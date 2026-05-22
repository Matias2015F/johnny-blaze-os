// Email helper — Resend REST API (sin SDK, solo fetch)
// Vars requeridas: RESEND_API_KEY, RESEND_FROM_EMAIL

const FROM_DEFAULT = "Johnny Blaze OS <noreply@motogestion.ar>";

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

// ── Template base ─────────────────────────────────────────────────────────────

function wrapTemplate(body, { accentColor = "#E85A1A" } = {}) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Johnny Blaze OS</title>
</head>
<body style="margin:0;padding:0;background:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px;">

    <!-- Logo header -->
    <div style="background:#0A0A0A;border-radius:16px 16px 0 0;border:1px solid #2A2A2A;border-bottom:2px solid ${accentColor};padding:22px 28px;display:flex;align-items:center;gap:14px;">
      <div style="background:${accentColor};border-radius:10px;width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">🔧</div>
      <div>
        <p style="margin:0;font-size:9px;color:${accentColor};font-weight:800;letter-spacing:0.35em;text-transform:uppercase;">Mecánica de Motos</p>
        <p style="margin:0;font-size:19px;color:#ffffff;font-weight:900;letter-spacing:-0.03em;line-height:1;">JOHNNY BLAZE</p>
      </div>
    </div>

    <!-- Contenido principal -->
    <div style="background:#ffffff;padding:32px 28px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
      ${body}
    </div>

    <!-- Footer -->
    <div style="background:#0A0A0A;border-radius:0 0 16px 16px;border:1px solid #2A2A2A;border-top:none;padding:16px 28px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#555;">Correo automático · no respondas este mensaje</p>
      <p style="margin:4px 0 0;font-size:11px;color:#333;font-weight:600;">motogestion.ar</p>
    </div>

  </div>
</body>
</html>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function planLabel(plan = "") {
  if (plan === "base")  return "Plan Base";
  if (plan === "pro")   return "Plan Pro";
  if (plan === "full")  return "Plan Full";
  if (plan === "trial") return "Período de prueba";
  return plan || "Plan activo";
}

function formatARS(monto = 0) {
  return "ARS " + new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(monto);
}

function formatFecha(ms) {
  return new Date(Number(ms)).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
}

function btnPrimario(texto, url = "https://app.motogestion.ar") {
  return `<a href="${url}" style="display:inline-block;background:#E85A1A;color:#ffffff;font-weight:800;font-size:13px;text-decoration:none;padding:14px 28px;border-radius:10px;letter-spacing:0.03em;">${texto}</a>`;
}

function infoRow(label, value) {
  return `<tr>
    <td style="padding:10px 0;color:#6b7280;font-size:13px;border-bottom:1px solid #f3f4f6;">${label}</td>
    <td style="padding:10px 0;font-weight:700;text-align:right;color:#111827;font-size:13px;border-bottom:1px solid #f3f4f6;">${value}</td>
  </tr>`;
}

function alertBox(color, text) {
  const palettes = {
    green:  { bg: "#f0fdf4", border: "#86efac", text: "#166534" },
    orange: { bg: "#fff7ed", border: "#fdba74", text: "#9a3412" },
    red:    { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b" },
    blue:   { bg: "#eff6ff", border: "#93c5fd", text: "#1e40af" },
  };
  const p = palettes[color] || palettes.blue;
  return `<div style="background:${p.bg};border:1px solid ${p.border};border-radius:10px;padding:14px 16px;margin-bottom:20px;">
    <p style="margin:0;font-size:13px;color:${p.text};font-weight:600;">${text}</p>
  </div>`;
}

// ── Templates ─────────────────────────────────────────────────────────────────

function templateBienvenida({ email, diasTrial, trialHasta }) {
  const subject = "Bienvenido — prueba gratuita activa";
  const html = wrapTemplate(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#111827;font-weight:900;">¡Bienvenido al taller!</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">Tu cuenta fue creada exitosamente. Ya podés empezar a gestionar tu taller.</p>

    ${alertBox("green", `✓ Tu período de prueba gratuita está activo por ${diasTrial} días — hasta el ${formatFecha(trialHasta)}.`)}

    <p style="margin:0 0 16px;font-size:14px;color:#374151;">Con Johnny Blaze OS podés:</p>
    <ul style="margin:0 0 24px;padding:0 0 0 20px;font-size:14px;color:#374151;line-height:2;">
      <li>Registrar y seguir el estado de cada trabajo</li>
      <li>Gestionar clientes, motos y pagos</li>
      <li>Emitir comprobantes y PDFs</li>
      <li>Programar recordatorios de service</li>
      <li>Ver agenda semanal y estadísticas</li>
    </ul>

    <p style="margin:0 0 20px;text-align:center;">${btnPrimario("Abrir la app →", "https://app.motogestion.ar")}</p>

    <p style="margin:0;font-size:12px;color:#9ca3af;">Cuenta: ${email}</p>
  `);
  return { subject, html };
}

function templatePagoAprobado({ plan, monto, activoHasta, paymentId }) {
  const subject = "Recibo — Plan activo";
  const html = wrapTemplate(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#111827;font-weight:900;">Recibo de pago</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">Tu suscripción fue activada correctamente.</p>

    ${alertBox("green", `✓ ${planLabel(plan)} activo hasta el ${formatFecha(activoHasta)}.`)}

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${infoRow("Plan", planLabel(plan))}
      ${infoRow("Monto abonado", formatARS(monto))}
      ${infoRow("Válido hasta", formatFecha(activoHasta))}
      <tr>
        <td style="padding:10px 0;color:#9ca3af;font-size:11px;">N° de pago</td>
        <td style="padding:10px 0;text-align:right;color:#9ca3af;font-size:11px;">${paymentId}</td>
      </tr>
    </table>

    <p style="margin:0 0 20px;text-align:center;">${btnPrimario("Ir al taller →", "https://app.motogestion.ar")}</p>
  `);
  return { subject, html };
}

function templatePagoFallido({ plan, monto, motivo }) {
  const subject = "Pago no procesado";
  const html = wrapTemplate(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#111827;font-weight:900;">Pago no procesado</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">Tu pago no pudo completarse. Tus datos están seguros.</p>

    ${alertBox("red", `✗ El pago de ${formatARS(monto)} para el ${planLabel(plan)} fue rechazado.${motivo ? ` Motivo: ${motivo}.` : ""}`)}

    <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
      Puede deberse a fondos insuficientes, datos incorrectos de la tarjeta, o una restricción del banco. Revisá los datos e intentá de nuevo.
    </p>

    <p style="margin:0 0 20px;text-align:center;">${btnPrimario("Reintentar el pago →", "https://app.motogestion.ar")}</p>

    <p style="margin:0;font-size:12px;color:#9ca3af;">Si el problema persiste, contactanos por WhatsApp.</p>
  `, { accentColor: "#dc2626" });
  return { subject, html };
}

function templateVencimientoProximo({ diasRestantes, activoHasta }) {
  const urgente = diasRestantes <= 3;
  const subject = `Plan vence en ${diasRestantes} día${diasRestantes !== 1 ? "s" : ""}`;
  const html = wrapTemplate(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#111827;font-weight:900;">${urgente ? "⚠️" : "📅"} Tu plan vence pronto</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">
      Tu suscripción vence el <strong>${formatFecha(activoHasta)}</strong> — en <strong>${diasRestantes} día${diasRestantes !== 1 ? "s" : ""}</strong>.
    </p>

    ${alertBox(urgente ? "orange" : "blue",
      urgente
        ? `⚠️ Quedan pocos días. Si no renovás, la app quedará bloqueada al vencer.`
        : `ℹ️ Acordate de renovar antes del vencimiento para no interrumpir el servicio.`
    )}

    <p style="margin:0 0 20px;font-size:14px;color:#374151;">Para renovar ingresá a la app → <strong>Configuración → Suscripción</strong>.</p>

    <p style="margin:0 0 20px;text-align:center;">${btnPrimario("Renovar ahora →", "https://app.motogestion.ar")}</p>
  `, { accentColor: urgente ? "#d97706" : "#E85A1A" });
  return { subject, html };
}

function templateEnGracia({ graceEndsAt, diasRestantes }) {
  const subject = `Te quedan ${diasRestantes} día${diasRestantes !== 1 ? "s" : ""} para renovar`;
  const html = wrapTemplate(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#111827;font-weight:900;">Estás en período de gracia</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">
      Tu suscripción venció pero todavía podés renovar antes del <strong>${formatFecha(graceEndsAt)}</strong>.
    </p>

    ${alertBox("red", `⚠️ Te quedan ${diasRestantes} día${diasRestantes !== 1 ? "s" : ""} de gracia. Después de esa fecha tu acceso será suspendido.`)}

    <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
      Tus datos están guardados y seguros. Renovando recuperás el acceso completo al instante.
    </p>

    <p style="margin:0 0 20px;text-align:center;">${btnPrimario("Renovar mi plan →", "https://app.motogestion.ar")}</p>
  `, { accentColor: "#dc2626" });
  return { subject, html };
}

function templateSuspendido() {
  const subject = "Acceso suspendido";
  const html = wrapTemplate(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#111827;font-weight:900;">Acceso suspendido</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">Tu suscripción venció y el período de gracia finalizó.</p>

    ${alertBox("red", "✗ Tu acceso a la app fue suspendido. Tus datos están guardados y seguros.")}

    <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
      Para recuperar el acceso completo simplemente renovás tu plan. En cuanto el pago se confirme, la app se desbloquea automáticamente.
    </p>

    <p style="margin:0 0 20px;text-align:center;">${btnPrimario("Reactivar mi cuenta →", "https://app.motogestion.ar")}</p>

    <p style="margin:0;font-size:12px;color:#9ca3af;">¿Necesitás ayuda? Contactanos por WhatsApp desde la pantalla de bloqueo.</p>
  `, { accentColor: "#dc2626" });
  return { subject, html };
}

function templateReactivado({ plan, activoHasta }) {
  const subject = "Acceso reactivado";
  const html = wrapTemplate(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#111827;font-weight:900;">¡Acceso reactivado!</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">Tu pago fue procesado y tu cuenta está activa de nuevo.</p>

    ${alertBox("green", `✓ ${planLabel(plan)} activo hasta el ${formatFecha(activoHasta)}.`)}

    <p style="margin:0 0 20px;font-size:14px;color:#374151;">Todos tus datos siguen intactos. Podés seguir gestionando tu taller desde donde lo dejaste.</p>

    <p style="margin:0 0 20px;text-align:center;">${btnPrimario("Volver al taller →", "https://app.motogestion.ar")}</p>
  `);
  return { subject, html };
}

function templateCambioPlan({ planAnterior, planNuevo, activoHasta }) {
  const subject = "Plan actualizado";
  const html = wrapTemplate(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#111827;font-weight:900;">Plan actualizado</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">Tu plan de suscripción fue cambiado exitosamente.</p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      ${infoRow("Plan anterior", planLabel(planAnterior))}
      ${infoRow("Plan nuevo", `<span style="color:#E85A1A;">${planLabel(planNuevo)}</span>`)}
      ${infoRow("Válido hasta", formatFecha(activoHasta))}
    </table>

    <p style="margin:0 0 20px;text-align:center;">${btnPrimario("Ir al taller →", "https://app.motogestion.ar")}</p>
  `);
  return { subject, html };
}

function buildResetEmail({ email, link }) {
  return wrapTemplate(`
    <h2 style="margin:0 0 6px;font-size:22px;color:#111827;font-weight:900;">Restablecer contraseña</h2>
    <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">
      Recibimos una solicitud para restablecer la contraseña de la cuenta <strong>${email}</strong>.
    </p>

    ${alertBox("blue", "ℹ️ Si no fuiste vos quien lo solicitó, ignorá este correo. Tu contraseña no cambia.")}

    <p style="margin:0 0 8px;font-size:14px;color:#374151;">
      Hacé clic en el botón para crear una contraseña nueva. El link vence en <strong>1 hora</strong>.
    </p>

    <p style="margin:0 0 28px;text-align:center;">${btnPrimario("Crear nueva contraseña →", link)}</p>

    <p style="margin:0;font-size:11px;color:#9ca3af;">
      Si el botón no funciona, copiá y pegá este enlace en tu navegador:
    </p>
    <p style="margin:4px 0 0;font-size:11px;word-break:break-all;color:#6b7280;">${link}</p>
  `);
}

module.exports = {
  sendEmail,
  buildResetEmail,
  templateBienvenida,
  templatePagoAprobado,
  templatePagoFallido,
  templateVencimientoProximo,
  templateEnGracia,
  templateSuspendido,
  templateReactivado,
  templateCambioPlan,
};
