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

## Fase 4 — Autoridad pública ✅

Mostrar talleres verificados públicamente.

Incluye:
- [x] publicWorkshops escritura via API autenticada (publish-workshop en verify-document.js)
- [x] perfil público del taller en /taller/:uid (TallerPublicView.jsx)
- [x] sello MotoGestión Verificado en perfil público
- [x] reputación visible públicamente (avg, count, recomienda %, categorías)
- [x] red por ciudad (mapa en landing lee publicWorkshops automáticamente)
- [x] botón "Publicar en la red" en tab Reput. del panel del taller

Cerrada: 2026-05-25 — commit 0b22a6d

## Fase 5 — Escala ← FOCO SIGUIENTE

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
