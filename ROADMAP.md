# ROADMAP.md — MotoGestión

Objetivo principal:
Vender un producto viable a talleres mecánicos y generar ingresos recurrentes.

---

## Fase 1 — Producto vendible ✅

Que el taller pueda trabajar más ordenado y entregar comprobantes profesionales.

Incluye:
- órdenes de trabajo
- clientes y motos
- presupuestos
- comprobantes PDF con garantía
- backup / restauración
- admin básico
- suscripciones funcionales

---

## Fase 2 — Comprobante verificable ✅

Convertir cada PDF en un documento con respaldo verificable.

Incluye:
- [x] token único por comprobante (receiptService.js)
- [x] QR en el PDF (ExportPdfView.jsx)
- [x] ruta pública /verificar/:token (App.jsx)
- [x] datos públicos mínimos sin precios (publicReceipts)
- [x] estado: pendiente / validado / anulado (validationStatus)

Cerrada: 2026-05-25 — commit d29379f

---

## Fase 3 — Validación y reputación interna ✅

Que el cliente pueda validar el comprobante y que eso construya reputación del taller.

Incluye:
- [x] flujo "Validá el mantenimiento de tu moto" antes de calificar
- [x] verificación por últimos 4 dígitos del teléfono
- [x] preguntas adaptadas al tipo de comprobante (servicio vs diagnóstico)
- [x] calificación vinculada al comprobante (maintenanceValidated, documentType)
- [x] reputación interna en panel del taller (tab "Reput.")
- [x] auto-aprobación: phoneVerified=true y fraudScore<20 → reputationWeight=1, status=aprobado

Cerrada: 2026-05-25 — commit 42d3bed

---

## Fase 4 — Autoridad pública ← FOCO SIGUIENTE

Mostrar talleres verificados públicamente.

Incluye:
- [ ] publicWorkshops con datos reales de talleres
- [ ] perfil público del taller
- [ ] sello MotoGestión Verificado
- [ ] reputación visible públicamente
- [ ] red por ciudad (mapa — estructura en landing ya lista)

Regla: no empezar hasta confirmar Fase 3 estable en producción.

---

## Fase 5 — Escala

Expandir a otros rubros y aumentar ticket.

Incluye:
- autos
- repuesteras
- alianzas
- mapa / ranking
- leads para talleres
- planes premium

---

Regla:
No avanzar a la siguiente fase hasta que la anterior esté cerrada, estable y vendible.
