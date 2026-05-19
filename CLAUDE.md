# Johnny Blaze Taller OS — Instrucciones para Claude Code

## Propósito

PWA de gestión operativa para taller mecánico de motos (usuario real: mecánico con manos sucias, celular, apuro).
La velocidad de uso y la ergonomía táctil importan más que la perfección arquitectural.

---

## Stack

| Capa | Tecnología |
|---|---|
| UI | React 18 + Vite 5 |
| Estilos | Tailwind CSS v3 |
| Íconos | lucide-react |
| Auth / DB | Firebase Auth + Firestore (users/{uid}/{col}) |
| Serverless | Vercel API routes (`api/`) |
| Pagos | MercadoPago (webhooks en `api/mp-webhook.js`) |
| Push | Web Push / VAPID (`api/push-send-recordatorios.js`) |
| Deploy | Vercel — https://app.motogestion.ar |
| Repo | github.com/Matias2015F/johnny-blaze-os (rama main) |

---

## Estructura clave

```
src/
  App.jsx           — auth state + acceso trial/activo/bloqueado
  TallerPanel.jsx   — router principal (estado `view`), handleCreateOrder
  lib/
    storage.js      — LS (cache + Firestore sync), useCollection, crearRecordatorioDeOrden
    constants.js    — CONFIG_DEFAULT, ESTADO_LABEL/CSS, PLANTILLAS_GARANTIA
    calc.js         — calcularResultadosOrden, calcularNuevoTotal
    proximoControl.js — buildProximoControl, evaluarEstadoRecordatorio
    messages.js     — generarMensajePresupuestoConDatos, normalizarTelWA
    backup.js       — exportBackup, importBackup
    appUpdate.js    — fetchRemoteVersion, applyRemoteUpdate
  views/            — HomeView, OrderListView, NewOrderView, ConfigView, HistoryView,
                      BikeProfileView, RecordatoriosView, PresupuestosView, AgendaView...
  components/       — OrderDetailView, TaskManagerView, LogisticsView, PaymentView,
                      PrePdfView, ExportPdfView
api/
  _firebase-admin.js  — init Admin SDK, verifyIdToken
  _email.js           — sendEmail via Resend
  _ratelimit.js       — sliding window rate limiter por IP
  mp-create-preference.js / mp-webhook.js / mp-diagnose.js
  push-subscribe.js / push-send-recordatorios.js
  check-expirations.js / send-welcome.js / send-password-reset.js
```

---

## Reglas de código

### Navegación
- Sin React Router. Ruteo por `view` string en `TallerPanel.jsx` via `setView(string)`.
- Agregar una vista: (1) crear componente en `src/views/`, (2) agregar `{view === "nombreVista" && <Componente ... />}` en TallerPanel, (3) actualizar la navegación desde donde corresponda.

### Persistencia de datos
- **NUNCA** escribir directamente a Firestore desde views o components.
- Usar siempre `LS.addDoc / LS.updateDoc / LS.setDoc / LS.deleteDoc` de `storage.js`.
- `LS` mantiene un cache en memoria que sincroniza a Firestore con reintentos.
- Leer con `LS.getDoc(col, id)` o `LS.getAll(col)`. Reactivo con `useCollection(col)`.
- Colecciones válidas: ver `DATA_COLS` en `storage.js`.

### API routes (Vercel serverless)
- Todas requieren autenticación via `verifyIdToken(req)` de `_firebase-admin.js`, excepto `mp-webhook.js` (usa HMAC) y `send-password-reset.js` (público con rate limit).
- Aplicar rate limiting con `applyRateLimit` de `_ratelimit.js`.
- Logs de auditoría con `console.log` (van a Vercel logs).

### Build
- Vite con Terser: elimina `console.log/info/debug` en producción. No usar logs de debug en código productivo.
- Deploy: `npx vercel --prod --scope matias2015fs-projects` → luego alias `app.motogestion.ar`.

---

## Modelo de datos (Firestore — users/{uid}/{col})

| Colección | Campos principales |
|---|---|
| `clientes` | nombre, tel, whatsapp, etiquetas, activo |
| `motos` | patente, marca, modelo, cilindrada, km, kilometrajeActual, clienteId |
| `trabajos` | numeroTrabajo (OT-000001), clientId, bikeId, estado, kmIngreso, total, pagos[], tareas[], repuestos[], insumos[], fletes[], proximoControl{} |
| `presupuestos` | numeroPresupuesto (PRE-000001), clientId, bikeId, estado, tareas[], total |
| `recordatorios` | trabajoId, clienteId, motoId, tipo, estado, kmObjetivo, kmAviso, unidad |
| `caja` | fecha, tipo, concepto, monto, metodo |
| `config/global` | CONFIG_DEFAULT + whatsappPlantillas + testModeRecordatorios |

---

## Patrones de UI — ver COOKBOOK.md para detalle

- Diseño oscuro: bg-[#0A0A0A] / zinc-950 / zinc-900
- Primario: orange-600 (#ea580c)
- Tipografía labels: `text-[10px] font-black uppercase tracking-widest`
- Cards: `rounded-[2rem] border border-zinc-800 bg-zinc-900 p-4`
- Sheets (modales): bottom sheet animado, `fixed inset-0 z-50 flex items-end`
- Botón primario: `rounded-2xl bg-orange-600 py-4 text-[11px] font-black uppercase tracking-widest text-white active:scale-95 transition-all`

---

## Seguridad — restricciones activas

- Firestore rules: `noModificaCamposSuscripcion()` bloquea autopromociones de plan desde el cliente
- `ensureSaasUserProfile` solo escribe: email, lastSeenAt, updatedAt, nombreTaller, appVersion
- Webhook MP: HMAC-SHA256 + timestamp freshness + HMAC failure tracker
- `isPlatformAdmin()` uid=TNwwuKJsIXN29zJg8HWfORawdFm1

---

## Lo que NO se hace aquí

- No hay React Router, Redux, Context API, GraphQL, REST API propia
- No hay múltiples técnicos / roles por ahora
- No hay testing automatizado (MVP prioriza velocidad de iteración)
