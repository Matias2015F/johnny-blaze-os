// ─────────────────────────────────────────────────────────────────────────────
// POST /api/mp-webhook
//
// Recibe notificaciones de Mercado Pago cuando cambia el estado de un pago.
// MP puede llamar este endpoint múltiples veces por el mismo pago (reintentos),
// por eso la lógica es idempotente (no importa si se ejecuta más de una vez).
//
// Configuración en MP:
//   Dashboard MP → Tu aplicación → Webhooks → Agregar URL de producción:
//   https://johnny-blaze-os.vercel.app/api/mp-webhook
//   Eventos a escuchar: "payment"
// ─────────────────────────────────────────────────────────────────────────────

const { db } = require("./_firebase-admin.js");

// ─────────────────────────────────────────────────────────────────────────────
// PLANES — deben coincidir con los montos definidos en mp-create-preference.js.
// Se detecta el plan comparando el monto pagado (con tolerancia por redondeos).
// ─────────────────────────────────────────────────────────────────────────────
const PLANES = [
  { monto: 5000,  dias: 30  },  // Mensual
  { monto: 12000, dias: 90  },  // Trimestral
  { monto: 40000, dias: 365 },  // Anual
];

// Tolerancia en ARS para comparar montos (MP a veces agrega centavos)
const TOLERANCIA = 50;

function detectarPlan(montoPagado) {
  return PLANES.find(p => Math.abs(p.monto - montoPagado) <= TOLERANCIA) ?? null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { type, data } = req.body || {};

  // MP envía varios tipos: "payment", "merchant_order", etc.
  // Solo procesamos pagos individuales.
  if (type !== "payment") {
    return res.status(200).json({ ok: true, ignorado: true, tipo: type });
  }

  const paymentId = data?.id;
  if (!paymentId) return res.status(400).json({ error: "Sin payment id" });

  // ── Verificar el pago contra la API de MP ─────────────────────────────────
  // NUNCA confiar solo en los datos del webhook.
  // Siempre consultar a MP para obtener el estado real del pago.
  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
  });

  if (!mpRes.ok) {
    console.error("Error al consultar pago en MP:", await mpRes.text());
    // Responder 200 para que MP no reintente inmediatamente
    return res.status(200).json({ error: "No se pudo verificar el pago" });
  }

  const pago = await mpRes.json();

  // Solo habilitar si el pago está efectivamente aprobado
  if (pago.status !== "approved") {
    return res.status(200).json({ ok: true, ignorado: true, status: pago.status });
  }

  // ── Obtener UID del usuario desde external_reference ──────────────────────
  // external_reference fue enviado en mp-create-preference.js con el Firebase UID.
  // Si cambiás cómo identificás al usuario, modificá esta lógica y el otro endpoint.
  const uid = pago.external_reference;
  if (!uid) {
    console.error("Pago aprobado pero sin external_reference:", paymentId);
    return res.status(400).json({ error: "Sin external_reference (uid)" });
  }

  // ── Detectar plan por monto pagado ────────────────────────────────────────
  const montoPagado = pago.transaction_amount;
  let plan = detectarPlan(montoPagado);

  if (!plan) {
    // Monto no coincide con ningún plan — habilitamos 30 días como fallback.
    // Revisar si el usuario pagó un monto incorrecto o si falta agregar el plan.
    console.warn(`Monto $${montoPagado} no coincide con ningún plan. Aplicando 30 días.`);
    plan = { dias: 30 };
  }

  // ── Actualizar Firestore ───────────────────────────────────────────────────
  const ahora = Date.now();
  const activoHasta = ahora + plan.dias * 24 * 60 * 60 * 1000;

  await db.collection("usuarios").doc(uid).update({
    estado:      "activo",
    activoHasta, // timestamp en ms — la app chequea este valor si querés agregar vencimiento de plan pago
    ultimoPago: {
      paymentId: String(paymentId),
      monto:     montoPagado,
      fecha:     ahora,
      dias:      plan.dias,
    },
  });

  console.log(`✅ Usuario ${uid} habilitado por ${plan.dias} días hasta ${new Date(activoHasta).toLocaleDateString("es-AR")}`);
  return res.status(200).json({ ok: true });
};
