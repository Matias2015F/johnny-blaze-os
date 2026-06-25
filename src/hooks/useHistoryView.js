import { useMemo, useState } from "react";
import jsQR from "jsqr";
import { getDocument } from "pdfjs-dist";
import { LS } from "../lib/storage.js";
import { validarComprobante } from "../lib/comprobante-validation.js";

// ── Utilidades de detección QR — privadas al módulo ──────────────────────────

function cargarImagenDesdeArchivo(file) {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(imageUrl); resolve(image); };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("No pudimos abrir esa imagen. Probá con una foto más nítida del QR."));
    };
    image.src = imageUrl;
  });
}

function detectarQRDesdeCanvas(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  try { ctx.imageSmoothingEnabled = false; } catch { /* ignore */ }
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const resultado = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: "attemptBoth",
  });
  if (!resultado?.data) throw new Error("No encontramos un código QR legible.");
  return resultado.data;
}

async function detectarQRDesdeImagen(file) {
  const image = await cargarImagenDesdeArchivo(file);
  const canvas = document.createElement("canvas");
  canvas.width  = image.naturalWidth  || image.width;
  canvas.height = image.naturalHeight || image.height;
  canvas.getContext("2d", { willReadFrequently: true }).drawImage(image, 0, 0, canvas.width, canvas.height);
  return detectarQRDesdeCanvas(canvas);
}

async function detectarQRDesdePdfRobusto(file) {
  const data = await file.arrayBuffer();
  const pdf   = await getDocument({ data }).promise;
  const pages  = Math.min(pdf.numPages, 15);
  const scales = [2.6, 3.2, 3.8];

  for (let p = 1; p <= pages; p += 1) {
    const page = await pdf.getPage(p);
    for (const scale of scales) {
      const vp     = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      const ctx    = canvas.getContext("2d", { willReadFrequently: true });
      canvas.width  = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      try { return detectarQRDesdeCanvas(canvas); } catch { /* try next scale */ }
    }
  }
  throw new Error("No encontramos un código QR dentro del PDF. Asegurate de subir el comprobante completo y no una captura recortada.");
}

// ── Utilidad de fecha de orden — lógica de dominio ───────────────────────────

function obtenerFechaOrden(order) {
  return (
    order?.fechaIngreso ||
    order?.fechaComprobante?.slice?.(0, 10) ||
    order?.fecha ||
    order?.createdAt ||
    ""
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useHistoryView({ orders, bikes, clients }) {
  const [search,           setSearch]           = useState("");
  const [qrInputValue,     setQrInputValue]     = useState("");
  const [validaciones,     setValidaciones]     = useState([]);
  const [validacionActual, setValidacionActual] = useState(null);
  const [scanFeedback,     setScanFeedback]     = useState("");
  const [scanLoading,      setScanLoading]      = useState(false);

  // ── Derivaciones ────────────────────────────────────────────────────────────

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byBike = new Map();

    orders.forEach((order) => {
      const bike   = bikes.find((b) => b.id === order.bikeId);
      const client = clients.find((c) => c.id === order.clientId);
      if (!bike) return;

      const match =
        !q ||
        (bike.patente || "").toLowerCase().includes(q) ||
        (client?.nombre || "").toLowerCase().includes(q) ||
        (order.numeroTrabajo || "").toLowerCase().includes(q) ||
        (order.numeroComprobante || "").toLowerCase().includes(q);

      if (!match) return;

      const current = byBike.get(bike.id) || {
        bike, client, orders: [],
        trabajos: 0, comprobantes: 0, repuestos: 0, gastos: 0,
        totalCobrado: 0, ultimaFecha: "",
      };

      current.orders.push(order);
      current.trabajos   += 1;
      current.comprobantes += order.numeroComprobante ? 1 : 0;
      current.repuestos  += (order.repuestos || []).length;
      current.gastos     += (order.insumos || []).length + (order.fletes || []).length;
      current.totalCobrado += order.total || 0;
      const f = obtenerFechaOrden(order);
      current.ultimaFecha = [current.ultimaFecha, f].filter(Boolean).sort().at(-1) || current.ultimaFecha;

      byBike.set(bike.id, current);
    });

    return Array.from(byBike.values())
      .sort((a, b) => (b.ultimaFecha || "").localeCompare(a.ultimaFecha || ""));
  }, [search, orders, bikes, clients]);

  const resultsGrouped = useMemo(() => {
    const groups = new Map();
    results.forEach((item) => {
      const key = (item.ultimaFecha || "").toString().slice(0, 7) || "Sin fecha";
      const arr = groups.get(key) || [];
      arr.push(item);
      groups.set(key, arr);
    });
    const keys = Array.from(groups.keys()).sort((a, b) => {
      if (a === "Sin fecha") return 1;
      if (b === "Sin fecha") return -1;
      return b.localeCompare(a);
    });
    return keys.map((k) => ({ key: k, items: groups.get(k) || [] }));
  }, [results]);

  const resumen = useMemo(() =>
    results.reduce((acc, item) => ({
      motos:       acc.motos       + 1,
      trabajos:    acc.trabajos    + item.trabajos,
      comprobantes: acc.comprobantes + item.comprobantes,
      repuestos:   acc.repuestos   + item.repuestos,
      gastos:      acc.gastos      + item.gastos,
    }), { motos: 0, trabajos: 0, comprobantes: 0, repuestos: 0, gastos: 0 }),
  [results]);

  const helperText = search.trim()
    ? `Encontramos ${resumen.motos} moto${resumen.motos === 1 ? "" : "s"} para "${search.trim()}"`
    : "Buscá por patente, cliente, número de trabajo o comprobante";

  // ── Procesamiento QR — dominio ───────────────────────────────────────────────

  const procesarQRData = (qrData) => {
    try {
      const { numeroComprobante, orderId } = qrData;
      const ordenOriginal = LS.getDoc("trabajos", orderId);

      if (!ordenOriginal) {
        setValidacionActual({ valido: false, razon: "No encontrada en registros", numeroComprobante, fecha: new Date().toISOString() });
        return;
      }

      const resultado  = validarComprobante(numeroComprobante, qrData, ordenOriginal);
      const validacion = { ...resultado, numeroComprobante, fecha: new Date().toISOString(), id: Date.now() };

      setValidacionActual(validacion);
      setValidaciones((prev) => [validacion, ...prev]);
      setQrInputValue("");
      setScanFeedback(resultado.valido ? "Comprobante validado correctamente." : "El comprobante no pasó la validación.");
    } catch (e) {
      setValidacionActual({ valido: false, razon: "Código QR inválido o corrupto: " + e.message, fecha: new Date().toISOString() });
      setScanFeedback("No pudimos interpretar el contenido del QR.");
    }
  };

  const procesarTextoQR = (rawValue) => {
    if (!rawValue?.trim()) throw new Error("No encontramos datos dentro del código QR.");

    setQrInputValue(rawValue);
    try {
      procesarQRData(JSON.parse(rawValue));
      return;
    } catch {
      const txt = rawValue.trim();
      if (/^https?:\/\//i.test(txt) || txt.startsWith("/verificar/")) {
        try {
          const url = txt.startsWith("/verificar/")
            ? new URL(txt, window.location.origin)
            : new URL(txt);
          if (url.pathname.startsWith("/verificar/")) {
            setScanFeedback("Abriendo verificación del comprobante...");
            window.location.assign(url.pathname + url.search + url.hash);
            return;
          }
        } catch { /* ignore */ }
      }
      throw new Error("Código QR inválido o corrupto.");
    }
  };

  const validarQR = () => {
    if (!qrInputValue.trim()) return;
    try {
      procesarTextoQR(qrInputValue);
    } catch (e) {
      const razon = e instanceof SyntaxError ? "JSON inválido" : e.message;
      setValidacionActual({ valido: false, razon, fecha: new Date().toISOString() });
      setScanFeedback("Revisá el contenido pegado e intentá de nuevo.");
    }
  };

  const manejarArchivoQR = async (file, origen) => {
    if (!file) return;
    setScanLoading(true);
    setScanFeedback(origen === "pdf" ? "Leyendo QR dentro del PDF..." : "Buscando QR en la imagen...");
    try {
      const rawValue = origen === "pdf"
        ? await detectarQRDesdePdfRobusto(file)
        : await detectarQRDesdeImagen(file);
      procesarTextoQR(rawValue);
    } catch (error) {
      setValidacionActual({ valido: false, razon: error.message, fecha: new Date().toISOString() });
      setScanFeedback(error.message);
    } finally {
      setScanLoading(false);
    }
  };

  // ── API pública ──────────────────────────────────────────────────────────────

  return {
    // Búsqueda
    search, setSearch, helperText,
    // Resultados
    results, resultsGrouped, resumen,
    // Validador QR
    qrInputValue, setQrInputValue,
    validaciones,
    validacionActual,
    scanFeedback, setScanFeedback,
    scanLoading, setScanLoading,
    validarQR,
    procesarTextoQR,
    manejarArchivoQR,
  };
}
