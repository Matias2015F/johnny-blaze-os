// Email helper usando Resend REST API (sin SDK, solo fetch)
// Variables de entorno requeridas:
//   RESEND_API_KEY    — clave API de resend.com
//   RESEND_FROM_EMAIL — remitente verificado, ej: "Johnny Blaze OS <no-reply@tudominio.com>"

const FROM_DEFAULT = "Johnny Blaze OS <no-reply@johnnyblazetaller.com.ar>";

async function sendEmail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY no configurada — mail no enviado:", subject);
    return false;
  }
  if (!to) {
    console.warn("[email] Destinatario vacío — mail no enviado:", subject);
    return false;
  }

  const from = process.env.RESEND_FROM_EMAIL || FROM_DEFAULT;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error("[email] Resend error:", res.status, JSON.stringify(body));
    return false;
  }
  console.log("[email] Enviado OK →", to, "|", subject);
  return true;
}

// ── Templates ────────────────────────────────────────────────────────────────

function wrapTemplate(body) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:#0f172a;padding:20px 28px;display:flex;align-items:center;gap:12px;">
      <span style="font-size:22px;">🔧</span>
      <span style="color:#fff;font-weight:900;font-size:16px;letter-spacing:0.05em;">JOHNNY BLAZE OS</span>
    </div>
    <div style="padding:28px;">
      ${body}
    </div>
    <div style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
      <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">Este es un correo automático. No respondas este mensaje.</p>
    </div>
  </div>
</body>
</html>`;
}

function planLabel(plan = "") {
  if (plan === "pro") return "Plan Pro";
  if (plan === "base") return "Plan Base";
  return plan || "Plan activo";
}

function formatARS(monto = 0) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(monto);
}

function formatFecha(ms) {
  return new Date(ms).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
}

// Recibo de pago aprobado
function templateReciboPago({ plan, monto, activoHasta, paymentId }) {
  const subject = `✅ Recibo de pago — ${planLabel(plan)}`;
  const html = wrapTemplate(`
    <h2 style="margin:0 0 4px;font-size:20px;color:#1e293b;">Recibo de pago</h2>
    <p style="margin:0 0 20px;font-size:13px;color:#64748b;">Tu suscripción fue activada correctamente.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 0;color:#64748b;">Plan</td>
        <td style="padding:10px 0;font-weight:700;text-align:right;color:#1e293b;">${planLabel(plan)}</td>
      </tr>
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 0;color:#64748b;">Monto abonado</td>
        <td style="padding:10px 0;font-weight:700;text-align:right;color:#1e293b;">${formatARS(monto)}</td>
      </tr>
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 0;color:#64748b;">Válido hasta</td>
        <td style="padding:10px 0;font-weight:700;text-align:right;color:#1e293b;">${formatFecha(activoHasta)}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#64748b;font-size:11px;">N° de pago</td>
        <td style="padding:10px 0;text-align:right;color:#94a3b8;font-size:11px;">${paymentId}</td>
      </tr>
    </table>
    <div style="background:#f0fdf4;border-radius:10px;padding:14px 16px;">
      <p style="margin:0;font-size:13px;color:#166534;font-weight:600;">✓ Suscripción activa hasta el ${formatFecha(activoHasta)}.</p>
    </div>
  `);
  return { subject, html };
}

// Alerta de vencimiento próximo
function templateAlertaVencimiento({ diasRestantes, activoHasta }) {
  const urgente = diasRestantes <= 3;
  const subject = urgente
    ? `⚠️ Tu suscripción vence en ${diasRestantes} días — Renovar ahora`
    : `📅 Tu suscripción vence en ${diasRestantes} días`;
  const html = wrapTemplate(`
    <h2 style="margin:0 0 8px;font-size:20px;color:${urgente ? "#92400e" : "#1e293b"};">
      ${urgente ? "⚠️" : "📅"} Tu suscripción vence pronto
    </h2>
    <p style="margin:0 0 16px;font-size:14px;color:#475569;">
      Hola, te avisamos que tu suscripción de <strong>Johnny Blaze OS</strong> vence
      el <strong>${formatFecha(activoHasta)}</strong> — en <strong>${diasRestantes} días</strong>.
    </p>
    <div style="background:${urgente ? "#fef3c7" : "#eff6ff"};border-radius:10px;padding:14px 16px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:${urgente ? "#92400e" : "#1d4ed8"};">
        ${urgente
          ? "⚠️ Quedan pocos días. Si no renovás, la app quedará bloqueada al vencer."
          : "ℹ️ Acordate de renovar antes del vencimiento para no interrumpir el uso de la app."
        }
      </p>
    </div>
    <p style="margin:0;font-size:13px;color:#64748b;">
      Para renovar, ingresá a la app y dirigite a <strong>Configuración → Suscripción</strong>.
    </p>
  `);
  return { subject, html };
}

// Cambio de plan
function templateCambioPlan({ planAnterior, planNuevo, activoHasta }) {
  const subject = `🔄 Tu plan fue actualizado — ${planLabel(planNuevo)}`;
  const html = wrapTemplate(`
    <h2 style="margin:0 0 8px;font-size:20px;color:#1e293b;">Plan actualizado</h2>
    <p style="margin:0 0 16px;font-size:14px;color:#475569;">Tu plan de suscripción fue cambiado exitosamente.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 0;color:#64748b;">Plan anterior</td>
        <td style="padding:10px 0;font-weight:700;text-align:right;color:#64748b;">${planLabel(planAnterior)}</td>
      </tr>
      <tr style="border-bottom:1px solid #f1f5f9;">
        <td style="padding:10px 0;color:#64748b;">Plan nuevo</td>
        <td style="padding:10px 0;font-weight:700;text-align:right;color:#2563eb;">${planLabel(planNuevo)}</td>
      </tr>
      <tr>
        <td style="padding:10px 0;color:#64748b;">Válido hasta</td>
        <td style="padding:10px 0;font-weight:700;text-align:right;color:#1e293b;">${formatFecha(activoHasta)}</td>
      </tr>
    </table>
  `);
  return { subject, html };
}

module.exports = { sendEmail, templateReciboPago, templateAlertaVencimiento, templateCambioPlan };
