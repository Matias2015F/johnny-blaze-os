import React, { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, FileText, Search, User, Wrench } from "lucide-react";
import { formatMoney } from "../utils/format.js";

export default function HistoryView({ orders, bikes, clients, setView, setSelectedBikeId }) {
  const [search, setSearch] = useState("");

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
    : "Buscá por patente, cliente, número de trabajo o número de comprobante";

  return (
    <div className="animate-in slide-in-from-right duration-300 space-y-4 pb-28 text-left">
      <div className="sticky top-0 z-40 rounded-b-[2rem] bg-slate-950 px-4 pb-5 pt-4 shadow-lg">
        <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-black/30 p-5 backdrop-blur-xl">
          <button onClick={() => setView("home")} className="rounded-2xl border border-white/5 bg-white/5 p-3 text-white active:scale-90">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest text-white">Historial</h2>
            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Patente, cliente, trabajo o comprobante</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4">
        <div className="rounded-[2rem] border-2 border-slate-200 bg-white p-4 shadow-sm">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              placeholder="Buscar patente, cliente, trabajo o comprobante"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-3xl border-2 border-slate-200 bg-slate-50 p-5 pl-12 font-black text-black outline-none focus:border-blue-500"
            />
          </div>
          <p className="mt-3 px-1 text-[10px] font-black uppercase tracking-widest text-slate-500">{helperText}</p>
        </div>

        {search.trim() && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Motos encontradas</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{resumen.motos}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Trabajos relacionados</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{resumen.trabajos}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Comprobantes</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{resumen.comprobantes}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Repuestos y gastos</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{resumen.repuestos + resumen.gastos}</p>
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
                className="w-full rounded-[2rem] border border-slate-200 bg-white p-5 text-left shadow-sm transition-all active:scale-[0.98]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-3xl font-black leading-none text-black">{item.bike.patente}</p>
                    <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {item.bike.marca} {item.bike.modelo} {item.bike.cilindrada ? `· ${item.bike.cilindrada}cc` : ""}
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-[11px] font-black text-slate-600">
                      <User size={14} className="text-slate-400" />
                      <span className="truncate uppercase">{item.client?.nombre || "Cliente sin nombre"}</span>
                    </div>
                  </div>
                  <ChevronRight size={24} className="shrink-0 text-slate-300" />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Trabajos</p>
                    <p className="mt-1 text-lg font-black text-slate-950">{item.trabajos}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Comprobantes</p>
                    <p className="mt-1 text-lg font-black text-slate-950">{item.comprobantes}</p>
                  </div>
                </div>

                <div className="mt-3 space-y-2 rounded-2xl bg-slate-50 p-3">
                  <div className="flex items-center justify-between text-[11px] font-black">
                    <span className="flex items-center gap-2 text-slate-500">
                      <Wrench size={14} className="text-blue-500" />
                      Repuestos usados
                    </span>
                    <span className="text-slate-950">{item.repuestos}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-black">
                    <span className="flex items-center gap-2 text-slate-500">
                      <FileText size={14} className="text-orange-500" />
                      Gastos e insumos
                    </span>
                    <span className="text-slate-950">{item.gastos}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-[11px] font-black">
                    <span className="text-slate-500">Total histórico</span>
                    <span className="text-slate-950">{formatMoney(item.totalCobrado)}</span>
                  </div>
                </div>

                {item.orders[0] && (
                  <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-500">Último movimiento</p>
                    <p className="mt-1 text-[11px] font-black uppercase text-blue-950">
                      {item.orders[0].numeroComprobante
                        ? `Comprobante ${item.orders[0].numeroComprobante}`
                        : item.orders[0].numeroTrabajo || "Trabajo sin número"}
                    </p>
                  </div>
                )}
              </button>
            ))
          ) : (
            <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
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
