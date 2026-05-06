import React, { useState, useEffect, lazy, Suspense } from "react";
import { auth } from "./firebase.js";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { Wrench, Clock, History, Settings, DollarSign, HelpCircle, RefreshCw } from "lucide-react";

import { LS, useCollection, generateId, migrateFromLocalStorage, migrateRenamedCollections, clearFirestoreData, useSyncStatus } from "./lib/storage.js";
import { autoCloudBackup } from "./lib/cloudBackup.js";
import { CONFIG_DEFAULT, hoyEstable } from "./lib/constants.js";
import { APP_BUILD } from "./generated/appVersion.js";
import { applyRemoteUpdate, bindInstallPromptCapture, canPromptInstall, fetchRemoteVersion, getDisplayModeInfo, isNewerBuild, promptInstallApp } from "./lib/appUpdate.js";
import { ensureAccountProfile, trackEvent } from "./lib/telemetry.js";

// HomeView se carga de forma eager — es la pantalla inicial
import HomeView from "./views/HomeView.jsx";

// El resto se carga bajo demanda (code splitting) y reduce el bundle inicial
const OrderListView  = lazy(() => import("./views/OrderListView.jsx"));
const NewOrderView   = lazy(() => import("./views/NewOrderView.jsx"));
const ConfigView     = lazy(() => import("./views/ConfigView.jsx"));
const HistoryView    = lazy(() => import("./views/HistoryView.jsx"));
const BikeProfileView= lazy(() => import("./views/BikeProfileView.jsx"));
const PreciosView    = lazy(() => import("./views/PreciosView.jsx"));
const OrderDetailView= lazy(() => import("./components/OrderDetailView.jsx"));
const TaskManagerView= lazy(() => import("./components/TaskManagerView.jsx"));
const LogisticsView  = lazy(() => import("./components/LogisticsView.jsx"));
const PaymentView    = lazy(() => import("./components/PaymentView.jsx"));
const PagosView      = lazy(() => import("./views/PagosView.jsx"));
const PrePdfView     = lazy(() => import("./components/PrePdfView.jsx"));
const ExportPdfView  = lazy(() => import("./components/ExportPdfView.jsx"));
const EsperandoAprobacionView = lazy(() => import("./views/EsperandoAprobacionView.jsx"));
const EjecucionView           = lazy(() => import("./views/EjecucionView.jsx"));
const FinalizacionView        = lazy(() => import("./views/FinalizacionView.jsx"));
const PagoView                = lazy(() => import("./views/PagoView.jsx"));
const RetiroView              = lazy(() => import("./views/RetiroView.jsx"));
const AgendaView              = lazy(() => import("./views/AgendaView.jsx"));

const Cargando = () => (
  <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-slate-600 text-[10px] font-black uppercase tracking-widest">
    Cargando...
  </div>
);

class ChunkErrorBoundary extends React.Component {
  componentDidCatch(error) {
    if (error?.name === "ChunkLoadError" || error?.message?.includes("dynamically imported module")) {
      window.location.reload();
    }
  }
  render() {
    return this.props.children;
  }
}

const NAV_VIEWS = ["home", "ordenes", "historial", "pagosView", "config"];
const HELP_CONTENT = {
  home: {
    titulo: "Ayuda de Inicio",
    items: [
      "Usa Nuevo ingreso para cargar una moto al taller.",
      "Trabajos activos muestra lo que hoy esta en movimiento.",
      "Proximos service te avisa cuando conviene contactar al cliente.",
    ],
  },
  ordenes: {
    titulo: "Ayuda de Trabajos",
    items: [
      "Toca una tarjeta para abrir el detalle completo del trabajo.",
      "El estado te dice en que parte del flujo esta cada moto.",
      "Si necesitas cobrar o emitir comprobante, entra al detalle.",
    ],
  },
  historial: {
    titulo: "Ayuda de Historial",
    items: [
      "Busca por patente, cliente, numero de trabajo o comprobante.",
      "Entrando a una moto ves trabajos anteriores, repuestos y gastos.",
      "Te sirve para no repetir cargas y tomar referencias reales.",
    ],
  },
  pagosView: {
    titulo: "Ayuda de Pagos",
    items: [
      "Primero revisa el saldo pendiente.",
      "Entra a un trabajo para registrar pago total o parcial.",
      "Cuando el saldo llega a cero, ya podes emitir comprobante.",
    ],
  },
  config: {
    titulo: "Ayuda de Configuracion",
    items: [
      "Aca ajustas datos del taller, alertas y copias de seguridad.",
      "Modo prueba sirve para validar recordatorios rapido.",
      "Alertas del navegador deben quedar permitidas para avisos reales.",
    ],
  },
};

function getInstallGuide() {
  if (typeof window === "undefined") {
    return { platform: "generic", title: "Instala la app", steps: [] };
  }

  const ua = window.navigator.userAgent || "";
  const isiPhone = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);

  if (isiPhone) {
    return {
      platform: "ios",
      title: "Instalar en iPhone o iPad",
      steps: [
        { title: "Abri Safari", detail: "Esta instalacion en iPhone funciona desde Safari." },
        { title: "Toca Compartir", detail: "Busca el boton Compartir abajo o arriba del navegador." },
        { title: "Agregala al inicio", detail: "Elegi Agregar a pantalla de inicio y confirma Agregar." },
      ],
    };
  }

  if (isAndroid) {
    return {
      platform: "android",
      title: "Instalar en Android",
      steps: [
        { title: "Proba instalar desde aca", detail: "Toca Instalar app si el boton esta habilitado." },
        { title: "Abri el menu", detail: "Si no aparece, abri el menu de Chrome." },
        { title: "Confirma la instalacion", detail: "Elegi Instalar aplicacion o Agregar a pantalla principal." },
      ],
    };
  }

  return {
    platform: "desktop",
    title: "Instalar en PC",
    steps: [
      { title: "Proba instalar desde aca", detail: "Toca Instalar app si el boton esta habilitado." },
      { title: "Abri el menu del navegador", detail: "Si no aparece, usa el menu de Chrome o Edge." },
      { title: "Instalala como app", detail: "Busca Instalar aplicacion o Apps y confirma." },
    ],
  };
}

export default function TallerPanel() {
  const [view, setView] = useState("home");
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedBikeId, setSelectedBikeId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [confirm, setConfirm] = useState(null); // { mensaje, onOk }

  const showConfirm = (mensaje, onOk) => setConfirm({ mensaje, onOk });
  const [prefillData, setPrefillData] = useState(null);
  const [serviceToEdit, setServiceToEdit] = useState(null);
  const [finalPdfData, setFinalPdfData] = useState({ garantia: "" });
  const [showHelp, setShowHelp] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [installAvailable, setInstallAvailable] = useState(false);
  const [selectedInstallPlatform, setSelectedInstallPlatform] = useState("auto");

  const clients       = useCollection("clientes");
  const bikes         = useCollection("motos");
  const orders        = useCollection("trabajos");
  const titularidades = useCollection("titularidades");
  useCollection("config");

  const syncStatus = useSyncStatus();

  const showToast = (msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(null), 2500); };
  const handleLogout = async () => { try { await signOut(auth); } catch (e) { console.error(e); } };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        setView("home");
        ensureAccountProfile().catch(console.error);
        trackEvent("login", { screen: "auth", entityType: "account", entityId: u.uid }).catch(console.error);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const openConfig = () => setView("config");
    window.addEventListener("jbos-open-config", openConfig);
    return () => window.removeEventListener("jbos-open-config", openConfig);
  }, []);

  useEffect(() => {
    let alive = true;

    const checkForUpdates = async () => {
      try {
        const remote = await fetchRemoteVersion();
        if (!alive) return;
        if (isNewerBuild(APP_BUILD, remote)) {
          setUpdateInfo(remote);
        }
      } catch (e) {
        console.error(e);
      }
    };

    checkForUpdates();
    const intervalId = setInterval(checkForUpdates, 5 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") checkForUpdates();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    const unbind = bindInstallPromptCapture();
    const syncInstallState = () => setInstallAvailable(canPromptInstall());
    syncInstallState();
    window.addEventListener("jbos-install-available", syncInstallState);
    return () => {
      if (typeof unbind === "function") unbind();
      window.removeEventListener("jbos-install-available", syncInstallState);
    };
  }, []);

  // Migracion localStorage -> Firestore y backup automatico diario
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    migrateRenamedCollections(uid)
      .then((n) => { if (n > 0) showToast(`Estructura actualizada (${n} registros migrados) ?`); })
      .catch(console.error);
    migrateFromLocalStorage(uid)
      .then((n) => { if (n > 0) showToast(`Datos sincronizados (${n} registros) ?`); })
      .catch(console.error);
    autoCloudBackup(uid).catch(console.error);
  }, []);

  // -- Crear orden nueva ------------------------------------------------------
  const handleCreateOrder = (payload) => {
    const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;
    const kmActual = Number(payload.km);

    // Cliente
    const ec = clients.find(
      (c) => c.nombre?.trim().toLowerCase() === payload.nombre?.trim().toLowerCase() && c.tel === payload.tel
    );
    const clientId = ec ? ec.id : LS.addDoc("clientes", {
      nombre: payload.nombre,
      tel: payload.tel,
      telefono: payload.tel,
      whatsapp: payload.tel,
      etiquetas: [],
      activo: true,
      createdAt: Date.now(),
    }).id;

    // Moto
    const eb = bikes.find((b) => b.patente === payload.patente.toUpperCase());
    let bikeId;
    if (eb) {
      bikeId = eb.id;
      LS.updateDoc("motos", bikeId, {
        km: kmActual,
        kilometrajeActual: kmActual,
        clienteId: clientId,
        ultimaVisita: hoyEstable(),
        proximoService: kmActual + (config.offsetServiceKm || 2500),
      });
    } else {
      bikeId = LS.addDoc("motos", {
        patente: payload.patente.toUpperCase(),
        patenteNormalizada: payload.patente.toUpperCase(),
        marca: payload.marca,
        modelo: payload.modelo,
        cilindrada: Number(payload.cilindrada),
        anio: null,
        color: null,
        estado: "activa",
        km: kmActual,
        kilometrajeActual: kmActual,
        clienteId: clientId,
        ultimaVisita: hoyEstable(),
        proximoService: kmActual + (config.offsetServiceKm || 2500),
        createdAt: Date.now(),
      }).id;
    }

    // Titularidad: relación histórica cliente ? moto
    const titActual = titularidades.find(t => t.motoId === bikeId && t.titularActual === true);
    if (!titActual || titActual.clienteId !== clientId) {
      if (titActual) {
        LS.updateDoc("titularidades", titActual.id, { titularActual: false, fechaHasta: hoyEstable() });
      }
      LS.addDoc("titularidades", {
        clienteId: clientId,
        motoId: bikeId,
        fechaDesde: hoyEstable(),
        fechaHasta: null,
        titularActual: true,
        createdAt: Date.now(),
      });
    }

    const numeroTrabajo = `OT-${String(orders.length + 1).padStart(6, "0")}`;
    const orden = LS.addDoc("trabajos", {
      numeroTrabajo,
      clientId, bikeId,
      estado: "diagnostico",
      prioridad: "normal",
      fechaIngreso: hoyEstable(),
      fechaEntrega: null,
      motivoIngreso: payload.falla,
      diagnostico: payload.falla,
      km: kmActual,
      kmIngreso: kmActual,
      kmEntrega: null,
      total: 0,
      pagos: [], tareas: [], repuestos: [], insumos: [], fletes: [],
      margen: 0, costoInterno: 0,
      observacionesProxima: "",
      pdfEntregado: false,
      tiempoReal: 0,
      cronometroActivo: false,
      inicioCronometro: null,
      maxAutorizado: 0,
      createdAt: Date.now(),
    });

    setSelectedOrderId(orden.id);
    setPrefillData(null);
    setView("detalleOrden");
    trackEvent("crear_trabajo", {
      screen: "nuevaOrden",
      entityType: "trabajo",
      entityId: orden.id,
      metadata: {
        marca: payload.marca,
        modelo: payload.modelo,
        cilindrada: Number(payload.cilindrada || 0),
        patente: payload.patente?.toUpperCase?.() || "",
      },
    }).catch(console.error);
    showToast("Orden abierta");
  };

  const handleStartNewService = (bike, client) => {
    setPrefillData({ bike, client });
    setView("nuevaOrden");
  };

  // -- Demo / Reset -----------------------------------------------------------
  const loadDemoData = () => {
    const hoy = hoyEstable();

    // Moto 1 — Juan García / Honda Wave 110
    const c1 = LS.addDoc("clientes", { nombre: "Juan García", tel: "3434123456", telefono: "3434123456", whatsapp: "3434123456", etiquetas: [], activo: true, createdAt: Date.now() });
    const b1 = LS.addDoc("motos", { patente: "ABC123", patenteNormalizada: "ABC123", marca: "Honda", modelo: "Wave 110", cilindrada: 110, km: 15400, kilometrajeActual: 15400, estado: "activa", clienteId: c1.id, ultimaVisita: hoy, proximoService: 17500, createdAt: Date.now() });
    LS.addDoc("titularidades", { clienteId: c1.id, motoId: b1.id, fechaDesde: hoy, fechaHasta: null, titularActual: true, createdAt: Date.now() });
    LS.addDoc("trabajos", {
      numeroTrabajo: "OT-000001",
      clientId: c1.id, bikeId: b1.id, estado: "reparacion", prioridad: "normal",
      fechaIngreso: hoy, fechaEntrega: null, total: 45000,
      pagos: [],
      tareas: [{ nombre: "Cambio de aceite y filtro", monto: 18000, horasBase: 0.5 }],
      repuestos: [{ nombre: "Aceite 10W40", monto: 12000, cantidad: 1 }, { nombre: "Filtro de aceite", monto: 8000, cantidad: 1 }],
      insumos: [], fletes: [], km: 15400, kmIngreso: 15400, kmEntrega: null,
      motivoIngreso: "Service periódico y revisión general.",
      diagnostico: "Service periódico y revisión general.",
      observacionesProxima: "Próximo service a los 17500 km.",
      pdfEntregado: false, createdAt: Date.now(),
    });

    // Moto 2 — María López / Yamaha FZ 16
    const c2 = LS.addDoc("clientes", { nombre: "María López", tel: "3434654321", telefono: "3434654321", whatsapp: "3434654321", etiquetas: [], activo: true, createdAt: Date.now() });
    const b2 = LS.addDoc("motos", { patente: "XYZ789", patenteNormalizada: "XYZ789", marca: "Yamaha", modelo: "FZ 16", cilindrada: 160, km: 8920, kilometrajeActual: 8920, estado: "activa", clienteId: c2.id, ultimaVisita: hoy, proximoService: 11000, createdAt: Date.now() });
    LS.addDoc("titularidades", { clienteId: c2.id, motoId: b2.id, fechaDesde: hoy, fechaHasta: null, titularActual: true, createdAt: Date.now() });
    LS.addDoc("trabajos", {
      numeroTrabajo: "OT-000002",
      clientId: c2.id, bikeId: b2.id, estado: "diagnostico", prioridad: "alta",
      fechaIngreso: hoy, fechaEntrega: null, total: 0,
      pagos: [], tareas: [], repuestos: [], insumos: [], fletes: [],
      km: 8920, kmIngreso: 8920, kmEntrega: null,
      motivoIngreso: "Frenos traseros con poco tacto, revisar pastillas.",
      diagnostico: "Frenos traseros con poco tacto, revisar pastillas.",
      observacionesProxima: "",
      pdfEntregado: false, createdAt: Date.now(),
    });

    showToast("Demo cargado ✓");
  };

  const clearAllData = () => {
    showConfirm("¿Borrar todos los datos? Esta accion no se puede deshacer.", async () => {
      const uid = auth.currentUser?.uid;
      if (uid) await clearFirestoreData(uid);
      localStorage.removeItem("jbos_fs_migrated_v1");
      window.location.reload();
    });
  };

  // -- Datos derivados --------------------------------------------------------
  const selectedOrder = orders.find((o) => o.id === selectedOrderId);
  const helpInfo = HELP_CONTENT[view] || null;
  const displayMode = getDisplayModeInfo();
  const installGuide = getInstallGuide();
  const activeInstallGuide =
    selectedInstallPlatform === "ios"
      ? {
          platform: "ios",
          title: "Instalar en iPhone o iPad",
          steps: [
            { title: "Abri Safari", detail: "Esta instalacion en iPhone funciona desde Safari." },
            { title: "Toca Compartir", detail: "Busca el boton Compartir abajo o arriba del navegador." },
            { title: "Agregala al inicio", detail: "Elegi Agregar a pantalla de inicio y confirma Agregar." },
          ],
        }
      : selectedInstallPlatform === "android"
        ? {
            platform: "android",
            title: "Instalar en Android",
            steps: [
              { title: "Proba instalar desde aca", detail: "Toca Instalar app si el boton esta habilitado." },
              { title: "Abri el menu", detail: "Si no aparece, abri el menu de Chrome." },
              { title: "Confirma la instalacion", detail: "Elegi Instalar aplicacion o Agregar a pantalla principal." },
            ],
          }
        : selectedInstallPlatform === "desktop"
          ? {
              platform: "desktop",
              title: "Instalar en PC",
              steps: [
                { title: "Proba instalar desde aca", detail: "Toca Instalar app si el boton esta habilitado." },
                { title: "Abri el menu del navegador", detail: "Si no aparece, usa el menu de Chrome o Edge." },
                { title: "Instalala como app", detail: "Busca Instalar aplicacion o Apps y confirma." },
              ],
            }
          : installGuide;
  const stats = {
    activas: orders.filter((o) => o.estado !== "cerrado_emitido").length,
    hoy: orders.filter((o) => o.fechaIngreso === hoyEstable()).length,
  };

  const aplicarActualizacion = async () => {
    try {
      const remote = await fetchRemoteVersion();
      await applyRemoteUpdate(remote);
    } catch (e) {
      console.error(e);
      window.location.reload();
    }
  };

  const instalarDesdeAyuda = async () => {
    const result = await promptInstallApp();
    if (result?.ok) {
      showToast("Instalacion iniciada");
      return;
    }
    if (installGuide.platform === "ios") {
      showToast("En iPhone usa Safari y Agregar a pantalla de inicio");
      return;
    }
    showToast("El instalador no esta disponible ahora");
  };

  const copiarEnlaceApp = async () => {
    try {
      const url = window.location.origin;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        showToast("Enlace copiado");
        return;
      }
      showToast("No se pudo copiar el enlace");
    } catch (error) {
      console.error(error);
      showToast("No se pudo copiar el enlace");
    }
  };

  const compartirDesdeAyuda = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Johnny Blaze OS",
          text: "Abri esta app y agregala a tu pantalla de inicio.",
          url: window.location.origin,
        });
        showToast("Se abrio compartir");
        return;
      }
      await copiarEnlaceApp();
    } catch (error) {
      console.error(error);
      showToast("No se pudo abrir compartir");
    }
  };

  // -- Render -----------------------------------------------------------------
  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#0A0A0A] relative text-left selection:bg-blue-500 overflow-x-hidden font-bold">

      <ChunkErrorBoundary>
      <Suspense fallback={<Cargando />}>
      {view === "home" && <HomeView stats={stats} setView={setView} bikes={bikes} orders={orders} setSelectedOrderId={setSelectedOrderId} handleLogout={handleLogout} />}
      {view === "nuevaOrden" && <NewOrderView handleCreateAll={handleCreateOrder} setView={setView} prefill={prefillData} bikes={bikes} clients={clients} />}
      {view === "ordenes" && <OrderListView orders={orders} bikes={bikes} clients={clients} setSelectedOrderId={setSelectedOrderId} setView={setView} />}
      {view === "detalleOrden" && selectedOrder && <OrderDetailView order={selectedOrder} clients={clients} bikes={bikes} setView={setView} showToast={showToast} setServiceToEdit={setServiceToEdit} />}
      {view === "gestionarTareas" && selectedOrder && <TaskManagerView order={selectedOrder} setView={setView} showToast={showToast} serviceToEdit={serviceToEdit} setServiceToEdit={setServiceToEdit} />}
      {view === "logistica" && selectedOrder && <LogisticsView order={selectedOrder} setView={setView} showToast={showToast} />}
      {view === "pagos" && selectedOrder && <PaymentView order={selectedOrder} setView={setView} showToast={showToast} />}
      {view === "pagosView" && <PagosView orders={orders} bikes={bikes} clients={clients} setSelectedOrderId={setSelectedOrderId} setView={setView} />}
      {view === "prePdf" && selectedOrder && <PrePdfView order={selectedOrder} setView={setView} setFinalPdfData={setFinalPdfData} />}
      {view === "imprimirOrden" && selectedOrder && (
        <ExportPdfView
          order={selectedOrder}
          bike={bikes.find((b) => b.id === selectedOrder.bikeId)}
          client={clients.find((c) => c.id === selectedOrder.clientId)}
          setView={setView}
          extraData={finalPdfData}
        />
      )}
      {view === "precios" && <PreciosView setView={setView} />}
      {view === "config" && <ConfigView setView={setView} showToast={showToast} orders={orders} bikes={bikes} clients={clients} handleLogout={handleLogout} loadDemoData={loadDemoData} clearAllData={clearAllData} />}
      {view === "agenda" && <AgendaView setView={setView} />}
      {view === "esperandoAprobacion" && selectedOrderId && <EsperandoAprobacionView ordenId={selectedOrderId} setView={setView} />}
      {view === "ejecucion" && selectedOrderId && <EjecucionView ordenId={selectedOrderId} setView={setView} />}
      {view === "finalizacion" && selectedOrderId && <FinalizacionView ordenId={selectedOrderId} setView={setView} />}
      {view === "pago" && selectedOrderId && <PagoView ordenId={selectedOrderId} setView={setView} />}
      {view === "retiro" && selectedOrderId && <RetiroView ordenId={selectedOrderId} setView={setView} />}
      {view === "historial" && <HistoryView orders={orders} bikes={bikes} clients={clients} setView={setView} setSelectedBikeId={setSelectedBikeId} />}
      {view === "perfilMoto" && <BikeProfileView bikeId={selectedBikeId} orders={orders} bikes={bikes} clients={clients} setView={setView} handleStartNewService={handleStartNewService} />}
      </Suspense>
      </ChunkErrorBoundary>

      {NAV_VIEWS.includes(view) && helpInfo && (
        <button
          onClick={() => {
            setSelectedInstallPlatform("auto");
            setShowHelp(true);
          }}
          className="fixed right-4 top-4 z-[120] flex items-center gap-2 rounded-full border border-blue-500/30 bg-slate-950/95 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-blue-400 shadow-xl active:scale-95"
        >
          <HelpCircle size={14} /> Ayuda
        </button>
      )}

      {updateInfo && (
        <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-sm rounded-[2rem] border border-blue-500/20 bg-[#151515] p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-600 p-3 text-white">
                <RefreshCw size={18} />
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-widest text-white">Actualizacion disponible</p>
                <p className="text-[10px] font-bold text-slate-400">Version nueva detectada en Vercel</p>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-900 p-4 space-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Version actual</p>
              <p className="text-sm font-black text-white">{APP_BUILD.version}</p>
              <p className="text-[10px] font-bold text-slate-500">
                {new Date(APP_BUILD.buildTime).toLocaleString("es-AR")}
              </p>
              <p className="mt-3 text-[9px] font-black uppercase tracking-widest text-slate-500">Ultimo deploy</p>
              <p className="text-sm font-black text-blue-400">{updateInfo.version}</p>
              {updateInfo.buildTime && (
                <p className="text-[10px] font-bold text-slate-500">
                  {new Date(updateInfo.buildTime).toLocaleString("es-AR")}
                </p>
              )}
            </div>
            <p className="text-[10px] font-bold leading-relaxed text-slate-400">
              Si aceptas, la app recarga la ultima version publicada para que la instalacion quede actualizada como una app profesional.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setUpdateInfo(null)}
                className="rounded-2xl bg-slate-800 py-4 text-[10px] font-black uppercase tracking-widest text-slate-300 active:scale-95"
              >
                Despues
              </button>
              <button
                onClick={aplicarActualizacion}
                className="rounded-2xl bg-blue-600 py-4 text-[10px] font-black uppercase tracking-widest text-white active:scale-95"
              >
                Actualizar ahora
              </button>
            </div>
          </div>
        </div>
      )}

      {showHelp && helpInfo && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-sm rounded-[2rem] border border-slate-700 bg-[#151515] p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-600 p-3 text-white">
                <HelpCircle size={18} />
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-widest text-white">{helpInfo.titulo}</p>
                <p className="text-[10px] font-bold text-slate-400">Guia rapida y simple</p>
              </div>
            </div>
            <div className="space-y-3">
              {helpInfo.items.map((item) => (
                <div key={item} className="rounded-2xl bg-slate-900 p-4 text-[11px] font-bold leading-relaxed text-slate-200">
                  {item}
                </div>
              ))}
            </div>
            <div className="space-y-3 rounded-2xl border border-blue-500/20 bg-slate-950/70 p-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Instalar app</p>
                <p className="mt-1 text-sm font-black text-white">{activeInstallGuide.title}</p>
                <p className="mt-1 text-[10px] font-bold text-slate-400">
                  {displayMode.installed ? "Esta app ya esta instalada en este dispositivo." : "Podes instalarla desde aca si tu navegador lo permite."}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: "android", label: "Android" },
                  { key: "ios", label: "iPhone" },
                  { key: "desktop", label: "PC" },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setSelectedInstallPlatform(item.key)}
                    className={`rounded-2xl py-3 text-[10px] font-black uppercase tracking-widest active:scale-95 ${
                      selectedInstallPlatform === item.key
                        ? "bg-blue-600 text-white"
                        : "bg-slate-900 text-slate-300"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {activeInstallGuide.steps.map((step, index) => (
                  <div key={`${index}-${step.title}`} className="rounded-2xl bg-slate-900 p-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">
                      Paso {index + 1}
                    </p>
                    <p className="mt-1 text-sm font-black text-white">{step.title}</p>
                    <p className="mt-1 text-[11px] font-bold leading-relaxed text-slate-300">
                      {step.detail}
                    </p>
                  </div>
                ))}
              </div>
              {!displayMode.installed && (
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={activeInstallGuide.platform === "ios" ? compartirDesdeAyuda : instalarDesdeAyuda}
                    className={`w-full rounded-2xl py-4 text-[10px] font-black uppercase tracking-widest active:scale-95 ${
                      activeInstallGuide.platform === "ios" || installAvailable
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {activeInstallGuide.platform === "ios"
                      ? "Abrir compartir"
                      : installAvailable
                        ? "Instalar app"
                        : "Intentar instalar"}
                  </button>
                  <button
                    onClick={copiarEnlaceApp}
                    className="w-full rounded-2xl bg-slate-900 py-4 text-[10px] font-black uppercase tracking-widest text-slate-200 active:scale-95"
                  >
                    Copiar enlace de la app
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowHelp(false)}
              className="w-full rounded-2xl bg-blue-600 py-4 text-[10px] font-black uppercase tracking-widest text-white active:scale-95"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Modal de confirmación — reemplaza window.confirm */}
      {confirm && (
        <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-6">
          <div className="bg-[#151515] border border-slate-800 rounded-[2rem] p-8 w-full max-w-sm space-y-5">
            <p className="text-white font-black text-sm text-center">{confirm.mensaje}</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setConfirm(null)}
                className="bg-slate-800 text-slate-300 py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">
                Cancelar
              </button>
              <button onClick={() => { confirm.onOk(); setConfirm(null); }}
                className="bg-red-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {NAV_VIEWS.includes(view) && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-gradient-to-t from-black/95 via-slate-950/90 to-slate-900/50 backdrop-blur-3xl border-t border-white/10 px-2 py-3 flex justify-around items-center z-50 rounded-t-[3rem] shadow-2xl">
          {/* Indicador de sincronización */}
          <div className={`absolute top-2 right-4 flex items-center gap-1 text-[8px] font-black uppercase tracking-widest ${syncStatus === "synced" ? "text-green-500" : syncStatus === "syncing" ? "text-yellow-400" : "text-red-400"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${syncStatus === "synced" ? "bg-green-500" : syncStatus === "syncing" ? "bg-yellow-400 animate-pulse" : "bg-red-400"}`} />
            {syncStatus === "synced" ? "Guardado" : syncStatus === "syncing" ? "Guardando..." : "Error al guardar"}
          </div>
          <button onClick={() => setView("home")} className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl transition-all ${view === "home" ? "text-blue-400 bg-blue-500/20 scale-105 shadow-lg shadow-blue-500/20" : "text-slate-500 hover:text-slate-300"}`}>
            <Wrench size={26} /><span className="text-[10px] font-black uppercase tracking-widest">Inicio</span>
          </button>
          <button onClick={() => setView("ordenes")} className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl transition-all ${view === "ordenes" ? "text-blue-400 bg-blue-500/20 scale-105 shadow-lg shadow-blue-500/20" : "text-slate-500 hover:text-slate-300"}`}>
            <Clock size={26} /><span className="text-[10px] font-black uppercase tracking-widest">Trabajos</span>
          </button>
          <button onClick={() => setView("historial")} className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl transition-all ${view === "historial" || view === "perfilMoto" ? "text-blue-400 bg-blue-500/20 scale-105 shadow-lg shadow-blue-500/20" : "text-slate-500 hover:text-slate-300"}`}>
            <History size={26} /><span className="text-[10px] font-black uppercase tracking-widest">Historial</span>
          </button>
          <button onClick={() => setView("pagosView")} className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl transition-all ${view === "pagosView" ? "text-blue-400 bg-blue-500/20 scale-105 shadow-lg shadow-blue-500/20" : "text-slate-500 hover:text-slate-300"}`}>
            <DollarSign size={26} /><span className="text-[10px] font-black uppercase tracking-widest">Pagos</span>
          </button>
          <button onClick={() => setView("config")} className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl transition-all ${view === "config" ? "text-blue-400 bg-blue-500/20 scale-105 shadow-lg shadow-blue-500/20" : "text-slate-500 hover:text-slate-300"}`}>
            <Settings size={26} /><span className="text-[10px] font-black uppercase tracking-widest">Más</span>
          </button>
        </nav>
      )}

      {toastMessage && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-white text-black px-10 py-5 rounded-3xl font-black text-xs uppercase shadow-2xl z-[100] animate-bounce">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

