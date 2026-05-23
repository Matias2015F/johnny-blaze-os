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

export default function VerifyReceiptView({ token }) {
  const [estado, setEstado] = useState("cargando");
  const [receipt, setReceipt] = useState(null);
  const [fase, setFase] = useState("verificacion");
  const [phoneLast4, setPhoneLast4] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [scores, setScores] = useState({ atencion: 0, claridad: 0, trabajo: 0, cumplimiento: 0 });
  const [recomienda, setRecomienda] = useState(null);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");

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
      })
      .catch(() => setEstado("no_encontrado"));
  }, [token]);

  const verificarTelefono = () => {
    if (phoneLast4.replace(/\D/g, "").length !== 4) {
      setPhoneError("Ingresá exactamente los últimos 4 dígitos.");
      return;
    }
    setPhoneError("");
    setFase("formulario");
  };

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

              <p className="text-[10px] leading-relaxed text-zinc-400">
                Este comprobante fue generado desde Moto Gestión y está asociado a una orden de trabajo registrada.
              </p>
            </div>

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
                {receipt.hasPhoneVerification ? (
                  <>
                    <p className="font-black text-zinc-900">Verificá tu identidad</p>
                    <p className="text-sm leading-relaxed text-zinc-500">
                      Ingresá los últimos 4 dígitos del celular registrado en la orden. La validación se hace de forma segura en el servidor.
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
                    onClick={() => setFase("formulario")}
                    className="w-full rounded-2xl bg-orange-600 py-4 text-sm font-black uppercase tracking-widest text-white transition-all active:scale-95"
                  >
                    Calificar el servicio
                  </button>
                )}
              </div>
            )}

            {estado === "verificado" && fase === "formulario" && (
              <div className="space-y-6 rounded-3xl border border-zinc-200 bg-white p-6">
                <div>
                  <p className="text-lg font-black text-zinc-900">Calificá el servicio</p>
                  <p className="mt-1 text-sm text-zinc-500">Tu calificación queda asociada a un comprobante real.</p>
                </div>

                <StarSelector label="Atención recibida" value={scores.atencion} onChange={(v) => setScores((s) => ({ ...s, atencion: v }))} />
                <StarSelector label="Claridad del presupuesto" value={scores.claridad} onChange={(v) => setScores((s) => ({ ...s, claridad: v }))} />
                <StarSelector label="Calidad del trabajo" value={scores.trabajo} onChange={(v) => setScores((s) => ({ ...s, trabajo: v }))} />
                <StarSelector label="Cumplimiento de lo acordado" value={scores.cumplimiento} onChange={(v) => setScores((s) => ({ ...s, cumplimiento: v }))} />

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
                      Sí
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
                  {enviando ? "Enviando..." : "Enviar calificación"}
                </button>

                <p className="text-center text-[10px] leading-relaxed text-zinc-400">
                  La opinión queda pendiente de validación antes de sumar reputación pública del taller.
                </p>
              </div>
            )}

            {fase === "enviado" && (
              <div className="space-y-3 rounded-3xl border border-green-200 bg-green-50 p-8 text-center">
                <div className="text-4xl">★</div>
                <p className="text-lg font-black text-green-800">¡Gracias por tu calificación!</p>
                <p className="text-sm leading-relaxed text-green-700">
                  Tu opinión quedó asociada a un trabajo documentado. Eso ayuda a otros clientes a elegir con información real.
                </p>
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
