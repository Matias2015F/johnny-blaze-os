# Contrato de Billing

Coleccion actual:
- `usuarios/{uid}/billingInvoices`
- `billingEvents`

Campos base:
- `paymentId`
- `plan`
- `monto`
- `status`
- `statusDetail`
- `fecha`
- `createdAt`
- `updatedAt`

Regla operativa:
- Los cobros recurrentes siguen confirmándose por webhook.
