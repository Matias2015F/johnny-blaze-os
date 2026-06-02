import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase.js";

function StarSelector({ value, onChange, label }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-zinc-700">{label}</p>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${n} estrellas`}
            className={`h-11 w-11 rounded-xl text-xl font-black transition-all active:scale-90 ${
              n <= value ? "bg-yellow-400 text-yellow-900" : "bg-zinc-100 text-zinc-300 hover:bg-zinc-200"
            }`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

function MgLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-600 text-xs font-black text-white">MG</div>
      <span className="text-sm font-black tracking-tight text-zinc-700">Moto Gestión</span>
    </div>
  );
}

function ErrorCard({ title, text, icon = "!" }) {
  return (
    <div className="space-y-4 rounded-3xl border border-red-200 bg-white p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl font-black text-red-500">{icon}</div>
      <div>
        <p className="text-lg font-black text-zinc-900">{title}</p>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">{text}</p>
      </div>
    </div>
  );
}

function normalizeDiscountPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(50, Math.round(n)));
}

function normalizeIncentive(incentive) {
  const discountPct = normalizeDiscountPct(incentive?.discountPct);
  if (!incentive?.enabled || discountPct <= 0) return null;
  return {
    ...incentive,
    discountPct,
    title: incentive.title || `${discountPct}% de descuento en tu proxima visita`,
    description: incentive.description || "El beneficio queda registrado automaticamente para esta moto si la calificacion queda validada.",
  };
}

function LoyaltyRewardCard({ incentive, compact = false }) {
  if (!incentive) return null;

  return (
    <div className="rounded-3xl border border-green-200 bg-green-50 p-4 text-left">
      <p className="text-[9px] font-black uppercase tracking-widest text-green-700">Premio por tu tiempo</p>
      <p className="mt-1 text-lg font-black text-green-900">
        {incentive.discountPct}% de descuento en tu proxima visita
      </p>
      <p className="mt-2 text-sm leading-relaxed text-green-800">
        Si completas la validacion y la calificacion, MotoGestion registra automaticamente este beneficio para esta moto.
      </p>
      {!compact && (
        <p className="mt-2 text-xs leading-relaxed text-green-700">
          En el proximo presupuesto, la app le avisa al taller y descuenta el {incentive.discountPct}% como cliente fiel. No depende de que el mecanico se acuerde.
        </p>
      )}
    </div>
  );
}

function getScoreLabels(documentType) {
  if (documentType === "diagnostico_presupuesto_cerrado") {
    return [
      { key: "atencion",     label: "Atención recibida" },
      { key: "claridad",     label: "Claridad del diagnóstico" },
      { key: "trabajo",      label: "Claridad del presupuesto" },
      { key: "cumplimiento", label: "Transparencia del cierre" },
    ];
  }
  return [
    { key: "atencion",     label: "Atención recibida" },
    { key: "claridad",     label: "Claridad del presupuesto" },
    { key: "trabajo",      label: "Calidad del trabajo" },
    { key: "cumplimiento", label: "Cumplimiento de lo acordado" },
  ];
}

export default function VerifyReceiptView({ token }) {
  const [estado, setEstado] = useState("cargando");
  const [receipt, setReceipt] = useState(null);
  const [fase, setFase] = useState("verificacion");
  const [phoneLast4, setPhoneLast4] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [checks, setChecks] = useState([false, false, false, false]);
  const [scores, setScores] = useState({ atencion: 0, claridad: 0, trabajo: 0, cumplimiento: 0 });
  const [recomienda, setRecomienda] = useState(null);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");
  const [ratingIncentive, setRatingIncentive] = useState(null);

  useEffect(() => {
    if (!token) {
      setEstado("no_encontrado");
      return;
    }

    getDoc(doc(db, "publicReceipts", token))
      .then((snap) => {
        if (!snap.exists()) {
          setEstado("no_encontrado");
          return;
        }

        const data = snap.data();
        setReceipt(data);
        setRatingIncentive(normalizeIncentive(data.incentive));
        if (data.estado === "anulado") {
          setEstado("anulado");
          return;
        }
        if (data.ratingUsed) {
          setEstado("ya_calificado");
          return;
        }
        if (Number(data.ratingExpiresAt || 0) < Date.now()) {
          setEstado("vencido");
          return;
        }
        setEstado("verificado");
        // Start at checklist validation unless the receipt requires phone verification first.
        setFase(data.hasPhoneVerification ? "verificacion" : "validacion");
      })
      .catch(() => setEstado("no_encontrado"));
  }, [token]);

  useEffect(() => {
    if (!token || !receipt || ratingIncentive) return;

    let cancelled = false;
    fetch(`/api/receipt-incentive?token=${encodeURIComponent(token)}`)
      .then((response) => response.json().catch(() => ({})))
      .then((data) => {
        if (!cancelled && data?.ok) setRatingIncentive(normalizeIncentive(data.incentive));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [token, receipt, ratingIncentive]);

  const verificarTelefono = () => {
    if (phoneLast4.replace(/\D/g, "").length !== 4) {
      setPhoneError("Ingresá exactamente los últimos 4 dígitos.");
      return;
    }
    setPhoneError("");
    setFase("validacion");
  };

  const checksValidos = checks.every(Boolean);

  const formValido =
    scores.atencion > 0 &&
    scores.claridad > 0 &&
    scores.trabajo > 0 &&
    scores.cumplimiento > 0 &&
    recomienda !== null;

  const enviarCalificacion = async () => {
    if (!formValido || enviando) return;
    setEnviando(true);
    setErrorEnvio("");

    try {
      const response = await fetch("/api/submit-rating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          phoneLast4: phoneLast4.replace(/\D/g, ""),
          scoreAtencion: scores.atencion,
          scoreClaridad: scores.claridad,
          scoreTrabajo: scores.trabajo,
          scoreCumplimiento: scores.cumplimiento,
          recomienda,
          comentario: comentario.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        if (response.status === 403) setFase("verificacion");
        throw new Error(data.error || "No pudimos guardar la calificación.");
      }

      setFase("enviado");
      setEstado("ya_calificado");
    } catch (error) {
      setErrorEnvio(error.message || "No se pudo enviar la calificación. Intentá de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  const fechaLabel = receipt?.fechaEmision
    ? new Date(receipt.fechaEmision).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-zinc-50 font-sans">
      <nav className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
        <MgLogo />
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Verificación de comprobante</span>
      </nav>

      <div className="mx-auto max-w-md space-y-4 px-4 py-8">
        {estado === "cargando" && (
          <div className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-8 text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" />
            <p className="text-sm font-bold text-zinc-500">Verificando comprobante...</p>
          </div>
        )}

        {estado === "no_encontrado" && (
          <ErrorCard
            title="Comprobante no verificable"
            text="Este link no corresponde a un comprobante emitido desde Moto Gestión, o el enlace está incompleto."
          />
        )}

        {estado === "anulado" && (
          <ErrorCard
            title="Comprobante anulado"
            text="Este documento fue emitido originalmente, pero luego fue anulado. No permite calificación."
            icon="×"
          />
        )}

        {(estado === "verificado" || estado === "ya_calificado" || estado === "vencido") && receipt && (
          <>
            <div className={`space-y-4 rounded-3xl border bg-white p-6 ${estado === "verificado" ? "border-green-200" : "border-zinc-200"}`}>
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl font-black ${
                  estado === "verificado" ? "bg-green-100 text-green-600" : "bg-zinc-100 text-zinc-500"
                }`}>
                  ✓
                </div>
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${estado === "verificado" ? "text-green-600" : "text-zinc-400"}`}>
                    Comprobante verificado
                  </p>
                  <p className="text-lg font-black leading-tight text-zinc-900">{receipt.taller?.nombre || "Taller"}</p>
                  {receipt.taller?.ciudad && (
                    <p className="text-sm text-zinc-500">
                      {receipt.taller.ciudad}{receipt.taller.provincia ? `, ${receipt.taller.provincia}` : ""}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2 border-t border-zinc-100 pt-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Datos del documento</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-zinc-50 p-3">
                    <p className="text-[9px] font-black uppercase text-zinc-400">N° orden</p>
                    <p className="mt-1 font-mono text-sm font-black text-zinc-900">{receipt.numeroOrden}</p>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 p-3">
                    <p className="text-[9px] font-black uppercase text-zinc-400">Comprobante</p>
                    <p className="mt-1 font-mono text-sm font-black text-zinc-900">{receipt.numeroComprobante}</p>
                  </div>
                  {receipt.resumen?.moto && (
                    <div className="rounded-2xl bg-zinc-50 p-3">
                      <p className="text-[9px] font-black uppercase text-zinc-400">Vehículo</p>
                      <p className="mt-1 text-sm font-black text-zinc-900">{receipt.resumen.moto}</p>
                    </div>
                  )}
                  {receipt.resumen?.patente && (
                    <div className="rounded-2xl bg-zinc-50 p-3">
                      <p className="text-[9px] font-black uppercase text-zinc-400">Patente</p>
                      <p className="mt-1 font-mono text-sm font-black text-zinc-900">{receipt.resumen.patente}</p>
                    </div>
                  )}
                </div>
                {fechaLabel && (
                  <div className="rounded-2xl bg-zinc-50 p-3">
                    <p className="text-[9px] font-black uppercase text-zinc-400">Fecha de emisión</p>
                    <p className="mt-1 text-sm font-black text-zinc-900">{fechaLabel}</p>
                  </div>
                )}
              </div>

              {receipt.resumen?.trabajos?.length > 0 && (
                <div className="space-y-1 border-t border-zinc-100 pt-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                    {receipt.documentType === "diagnostico_presupuesto_cerrado"
                      ? "Diagnóstico realizado"
                      : "Trabajos realizados"}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {receipt.resumen.trabajos.map((t, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-700">
                        <span className="mt-0.5 text-orange-500">•</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {receipt.resumen?.repuestos?.length > 0 && (
                <div className="space-y-1 border-t border-zinc-100 pt-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                    {receipt.documentType === "diagnostico_presupuesto_cerrado"
                      ? "Repuestos presupuestados"
                      : "Repuestos utilizados"}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {receipt.resumen.repuestos.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-700">
                        <span className="mt-0.5 text-zinc-400">–</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {receipt.resumen?.garantia && (
                <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                    {receipt.documentType === "diagnostico_presupuesto_cerrado"
                      ? "Condición de cierre"
                      : "Garantía"}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-700">{receipt.resumen.garantia}</p>
                </div>
              )}

              <p className="text-[10px] leading-relaxed text-zinc-400">
                Este comprobante fue generado desde Moto Gestión y está asociado a una orden de trabajo registrada.
              </p>
            </div>

            {estado === "verificado" && (
              <>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({ title: "Comprobante", url: window.location.href });
                      } else {
                        navigator.clipboard?.writeText(window.location.href);
                      }
                    }}
                    className="w-full rounded-2xl border border-zinc-200 bg-white py-3 text-[11px] font-black uppercase tracking-widest text-zinc-700 active:scale-95 transition-all"
                  >
                    Guardar o compartir enlace
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (receipt.pdfUrl) window.open(receipt.pdfUrl, "_blank");
                    }}
                    disabled={!receipt.pdfUrl}
                    className={`w-full rounded-2xl py-3 text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all ${
                      receipt.pdfUrl ? "bg-orange-600 text-white" : "bg-zinc-200 text-zinc-400"
                    }`}
                  >
                    Descargar comprobante PDF
                  </button>
                </div>
                {!receipt.pdfUrl && (
                  <p className="text-[10px] leading-relaxed text-zinc-400">
                    El PDF descargable desde este portal aún no está habilitado. Podés pedir el PDF al taller o guardarlo desde WhatsApp.
                  </p>
                )}
              </>
            )}

            {estado === "ya_calificado" && fase !== "enviado" && (
              <div className="space-y-2 rounded-3xl border border-green-200 bg-green-50 p-6 text-center">
                <p className="text-2xl">★★★★★</p>
                <p className="font-black text-green-800">Este comprobante ya fue calificado</p>
                <p className="text-sm text-green-700">Gracias por tu opinión. La calificación quedó asociada a un trabajo real documentado.</p>
              </div>
            )}

            {estado === "vencido" && (
              <div className="rounded-3xl bg-zinc-100 p-5 text-center">
                <p className="text-sm font-bold text-zinc-500">El período de calificación venció. El comprobante sigue siendo válido como documento.</p>
              </div>
            )}

            {estado === "verificado" && fase === "verificacion" && (
              <div className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6">
                <div className="space-y-1">
                  <p className="font-black text-zinc-900">
                    {receipt.documentType === "diagnostico_presupuesto_cerrado"
                      ? "Validá la recepción de este comprobante"
                      : "Validá el mantenimiento de tu moto"}
                  </p>
                  <p className="text-sm leading-relaxed text-zinc-500">
                    Al validar, este registro queda vinculado a tu vehículo como historial verificado. El taller no puede modificarlo.
                  </p>
                </div>
                {receipt.hasPhoneVerification ? (
                  <>
                    <p className="text-sm text-zinc-500">
                      Ingresá los últimos 4 dígitos del celular registrado en la orden para confirmar que sos el titular.
                    </p>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={4}
                      value={phoneLast4}
                      onChange={(e) => setPhoneLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="Ej: 3456"
                      className="w-full rounded-2xl border-2 border-zinc-100 p-4 text-center text-2xl font-black tracking-widest text-zinc-900 outline-none focus:border-orange-400"
                    />
                    {(phoneError || errorEnvio) && <p className="text-sm font-bold text-red-600">{phoneError || errorEnvio}</p>}
                    <button
                      onClick={verificarTelefono}
                      disabled={phoneLast4.length !== 4}
                      className="w-full rounded-2xl bg-orange-600 py-4 text-sm font-black uppercase tracking-widest text-white transition-all active:scale-95 disabled:opacity-40"
                    >
                      Continuar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFase("validacion")}
                    className="w-full rounded-2xl bg-orange-600 py-4 text-[11px] font-black uppercase tracking-widest text-white active:scale-95 transition-all"
                  >
                    Continuar
                  </button>
                )}
              </div>
            )}

            {estado === "verificado" && fase === "validacion" && (
              <div className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6">
                <div className="space-y-1">
                  <p className="text-lg font-black text-zinc-900">Validar comprobante</p>
                  <p className="text-sm leading-relaxed text-zinc-500">
                    Confirmá que recibiste este comprobante y que los datos principales coinciden con el servicio informado.
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    "Reconozco esta moto como propia o vinculada a mí.",
                    "Recibí este comprobante del taller.",
                    "Los datos principales coinciden con lo informado.",
                    receipt.documentType === "diagnostico_presupuesto_cerrado"
                      ? "Entiendo la condición de cierre indicada."
                      : "Entiendo la condición de garantía indicada.",
                  ].map((texto, i) => (
                    <label key={i} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checks[i] || false}
                        onChange={(e) => {
                          const next = [...checks];
                          next[i] = e.target.checked;
                          setChecks(next);
                        }}
                        className="mt-0.5 h-5 w-5 rounded accent-orange-500 cursor-pointer"
                      />
                      <span className="text-sm leading-relaxed text-zinc-700">{texto}</span>
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setFase("formulario")}
                  disabled={!checksValidos}
                  className="w-full rounded-2xl bg-orange-600 py-4 text-[11px] font-black uppercase tracking-widest text-white active:scale-95 transition-all disabled:opacity-40"
                >
                  Validar comprobante
                </button>

                <p className="text-center text-[10px] leading-relaxed text-zinc-400">
                  Confirmás recepción del comprobante y conformidad inicial con los datos informados.
                </p>
              </div>
            )}

            {estado === "verificado" && fase === "formulario" && (
              <div className="space-y-6 rounded-3xl border border-zinc-200 bg-white p-6">
                <div>
                  <p className="text-lg font-black text-zinc-900">
                    {receipt.documentType === "diagnostico_presupuesto_cerrado"
                      ? "Calificá la atención y el presupuesto"
                      : "Calificá el servicio realizado"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">Tu calificación queda vinculada a este comprobante real y no puede editarse.</p>
                </div>

                <LoyaltyRewardCard incentive={ratingIncentive} />

                {getScoreLabels(receipt.documentType).map(({ key, label }) => (
                  <StarSelector
                    key={key}
                    label={label}
                    value={scores[key]}
                    onChange={(v) => setScores((s) => ({ ...s, [key]: v }))}
                  />
                ))}

                <div className="space-y-2">
                  <p className="text-sm font-bold text-zinc-700">¿Recomendarías este taller?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRecomienda(true)}
                      className={`rounded-2xl py-3 text-sm font-black uppercase tracking-widest transition-all active:scale-95 ${
                        recomienda === true ? "bg-green-500 text-white" : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      Si
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecomienda(false)}
                      className={`rounded-2xl py-3 text-sm font-black uppercase tracking-widest transition-all active:scale-95 ${
                        recomienda === false ? "bg-zinc-800 text-white" : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-bold text-zinc-700">Comentario <span className="font-normal text-zinc-400">(opcional)</span></p>
                  <textarea
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Contanos tu experiencia..."
                    className="w-full resize-none rounded-2xl border-2 border-zinc-100 p-4 text-sm text-zinc-900 outline-none focus:border-orange-400"
                  />
                </div>

                {errorEnvio && <p className="text-sm font-bold text-red-600">{errorEnvio}</p>}

                <button
                  onClick={enviarCalificacion}
                  disabled={!formValido || enviando}
                  className="w-full rounded-2xl bg-orange-600 py-4 text-sm font-black uppercase tracking-widest text-white transition-all active:scale-95 disabled:opacity-40"
                >
                  {enviando ? "Enviando..." : "Confirmar validación"}
                </button>

                <p className="text-center text-[10px] leading-relaxed text-zinc-400">
                  Una vez enviada, la validación queda registrada como parte del historial del vehículo.
                </p>
              </div>
            )}

            {fase === "enviado" && (
              <div className="space-y-4 rounded-3xl border border-green-200 bg-white p-8 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">✓</div>
                <div>
                  <p className="text-lg font-black text-zinc-900">Comprobante validado</p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                    Este registro quedó confirmado dentro del historial verificable de la moto.
                    Podés guardarlo como respaldo del mantenimiento realizado.
                  </p>
                </div>
                <LoyaltyRewardCard incentive={ratingIncentive} compact />
                <div className="flex flex-col gap-2 pt-2">
                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({ title: "Mi comprobante", url: window.location.href });
                      } else {
                        navigator.clipboard.writeText(window.location.href);
                      }
                    }}
                    className="w-full rounded-2xl border border-zinc-200 py-3 text-[11px] font-black uppercase tracking-widest text-zinc-700 active:scale-95 transition-all"
                  >
                    Guardar o compartir enlace
                  </button>
                  {receipt.pdfUrl && (
                    <button
                      type="button"
                      onClick={() => window.open(receipt.pdfUrl, "_blank")}
                      className="w-full rounded-2xl bg-orange-600 py-3 text-[11px] font-black uppercase tracking-widest text-white active:scale-95 transition-all"
                    >
                      Descargar comprobante PDF
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        <div className="pt-4 text-center">
          <p className="text-[10px] text-zinc-300">motogestion.ar · Comprobantes verificables</p>
        </div>
      </div>
    </div>
  );
}
