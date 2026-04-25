import React, { useState, useEffect } from "react";
import { auth } from "./firebase.js";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { Wrench, Clock, History, TrendingUp } from "lucide-react";

import { LS, useCollection, generateId } from "./lib/storage.js";
import { CONFIG_DEFAULT, hoyEstable } from "./lib/constants.js";

import HomeView from "./views/HomeView.jsx";
import OrderListView from "./views/OrderListView.jsx";
import NewOrderView from "./views/NewOrderView.jsx";
import ConfigView from "./views/ConfigView.jsx";
import HistoryView from "./views/HistoryView.jsx";
import BikeProfileView from "./views/BikeProfileView.jsx";

import OrderDetailView from "./components/OrderDetailView.jsx";
import TaskManagerView from "./components/TaskManagerView.jsx";
import LogisticsView from "./components/LogisticsView.jsx";
import PaymentView from "./components/PaymentView.jsx";
import PrePdfView from "./components/PrePdfView.jsx";
import ExportPdfView from "./components/ExportPdfView.jsx";

const NAV_VIEWS = ["home", "ordenes", "historial", "config"];

export default function TallerPanel() {
  const [view, setView] = useState("home");
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [selectedBikeId, setSelectedBikeId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [prefillData, setPrefillData] = useState(null);
  const [serviceToEdit, setServiceToEdit] = useState(null);
  const [finalPdfData, setFinalPdfData] = useState({ garantia: "" });

  const clients = useCollection("clientes");
  const bikes = useCollection("motos");
  const orders = useCollection("ordenes");

  const showToast = (msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(null), 2500); };
  const handleLogout = async () => { try { await signOut(auth); } catch (e) { console.error(e); } };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { if (u) setView("home"); });
    return () => unsub();
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
    if (window.confirm("¿Borrar todo?")) {
      ["clientes", "motos", "ordenes", "config", "caja", "serviciosCatalogo"].forEach((c) =>
        localStorage.removeItem(LS.key(c))
      );
      window.location.reload();
    }
  };

  // ── Datos derivados ────────────────────────────────────────────────────────
  const selectedOrder = orders.find((o) => o.id === selectedOrderId);
  const stats = {
    activas: orders.filter((o) => o.estado !== "entregada").length,
    hoy: orders.filter((o) => o.fechaIngreso === hoyEstable()).length,
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#0A0A0A] relative text-left selection:bg-orange-500 overflow-x-hidden font-bold">

      {view === "home" && <HomeView stats={stats} setView={setView} bikes={bikes} loadDemoData={loadDemoData} clearAllData={clearAllData} />}
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
      {view === "config" && <ConfigView setView={setView} showToast={showToast} />}
      {view === "historial" && <HistoryView orders={orders} bikes={bikes} clients={clients} setView={setView} setSelectedBikeId={setSelectedBikeId} />}
      {view === "perfilMoto" && <BikeProfileView bikeId={selectedBikeId} orders={orders} bikes={bikes} clients={clients} setView={setView} handleStartNewService={handleStartNewService} />}

      {NAV_VIEWS.includes(view) && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-black/95 backdrop-blur-3xl border-t border-white/10 p-5 flex justify-around items-center z-50 rounded-t-[3rem] shadow-2xl">
          <button onClick={() => setView("home")} className={`flex flex-col items-center gap-1.5 transition-all ${view === "home" ? "text-orange-500 scale-110" : "text-slate-500"}`}>
            <Wrench size={26} /><span className="text-[10px] font-black uppercase tracking-widest">Taller</span>
          </button>
          <button onClick={() => setView("ordenes")} className={`flex flex-col items-center gap-1.5 transition-all ${view === "ordenes" ? "text-orange-500 scale-110" : "text-slate-500"}`}>
            <Clock size={26} /><span className="text-[10px] font-black uppercase tracking-widest">Trabajos</span>
          </button>
          <button onClick={() => setView("historial")} className={`flex flex-col items-center gap-1.5 transition-all ${view === "historial" || view === "perfilMoto" ? "text-orange-500 scale-110" : "text-slate-500"}`}>
            <History size={26} /><span className="text-[10px] font-black uppercase tracking-widest">Historial</span>
          </button>
          <button onClick={() => setView("config")} className={`flex flex-col items-center gap-1.5 transition-all ${view === "config" ? "text-orange-500 scale-110" : "text-slate-500"}`}>
            <TrendingUp size={26} /><span className="text-[10px] font-black uppercase tracking-widest">Balance</span>
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
