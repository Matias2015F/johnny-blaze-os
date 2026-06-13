import React from "react";
import {
  presentarDecisionShadowOrden,
} from "../orden.shadowPresenter.js";
import { crearResumenShadowOrden } from "../orden.shadowIntegration.js";

export default function OrdenShadowDecisionPanel({ shadowResult, legacyOrden }) {
  const resolved = shadowResult || crearResumenShadowOrden(legacyOrden);
  const viewModel = presentarDecisionShadowOrden(resolved);

  return (
    <section aria-label="Shadow decision panel" className="rounded-lg border border-slate-700 bg-slate-950 p-4 text-slate-100">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Modo sombra</p>
          <h3 className="mt-1 text-base font-semibold">{viewModel.title}</h3>
        </div>
        <span className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300">
          {viewModel.severity}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm">
        <div>
          <dt className="text-slate-400">PDF final</dt>
          <dd className="mt-1 font-medium">
            {viewModel.decisionPdf.permitido ? "Permitido" : "Bloqueado"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Motivos</dt>
          <dd className="mt-1 text-slate-200">{viewModel.resumenMotivos}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Proxima accion</dt>
          <dd className="mt-1 text-slate-200">{viewModel.decisionPdf.accionSugerida || viewModel.proximaAccion.accionSugerida || "Sin accion sugerida"}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Warnings</dt>
          <dd className="mt-1 text-slate-200">{viewModel.resumenWarnings}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Divergencias</dt>
          <dd className="mt-1 text-slate-200">
            {viewModel.divergenciasTexto}
          </dd>
        </div>
        <div>
          <dt className="text-slate-400">Origen</dt>
          <dd className="mt-1 text-slate-200">{viewModel.source}</dd>
        </div>
      </dl>
    </section>
  );
}
