import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, FileText, Search, User, Wrench, Check, AlertTriangle, Camera, Upload, X } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import jsQR from "jsqr";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { formatMoney } from "../utils/format.js";
import { validarComprobante } from "../lib/comprobante-validation.js";
import { LS } from "../lib/storage.js";

GlobalWorkerOptions.workerSrc = pdfWorker;

function cargarImagenDesdeArchivo(file) {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("No pudimos abrir esa imagen. Probá con una foto más nítida del QR."));
    };
    image.src = imageUrl;
  });
}

function detectarQRDesdeCanvas(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const resultado = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: "attemptBoth",
  });

  if (!resultado?.data) {
    throw new Error("No encontramos un código QR legible.");
  }

  return resultado.data;
}

async function detectarQRDesdeImagen(file) {
  const image = await cargarImagenDesdeArchivo(file);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return detectarQRDesdeCanvas(canvas);
}

async function detectarQRDesdePdf(file) {
  const data = await file.arrayBuffer();
  const pdf = await getDocument({ data }).promise;
  const paginasARevisar = Math.min(pdf.numPages, 8);

  for (let pageNumber = 1; pageNumber <= paginasARevisar; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2.6 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    await page.render({ canvasContext: context, viewport }).promise;

    try {
      return detectarQRDesdeCanvas(canvas);
    } catch (error) {
      if (pageNumber === paginasARevisar) {
        throw new Error("No encontramos un código QR dentro del PDF. Asegurate de subir el comprobante completo y no una captura recortada.");
      }
    }
  }

  throw new Error("No encontramos un código QR dentro del PDF.");
}

export default function HistoryView({ orders, bikes, clients, setView, setSelectedBikeId }) {
  const [search, setSearch] = useState("");
  const [validaciones, setValidaciones] = useState([]);
  const [qrInputValue, setQrInputValue] = useState("");
  const [validacionActual, setValidacionActual] = useState(null);
  const [scanFeedback, setScanFeedback] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const pdfInputRef = useRef(null);
  const scannerRef = useRef(null);
  const scannerRegionId = "historial-comprobante-scanner";

  const procesarQRData = (qrData) => {
    try {
      const { numeroComprobante, orderId } = qrData;

      const ordenOriginal = LS.getDoc("trabajos", orderId);
      if (!ordenOriginal) {
        setValidacionActual({
          valido: false,
          razon: "No encontrada en registros",
          numeroComprobante,
          fecha: new Date().toISOString()
        });
        return;
      }

      const resultado = validarComprobante(numeroComprobante, qrData, ordenOriginal);
      const validacion = {
        ...resultado,
        numeroComprobante,
        fecha: new Date().toISOString(),
        id: Date.now()
      };

      setValidacionActual(validacion);
      setValidaciones((prev) => [validacion, ...prev]);
      setQrInputValue("");
      setScanFeedback(resultado.valido ? "Comprobante validado correctamente." : "El comprobante no pasó la validación.");
    } catch (e) {
      setValidacionActual({
        valido: false,
        razon: "Código QR inválido o corrupto: " + e.message,
        fecha: new Date().toISOString()
      });
      setScanFeedback("No pudimos interpretar el contenido del QR.");
    }
  };

  const procesarTextoQR = (rawValue) => {
    if (!rawValue?.trim()) {
      throw new Error("No encontramos datos dentro del código QR.");
    }

    setQrInputValue(rawValue);
    const qrData = JSON.parse(rawValue);
    procesarQRData(qrData);
  };

  const validarQR = () => {
    if (!qrInputValue.trim()) return;
    try {
      procesarTextoQR(qrInputValue);
    } catch (e) {
      const mensaje = e instanceof SyntaxError ? "JSON inválido" : e.message;
      setValidacionActual({
        valido: false,
        razon: mensaje,
        fecha: new Date().toISOString()
      });
      setScanFeedback("Revisá el contenido pegado e intentá de nuevo.");
    }
  };

  const cerrarScanner = async () => {
    setScannerOpen(false);
    setScannerReady(false);
    setScannerError("");
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
      }
      try {
        await scannerRef.current.clear();
      } catch {
      }
      scannerRef.current = null;
    }
  };

  useEffect(() => {
    if (!scannerOpen) return undefined;

    let cancelled = false;

    const iniciarScanner = async () => {
      setScannerError("");
      setScanFeedback("Apuntá la cámara al QR del comprobante.");
      try {
        const scanner = new Html5Qrcode(scannerRegionId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1,
          },
          async (decodedText) => {
            if (cancelled) return;
            setScanLoading(true);
            try {
              procesarTextoQR(decodedText);
              await cerrarScanner();
            } catch (error) {
              setValidacionActual({
                valido: false,
                razon: error instanceof SyntaxError ? "El QR no contiene un JSON válido." : error.message,
                fecha: new Date().toISOString()
              });
              setScanFeedback("El QR fue leído, pero el contenido no coincide con un comprobante válido.");
            } finally {
              setScanLoading(false);
            }
          },
          () => {}
        );
        if (!cancelled) {
          setScannerReady(true);
        }
      } catch (error) {
        if (!cancelled) {
          setScannerError("No pudimos iniciar la cámara en este dispositivo. Probá con el PDF o una imagen del comprobante.");
          setScanFeedback("No se pudo abrir el lector QR.");
        }
      }
    };

    iniciarScanner();

    return () => {
      cancelled = true;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {}).finally(() => {
          scannerRef.current?.clear().catch(() => {});
          scannerRef.current = null;
        });
      }
    };
  }, [scannerOpen]);

  const manejarArchivoQR = async (file, origen) => {
    if (!file) return;
    setScanLoading(true);
    setScanFeedback(origen === "pdf" ? "Leyendo QR dentro del PDF..." : "Buscando QR en la imagen...");

    try {
      const rawValue = origen === "pdf" ? await detectarQRDesdePdf(file) : await detectarQRDesdeImagen(file);
      procesarTextoQR(rawValue);
    } catch (error) {
      setValidacionActual({
        valido: false,
        razon: error.message,
        fecha: new Date().toISOString()
      });
      setScanFeedback(error.message);
    } finally {
      setScanLoading(false);
    }
  };

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];

    const byBike = new Map();

    orders.forEach((order) => {
      const bike = bikes.find((item) => item.id === order.bikeId);
      const client = clients.find((item) => item.id === order.clientId);
      const patente = bike?.patente || "";
      const cliente = client?.nombre || "";
      const numeroTrabajo = order?.numeroTrabajo || "";
      const numeroComprobante = order?.numeroComprobante || "";

      const match =
        patente.toLowerCase().includes(q) ||
        cliente.toLowerCase().includes(q) ||
        numeroTrabajo.toLowerCase().includes(q) ||
        numeroComprobante.toLowerCase().includes(q);

      if (!match || !bike) return;

      const current = byBike.get(bike.id) || {
        bike,
        client,
        orders: [],
        trabajos: 0,
        comprobantes: 0,
        repuestos: 0,
        gastos: 0,
        totalCobrado: 0,
        ultimaFecha: "",
      };

      current.orders.push(order);
      current.trabajos += 1;
      current.comprobantes += order.numeroComprobante ? 1 : 0;
      current.repuestos += (order.repuestos || []).length;
      current.gastos += (order.insumos || []).length + (order.fletes || []).length;
      current.totalCobrado += order.total || 0;
      current.ultimaFecha = [current.ultimaFecha, order.fecha].filter(Boolean).sort().at(-1) || current.ultimaFecha;

      byBike.set(bike.id, current);
    });

    return Array.from(byBike.values()).sort((a, b) => (b.ultimaFecha || "").localeCompare(a.ultimaFecha || ""));
  }, [search, orders, bikes, clients]);

  const resumen = useMemo(() => {
    return results.reduce(
      (acc, item) => {
        acc.motos += 1;
        acc.trabajos += item.trabajos;
        acc.comprobantes += item.comprobantes;
        acc.repuestos += item.repuestos;
        acc.gastos += item.gastos;
        return acc;
      },
      { motos: 0, trabajos: 0, comprobantes: 0, repuestos: 0, gastos: 0 }
    );
  }, [results]);

  const helperText = search.trim()
    ? `Encontramos ${resumen.motos} moto${resumen.motos === 1 ? "" : "s"} para "${search.trim()}"`
    : "Buscá por patente, cliente, número de trabajo o comprobante";

  return (
    <>
      <div className="animate-in slide-in-from-right duration-300 space-y-4 pb-28 text-left">
        <div className="sticky top-0 z-40 rounded-b-[2.5rem] bg-slate-950 px-4 pb-5 pt-4 shadow-lg">
          <div className="rounded-[2rem] border border-white/10 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setView("home")}
                className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white active:scale-90"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Historial</p>
                <h2 className="mt-1 text-xl font-black uppercase tracking-widest text-white">Buscar y revisar</h2>
                <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Patente, cliente, trabajo o comprobante
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-4">
          <div className="rounded-[2.5rem] border border-slate-800 bg-slate-900 p-5 shadow-xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                placeholder="Buscar patente, cliente, trabajo o comprobante"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-[1.75rem] border border-white/10 bg-black/20 p-5 pl-12 font-black text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
              />
            </div>
            <p className="mt-3 px-1 text-[10px] font-black uppercase tracking-widest text-slate-500">{helperText}</p>
          </div>

          <div className="rounded-[2.5rem] border border-slate-800 bg-slate-900 p-5 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-blue-500/20 p-2">
                <Check className="text-blue-400" size={18} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-300">Validar comprobante</p>
                <p className="text-[9px] font-bold text-slate-500">Pegá el JSON, escaneá el QR en vivo o abrí el PDF desde el dispositivo</p>
              </div>
            </div>

            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const esPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
                manejarArchivoQR(file, esPdf ? "pdf" : "imagen");
                e.target.value = "";
              }}
            />

            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  onClick={() => setScannerOpen(true)}
                  disabled={scanLoading || scannerOpen}
                  className="flex items-center justify-center gap-2 rounded-[1.5rem] border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-[11px] font-black uppercase text-blue-200 transition-all disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500 active:scale-95"
                >
                  <Camera size={16} /> Escanear con cámara
                </button>
                <button
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={scanLoading}
                  className="flex items-center justify-center gap-2 rounded-[1.5rem] border border-white/10 bg-black/20 px-4 py-3 text-[11px] font-black uppercase text-white transition-all disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-500 active:scale-95"
                >
                  <Upload size={16} /> Abrir PDF o imagen
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Pegá el JSON del QR aquí"
                  value={qrInputValue}
                  onChange={(e) => setQrInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && validarQR()}
                  className="w-full rounded-[1.75rem] border border-white/10 bg-black/20 p-3 font-mono text-xs text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
                />
              </div>
              <button
                onClick={validarQR}
                disabled={!qrInputValue.trim() || scanLoading}
                className="w-full rounded-2xl bg-blue-600 py-3 text-sm font-black uppercase text-white transition-all disabled:bg-slate-700 disabled:text-slate-400 active:scale-95"
              >
                {scanLoading ? "Procesando..." : "Validar"}
              </button>
            </div>

            <p className="mt-3 text-[9px] font-bold text-slate-500">
              La cámara ahora funciona como lector en vivo. Si ya tenés el comprobante, también podés subir el PDF o una imagen del QR.
            </p>

            {scanFeedback && (
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-[10px] font-bold text-slate-300">
                {scanFeedback}
              </div>
            )}

            {validacionActual && (
              <div className={`mt-4 rounded-2xl border-2 p-4 ${
                validacionActual.valido
                  ? "border-green-500/30 bg-green-500/10"
                  : "border-red-500/30 bg-red-500/10"
              }`}>
                <div className="flex items-start gap-3">
                  {validacionActual.valido ? (
                    <Check className="mt-1 shrink-0 text-green-400" size={18} />
                  ) : (
                    <AlertTriangle className="mt-1 shrink-0 text-red-400" size={18} />
                  )}
                  <div className="min-w-0">
                    <p className={`text-[10px] font-black uppercase ${
                      validacionActual.valido ? "text-green-300" : "text-red-300"
                    }`}>
                      {validacionActual.razon}
                    </p>
                    {validacionActual.numeroComprobante && (
                      <p className="mt-1 text-[9px] text-slate-300">
                        Número: <span className="font-mono font-bold">{validacionActual.numeroComprobante}</span>
                      </p>
                    )}
                    {validacionActual.detalles && (
                      <div className="mt-2 space-y-1 text-[9px] text-slate-400">
                        <p>Cliente: {validacionActual.detalles.cliente?.nombre || "N/A"}</p>
                        <p>Moto: {validacionActual.detalles.moto?.patente || "N/A"}</p>
                        <p>Monto: {formatMoney(validacionActual.detalles.monto || 0)}</p>
                        <p>Fecha: {validacionActual.detalles.fecha?.slice(0, 10) || "N/A"}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {validaciones.length > 0 && (
              <div className="mt-4 border-t border-slate-700 pt-4">
                <p className="mb-2 text-[9px] font-black uppercase text-slate-500">Historial de validaciones</p>
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {validaciones.slice(0, 5).map((v) => (
                    <div key={v.id} className={`rounded-lg border p-3 text-[9px] ${
                      v.valido
                        ? "border-green-500/20 bg-green-500/10 text-green-300"
                        : "border-red-500/20 bg-red-500/10 text-red-300"
                    }`}>
                      <div className="flex items-center gap-2">
                        {v.valido ? <Check size={12} /> : <AlertTriangle size={12} />}
                        <span className="font-mono font-bold">{v.numeroComprobante?.slice(0, 15)}</span>
                        <span className="text-[8px]">{new Date(v.fecha).toLocaleTimeString("es-AR")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {search.trim() && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900 p-4 shadow-xl">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Motos encontradas</p>
                <p className="mt-2 text-2xl font-black text-white">{resumen.motos}</p>
              </div>
              <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900 p-4 shadow-xl">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Trabajos relacionados</p>
                <p className="mt-2 text-2xl font-black text-white">{resumen.trabajos}</p>
              </div>
              <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900 p-4 shadow-xl">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Comprobantes</p>
                <p className="mt-2 text-2xl font-black text-white">{resumen.comprobantes}</p>
              </div>
              <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900 p-4 shadow-xl">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Repuestos y gastos</p>
                <p className="mt-2 text-2xl font-black text-white">{resumen.repuestos + resumen.gastos}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {results.length > 0 ? (
              results.map((item) => (
                <button
                  key={item.bike.id}
                  onClick={() => {
                    setSelectedBikeId(item.bike.id);
                    setView("perfilMoto");
                  }}
                  className="w-full rounded-[2.5rem] border border-slate-800 bg-slate-900 p-5 text-left shadow-xl transition-all active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-3xl font-black leading-none text-white">{item.bike.patente}</p>
                      <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {item.bike.marca} {item.bike.modelo} {item.bike.cilindrada ? `· ${item.bike.cilindrada}cc` : ""}
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-[11px] font-black text-slate-300">
                        <User size={14} className="text-slate-500" />
                        <span className="truncate uppercase">{item.client?.nombre || "Cliente sin nombre"}</span>
                      </div>
                    </div>
                    <ChevronRight size={24} className="shrink-0 text-slate-600" />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-[1.25rem] border border-white/5 bg-black/20 px-3 py-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Trabajos</p>
                      <p className="mt-1 text-lg font-black text-white">{item.trabajos}</p>
                    </div>
                    <div className="rounded-[1.25rem] border border-white/5 bg-black/20 px-3 py-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Comprobantes</p>
                      <p className="mt-1 text-lg font-black text-white">{item.comprobantes}</p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2 rounded-[1.5rem] border border-white/5 bg-black/20 p-3">
                    <div className="flex items-center justify-between text-[11px] font-black">
                      <span className="flex items-center gap-2 text-slate-400">
                        <Wrench size={14} className="text-blue-400" />
                        Repuestos usados
                      </span>
                      <span className="text-white">{item.repuestos}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-black">
                      <span className="flex items-center gap-2 text-slate-400">
                        <FileText size={14} className="text-orange-400" />
                        Gastos e insumos
                      </span>
                      <span className="text-white">{item.gastos}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/10 pt-2 text-[11px] font-black">
                      <span className="text-slate-400">Total histórico</span>
                      <span className="text-white">{formatMoney(item.totalCobrado)}</span>
                    </div>
                  </div>

                  {item.orders[0] && (
                    <div className="mt-3 rounded-[1.5rem] border border-blue-500/20 bg-blue-500/10 px-3 py-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-blue-300">Último movimiento</p>
                      <p className="mt-1 text-[11px] font-black uppercase text-white">
                        {item.orders[0].numeroComprobante
                          ? `Comprobante ${item.orders[0].numeroComprobante}`
                          : item.orders[0].numeroTrabajo || "Trabajo sin número"}
                      </p>
                    </div>
                  )}
                </button>
              ))
            ) : (
              <div className="rounded-[2.5rem] border border-dashed border-slate-700 bg-slate-900 px-6 py-16 text-center shadow-xl">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  {search.trim()
                    ? "No encontramos resultados con esa búsqueda"
                    : "Escribí patente, cliente, trabajo o comprobante para ver el historial"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {scannerOpen && (
        <div className="fixed inset-0 z-[90] flex items-end bg-slate-950/90 p-4 backdrop-blur-sm sm:items-center sm:justify-center">
          <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-900 p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Lector QR</p>
                <p className="mt-1 text-sm font-black uppercase text-white">Escaneá el comprobante</p>
              </div>
              <button
                onClick={cerrarScanner}
                className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white active:scale-95"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/40 p-3">
              <div id={scannerRegionId} className="min-h-[320px] rounded-[1.25rem] bg-slate-950" />
            </div>

            <div className="mt-3 space-y-2">
              <p className="text-[10px] font-bold text-slate-300">
                {scannerReady ? "Apuntá el QR al centro del recuadro." : "Preparando cámara..."}
              </p>
              {scannerError && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[10px] font-bold text-red-200">
                  {scannerError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
