import React, { useState, useEffect, lazy, Suspense } from "react";
import { auth } from "./firebase.js";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { Wrench, Clock, History, Settings, DollarSign } from "lucide-react";

import { LS, useCollection, generateId, migrateFromLocalStorage, clearFirestoreData } from "./lib/storage.js";
import { CONFIG_DEFAULT, hoyEstable } from "./lib/constants.js";

// HomeView se carga de forma eager — es la pantalla inicial
import HomeView from "./views/HomeView.jsx";

// El resto se carga bajo demanda (code splitting) → reduce el bundle inicial
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
const PrePdfView     = lazy(() => import("./components/PrePdfView.jsx"));
const ExportPdfView  = lazy(() => import("./components/ExportPdfView.jsx"));

// Fallback minimalista mientras carga un chunk
const Cargando = () => (
  <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-slate-600 text-[10px] font-black uppercase tracking-widest">
    Cargando...
  </div>
);

const NAV_VIEWS = ["home", "ordenes", "historial", "precios", "config"];

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

  const clients = useCollection("clientes");
  const bikes   = useCollection("motos");
  const orders  = useCollection("ordenes");
  useCollection("config"); // mantiene config en cache para lecturas síncronas

  const showToast = (msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(null), 2500); };
  const handleLogout = async () => { try { await signOut(auth); } catch (e) { console.error(e); } };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { if (u) setView("home"); });
    return () => unsub();
  }, []);

  // Migración única: sube datos de localStorage a Firestore al primer login
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    migrateFromLocalStorage(uid)
      .then((n) => { if (n > 0) showToast(`Datos sincronizados (${n} registros) ✓`); })
      .catch(console.error);
  }, []);

  // ── Crear orden nueva ──────────────────────────────────────────────────────
  const handleCreateOrder = (payload) => {
    const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;
    const kmActual = Number(payload.km);

    // Cliente
    const ec = clients.find(
      (c) => c.nombre?.trim().toLowerCase() === payload.nombre?.trim().toLowerCase() && c.tel === payload.tel
    );
    const clientId = ec ? ec.id : LS.addDoc("clientes", { nombre: payload.nombre, tel: payload.tel }).id;

    // Moto
    const eb = bikes.find((b) => b.patente === payload.patente.toUpperCase());
    let bikeId;
    if (eb) {
      bikeId = eb.id;
      LS.updateDoc("motos", bikeId, {
        km: kmActual,
        clienteId: clientId,
        ultimaVisita: hoyEstable(),
        proximoService: kmActual + (config.offsetServiceKm || 2500),
      });
    } else {
      bikeId = LS.addDoc("motos", {
        patente: payload.patente.toUpperCase(),
        marca: payload.marca,
        modelo: payload.modelo,
        cilindrada: Number(payload.cilindrada),
        km: kmActual,
        clienteId: clientId,
        ultimaVisita: hoyEstable(),
        proximoService: kmActual + (config.offsetServiceKm || 2500),
      }).id;
    }

    const orden = LS.addDoc("ordenes", {
      clientId, bikeId,
      estado: "diagnostico",
      fechaIngreso: hoyEstable(),
      diagnostico: payload.falla,
      km: kmActual,
      total: 0,
      pagos: [], tareas: [], repuestos: [], insumos: [], fletes: [],
      margen: 0, costoInterno: 0,
      observacionesProxima: "",
      pdfEntregado: false,
      tiempoReal: 0,
      cronometroActivo: false,
      inicioCronometro: null,
      maxAutorizado: 0,
    });

    setSelectedOrderId(orden.id);
    setPrefillData(null);
    setView("detalleOrden");
    showToast("Orden abierta ✓");
  };

  const handleStartNewService = (bike, client) => {
    setPrefillData({ bike, client });
    setView("nuevaOrden");
  };

  // ── Demo / Reset ───────────────────────────────────────────────────────────
  const loadDemoData = () => {
    const hoy = hoyEstable();
    const c1 = LS.addDoc("clientes", { nombre: "Juan Pérez", tel: "3434111222" });
    const b1 = LS.addDoc("motos", { patente: "A123ABC", marca: "Honda", modelo: "Tornado 250", cilindrada: 250, km: 12500, clienteId: c1.id, ultimaVisita: hoy, proximoService: 15000 });
    LS.addDoc("ordenes", {
      clientId: c1.id, bikeId: b1.id, estado: "reparacion",
      fechaIngreso: hoy, total: 65000,
      pagos: [{ id: generateId(), fecha: hoy, monto: 20000, metodo: "efectivo", hora: "14:30" }],
      tareas: [{ nombre: "Regulación de válvulas", monto: 25000, horasBase: 2 }],
      repuestos: [{ nombre: "Junta de tapa", monto: 15000, cantidad: 1 }, { nombre: "Aceite Motul 5100", monto: 25000, cantidad: 1 }],
      insumos: [{ nombre: "Limpia carburador", monto: 3500 }],
      fletes: [], km: 12500,
      diagnostico: "Le cuesta arrancar en frío y regula mal.",
      observacionesProxima: "Revisar transmisión en 2000km.",
      pdfEntregado: false,
    });
    showToast("Demo cargado ✓");
  };

  const clearAllData = () => {
    showConfirm("¿Borrar todos los datos? Esta acción no se puede deshacer.", async () => {
      const uid = auth.currentUser?.uid;
      if (uid) await clearFirestoreData(uid);
      localStorage.removeItem("jbos_fs_migrated_v1");
      window.location.reload();
    });
  };

  // ── Datos derivados ────────────────────────────────────────────────────────
  const selectedOrder = orders.find((o) => o.id === selectedOrderId);
  const stats = {
    activas: orders.filter((o) => o.estado !== "entregada").length,
    hoy: orders.filter((o) => o.fechaIngreso === hoyEstable()).length,
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#0A0A0A] relative text-left selection:bg-blue-500 overflow-x-hidden font-bold">

      <Suspense fallback={<Cargando />}>
      {view === "home" && <HomeView stats={stats} setView={setView} bikes={bikes} orders={orders} setSelectedOrderId={setSelectedOrderId} handleLogout={handleLogout} />}
      {view === "nuevaOrden" && <NewOrderView handleCreateAll={handleCreateOrder} setView={setView} prefill={prefillData} />}
      {view === "ordenes" && <OrderListView orders={orders} bikes={bikes} clients={clients} setSelectedOrderId={setSelectedOrderId} setView={setView} />}
      {view === "detalleOrden" && selectedOrder && <OrderDetailView order={selectedOrder} clients={clients} bikes={bikes} setView={setView} showToast={showToast} setServiceToEdit={setServiceToEdit} />}
      {view === "gestionarTareas" && selectedOrder && <TaskManagerView order={selectedOrder} setView={setView} showToast={showToast} serviceToEdit={serviceToEdit} setServiceToEdit={setServiceToEdit} />}
      {view === "logistica" && selectedOrder && <LogisticsView order={selectedOrder} setView={setView} showToast={showToast} />}
      {view === "pagos" && selectedOrder && <PaymentView order={selectedOrder} setView={setView} showToast={showToast} />}
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
      {view === "historial" && <HistoryView orders={orders} bikes={bikes} clients={clients} setView={setView} setSelectedBikeId={setSelectedBikeId} />}
      {view === "perfilMoto" && <BikeProfileView bikeId={selectedBikeId} orders={orders} bikes={bikes} clients={clients} setView={setView} handleStartNewService={handleStartNewService} />}
      </Suspense>

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
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-black/95 backdrop-blur-3xl border-t border-white/10 px-2 py-4 flex justify-around items-center z-50 rounded-t-[3rem] shadow-2xl">
          <button onClick={() => setView("home")} className={`flex flex-col items-center gap-1.5 transition-all ${view === "home" ? "text-blue-500 scale-110" : "text-slate-500"}`}>
            <Wrench size={26} /><span className="text-[10px] font-black uppercase tracking-widest">Taller</span>
          </button>
          <button onClick={() => setView("ordenes")} className={`flex flex-col items-center gap-1.5 transition-all ${view === "ordenes" ? "text-blue-500 scale-110" : "text-slate-500"}`}>
            <Clock size={26} /><span className="text-[10px] font-black uppercase tracking-widest">Trabajos</span>
          </button>
          <button onClick={() => setView("historial")} className={`flex flex-col items-center gap-1.5 transition-all ${view === "historial" || view === "perfilMoto" ? "text-blue-500 scale-110" : "text-slate-500"}`}>
            <History size={26} /><span className="text-[10px] font-black uppercase tracking-widest">Historial</span>
          </button>
          <button onClick={() => setView("precios")} className={`flex flex-col items-center gap-1.5 transition-all ${view === "precios" ? "text-blue-500 scale-110" : "text-slate-500"}`}>
            <DollarSign size={26} /><span className="text-[10px] font-black uppercase tracking-widest">Precios</span>
          </button>
          <button onClick={() => setView("config")} className={`flex flex-col items-center gap-1.5 transition-all ${view === "config" ? "text-blue-500 scale-110" : "text-slate-500"}`}>
            <Settings size={26} /><span className="text-[10px] font-black uppercase tracking-widest">Cuenta</span>
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
