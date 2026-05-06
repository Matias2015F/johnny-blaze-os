import React, { useMemo, useState, useRef, useEffect } from "react";
import { ArrowLeft, ChevronRight, FileText, Search, User, Wrench, Camera, Check, AlertTriangle, X, Upload } from "lucide-react";
import { formatMoney } from "../utils/format.js";
import { validarComprobante } from "../lib/comprobante-validation.js";
import { LS } from "../lib/storage.js";
import { Html5Qrcode } from "html5-qrcode";

export default function HistoryView({ orders, bikes, clients, setView, setSelectedBikeId }) {
  const [search, setSearch] = useState("");
  const [validaciones, setValidaciones] = useState([]);
  const [qrInputValue, setQrInputValue] = useState("");
  const [validacionActual, setValidacionActual] = useState(null);
  const [modoEscaneo, setModoEscaneo] = useState(null); // "camara" | "archivo" | null
  const [camaraActiva, setCamaraActiva] = useState(false);
  const qrReaderRef = useRef(null);
  const fileInputRef = useRef(null);
  const html5QrcodeRef = useRef(null);

  useEffect(() => {
    return () => {
      if (html5QrcodeRef.current) {
        html5QrcodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  const procesarQRData = (qrData) => {
    try {
      const { numeroComprobante, orderId, hash } = qrData;

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
      setValidaciones([validacion, ...validaciones]);
      setQrInputValue("");
      setModoEscaneo(null);
      setCamaraActiva(false);

      if (html5QrcodeRef.current) {
        html5QrcodeRef.current.stop();
      }
    } catch (e) {
      setValidacionActual({
        valido: false,
        razon: "Código QR inválido o corrupto: " + e.message,
        fecha: new Date().toISOString()
      });
    }
  };

  const validarQR = () => {
    if (!qrInputValue.trim()) return;
    try {
      const qrData = JSON.parse(qrInputValue);
      procesarQRData(qrData);
    } catch (e) {
      setValidacionActual({
        valido: false,
        razon: "JSON inválido",
        fecha: new Date().toISOString()
      });
    }
  };

  const iniciarEscaneo = async () => {
    setModoEscaneo("camara");
    setCamaraActiva(true);

    try {
      const html5QrCode = new Html5Qrcode("qr-reader");
      html5QrcodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          try {
            const qrData = JSON.parse(decodedText);
            procesarQRData(qrData);
          } catch {
            // Reintentar si no es JSON válido
          }
        },
        (errorMessage) => {
          // Error silencioso de escaneo
        }
      );
    } catch (err) {
      setValidacionActual({
        valido: false,
        razon: "No se pudo acceder a la cámara: " + err.message,
        fecha: new Date().toISOString()
      });
      setCamaraActiva(false);
    }
  };

  const detenerEscaneo = async () => {
    if (html5QrcodeRef.current) {
      try {
        await html5QrcodeRef.current.stop();
      } catch (e) {
        console.error("Error deteniendo escáner:", e);
      }
    }
    setCamaraActiva(false);
    setModoEscaneo(null);
  };

  const cargarArchivo = (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    const lector = new FileReader();
    lector.onload = (evento) => {
      try {
        // Buscar el JSON en el contenido del archivo (simulado)
        const contenido = evento.target?.result;
        const match = contenido.match(/\{"numeroComprobante".*?"hash":"[^"]+"\}/);

        if (match) {
          const qrData = JSON.parse(match[0]);
          procesarQRData(qrData);
        } else {
          setValidacionActual({
            valido: false,
            razon: "No se encontró código QR válido en el archivo",
            fecha: new Date().toISOString()
          });
        }
      } catch (err) {
        setValidacionActual({
          valido: false,
          razon: "Error al procesar archivo: " + err.message,
          fecha: new Date().toISOString()
        });
      }
    };
    lector.readAsText(archivo);
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
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-500/20 p-2 rounded-xl">
              <Camera className="text-blue-400" size={18} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-300">Validar comprobante</p>
              <p className="text-[9px] font-bold text-slate-500">Escanea, carga PDF o pega código QR</p>
            </div>
          </div>

          {!camaraActiva ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={iniciarEscaneo}
                  className="py-3 rounded-xl bg-blue-600 text-white font-black uppercase text-xs hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Camera size={14} /> Cámara
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="py-3 rounded-xl bg-amber-600 text-white font-black uppercase text-xs hover:bg-amber-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Upload size={14} /> PDF
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt"
                onChange={cargarArchivo}
                className="hidden"
              />

              <div className="relative">
                <input
                  type="text"
                  placeholder='O pega el JSON aquí'
                  value={qrInputValue}
                  onChange={(e) => setQrInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && validarQR()}
                  className="w-full rounded-[1.75rem] border border-white/10 bg-black/20 p-3 font-mono text-xs text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
                />
              </div>
              <button
                onClick={validarQR}
                disabled={!qrInputValue.trim()}
                className="w-full py-3 rounded-2xl bg-blue-600 text-white font-black uppercase text-sm disabled:bg-slate-700 disabled:text-slate-400 transition-all active:scale-95"
              >
                Validar
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div id="qr-reader" className="rounded-xl overflow-hidden border-2 border-blue-500"></div>
              <button
                onClick={detenerEscaneo}
                className="w-full py-3 rounded-2xl bg-red-600 text-white font-black uppercase text-sm hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <X size={16} /> Cerrar cámara
              </button>
            </div>
          )}

          {validacionActual && (
            <div className={`mt-4 p-4 rounded-2xl border-2 ${
              validacionActual.valido
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              <div className="flex items-start gap-3">
                {validacionActual.valido ? (
                  <Check className="text-green-400 shrink-0 mt-1" size={18} />
                ) : (
                  <AlertTriangle className="text-red-400 shrink-0 mt-1" size={18} />
                )}
                <div className="min-w-0">
                  <p className={`text-[10px] font-black uppercase ${
                    validacionActual.valido ? 'text-green-300' : 'text-red-300'
                  }`}>
                    {validacionActual.razon}
                  </p>
                  {validacionActual.numeroComprobante && (
                    <p className="mt-1 text-[9px] text-slate-300">
                      Número: <span className="font-mono font-bold">{validacionActual.numeroComprobante}</span>
                    </p>
                  )}
                  {validacionActual.detalles && (
                    <div className="mt-2 text-[9px] text-slate-400 space-y-1">
                      <p>Cliente: {validacionActual.detalles.cliente?.nombre || 'N/A'}</p>
                      <p>Moto: {validacionActual.detalles.moto?.patente || 'N/A'}</p>
                      <p>Monto: {formatMoney(validacionActual.detalles.monto || 0)}</p>
                      <p>Fecha: {validacionActual.detalles.fecha?.slice(0, 10) || 'N/A'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {validaciones.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className="text-[9px] font-black uppercase text-slate-500 mb-2">Historial de validaciones</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {validaciones.slice(0, 5).map(v => (
                  <div key={v.id} className={`p-3 rounded-lg text-[9px] border ${
                    v.valido
                      ? 'bg-green-500/10 border-green-500/20 text-green-300'
                      : 'bg-red-500/10 border-red-500/20 text-red-300'
                  }`}>
                    <div className="flex items-center gap-2">
                      {v.valido ? <Check size={12} /> : <AlertTriangle size={12} />}
                      <span className="font-bold font-mono">{v.numeroComprobante?.slice(0, 15)}</span>
                      <span className="text-[8px]">{new Date(v.fecha).toLocaleTimeString('es-AR')}</span>
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
  );
}
