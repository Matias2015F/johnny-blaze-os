let db, verifyIdToken;
try {
  ({ db, verifyIdToken } = require("./_firebase-admin.js"));
} catch (initError) {
  console.error("ERROR al inicializar Firebase Admin:", initError.message);
}

const ADMIN_EMAILS = String(process.env.PLATFORM_ADMIN_EMAILS || "matias4604@gmail.com,fefe@gmail.com")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const ADMIN_UIDS = String(process.env.PLATFORM_ADMIN_UIDS || "TNwwuKJsIXN29zJg8HWfORawdFm1")
  .split(",")
  .map((uid) => uid.trim())
  .filter(Boolean);

function serializeFirestoreValue(value) {
  if (!value) return value;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (Array.isArray(value)) return value.map(serializeFirestoreValue);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [key, serializeFirestoreValue(val)]),
    );
  }
  return value;
}

async function assertAdmin(decoded) {
  const uid = decoded?.uid || "";
  const email = String(decoded?.email || "").toLowerCase();
  if (ADMIN_UIDS.includes(uid) || ADMIN_EMAILS.includes(email)) return true;

  const snap = await db.collection("usuarios").doc(uid).get();
  const data = snap.exists ? snap.data() || {} : {};
  if (data.rol === "admin" || data.isPlatformAdmin === true) return true;

  const err = new Error("No autorizado como administrador");
  err.status = 403;
  throw err;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Método no permitido" });
  if (!db) return res.status(500).json({ error: "Servidor sin base de datos" });

  let decoded;
  try {
    decoded = await verifyIdToken(req);
    await assertAdmin(decoded);
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message || "No autorizado" });
  }

  try {
    const [usuariosSnap, invoicesSnap, ticketsSnap, settingsSnap] = await Promise.all([
      db.collection("usuarios").get(),
      db.collectionGroup("billingInvoices").get(),
      db.collection("soporteTickets").get(),
      db.collection("admin_settings").doc("global").get(),
    ]);

    const accounts = usuariosSnap.docs.map((doc) => serializeFirestoreValue({ id: doc.id, uid: doc.id, ...doc.data() }));
    const invoices = invoicesSnap.docs.map((doc) => {
      const userDoc = doc.ref.parent.parent;
      return serializeFirestoreValue({
        id: doc.id,
        uid: userDoc?.id || doc.data()?.uid || "",
        path: doc.ref.path,
        ...doc.data(),
      });
    });
    const tickets = ticketsSnap.docs.map((doc) => serializeFirestoreValue({ id: doc.id, ...doc.data() }));
    const settings = settingsSnap.exists ? serializeFirestoreValue(settingsSnap.data()) : null;

    return res.status(200).json({
      ok: true,
      accounts,
      invoices,
      tickets,
      settings,
      loadedAt: Date.now(),
    });
  } catch (err) {
    console.error("admin-dashboard error:", err);
    return res.status(500).json({ error: err.message || "No se pudo cargar el panel admin" });
  }
};
