import React, { useState } from "react";
import { useVerifyReceipt } from "../hooks/useVerifyReceipt.js";

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
            className={`h-11 w-11 rounded-xl text-xl font-black transition-all active:scale-95 ${
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

function LoyaltyRewardCard({ incentive, compact = false }) {
  if (!incentive) return null;

  return (
    <div className="rounded-3xl border border-green-200 bg-green-50 p-4 text-left">
      <p className="text-[9px] font-black uppercase tracking-widest text-green-700">Premio por tu tiempo</p>
      <p className="mt-1 text-lg font-black text-green-900">
        {incentive.discountPct}% de descuento en tu proxima visita
      </p>
      <p className="mt-2 text-sm leading-relaxed text-green-800">
        Al descargar, este beneficio queda guardado para esta moto.
      </p>
      {!compact && (
        <p className="mt-2 text-xs leading-relaxed text-green-700">
          En el proximo presupuesto, la app le avisa al taller y descuenta el {incentive.discountPct}% como cliente fiel. No depende de que el mecanico se acuerde.
        </p>
      )}
    </div>
  );
}

export default function VerifyReceiptView({ token }) {
  const {
    estado,
    receipt,
    fase,
    setFase,
    ratingIncentive,
    enviando,
    errorEnvio,
    descargando,
    downloadError,
    descargarPdf,
    submitRating,
  } = useVerifyReceipt(token);

  const [phoneLast4, setPhoneLast4] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [checks, setChecks] = useState([true, true, true, true]);
  const [scores, setScores] = useState({ atencion: 0, claridad: 0, trabajo: 0, cumplimiento: 0 });
  const [recomienda, setRecomienda] = useState(null);
  const [comentario] = useState("");

  const verificarTelefono = () => {
    if (phoneLast4.replace(/\D/g, "").length !== 4) {
      setPhoneError("Ingresá exactamente los últimos 4 dígitos.");
      return;
    }
    setPhoneError("");
    setFase("formulario");
  };

  const checksValidos = checks.every(Boolean);

  const formValido =
    scores.atencion > 0 &&
    scores.claridad > 0 &&
    scores.trabajo > 0 &&
    scores.cumplimiento > 0 &&
    checksValidos;

  const setCalificacionRapida = (valor) => {
    setScores({ atencion: valor, claridad: valor, trabajo: valor, cumplimiento: valor });
    if (recomienda === null) setRecomienda(valor >= 4);
  };

  const enviarCalificacion = async () => {
    if (!formValido || enviando) return;
    await submitRating({ phoneLast4, scores, recomienda, comentario });
  };

  const fechaLabel = receipt?.fechaEmision
    ? new Date(receipt.fechaEmision).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })
    : null;
  const mostrarDetalleCompleto = estado !== "verificado" || fase === "enviado";

  return (
    <div className="min-h-screen bg-zinc-50 font-sans">
      <nav className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
        <MgLogo />
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Descargar comprobante</span>
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
                    Comprobante listo
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

              {mostrarDetalleCompleto && receipt.resumen?.trabajos?.length > 0 && (
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

              {mostrarDetalleCompleto && receipt.resumen?.repuestos?.length > 0 && (
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

              {mostrarDetalleCompleto && receipt.resumen?.garantia && (
                <div className="rounded-2xl bg-zinc-50 border border-zinc-100 p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                    {receipt.documentType === "diagnostico_presupuesto_cerrado"
                      ? "Condición de cierre"
                      : "Garantía"}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-700">{receipt.resumen.garantia}</p>
                </div>
              )}

              {mostrarDetalleCompleto && (
              <p className="text-[10px] leading-relaxed text-zinc-400">
                Este comprobante fue generado desde Moto Gestión y está asociado a una orden de trabajo registrada.
              </p>
              )}
            </div>

            {estado === "verificado" && (
              <>
                {mostrarDetalleCompleto && (
                <div className="grid grid-cols-1 gap-2">
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
                </div>
                )}
                {receipt.pdfStoragePath && (
                  <div className="rounded-3xl border border-orange-200 bg-orange-50 p-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-orange-700">PDF disponible</p>
                    <p className="mt-1 text-sm font-black text-orange-900">Calificá y descargá tu comprobante</p>
                    <p className="mt-2 text-xs leading-relaxed text-orange-800">
                      Tocá las estrellas y después el botón naranja. Listo.
                    </p>
                  </div>
                )}
              </>
            )}

            {estado === "ya_calificado" && fase !== "enviado" && (
              <div className="space-y-4 rounded-3xl border border-green-200 bg-green-50 p-6 text-center">
                <p className="text-2xl">★★★★★</p>
                <p className="font-black text-green-800">Este comprobante ya fue calificado</p>
                <p className="text-sm text-green-700">Gracias por tu opinión. La calificación quedó asociada a un trabajo real documentado.</p>
                {receipt.pdfStoragePath ? (
                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      onClick={descargarPdf}
                      disabled={descargando}
                      className="w-full rounded-2xl bg-orange-600 py-3 text-[11px] font-black uppercase tracking-widest text-white active:scale-95 transition-all disabled:opacity-60"
                    >
                      {descargando ? "Generando enlace..." : "Descargar comprobante PDF"}
                    </button>
                    {downloadError && <p className="text-sm font-bold text-red-600">{downloadError}</p>}
                  </div>
                ) : (
                  <p className="text-xs text-green-700">El PDF estará disponible en breve. Si no aparece, pedíselo al taller.</p>
                )}
                <LoyaltyRewardCard incentive={ratingIncentive} compact />
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
                    onClick={() => setFase("formulario")}
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
              <div className="space-y-5 rounded-3xl border border-zinc-200 bg-white p-6">
                <div>
                  <p className="text-lg font-black text-zinc-900">Descargar comprobante del trabajo</p>
                  <p className="mt-1 text-sm text-zinc-500">Toca una calificacion y descargalo.</p>
                </div>

                <StarSelector
                  label="Califica la atencion"
                  value={scores.atencion}
                  onChange={setCalificacionRapida}
                />

                <LoyaltyRewardCard incentive={ratingIncentive} compact />

                {errorEnvio && <p className="text-sm font-bold text-red-600">{errorEnvio}</p>}

                <button
                  onClick={enviarCalificacion}
                  disabled={!formValido || enviando}
                  className="w-full rounded-2xl bg-orange-600 py-4 text-sm font-black uppercase tracking-widest text-white transition-all active:scale-95 disabled:opacity-40"
                >
                  {enviando ? "Preparando descarga..." : "Descargar comprobante del trabajo"}
                </button>

                <p className="text-center text-[10px] leading-relaxed text-zinc-400">
                  Tu calificacion queda asociada a este trabajo real.
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
                    Ya podés descargarlo como respaldo del mantenimiento realizado.
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
                  {receipt.pdfStoragePath ? (
                    <>
                      <button
                        type="button"
                        onClick={descargarPdf}
                        disabled={descargando}
                        className="w-full rounded-2xl bg-orange-600 py-3 text-[11px] font-black uppercase tracking-widest text-white active:scale-95 transition-all disabled:opacity-60"
                      >
                        {descargando ? "Generando enlace..." : "Descargar comprobante PDF"}
                      </button>
                      {downloadError && <p className="text-sm font-bold text-red-600">{downloadError}</p>}
                    </>
                  ) : (
                    <p className="text-xs text-zinc-500">El PDF estará disponible en breve. Si no aparece, pedíselo al taller.</p>
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
