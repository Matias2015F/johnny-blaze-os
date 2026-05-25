# MEMORY.md — MotoGestión

Última actualización: 2026-05-25

## Decisiones estratégicas

- MotoGestión debe venderse como sistema de autoridad y confianza documentada para talleres.
- La frase central es: La confianza no se promete. Se documenta.
- El producto debe generar dinero antes de expandirse demasiado.
- El primer mercado es talleres de motos.
- La expansión futura puede ser autos, pero no ahora.
- La reputación debe nacer de comprobantes reales, no de opiniones sueltas.
- No se debe prometer certificación oficial, honestidad garantizada ni calidad mecánica absoluta.
- Sí se debe prometer documentación, trazabilidad, comprobantes verificables y reputación asociada a trabajos reales.

## Decisiones técnicas

- No tocar Mercado Pago si la tarea no es de pagos.
- No tocar backup/restauración si la tarea no es de datos.
- No tocar cálculos de órdenes si la tarea es de PDF/copy.
- Mantener cambios chicos y verificables.
- Prioridad actual: cerrar reputación interna con peso automático.

## Estado actual del circuito verificable

### Fase 2 — Comprobante verificable ✅ CERRADA

- [x] PDF generado con datos del trabajo
- [x] Token único por comprobante (crypto.randomUUID — receiptService.js)
- [x] QR incluido en el PDF (ExportPdfView.jsx)
- [x] Ruta pública /verificar/:token (App.jsx — deploy d29379f 2026-05-25)
- [x] Datos públicos mínimos sin precios (publicReceipts — taller, moto parcial, número, fecha)
- [x] Estado: pendiente / validado / anulado (validationStatus en receiptService.js y submit-rating.js)

### Fase 3 — Validación y reputación interna ← FOCO ACTUAL

- [x] Flujo de validación antes de calificar ("Validá el mantenimiento de tu moto")
- [x] Verificación por últimos 4 dígitos del teléfono (submit-rating.js — phoneVerified)
- [x] Preguntas adaptadas al tipo de comprobante (servicio_realizado vs diagnostico_presupuesto_cerrado)
- [x] Calificación vinculada al comprobante (maintenanceValidated, documentType, incentiveOffered en ratings)
- [x] validationStatus: "validado" + validatedAt escritos al receipt al completar calificación
- [x] Pantalla final "Mantenimiento validado" con incentivo si existe
- [x] Panel de reputación interna en ConfigView (tab "Reput.")
- [x] reputationWeight = 1 y status = "aprobado" automático si phoneVerified=true y fraudScore < 20 (submit-rating.js — commit 42d3bed 2026-05-25)
- [x] Ratings sin verificación telefónica o fraudScore >= 20 quedan en pendiente_validacion con reputationWeight = 0

### Fase 4 — Autoridad pública (no empezar hasta cerrar Fase 3)

- [ ] Perfil público del taller
- [ ] Sello MotoGestión Verificado
- [ ] Reputación visible públicamente
- [ ] Red por ciudad (mapa — landing ya tiene estructura)
- [ ] publicWorkshops collection con datos reales de talleres

## Deploy actual

- App: https://app.motogestion.ar (dpl_96zvaXTwuRgsqSJuia6XCorhbJzt — 2026-05-25)
- Landing: https://motogestion.ar (dpl_3uwLEiiPC8kDHFx6fFbh4wbKNQ3E — 2026-05-25)
- Repo: github.com/Matias2015F/johnny-blaze-os (main — commit d29379f)
