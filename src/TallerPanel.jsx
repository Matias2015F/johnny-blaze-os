import React, { useState, useEffect, lazy, Suspense } from "react";
import { auth } from "./firebase.js";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { Wrench, Clock, History, Settings, DollarSign, HelpCircle, RefreshCw, WifiOff } from "lucide-react";

import { LS, useCollection, generateId, migrateFromLocalStorage, migrateRenamedCollections, clearFirestoreData, useSyncStatus } from "./lib/storage.js";
import { autoCloudBackup } from "./lib/cloudBackup.js";
import { CONFIG_DEFAULT, hoyEstable } from "./lib/constants.js";
import { APP_BUILD } from "./generated/appVersion.js";
import { applyRemoteUpdate, bindInstallPromptCapture, canPromptInstall, fetchRemoteVersion, getDisplayModeInfo, isNewerBuild, promptInstallApp } from "./lib/appUpdate.js";
import { ensureAccountProfile, trackEvent } from "./lib/telemetry.js";
import { upsertClienteYMoto } from "./services/clienteMotoService.js";
import { nextNumeroOT, nextNumeroPRE } from "./services/counterService.js";

// HomeView se carga de forma eager � es la pantalla inicial
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
const RecordatoriosView       = lazy(() => import("./views/RecordatoriosView.jsx"));
const PresupuestosView        = lazy(() => import("./views/PresupuestosView.jsx"));
const NuevoPresupuestoView    = lazy(() => import("./views/NuevoPresupuestoView.jsx"));
const PresupuestoDetailView   = lazy(() => import("./views/PresupuestoDetailView.jsx"));

const Cargando = () => (
  <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-zinc-600 text-[10px] font-black uppercase tracking-widest">
    Cargando...
  </div>
);

class ChunkErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    if (error?.name === "ChunkLoadError" || error?.message?.includes("dynamically imported module")) {
      window.location.reload();
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-8 text-center gap-5">
          <p className="text-4xl select-none">⚠️</p>
          <p className="text-white font-black text-sm uppercase tracking-tight">Algo salió mal en esta pantalla</p>
          <p className="text-zinc-500 text-xs">Tus datos están guardados.</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="rounded-2xl bg-orange-600 px-8 py-4 text-[11px] font-black uppercase tracking-widest text-white active:scale-95"
          >
            Reintentar
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-2xl bg-zinc-900 border border-zinc-700 px-8 py-4 text-[11px] font-black uppercase tracking-widest text-zinc-400 active:scale-95"
          >
            Recargar app
          </button>
        </div>
      );
    }
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

export default function TallerPanel({ modoLectura = false }) {
  const [view, setViewRaw] = useState("home");
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedBikeId, setSelectedBikeId] = useState(null);
  const [selectedPresupuestoId, setSelectedPresupuestoId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [confirm, setConfirm] = useState(null); // { mensaje, onOk }
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  const showConfirm = (mensaje, onOk) => setConfirm({ mensaje, onOk });
  const [prefillData, setPrefillData] = useState(null);
  const [serviceToEdit, setServiceToEdit] = useState(null);
  const [finalPdfData, setFinalPdfData] = useState({ garantia: "" });
  const [showHelp, setShowHelp] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [installAvailable, setInstallAvailable] = useState(false);
  const [selectedInstallPlatform, setSelectedInstallPlatform] = useState("auto");

  const clients         = useCollection("clientes");
  const bikes           = useCollection("motos");
  const orders          = useCollection("trabajos");
  const presupuestos    = useCollection("presupuestos");
  const titularidades   = useCollection("titularidades");
  useCollection("config");
  useCollection("repuestosHistorial");

  const syncStatus = useSyncStatus();

  const showToast = (msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(null), 2500); };
  const setView = (v) => {
    if (modoLectura && (v === "nuevaOrden" || v === "nuevoPresupuesto")) {
      showToast("Plan vencido. Renova tu suscripcion para crear nuevas ordenes.");
      return;
    }
    setViewRaw(v);
  };
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
    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const checkForUpdates = async () => {
      try {
        const remote = await fetchRemoteVersion();
        if (!alive) return;
        if (isNewerBuild(APP_BUILD, remote)) {
          const isIosStandalone = window.navigator.standalone === true;
          if (isIosStandalone) {
            // On iOS PWA apply immediately — no modal interaction required
            try {
              await applyRemoteUpdate(remote);
            } catch {
              window.location.reload();
            }
          } else {
            setUpdateInfo(remote);
          }
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
      .then((n) => { if (n > 0) showToast(`Estructura actualizada (${n} registros migrados)`); })
      .catch(console.error);
    migrateFromLocalStorage(uid)
      .then((n) => { if (n > 0) showToast(`Datos sincronizados (${n} registros)`); })
      .catch(console.error);
    autoCloudBackup(uid).catch(console.error);
  }, []);

  // -- Crear orden nueva ------------------------------------------------------
  const handleCreateOrder = async (payload) => {
    const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;
    const { clientId, bikeId, kmActual } = upsertClienteYMoto(
      payload,
      { clients, bikes, titularidades, config },
      { soloSiKm: false, actualizarService: true, crearTitularidad: true }
    );

    const numeroTrabajo = await nextNumeroOT(orders.length + 1);
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
    if (modoLectura) {
      showToast("Plan vencido. Renova tu suscripcion para crear nuevas ordenes.");
      return;
    }
    setPrefillData({ bike, client });
    setViewRaw("nuevaOrden");
  };

  // -- Presupuestos -----------------------------------------------------------
  const handleCreatePresupuesto = async (payload) => {
    const { clientId, bikeId, kmActual } = upsertClienteYMoto(
      payload,
      { clients, bikes, titularidades },
      { soloSiKm: true, actualizarService: false, crearTitularidad: false }
    );

    const numeroPresupuesto = await nextNumeroPRE(presupuestos.length + 1);
    const pres = LS.addDoc("presupuestos", {
      numeroPresupuesto,
      clientId,
      bikeId,
      estado: "borrador",
      km: kmActual,
      motivoConsulta: payload.consulta || "",
      tareas: [],
      repuestos: [],
      insumos: [],
      fletes: [],
      total: 0,
      costoInterno: 0,
      margen: 0,
      validezDias: payload.validezDias || 7,
      trabajoId: null,
      cronometroActivo: false,
      inicioCronometro: null,
      tiempoReal: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    setSelectedPresupuestoId(pres.id);
    setView("detallePresupuesto");
    showToast("Presupuesto creado");
  };

  const handleConvertirPresupuestoAOT = async () => {
    const pres = presupuestos.find((p) => p.id === selectedPresupuestoId);
    if (!pres) return;

    const numeroTrabajo = await nextNumeroOT(orders.length + 1);
    const orden = LS.addDoc("trabajos", {
      numeroTrabajo,
      clientId: pres.clientId,
      bikeId: pres.bikeId,
      estado: "aprobacion",
      prioridad: "normal",
      fechaIngreso: hoyEstable(),
      fechaEntrega: null,
      motivoIngreso: pres.motivoConsulta || "",
      diagnostico: pres.motivoConsulta || "",
      km: pres.km || 0,
      kmIngreso: pres.km || 0,
      kmEntrega: null,
      total: pres.total || 0,
      pagos: [],
      tareas: pres.tareas || [],
      repuestos: pres.repuestos || [],
      insumos: pres.insumos || [],
      fletes: pres.fletes || [],
      margen: pres.margen || 0,
      costoInterno: pres.costoInterno || 0,
      observacionesProxima: "",
      pdfEntregado: false,
      tiempoReal: 0,
      cronometroActivo: false,
      inicioCronometro: null,
      maxAutorizado: 0,
      presupuestoId: pres.id,
      createdAt: Date.now(),
    });

    LS.updateDoc("presupuestos", pres.id, {
      estado: "convertido",
      trabajoId: orden.id,
      updatedAt: Date.now(),
    });

    setSelectedOrderId(orden.id);
    setView("detalleOrden");
    showToast("OT creada desde presupuesto");
  };

  const handleEliminarPresupuesto = () => {
    if (!selectedPresupuestoId) return;
    LS.deleteDoc("presupuestos", selectedPresupuestoId);
    setSelectedPresupuestoId(null);
    setView("presupuestos");
    showToast("Presupuesto eliminado");
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

    showToast("Demo cargado OK");
  };

  const clearAllData = () => {
    showConfirm("¿Borrar todos los datos? Esta acción no se puede deshacer.", async () => {
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
          title: "Moto Gestión",
          text: "Abrí esta app y agregala a tu pantalla de inicio.",
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
    <div className="max-w-md mx-auto min-h-screen bg-[#0A0A0A] relative text-left selection:bg-orange-500 overflow-x-hidden font-bold">

      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[300] flex items-center justify-center gap-2 bg-zinc-900/95 border-b border-zinc-700 py-2.5 px-4 backdrop-blur">
          <WifiOff size={12} className="text-zinc-400 shrink-0" />
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
            Sin conexión — los cambios se guardan en este dispositivo
          </p>
        </div>
      )}

      <ChunkErrorBoundary>
      <Suspense fallback={<Cargando />}>
      {view === "home" && <HomeView stats={stats} setView={setView} bikes={bikes} orders={orders} presupuestos={presupuestos} setSelectedOrderId={setSelectedOrderId} handleLogout={handleLogout} modoLectura={modoLectura} />}
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
      {view === "recordatorios" && <RecordatoriosView setView={setView} showToast={showToast} bikes={bikes} clients={clients} />}
      {view === "esperandoAprobacion" && selectedOrderId && <EsperandoAprobacionView ordenId={selectedOrderId} setView={setView} />}
      {view === "ejecucion" && selectedOrderId && <EjecucionView ordenId={selectedOrderId} setView={setView} />}
      {view === "finalizacion" && selectedOrderId && <FinalizacionView ordenId={selectedOrderId} setView={setView} />}
      {view === "pago" && selectedOrderId && <PagoView ordenId={selectedOrderId} setView={setView} />}
      {view === "retiro" && selectedOrderId && <RetiroView ordenId={selectedOrderId} setView={setView} setSelectedOrderId={setSelectedOrderId} />}
      {view === "historial" && <HistoryView orders={orders} bikes={bikes} clients={clients} setView={setView} setSelectedBikeId={setSelectedBikeId} />}
      {view === "perfilMoto" && <BikeProfileView bikeId={selectedBikeId} orders={orders} bikes={bikes} clients={clients} setView={setView} handleStartNewService={handleStartNewService} setSelectedOrderId={setSelectedOrderId} setFinalPdfData={setFinalPdfData} />}
      {view === "presupuestos" && <PresupuestosView presupuestos={presupuestos} bikes={bikes} clients={clients} setSelectedPresupuestoId={setSelectedPresupuestoId} setView={setView} />}
      {view === "nuevoPresupuesto" && <NuevoPresupuestoView onCrear={handleCreatePresupuesto} setView={setView} bikes={bikes} clients={clients} />}
      {view === "detallePresupuesto" && (() => {
        const pres = presupuestos.find((p) => p.id === selectedPresupuestoId);
        return pres ? (
          <PresupuestoDetailView
            presupuesto={pres}
            bike={bikes.find((b) => b.id === pres.bikeId)}
            client={clients.find((c) => c.id === pres.clientId)}
            onConvertirAOT={handleConvertirPresupuestoAOT}
            onEliminar={handleEliminarPresupuesto}
            setView={setView}
            showToast={showToast}
            setSelectedOrderId={setSelectedOrderId}
          />
        ) : null;
      })()}
      {view === "gestionarPresupuesto" && (() => {
        const pres = presupuestos.find((p) => p.id === selectedPresupuestoId);
        return pres ? (
          <TaskManagerView
            order={pres}
            coleccion="presupuestos"
            setView={setView}
            showToast={showToast}
            serviceToEdit={serviceToEdit}
            setServiceToEdit={setServiceToEdit}
            onBack={() => setView("detallePresupuesto")}
          />
        ) : null;
      })()}
      </Suspense>
      </ChunkErrorBoundary>

      {NAV_VIEWS.includes(view) && helpInfo && (
        <button
          onClick={() => {
            setSelectedInstallPlatform("auto");
            setShowHelp(true);
          }}
          className="fixed right-4 top-4 z-[120] flex items-center gap-2 rounded-full border border-orange-500/30 bg-zinc-950/95 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-orange-400 shadow-xl active:scale-95"
        >
          <HelpCircle size={14} /> Ayuda
        </button>
      )}

      {updateInfo && (
        <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-sm rounded-[2rem] border border-orange-500/20 bg-[#151515] p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-orange-600 p-3 text-white">
                <RefreshCw size={18} />
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-widest text-white">Actualizacion disponible</p>
                <p className="text-[10px] font-bold text-zinc-400">Version nueva detectada en Vercel</p>
              </div>
            </div>
            <div className="rounded-2xl bg-zinc-900 p-4 space-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Version actual</p>
              <p className="text-sm font-black text-white">{APP_BUILD.version}</p>
              <p className="text-[10px] font-bold text-zinc-500">
                {new Date(APP_BUILD.buildTime).toLocaleString("es-AR")}
              </p>
              <p className="mt-3 text-[9px] font-black uppercase tracking-widest text-zinc-500">Ultimo deploy</p>
              <p className="text-sm font-black text-orange-400">{updateInfo.version}</p>
              {updateInfo.buildTime && (
                <p className="text-[10px] font-bold text-zinc-500">
                  {new Date(updateInfo.buildTime).toLocaleString("es-AR")}
                </p>
              )}
            </div>
            <p className="text-[10px] font-bold leading-relaxed text-zinc-400">
              Si aceptas, la app recarga la ultima version publicada para que la instalacion quede actualizada como una app profesional.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setUpdateInfo(null)}
                className="rounded-2xl bg-zinc-800 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-300 active:scale-95"
              >
                Despues
              </button>
              <button
                onClick={aplicarActualizacion}
                className="rounded-2xl bg-orange-600 py-4 text-[10px] font-black uppercase tracking-widest text-white active:scale-95"
              >
                Actualizar ahora
              </button>
            </div>
          </div>
        </div>
      )}

      {showHelp && helpInfo && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-sm rounded-[2rem] border border-zinc-700 bg-[#151515] p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-orange-600 p-3 text-white">
                <HelpCircle size={18} />
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-widest text-white">{helpInfo.titulo}</p>
                <p className="text-[10px] font-bold text-zinc-400">Guia rapida y simple</p>
              </div>
            </div>
            <div className="space-y-3">
              {helpInfo.items.map((item) => (
                <div key={item} className="rounded-2xl bg-zinc-900 p-4 text-[11px] font-bold leading-relaxed text-zinc-200">
                  {item}
                </div>
              ))}
            </div>
            <div className="space-y-3 rounded-2xl border border-orange-500/20 bg-zinc-950/70 p-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-400">Instalar app</p>
                <p className="mt-1 text-sm font-black text-white">{activeInstallGuide.title}</p>
                <p className="mt-1 text-[10px] font-bold text-zinc-400">
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
                        ? "bg-orange-600 text-white"
                        : "bg-zinc-900 text-zinc-300"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {activeInstallGuide.steps.map((step, index) => (
                  <div key={`${index}-${step.title}`} className="rounded-2xl bg-zinc-900 p-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-orange-400">
                      Paso {index + 1}
                    </p>
                    <p className="mt-1 text-sm font-black text-white">{step.title}</p>
                    <p className="mt-1 text-[11px] font-bold leading-relaxed text-zinc-300">
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
                        : "bg-zinc-800 text-zinc-400"
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
                    className="w-full rounded-2xl bg-zinc-900 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-200 active:scale-95"
                  >
                    Copiar enlace de la app
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowHelp(false)}
              className="w-full rounded-2xl bg-orange-600 py-4 text-[10px] font-black uppercase tracking-widest text-white active:scale-95"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Modal de confirmaci�n � reemplaza window.confirm */}
      {confirm && (
        <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-6">
          <div className="bg-[#151515] border border-zinc-800 rounded-[2rem] p-8 w-full max-w-sm space-y-5">
            <p className="text-white font-black text-sm text-center">{confirm.mensaje}</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setConfirm(null)}
                className="bg-zinc-800 text-zinc-300 py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">
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
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-gradient-to-t from-black/95 via-zinc-950/90 to-zinc-900/50 backdrop-blur-3xl border-t border-white/10 px-2 py-3 flex justify-around items-center z-50 rounded-t-[3rem] shadow-2xl">
          {/* Indicador de sincronizaci�n */}
          <div className={`absolute top-2 right-4 flex items-center gap-1 text-[8px] font-black uppercase tracking-widest ${syncStatus === "synced" ? "text-green-500" : syncStatus === "syncing" ? "text-yellow-400" : "text-red-400"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${syncStatus === "synced" ? "bg-green-500" : syncStatus === "syncing" ? "bg-yellow-400 animate-pulse" : "bg-red-400"}`} />
            {syncStatus === "synced" ? "Guardado" : syncStatus === "syncing" ? "Guardando..." : "Error al guardar"}
          </div>
          <button onClick={() => setView("home")} className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl transition-all ${view === "home" ? "text-orange-400 bg-orange-500/20 scale-105 shadow-lg shadow-orange-500/20" : "text-zinc-500 hover:text-zinc-300"}`}>
            <Wrench size={26} /><span className="text-[10px] font-black uppercase tracking-widest">Inicio</span>
          </button>
          <button onClick={() => setView("ordenes")} className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl transition-all ${view === "ordenes" ? "text-orange-400 bg-orange-500/20 scale-105 shadow-lg shadow-orange-500/20" : "text-zinc-500 hover:text-zinc-300"}`}>
            <Clock size={26} /><span className="text-[10px] font-black uppercase tracking-widest">Trabajos</span>
          </button>
          <button onClick={() => setView("historial")} className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl transition-all ${view === "historial" || view === "perfilMoto" ? "text-orange-400 bg-orange-500/20 scale-105 shadow-lg shadow-orange-500/20" : "text-zinc-500 hover:text-zinc-300"}`}>
            <History size={26} /><span className="text-[10px] font-black uppercase tracking-widest">Historial</span>
          </button>
          <button onClick={() => setView("pagosView")} className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl transition-all ${view === "pagosView" ? "text-orange-400 bg-orange-500/20 scale-105 shadow-lg shadow-orange-500/20" : "text-zinc-500 hover:text-zinc-300"}`}>
            <DollarSign size={26} /><span className="text-[10px] font-black uppercase tracking-widest">Pagos</span>
          </button>
          <button onClick={() => setView("config")} className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl transition-all ${view === "config" ? "text-orange-400 bg-orange-500/20 scale-105 shadow-lg shadow-orange-500/20" : "text-zinc-500 hover:text-zinc-300"}`}>
            <Settings size={26} /><span className="text-[10px] font-black uppercase tracking-widest">Más</span>
          </button>
        </nav>
      )}

      {toastMessage && (
        <div className="fixed inset-x-0 top-4 z-[100] flex justify-center px-4 pointer-events-none">
          <div className="w-full max-w-sm rounded-3xl bg-white px-5 py-4 text-center text-xs font-black uppercase leading-relaxed text-black shadow-2xl break-words animate-in fade-in slide-in-from-top-2">
            {toastMessage}
          </div>
        </div>
      )}
    </div>
  );
}
