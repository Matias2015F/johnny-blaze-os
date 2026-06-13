import React, { useMemo, useState } from "react";
import OrdenShadowDecisionPanel from "../components/OrdenShadowDecisionPanel.jsx";
import { ORDEN_LEGACY_SANITIZED_SNAPSHOTS, obtenerOrdenLegacySanitizedSnapshot } from "../fixtures/ordenLegacySanitizedSnapshots.js";
import { crearReporteCompatibilidadOrden } from "../orden.compatibilityAudit.js";
import { prepararOrdenShadowDiagnosticsViewModel } from "../orden.shadowDiagnosticsPresenter.js";
import { sanitizarOrdenParaDiagnostico } from "../orden.sanitizer.js";

function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, value: null };
  }
}

function describeCompatibility(report = {}) {
  return report.nivel || "UNKNOWN";
}

export default function OrdenShadowDiagnosticsView({ legacyOrden, fixtureKey = "canonicaCompleta" }) {
  const [selectedFixtureKey, setSelectedFixtureKey] = useState(fixtureKey);
  const [snapshotText, setSnapshotText] = useState("");
  const [snapshotError, setSnapshotError] = useState("");
  const availableFixtures = useMemo(() => Object.keys(ORDEN_LEGACY_SANITIZED_SNAPSHOTS), []);

  const fixtureOrden = legacyOrden || obtenerOrdenLegacySanitizedSnapshot(selectedFixtureKey);
  const parsedSnapshot = snapshotText ? safeJsonParse(snapshotText) : { ok: true, value: null };
  const rawInputOrden = parsedSnapshot.ok && parsedSnapshot.value ? parsedSnapshot.value : fixtureOrden;
  const sanitizedInputOrden = sanitizarOrdenParaDiagnostico(rawInputOrden);
  const compatibilityReport = crearReporteCompatibilidadOrden(sanitizedInputOrden);
  const viewModel = prepararOrdenShadowDiagnosticsViewModel({ legacyOrden: sanitizedInputOrden });

  const handleSnapshotChange = (event) => {
    const value = event.target.value;
    setSnapshotText(value);
    if (!value.trim()) {
      setSnapshotError("");
      return;
    }
    const parsed = safeJsonParse(value);
    setSnapshotError(parsed.ok ? "" : "JSON inválido. Usá sólo snapshots sanitizados.");
  };

  const handleFileLoad = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setSnapshotText(text);
    const parsed = safeJsonParse(text);
    setSnapshotError(parsed.ok ? "" : "JSON inválido. Usá sólo snapshots sanitizados.");
  };

  return (
    <section className="space-y-4 p-4">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-500">Diagnóstico interno</p>
        <h2 className="text-xl font-semibold text-slate-100">Shadow diagnostics</h2>
        <p className="rounded-lg border border-amber-700 bg-amber-950/60 p-3 text-xs text-amber-100">
          Usá únicamente snapshots sanitizados. No pegues nombres, teléfonos, documentos, patentes reales, direcciones,
          tokens ni información de clientes.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200">
          <span className="text-slate-400">Fixture diagnóstico</span>
          <select
            value={selectedFixtureKey}
            onChange={(event) => {
              setSelectedFixtureKey(event.target.value);
              setSnapshotText("");
              setSnapshotError("");
            }}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
          >
            {availableFixtures.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200">
          <span className="text-slate-400">Cargar snapshot JSON local</span>
          <input
            type="file"
            accept="application/json,.json"
            onChange={handleFileLoad}
            className="text-sm text-slate-300 file:mr-4 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-100"
          />
        </label>
      </div>

      <label className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200">
        <span className="text-slate-400">Snapshot JSON sanitizado</span>
        <textarea
          value={snapshotText}
          onChange={handleSnapshotChange}
          placeholder='Pegá un JSON sanitizado o dejá vacío para usar el fixture.'
          className="min-h-40 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100"
        />
        {snapshotError ? <p className="text-xs text-amber-300">{snapshotError}</p> : null}
      </label>

      <div className="grid gap-3 text-sm text-slate-200 md:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
          <p className="text-slate-400">Compatibilidad legacy</p>
          <p className="mt-1 font-medium">{compatibilityReport.compatible ? "Compatible" : "No compatible"}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
          <p className="text-slate-400">Estado legacy detectado</p>
          <p className="mt-1 font-medium">{viewModel.legacyEstado}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
          <p className="text-slate-400">Estado normalizado</p>
          <p className="mt-1 font-medium">{viewModel.estadoNormalizado}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
          <p className="text-slate-400">Compatibilidad</p>
          <p className="mt-1 font-medium">{describeCompatibility(compatibilityReport)}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
          <p className="text-slate-400">Campos reconocidos</p>
          <p className="mt-1 font-medium">{(compatibilityReport.camposReconocidos || []).join(", ") || "Ninguno"}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
          <p className="text-slate-400">Campos legacy no reconocidos</p>
          <p className="mt-1 font-medium">{(compatibilityReport.camposNoReconocidos || []).join(", ") || "Ninguno"}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
          <p className="text-slate-400">Campos críticos ausentes</p>
          <p className="mt-1 font-medium">{(compatibilityReport.camposCriticosAusentes || []).join(", ") || "Ninguno"}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
          <p className="text-slate-400">Campos detectados</p>
          <p className="mt-1 font-medium">{(compatibilityReport.fieldsSeen || []).length}</p>
        </div>
      </div>

      <OrdenShadowDecisionPanel shadowResult={viewModel.shadowResult} legacyOrden={viewModel.legacyOrden} />

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200">
          <p className="text-slate-400">Snapshot sanitizado</p>
          <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
            {JSON.stringify(compatibilityReport.snapshotSanitizado, null, 2)}
          </pre>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-sm text-slate-200">
          <p className="text-slate-400">Reporte compatibilidad</p>
          <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
            {JSON.stringify({
              compatible: compatibilityReport.compatible,
              nivel: compatibilityReport.nivel,
              warnings: compatibilityReport.warnings,
            }, null, 2)}
          </pre>
        </div>
      </div>
    </section>
  );
}

