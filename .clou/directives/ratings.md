## ID y Estado
ratings — Estable (enum corregido 2026-05-28)

## Objetivo principal
Gestionar calificaciones de clientes: creación, moderación por admin,
y visualización filtrada en la UI del taller.

## Criterios de éxito
- [ ] `submit-rating.js` escribe status `"pendiente_validacion"` inicial
- [ ] `moderate-rating.js` actualiza a `"aprobado"` o `"rechazado"`
- [ ] `ConfigView.jsx` filtra por `"aprobado"` / `"rechazado"` correctamente
- [ ] `reputationWeight` = 1 si aprobado, 0 si rechazado
- [ ] Acción registrada en `adminAuditLogs` (no `adminAudit`)

## Entradas / Salidas
- submit-rating: `{ uidTaller, calificacion, comentario, token }` → escribe en `ratings/{id}`
- moderate-rating: `{ ratingId, decision: "aprobar"|"rechazar", reason }` → actualiza `ratings/{id}`

## Flujo lógico (submit)
1. Verificar token en `publicReceipts/{token}`
2. Validar que no fue calificado antes (ratingId en publicReceipts)
3. Escribir `ratings/{id}` con status `"pendiente_validacion"`, reputationWeight: 0
4. Actualizar `publicReceipts/{token}` con ratingId

## Flujo lógico (moderate)
1. Verificar admin (uid/email o rol en Firestore)
2. `decision === "aprobar"` → status `"aprobado"`, reputationWeight: 1
3. `decision === "rechazar"` → status `"rechazado"`, reputationWeight: 0
4. Escribir a `adminAuditLogs`

## Dependencias y zonas protegidas
### Strings canónicos de status (NO cambiar, están en Firestore)
- `"pendiente_validacion"` — recién creado, sin moderar
- `"aprobado"` — aprobado por admin (masculino, no "aprobada")
- `"rechazado"` — rechazado por admin (masculino, no "rechazada")

### Consumidores del campo `status`
- `moderate-rating.js` — escribe el valor
- `ConfigView.jsx` — filtra tabs y colores de estado
- `publicWorkshops` — podría leer reputationWeight en el futuro

## Historial de cambios
| Fecha | Commit | Cambio |
|-------|--------|--------|
| 2026-05-28 | 292a140 | Fix: enum status "aprobada/rechazada" → "aprobado/rechazado" en moderate-rating.js y ConfigView.jsx |
