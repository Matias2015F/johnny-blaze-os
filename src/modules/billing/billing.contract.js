export const BILLING_USER_COLLECTION = "usuarios";
export const BILLING_INVOICES_COLLECTION = "billingInvoices";
export const BILLING_EVENTS_COLLECTION = "billingEvents";
export const BILLING_ESTADOS = ["pending", "approved", "rejected", "cancelled", "refunded"];

export const isEstadoBillingValido = (estado) => BILLING_ESTADOS.includes(String(estado || ""));
