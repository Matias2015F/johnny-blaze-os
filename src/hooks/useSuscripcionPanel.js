import { useState, useMemo, useEffect } from "react";
import { auth, db } from "../firebase.js";
import { getDocs, collection, query, orderBy, limit } from "firebase/firestore";
import {
  DEFAULT_SAAS_ADMIN_SETTINGS as DEFAULT_ADMIN_SETTINGS,
  actualizarSuscripcionUsuario, crearTicketSoporte,
  leerAdminSettings, leerUsuarioSaas, normalizeDateMs,
} from "../services/saasService.js";

// Todas las acciones retornan { ok, mensaje }. La vista llama showToast(mensaje).
export function useSuscripcionPanel() {
  const [loading,       setLoading]       = useState(true);
  const [account,       setAccount]       = useState(null);
  const [settings,      setSettings]      = useState(DEFAULT_ADMIN_SETTINGS);
  const [invoices,      setInvoices]      = useState([]);
  const [sending,       setSending]       = useState(false);
  const [paymentResult, setPaymentResult] = useState(null); // "ok" | "error" | "pendiente" | null
  const [lastAttempt,   setLastAttempt]   = useState(null);
  const [initError,     setInitError]     = useState(null); // string | null — vista lo toastea

  const uid = auth.currentUser?.uid;

  // ─── Carga principal ────────────────────────────────────────────────────────

  const cargar = async () => {
    if (!uid) return null;
    setLoading(true);
    let errorMsg = null;
    try {
      const [usuario, global] = await Promise.all([leerUsuarioSaas(uid), leerAdminSettings()]);
      setAccount(usuario);
      setSettings(global);
    } catch (e) {
      errorMsg = "No se pudo cargar la suscripción";
      console.error(e);
    } finally {
      setLoading(false);
    }
    // Facturas en sub-colección — falla silenciosa para no bloquear settings
    try {
      const snap = await getDocs(
        query(collection(db, "usuarios", uid, "billingInvoices"), orderBy("fecha", "desc"), limit(5))
      );
      setInvoices(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.warn("No se pudieron cargar facturas:", e.message);
    }
    return errorMsg;
  };

  useEffect(() => {
    cargar().then((err) => setInitError(err));
  }, [uid]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const pago   = params.get("pago");
      const cs     = params.get("collection_status");
      let result   = null;
      if (pago === "ok" || pago === "error" || pago === "pendiente") {
        result = pago;
      } else if (cs === "approved") {
        result = "ok";
      } else if (cs === "rejected" || cs === "cancelled") {
        result = "error";
      } else if (cs === "pending" || cs === "in_process") {
        result = "pendiente";
      }
      setPaymentResult(result);
    } catch { setPaymentResult(null); }

    try {
      const raw = window.localStorage.getItem("jbos_last_mp_attempt");
      setLastAttempt(raw ? JSON.parse(raw) : null);
    } catch { setLastAttempt(null); }
  }, []);

  // ─── Derivados ──────────────────────────────────────────────────────────────

  const planKey    = String(account?.currentPlanKey || account?.plan || "base");
  const planLabel  = account?.estado === "trial"
    ? "Prueba"
    : settings?.plans?.[planKey]?.label ||
      (planKey === "pro" ? "Trimestral" : planKey === "full" ? "Anual" : "Mensual");
  const estadoLabel  = account?.estado === "activo" ? "Activa"
    : account?.estado === "trial" ? "En prueba" : "Vencida";
  const activoHasta  = normalizeDateMs(account?.activoHasta || account?.trialEndsAt || account?.nextBillingAt);
  const previousPlanKey = account?.previousPlanKey || "";

  const latestInvoiceAttempt = useMemo(() => {
    const latest = invoices[0];
    if (!latest) return null;
    return {
      invoiceId:    latest.invoiceId  || latest.id          || null,
      preferenceId: latest.preferenceId                     || null,
      mode:         latest.mpMode                           || null,
      tokenMode:    latest.mercadoPagoTokenMode             || null,
      planKey:      latest.planKey                          || null,
      at:           normalizeDateMs(latest.updatedAt) || normalizeDateMs(latest.createdAt) || null,
      status:       latest.status                           || null,
      errorMessage: latest.errorMessage || latest.errorText || null,
      mpStatus:     latest.errorHttpStatus                  || null,
    };
  }, [invoices]);

  const activeAttempt = useMemo(() => {
    if (!lastAttempt)           return latestInvoiceAttempt;
    if (!latestInvoiceAttempt)  return lastAttempt;
    const localAt   = Number(lastAttempt.at          || 0);
    const invoiceAt = Number(latestInvoiceAttempt.at || 0);
    return invoiceAt >= localAt ? latestInvoiceAttempt : lastAttempt;
  }, [lastAttempt, latestInvoiceAttempt]);

  // ─── Helpers internos ───────────────────────────────────────────────────────

  const persistPaymentAttempt = (attempt) => {
    if (!attempt?.invoiceId && !attempt?.preferenceId) return;
    const normalized = {
      invoiceId:    attempt.invoiceId    || null,
      preferenceId: attempt.preferenceId || null,
      mode:         attempt.mode         || null,
      tokenMode:    attempt.tokenMode    || null,
      planKey:      attempt.planKey      || null,
      at:           attempt.at           || Date.now(),
      status:       attempt.status       || null,
      errorMessage: attempt.errorMessage || null,
      mpStatus:     attempt.mpStatus     || null,
    };
    try { window.localStorage.setItem("jbos_last_mp_attempt", JSON.stringify(normalized)); } catch {}
    setLastAttempt(normalized);
  };

  // ─── Acciones ───────────────────────────────────────────────────────────────

  // returns { ok, url, sandbox, mensaje }
  const irAPagar = async (targetPlanKey) => {
    setSending(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res     = await fetch("/api/mp-create-preference", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body:    JSON.stringify({
          uid,
          plan:       targetPlanKey,
          planLabel:  settings.plans?.[targetPlanKey]?.label || targetPlanKey,
          planPrice:  settings.precios?.[targetPlanKey] ?? 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        const statusLine = res?.status ? `HTTP ${res.status}` : "";
        const hint       = String(data.error || data.mpMessage || "").includes("MP_ACCESS_TOKEN")
          ? " (configuración del servidor)" : "";
        persistPaymentAttempt({
          invoiceId:    data.invoiceId    || null,
          preferenceId: data.preferenceId || null,
          planKey: targetPlanKey, tokenMode: data.tokenMode || null, at: Date.now(),
          status: "error",
          errorMessage: [data.mpMessage, data.error, statusLine ? `${statusLine}${hint}` : ""].filter(Boolean).join(" · ") || null,
          mpStatus: data.mpStatus || null,
        });
        await cargar();
        const mensaje = [data.error, data.mpMessage, statusLine ? `${statusLine}${hint}` : ""].filter(Boolean).join(" · ")
          || "No se pudo generar el pago";
        return { ok: false, url: null, sandbox: false, mensaje };
      }
      persistPaymentAttempt({
        invoiceId: data.invoiceId || null, preferenceId: data.preferenceId || null,
        mode: data.mode || null, tokenMode: data.tokenMode || null,
        planKey: targetPlanKey, at: Date.now(),
      });
      return { ok: true, url: data.url, sandbox: data.mode === "sandbox", mensaje: null };
    } catch (e) {
      return { ok: false, url: null, sandbox: false, mensaje: e.message || "No se pudo iniciar el pago" };
    } finally {
      setSending(false);
    }
  };

  // returns { ok, mensaje }
  const solicitarCambioPlan = async (targetPlanKey) => {
    setSending(true);
    try {
      await actualizarSuscripcionUsuario(uid, { requestedAction: "change_plan", requestedPlanKey: targetPlanKey });
      await cargar();
      return { ok: true, mensaje: "Pedido enviado para volver al plan anterior" };
    } catch {
      return { ok: false, mensaje: "No se pudo guardar el pedido" };
    } finally {
      setSending(false);
    }
  };

  // La vista pasa los campos del formulario como parámetros. Returns { ok, mensaje }.
  const cancelarSuscripcion = async ({ reasonCode, reasonText, comment }) => {
    setSending(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res     = await fetch("/api/cancel-plan", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body:    JSON.stringify({ reasonCode, reasonText, comment }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo cancelar");
      await cargar();
      return { ok: true, mensaje: "Cancelación registrada. Te enviamos un correo con una opción para reactivar." };
    } catch (e) {
      return { ok: false, mensaje: e.message || "No se pudo cancelar" };
    } finally {
      setSending(false);
    }
  };

  // La vista valida que noteText no esté vacío antes de llamar. Returns { ok, mensaje }.
  const enviarReclamo = async (noteText) => {
    setSending(true);
    try {
      await crearTicketSoporte({
        uid, email: auth.currentUser?.email || "",
        tipo:          "reclamo_suscripcion",
        mensaje:       noteText,
        currentPlanKey: account?.currentPlanKey || "",
      });
      return { ok: true, mensaje: "Reclamo enviado al administrador" };
    } catch {
      return { ok: false, mensaje: "No se pudo enviar el reclamo" };
    } finally {
      setSending(false);
    }
  };

  // returns { ok, mensaje }
  const diagnosticarPago = async () => {
    setSending(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res     = await fetch("/api/mp-diagnose", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body:    JSON.stringify({
          preferenceId: activeAttempt?.preferenceId || null,
          invoiceId:    activeAttempt?.invoiceId    || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo diagnosticar");
      const payment = Array.isArray(data.payments) && data.payments.length ? data.payments[0] : null;
      if (!payment) {
        const invoiceError = data.invoice?.errorMessage || data.invoice?.errorText || data.preferenceError || data.paymentsError;
        if (invoiceError) return { ok: false, mensaje: String(invoiceError).slice(0, 180) };
        if (data.preference) return { ok: false, mensaje: "Preferencia creada, pero Mercado Pago no registro pago. Revisa que el comprador sea usuario test distinto." };
        return { ok: false, mensaje: "Sin pagos asociados todavía. Proba de nuevo en 30s." };
      }
      const status = payment?.status || payment?.status_detail || null;
      const detail = payment?.status_detail || null;
      return { ok: true, mensaje: `MP: ${String(status || "sin estado")} ${detail ? `(${detail})` : ""}`.trim() };
    } catch (e) {
      return { ok: false, mensaje: e.message || "No se pudo diagnosticar el pago" };
    } finally {
      setSending(false);
    }
  };

  return {
    loading, account, settings, invoices, sending, paymentResult, activeAttempt, initError,
    uid, planKey, planLabel, estadoLabel, activoHasta, previousPlanKey,
    latestInvoiceAttempt,
    irAPagar, solicitarCambioPlan, cancelarSuscripcion, enviarReclamo, diagnosticarPago,
  };
}
