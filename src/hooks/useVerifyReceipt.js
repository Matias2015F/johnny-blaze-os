import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase.js";

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
    description:
      incentive.description ||
      "El beneficio queda registrado automaticamente para esta moto si la calificacion queda validada.",
  };
}

export function useVerifyReceipt(token) {
  const [estado, setEstado] = useState("cargando");
  const [receipt, setReceipt] = useState(null);
  const [fase, setFase] = useState("verificacion");
  const [ratingIncentive, setRatingIncentive] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");
  const [descargando, setDescargando] = useState(false);
  const [downloadError, setDownloadError] = useState("");

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
        if (data.estado === "anulado") { setEstado("anulado"); return; }
        if (data.ratingUsed) { setEstado("ya_calificado"); return; }
        if (Number(data.ratingExpiresAt || 0) < Date.now()) { setEstado("vencido"); return; }
        setEstado("verificado");
        setFase(data.hasPhoneVerification ? "verificacion" : "formulario");
      })
      .catch(() => setEstado("no_encontrado"));
  }, [token]);

  useEffect(() => {
    if (!token || !receipt || ratingIncentive) return;
    let cancelled = false;
    fetch(`/api/verify-document?mode=receipt-incentive&token=${encodeURIComponent(token)}`)
      .then((r) => r.json().catch(() => ({})))
      .then((data) => {
        if (!cancelled && data?.ok) setRatingIncentive(normalizeIncentive(data.incentive));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token, receipt, ratingIncentive]);

  const descargarPdf = async () => {
    setDescargando(true);
    setDownloadError("");
    try {
      const resp = await fetch(`/api/download-receipt-pdf?token=${encodeURIComponent(token)}`);
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) throw new Error(data.error || "No se pudo obtener el enlace.");
      window.open(data.url, "_blank");
    } catch (e) {
      setDownloadError(e.message || "No se pudo descargar. Intentá de nuevo.");
    } finally {
      setDescargando(false);
    }
  };

  const submitRating = async ({ phoneLast4, scores, recomienda, comentario }) => {
    if (enviando) return { ok: false };
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
          recomienda: recomienda ?? scores.atencion >= 4,
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
      if (receipt?.pdfStoragePath) await descargarPdf();
      return { ok: true };
    } catch (error) {
      setErrorEnvio(error.message || "No se pudo enviar la calificación. Intentá de nuevo.");
      return { ok: false, mensaje: error.message };
    } finally {
      setEnviando(false);
    }
  };

  return {
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
  };
}
