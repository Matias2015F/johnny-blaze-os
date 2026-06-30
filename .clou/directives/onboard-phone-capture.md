# Directiva: onboard-phone-capture (HF-OB-2 / ONBOARD-001-B)

## ID y Estado
onboard-phone-capture — IMPLEMENTADO (aprobado 2026-06-29, pendiente commit/deploy)

## Origen
Hallazgo HF-OB-2 de ONBOARD-001 (RC-2 Growth, 2026-06-29).
Alcance elegido por el usuario: **Emisión + creación** (ambos no bloqueantes).

## Estado actual de la zona a modificar

El sistema de reputación verificada depende del teléfono del cliente:
- `PrePdfView.jsx` (emisión) deriva `phoneLast4` de
  `cliente.celular || cliente.tel || cliente.whatsapp || cliente.telefono`.
  Si no hay teléfono (`telRaw.length < 4`), `phoneLast4 = null` y el comprobante
  se crea con `verificationMethod: "public_link"`.
- `api/submit-rating.js`: sin `phoneVerified` suma `fraudScore += 15`, la
  calificación queda `status: "pendiente_validacion"` (NO auto-aprueba) y
  requiere moderación manual del admin para contar en la reputación pública.
- `NewOrderView.jsx` captura el teléfono (`f.tel`) como campo **opcional, sin
  validación ni indicación de su importancia**.

Consecuencia: un comprobante emitido para un cliente sin teléfono debilita el
diferencial competitivo (reputación verificada + descuento de fidelidad
auto-aprobado).

## Criterios de éxito

1. En `PrePdfView`, si el cliente de la orden NO tiene teléfono usable al momento
   de emitir, se muestra una advertencia **no bloqueante** explicando que el
   comprobante saldrá sin calificación verificada, con un campo inline para
   agregar el teléfono y emitir como verificado.
2. El mecánico puede emitir igual sin teléfono (no se bloquea el golden path).
3. Si agrega el teléfono inline, se persiste en el doc del cliente
   (`LS.updateDoc("clientes", order.clientId, ...)`) y la emisión posterior
   deriva `phoneLast4` correctamente (sin cambiar la lógica de `irAlPdf`).
4. En `NewOrderView`, el campo Teléfono muestra un hint de una línea, no
   bloqueante, indicando que habilita el comprobante verificado + descuento.
5. Cero cambios en `crearPublicReceipt`, `submit-rating.js`, la derivación de
   `phoneLast4` ni en la lógica de emisión existente.

## Diseño propuesto (aditivo, no bloqueante)

### PrePdfView.jsx
- En render, leer el cliente (`LS.getDoc("clientes", order.clientId)`) y calcular
  `tieneTelefono` con la misma derivación que usa `irAlPdf`.
- Estado local: `telInline`, `telGuardado`.
- Si `!tieneTelefono && !telGuardado`: bloque de advertencia ámbar (no rojo, no
  bloquea) + input de teléfono + botón "Guardar y emitir verificado" que llama
  `LS.updateDoc("clientes", order.clientId, { tel })` y setea `telGuardado`.
- El botón de emisión existente queda intacto y habilitado en todos los casos.

### NewOrderView.jsx
- Bajo el input Teléfono, agregar un `<p>` hint de una línea (patrón de copy
  existente, `text-[10px] text-zinc-400`): el teléfono habilita el comprobante
  verificable y el descuento de fidelidad.

## Regla de seguridad (qué NO se toca)

- `crearPublicReceipt` / `receiptService.js`: intacto.
- `api/submit-rating.js`, `api/moderate-rating.js`: intactos.
- La función `irAlPdf` y la derivación de `phoneLast4`: intactas (solo se asegura
  que el cliente ya tenga teléfono antes de llamarla).
- `TallerPanel.jsx` (`handleCreateOrder`) y `upsertClienteYMoto`: NO se tocan.
  El teléfono sigue sin ser obligatorio para crear la orden (filtro S1).
- Archivos Baseline de Oro: ninguno se modifica.

## Plan de implementación

1. `/respaldo` — backup antes de tocar el flujo de emisión.
2. Editar `PrePdfView.jsx` (advertencia + inline phone) y `NewOrderView.jsx` (hint).
3. `npm run build` — sin errores.
4. `npm run lint` — sin errores nuevos.
5. `git diff` — solo esos 2 archivos (+ esta directiva).
6. Verificar en preview: orden con cliente sin teléfono → aparece la advertencia;
   agregar teléfono inline → se persiste; emisión genera comprobante con
   `hasPhoneVerification: true`.
7. Commit, push, deploy, verificar `version.json`.

## Historial de cambios
| Fecha | Commit | Cambio |
|-------|--------|--------|
| 2026-06-29 | (pendiente) | Creación de la directiva (propuesta) |
| 2026-06-29 | (pendiente commit) | Implementado: PrePdfView (advertencia ambar + input inline que persiste tel via LS.updateDoc) y NewOrderView (hint). No bloqueante. Build OK, lint 0 nuevos. Hint verificado en vivo (preview). Advertencia PrePdfView compila pero no gatillada interactivamente (requiere flujo completo con datos reales). |
