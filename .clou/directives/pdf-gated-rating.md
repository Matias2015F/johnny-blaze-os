# Directiva: PDF Gated por Calificación

**Estado:** DECIDED — pendiente aprobación antes de implementar  
**Fecha:** 2026-06-20  
**Origen:** CLAUDE 20.txt — Intercambio de valor forzado (gateo de beneficio)

---

## Estado actual (CONSEJO04)

| Feature | D | I | UI | RT | DEP |
|---|---|---|---|---|---|
| Token público + portal verificación | ✅ | ✅ | ✅ | ✅ | ✅ |
| Calificación 4 dimensiones | ✅ | ✅ | ✅ | ✅ | ✅ |
| `ratingUsed: true` post-calificación | ✅ | ✅ | ✅ | ✅ | ✅ |
| Incentivo 15% descuento | ✅ | ✅ | ✅ | ✅ | ✅ |
| Link WhatsApp → portal | ✅ | ✅ | ✅ | ✅ | ✅ |
| **PDF gated (descarga post-rating)** | ✅ | ❌ | ❌ | ❌ | ❌ |
| PDF en Firebase Storage privado | ✅ | ❌ | ❌ | ❌ | ❌ |
| `pdfDownloadUnlocked` field | ✅ | ❌ | ❌ | ❌ | ❌ |
| Endpoint download-receipt-pdf | ✅ | ❌ | ❌ | ❌ | ❌ |
| WhatsApp texto actualizado | ✅ | ❌ | ❌ | ❌ | ❌ |

**Lo que ya existe y no se toca:**
- `publicReceipts/{token}` con `ratingEnabled`, `ratingUsed`, `incentive` — estructura correcta
- `VerifyReceiptView.jsx` — flujo de verificación teléfono → formulario → envío — funciona
- `submit-rating.js` — guarda calificación y marca `ratingUsed: true` — funciona
- `mensajeComprobanteVerificable()` — ya manda el link correcto — solo cambia el texto

**Lo que está a null hoy (by design, esperando esta feature):**
```js
// receiptService.js línea 111-113
pdfUrl: null,
pdfStoragePath: null,
pdfGeneratedAt: null,
```

---

## Flujo nuevo (end-to-end)

```
1. Mecánico cierra orden
2. App genera PDF (ExportPdfView / PrePdfView) 
3. PDF se sube a Firebase Storage en ruta privada:
   receipts/{uidTaller}/{token}/comprobante.pdf
4. receiptService guarda:
   pdfStoragePath: "receipts/{uid}/{token}/comprobante.pdf"
   pdfDownloadUnlocked: false
   downloadRequiresRating: true
5. WhatsApp manda link al cliente (NO el PDF directo)
6. Cliente entra a motogestion.ar/verificar/{token}
7. Ve resumen del taller + moto + garantía
8. ANTES de calificar: ve CTA "Calificá para descargar tu comprobante oficial"
   (botón de descarga OCULTO)
9. Cliente califica (flujo existente)
10. submit-rating marca pdfDownloadUnlocked: true
11. VerifyReceiptView muestra botón "Descargar comprobante"
12. Botón llama /api/verify-document?mode=download-pdf&token=...
13. Endpoint verifica: token válido + ratingUsed === true + pdf existe
14. Devuelve signed URL temporal (Firebase Storage, 15 min)
15. Pantalla final: descarga habilitada + cartel 15% descuento
```

---

## Arquitectura técnica

### Restricción crítica: límite 12 funciones Vercel Hobby

El nuevo endpoint de descarga NO puede ser un archivo nuevo en `api/`.  
**Solución:** agregar como `?mode=download-pdf` en `api/verify-document.js` + rewrite en `vercel.json`.

```json
// vercel.json — agregar:
{ "source": "/api/download-receipt-pdf", "destination": "/api/verify-document?mode=download-pdf" }
```

### Firebase Storage — ruta privada

```
receipts/{uidTaller}/{token}/comprobante.pdf
```

Reglas de Storage: lectura solo desde Admin SDK (backend). Nunca URL pública directa.

### Campos nuevos en `publicReceipts/{token}`

```js
pdfStoragePath: "receipts/{uid}/{token}/comprobante.pdf",  // reemplaza pdfUrl: null
pdfDownloadUnlocked: false,   // se pone true en submit-rating después de calificar
downloadRequiresRating: true, // flag de diseño
pdfGeneratedAt: timestamp,    // cuando se subió el PDF
```

### `pdfDownloadUnlocked` no es una puerta de honor

El endpoint `?mode=download-pdf` verifica en Firestore que `ratingUsed === true` en tiempo real. `pdfDownloadUnlocked` es solo una señal para la UI. La seguridad real está en el backend.

---

## Archivos a tocar (por fase)

### FASE P1 — Campos Firestore + Storage path
- `src/services/receiptService.js`
  - Agregar `pdfStoragePath`, `pdfDownloadUnlocked: false`, `downloadRequiresRating: true`
  - Sacar comentario `// PDF downloadable (optional). If not implemented yet...`

### FASE P2 — Subida del PDF a Storage
- `src/components/ExportPdfView.jsx` o `PrePdfView.jsx`
  - Después de generar el blob del PDF: subirlo a Firebase Storage con path `receipts/{uid}/{token}/comprobante.pdf`
  - Actualizar `publicReceipts/{token}` con `pdfStoragePath` y `pdfGeneratedAt`
  - Requiere importar `storage` de firebase y `uploadBytes` / `ref`

### FASE P3 — submit-rating desbloquea PDF
- `api/submit-rating.js`
  - Al final del batch, agregar: `pdfDownloadUnlocked: true`
  - Solo si `receipt.downloadRequiresRating === true`

### FASE P4 — Endpoint de descarga
- `api/verify-document.js`
  - Nuevo modo `download-pdf`:
    - Lee `publicReceipts/{token}`
    - Verifica: existe, no anulado, `ratingUsed === true`
    - Genera signed URL de Firebase Storage (Admin SDK, 15 min TTL)
    - Devuelve `{ ok: true, url: signedUrl, expiresIn: 900 }`
- `vercel.json`
  - Agregar rewrite `/api/download-receipt-pdf` → `verify-document?mode=download-pdf`

### FASE P5 — VerifyReceiptView: UI gated
- `src/views/VerifyReceiptView.jsx`
  - En estado `ya_calificado`: mostrar botón "Descargar comprobante"
  - Botón llama al endpoint, abre signed URL
  - Antes de calificar: mostrar CTA "Calificá para desbloquear la descarga" (no el botón)
  - Cartel post-calificación: "Gracias. El Taller X te dejó un 15% de descuento automático en tu próximo mantenimiento."

### FASE P6 — WhatsApp texto + prueba completa
- `src/lib/messages.js`
  - `mensajeComprobanteVerificable()` → texto actualizado:
    ```
    Hola [cliente], el comprobante oficial de garantía de tu moto está listo.
    Para descargarlo, ingresá al siguiente link y validá la atención:
    [link]
    Taller XXX
    ```
  - Sacar mención genérica a "descargarlo" del texto actual (que prometía algo que no existía)

---

## Criterio de éxito

1. Mecánico cierra orden → PDF se sube a Storage automáticamente.
2. Cliente recibe WhatsApp con link (no PDF directo).
3. Cliente entra al portal → no ve el botón de descarga todavía.
4. Cliente completa calificación → botón de descarga aparece.
5. Botón genera signed URL → PDF se descarga correctamente.
6. Pantalla muestra cartel 15% descuento.
7. Si alguien entra al link del PDF directo en Storage: acceso denegado (regla de Storage).
8. Si alguien llama al endpoint sin haber calificado: 403.

---

## Regla de seguridad — zonas protegidas durante esta implementación

- `api/mp-webhook.js` — NO TOCAR
- `api/mp-create-preference.js` — NO TOCAR
- `api/cancel-plan.js` — NO TOCAR
- `api/retention-offer.js` — NO TOCAR
- `src/App.jsx` — NO TOCAR
- `src/services/saasService.js` — NO TOCAR
- `firestore.rules` — puede necesitar ajuste menor para Storage, verificar antes de editar
- **Límite 12 funciones en api/:** no crear nuevo archivo en api/, usar `?mode=` en verify-document.js

---

## Advertencia legal (del consejo)

El PDF es comprobante de garantía técnica, NO factura fiscal.  
El texto de la UI debe decir:
```
"Validá la recepción y activá la garantía digital"
```
NO:
```
"Si no calificás, no tenés comprobante legal"
```

---

## Historial

| Fecha | Commit | Cambio |
|---|---|---|
| 2026-06-20 | — | Directiva creada, pendiente aprobación |
