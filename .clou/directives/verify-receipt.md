# Directiva de Arquitectura - useVerifyReceipt

## 1. Contrato del Hook (Capa de Infraestructura y Dominio)

El hook `useVerifyReceipt` debe encapsular de manera absoluta Firebase y peticiones HTTP externas.

### Entradas (Parametros)

- `token` (string) — Identificador del recibo publico extraido de la URL.

### Estados Internos Delegados (8)

- `estado` — "cargando" | "ok" | "error"
- `receipt` — object | null
- `fase` — "verificacion" | "vista" | etc.
- `ratingIncentive` — object | null
- `enviando` — boolean
- `errorEnvio` — string | null
- `descargando` — boolean
- `downloadError` — string | null

### Funciones Expuestas

- `downloadPDF()` — Peticion asincrona a `/api/download-receipt-pdf`. Retorna `{ ok, mensaje }`.
- `submitRating(ratingData)` — Envio transaccional a `/api/submit-rating`. Retorna `{ ok, mensaje }`.

### Efectos internos (no expuestos)

- `useEffect([token])` — Consulta Firestore `publicReceipts/{token}` al montar. Setea `estado` y `receipt`.
- `useEffect([receipt])` — Fetch `/api/verify-document?mode=receipt-incentive` si receipt existe. Setea `ratingIncentive`.

---

## 2. Contrato de la Vista (Capa UI - VerifyReceiptView.jsx)

La vista se reduce a un componente puramente declarativo y sincrono.

### Estados Locales Retenidos (6 — Formulario local)

- `phoneLast4`, `phoneError` — Validacion primaria de seguridad en cliente.
- `checks`, `scores` — Estructuras de seleccion del feedback.
- `recomienda`, `comentario` — Inputs de texto directos del usuario.

### Regla estricta (ENFORCED)

Prohibido importar `getDoc`, `doc`, `firebase/firestore` o usar `fetch` dentro de `VerifyReceiptView.jsx`.
Toda mutacion u obtencion de datos ocurre exclusivamente por las funciones expuestas por el hook.

---

## 3. Zona protegida durante esta implementacion

No tocar durante este refactor:
- `api/submit-rating.js`
- `api/verify-document.js`
- `api/download-receipt-pdf` (modo de `verify-document.js`)
- `src/services/receiptService.js`
- `firestore.rules` (reglas de `publicReceipts`)

---

## 4. Criterio de exito

1. `VerifyReceiptView.jsx` no contiene ningun import de `firebase/firestore` ni llamadas a `fetch`.
2. `npm run build` pasa sin errores.
3. La vista publica `/verificar/:token` carga el comprobante, permite verificar telefono, enviar calificacion y descargar PDF — todo funcionando igual que antes.
4. `npm run lint` sin errores nuevos.

---

## 5. Historial

| Fecha | Commit | Cambio |
|---|---|---|
| 2026-06-28 | — | Directiva creada |
