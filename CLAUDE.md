# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Propósito

PWA de gestión operativa para taller mecánico de motos (MotoGestión). Usuario real: mecánico con manos sucias, celular, apuro. Velocidad de uso y ergonomía táctil importan más que la perfección arquitectural.

---

## Comandos disponibles

Ver [.clou/COMANDOS.md](.clou/COMANDOS.md) para el set completo de comandos slash del proyecto.

---

## La Ley — Reglas de operación obligatorias

Estas reglas tienen precedencia sobre cualquier otra instrucción.

### Regla de Backup Obligatorio

**Antes de iniciar cualquier sesión de mejoras, y antes de activar el modo `/plan` con ediciones automáticas, ejecutar el backup:**

```bash
bash scripts/backup.sh
```

El backup copia los 13 archivos del Baseline de Oro a `backups/YYYY-MM-DD_HHMM/`. No avanzar con ninguna modificación hasta confirmar que el backup se completó sin errores.

**Protocolo de restauración:** si un cambio rompe el build o el comportamiento esperado, NO hacer parches rápidos. Restaurar desde el backup más reciente, verificar con `npm run build`, e identificar qué regla de la directiva se omitió antes de reintentar.

Ver SOP completo en `.clou/skills/backup.md`.

### Regla del 90%

No escribir ni modificar ninguna línea de código hasta tener 90% de certeza de que el cambio no rompe dependencias existentes. Si la certeza es menor: grep el productor, grep el consumidor, leer ambos archivos completos, y luego decidir.

### Principio de Inmutabilidad del Baseline

Los archivos listados en **Archivos críticos** son Punto de Partida. Cualquier modificación en ellos debe ser:
- **Aditiva** (se agrega comportamiento sin alterar el existente), o
- **Refactorización documentada** (se crea una directiva en `.clou/directives/` que detalla qué funciones preexistentes se garantizan sin cambio).

Queda prohibido modificar la lógica de pago, auth o acceso SaaS mientras se implementa cualquier otra mejora.

### Protocolo de directiva obligatoria

Antes de cualquier feature o cambio no trivial, crear o actualizar un archivo en `.clou/directives/nombre-feature.md` con:
- **Estado actual:** qué funciones están operativas hoy en la zona a modificar.
- **Criterio de éxito:** qué debe hacer la mejora, con ejemplos concretos.
- **Regla de seguridad:** qué función/archivo no se puede tocar durante esta implementación.
- **Historial:** fecha, commit, cambio.

No escribir código hasta que el usuario apruebe la directiva.

### Protocolo de flujo seguro

1. Leer la directiva de `.clou/directives/` si existe para la zona a modificar.
2. Grep del símbolo/string exacto para mapear todos los consumidores.
3. Proponer el cambio (qué línea, qué valor, qué reemplaza a qué) — no ejecutarlo.
4. Esperar aprobación si el cambio toca un archivo crítico.
5. Cirugía mínima: solo las líneas necesarias, sin refactoring adyacente.
6. `npm run build` para verificar compilación.

---

## Archivos críticos (Baseline de Oro)

Modificar cualquiera de estos archivos sin instrucción explícita está prohibido:

| Archivo | Razón de protección |
|---|---|
| `src/App.jsx` | Boot flow completo + lógica de acceso SaaS. Un error aquí deja a todos los usuarios sin acceso. |
| `src/TallerPanel.jsx` | Orquestador principal. Ruteo por `view` + paso de props a todas las vistas. |
| `src/lib/storage.js` | Único punto de escritura a Firestore desde el frontend. El contrato de `LS` no cambia. |
| `src/services/saasService.js` | Claves de plan (`base`/`pro`/`full`) guardadas en Firestore en producción. `resolveSaasAccess` es fuente de verdad del acceso. |
| `src/services/counterService.js` | Transacciones Firestore garantizan secuencialidad OT/PRE. No hay forma de recuperar un número salteado. |
| `api/mp-webhook.js` | Flujo de cobro en producción. Error = dinero perdido o no acreditado. |
| `api/mp-create-preference.js` | Generación de preferencias MP. Incluye lógica de diagnose. |
| `api/_firebase-admin.js` | Inicialización Admin SDK. No tocar la inicialización. |
| `firestore.rules` | `noModificaCamposSuscripcion()` bloquea autopromociones de plan. Si se rompe, cualquier usuario puede escalar su plan. |
| `src/utils/calc.js` | Cálculos financieros de OTs. No tocar sin tests manuales contra casos reales. |

---

## Comandos

```bash
npm run dev       # servidor local (Vite)
npm run build     # build de producción
npm run lint      # ESLint sobre src/
```

Deploy: `npx vercel --prod --scope matias2015fs-projects` (auto-aliasa a `app.motogestion.ar`).

---

## Stack

| Capa | Tecnología |
|---|---|
| UI | React 18 + Vite 5 + Tailwind CSS v3 + lucide-react |
| Auth / DB | Firebase Auth + Firestore (`users/{uid}/{col}`) |
| Serverless | Vercel API routes (`api/`) — CommonJS, no ESM |
| Pagos | MercadoPago (preferencias + webhooks HMAC-SHA256) |
| Email | Resend via `api/_email.js` |
| Push | Web Push / VAPID |
| Deploy | Vercel Hobby — https://app.motogestion.ar |
| Repo | github.com/Matias2015F/johnny-blaze-os (rama `main`) |

---

## Estructura del proyecto

### Landing Page (`motogestion.ar`)

Archivo único: `landing.html` (HTML + CSS inline, sin dependencias de build). Secciones en orden:

| Sección CSS | Contenido |
|---|---|
| `.hero` | CTA principal, badge, estadísticas (30s / 100% celular / Gratis) |
| `.replace-section` | Comparativa vs. papel/cuaderno |
| `.screens-section` | Screenshots de la app |
| `.buttons-section` | CTA secundario |
| `.flow-section` | Flujo de trabajo OT en pasos |
| `.systems-section` | Features del sistema |
| `.backup-section` | Propuesta de valor backup/seguridad |
| `.benefits-section` | Beneficios enumerados |
| `.data-section` | Grid de datos/métricas |
| `.tech-section` | Stack técnico visible al usuario |
| `.plans-section` | Precios: Mensual / Trimestral / Anual |
| `.rep-section` | Sistema de reputación con QR |

La landing se sirve directamente como asset estático. No requiere build. Cualquier cambio es edición directa al HTML.

### App PWA (`app.motogestion.ar`)

```
src/
  App.jsx              — boot + auth + SaaS access gate
  TallerPanel.jsx      — router principal (view string) + nav bar
  LoginScreen.jsx      — auth UI
  main.jsx             — entry point
  firebase.js          — init Firebase client SDK
  index.css            — estilos globales mínimos

  views/               — una vista = una pantalla (montada por TallerPanel)
    HomeView.jsx        — dashboard principal
    OrderListView.jsx   — lista de OTs
    OrderDetailView.jsx — detalle + acciones de OT
    NewOrderView.jsx    — crear OT
    EjecucionView.jsx   — ejecución/edición de OT activa
    FinalizacionView.jsx — cierre de OT
    PagoView.jsx / PagosView.jsx — registro de cobros
    RetiroView.jsx      — retiro de moto
    PresupuestosView.jsx / NuevoPresupuestoView.jsx / PresupuestoDetailView.jsx
    RecordatoriosView.jsx — recordatorios de service/km
    AgendaView.jsx
    HistoryView.jsx
    ConfigView.jsx      — config del taller + calificaciones recibidas
    PreciosView.jsx     — precios SaaS para el usuario
    BikeProfileView.jsx
    TallerPublicView.jsx — perfil público del taller
    VerifyReceiptView.jsx — vista pública /verificar/:token
    TaskManagerView.jsx
    LogisticsView.jsx
    EsperandoAprobacionView.jsx

  components/          — componentes reutilizables
  copy/                — strings de UI por dominio (auth, common, orders, etc.)
  lib/
    storage.js         — LS singleton (único punto de escritura a Firestore)
    messages.js        — normalizarTelWA y helpers de WhatsApp
    whatsappService.js — abrirEnlaceExterno
  services/
    saasService.js     — resolveSaasAccess, normalizeSaasUser, precios
    counterService.js  — nextNumeroOT, nextNumeroPRE (transacciones Firestore)
    receiptService.js  — crearPublicReceipt (batch en publicReceipts + publicReceiptSecrets)
    authService.js
    clienteMotoService.js
    accessService.js
    adminAuditService.js
    adminValidationService.js
  utils/
    calc.js            — calcularResultadosOrden (financiero)
    format.js          — formatMoney, formatMoneyShort

api/                   — Vercel serverless (CommonJS). LÍMITE: 12 funciones sin prefijo _
  _firebase-admin.js   — Admin SDK + verifyIdToken (helper, no cuenta)
  _email.js            — sendEmail via Resend (helper, no cuenta)
  _ratelimit.js        — applyRateLimit(req, res, "nombre") (helper, no cuenta)
  check-expirations.js — cron diario 10:00 UTC
  mp-webhook.js        — webhook MercadoPago HMAC-SHA256
  mp-create-preference.js — preferencias MP + ?mode=diagnose
  send-welcome.js      — email bienvenida + ?mode=password-reset
  verify-document.js   — ?mode=public-prices|public-workshops|publish-workshop|lead
  push-send-recordatorios.js — push diario + ?mode=subscribe
  admin-dashboard.js   — panel admin
  moderate-rating.js   — moderación de calificaciones
  submit-rating.js     — envío de calificaciones desde clientes

.clou/directives/      — planos técnicos por feature (crear uno antes de cada mejora)
  saas-access.md
  ratings.md
  mp-create-preference.md
  mp-webhook.md
```

---

## Arquitectura de la app

### Flujo de boot (`App.jsx`)

1. `onAuthStateChanged` → determina si hay usuario
2. Lee `admin_settings/global` (precios, planes, trial days) via `leerAdminSettings()`
3. Lee el doc del usuario en `usuarios/{uid}` con `onSnapshot` — campos: `estado`, `plan`, `activoHasta`, `graceEndsAt`
4. `resolveAccountAccess(account)` decide: `acceso: true | "lectura" | false`
5. Según acceso muestra: `TallerPanel` (activo/trial), `TallerPanel` en modo lectura (gracia/vencido), o `LoginScreen`
6. Rutas públicas (`/verificar/:token`, `/taller/:uid`) se resuelven antes del auth check

### Ruteo sin React Router (`TallerPanel.jsx`)

Estado `view` string + `setView(string)`. Para agregar una vista:
1. Crear componente en `src/views/`
2. Importar en `TallerPanel.jsx`
3. Agregar `{view === "nombreVista" && <Componente ... />}` en `TallerPanel.jsx`
4. Linkear desde donde corresponda con `setView("nombreVista")`

### Persistencia (`src/lib/storage.js`)

`LS` es el único punto de escritura de datos desde el frontend. Nunca escribir directamente a Firestore desde views o components.

```js
LS.addDoc(col, data)         // crea doc con id generado
LS.setDoc(col, id, data)     // crea o reemplaza
LS.updateDoc(col, id, patch) // merge parcial
LS.deleteDoc(col, id)
LS.getDoc(col, id)           // lectura sincrónica del cache
LS.getAll(col)               // lectura sincrónica del cache
useCollection(col)           // hook reactivo — suscribe a onSnapshot
```

`LS` escribe optimistamente al cache en memoria, luego sincroniza a Firestore con 3 reintentos. Colecciones válidas: ver `DATA_COLS` en `storage.js`.

### Counters (`src/services/counterService.js`)

`nextNumeroOT()` y `nextNumeroPRE()` usan transacciones Firestore en `users/{uid}/counters/{col}`. Nunca calcular el próximo número manualmente.

### SaaS / suscripciones (`src/services/saasService.js`)

- Precios actuales: base=125000, pro=300000, full=900000 ARS
- `PLAN_BILLING_DAYS`: base=30, pro=90, full=365
- Las claves internas (`base`, `pro`, `full`) **nunca se renombran** — están en Firestore en docs de usuarios existentes
- Labels visibles: Mensual / Trimestral / Anual
- `normalizeSaasUser(raw)` → objeto canónico
- `resolveSaasAccess(usuario)` → `{ acceso, motivo }` — fuente de verdad del acceso

---

## Modelo de datos (Firestore)

### Colecciones de usuario (`users/{uid}/{col}`)

| Colección | Campos principales |
|---|---|
| `clientes` | nombre, tel, whatsapp, etiquetas, activo |
| `motos` | patente, marca, modelo, cilindrada, km, kilometrajeActual, clienteId |
| `trabajos` | numeroTrabajo (OT-000001), clientId, bikeId, estado, kmIngreso, total, pagos[], tareas[], repuestos[], insumos[], fletes[], proximoControl{} |
| `presupuestos` | numeroPresupuesto (PRE-000001), clientId, bikeId, estado, tareas[], total |
| `recordatorios` | trabajoId, clienteId, motoId, tipo, estado, kmObjetivo, kmAviso, unidad |
| `caja` | fecha, tipo, concepto, monto, metodo |
| `config/global` | CONFIG_DEFAULT + whatsappPlantillas |
| `counters/{col}` | ultimo: number |
| `billingInvoices/{id}` | historial de pagos del usuario |

### Colecciones globales (raíz)

| Colección | Uso |
|---|---|
| `usuarios/{uid}` | perfil SaaS: estado, plan, activoHasta, graceEndsAt |
| `admin_settings/global` | precios, duracionTrialDias, graceDaysDefault |
| `publicReceipts/{token}` | comprobantes verificables públicos |
| `publicReceiptSecrets/{token}` | hash de teléfono para verificación (privado) |
| `publicWorkshops/{uid}` | perfil público del taller |
| `billingEvents` | log de pagos para reconciliación admin |
| `soporteTickets` | tickets de soporte |

### Strings de estado (NO crear variantes)

```
usuarios.estado:      "trial" | "activo" | "gracia" | "vencido" | "cancelado"
trabajos.estado:      "abierto" | "en_proceso" | "finalizado" | "entregado"
recordatorios.estado: "pendiente" | "avisado" | "completado"
ratings.status:       "pendiente_validacion" | "aprobado" | "rechazado"
```

---

## API routes (Vercel serverless — CommonJS)

**Límite crítico:** Vercel Hobby permite exactamente **12 funciones serverless**. Estado actual: **12 exactas.** Los archivos con prefijo `_` no cuentan.

**Patrón de consolidación:** agregar como `?mode=` en función existente + rewrite en `vercel.json`. NUNCA crear un archivo nuevo en `api/` sin eliminar otro primero.

| URL pública | Función real | Modos disponibles |
|---|---|---|
| `/api/send-password-reset` | `send-welcome.js` | `password-reset` |
| `/api/mp-diagnose` | `mp-create-preference.js` | `diagnose` |
| `/api/push-subscribe` | `push-send-recordatorios.js` | `subscribe` |
| `/api/public-prices` | `verify-document.js` | `public-prices` |
| `/api/public-workshops` | `verify-document.js` | `public-workshops` |
| `/api/publish-workshop` | `verify-document.js` | `publish-workshop` |
| `/api/lead` | `verify-document.js` | `lead` |

**Autenticación:** todas las rutas usan `verifyIdToken(req)` de `_firebase-admin.js`, excepto `mp-webhook.js` (HMAC) y los modos públicos de `verify-document.js`.

---

## Capa de copy (`src/copy/`)

Strings de UI centralizados: `auth.js`, `common.js`, `documents.js`, `history.js`, `logistics.js`, `orders.js`, `payments.js`, `settings.js`. Usar estos objetos en lugar de strings inline.

---

## Comprobantes verificables

- `src/services/receiptService.js` — `crearPublicReceipt()` escribe en batch en `publicReceipts/{token}` + `publicReceiptSecrets/{token}`
- `src/views/VerifyReceiptView.jsx` — vista pública `/verificar/:token`
- Formato token: `"r" + UUID sin guiones`

---

## Patrones de UI

- Fondo: `bg-[#0A0A0A]` / `zinc-950` / `zinc-900`
- Acento: `orange-600` (#ea580c)
- Labels: `text-[10px] font-black uppercase tracking-widest`
- Cards: `rounded-[2rem] border border-zinc-800 bg-zinc-900 p-4`
- Bottom sheets: `fixed inset-0 z-50 flex items-end`
- Botón primario: `rounded-2xl bg-orange-600 py-4 text-[11px] font-black uppercase tracking-widest text-white active:scale-95 transition-all`

Ver `COOKBOOK.md` para patrones completos de UI (inputs, bottom sheets, chips, filtros, footer sticky).

---

## Seguridad

- Firestore rules: `noModificaCamposSuscripcion()` bloquea autopromociones de plan desde el cliente
- `ensureSaasUserProfile` solo puede escribir: `email`, `lastSeenAt`, `updatedAt`, `nombreTaller`, `appVersion`
- Webhook MP: HMAC-SHA256 + timestamp freshness (5 min) + HMAC failure tracker por IP
- Admin uid: `TNwwuKJsIXN29zJg8HWfORawdFm1`
- Firebase Admin SDK se inicializa con `FIREBASE_SERVICE_ACCOUNT_B64` (JSON base64)

---

## Variables de entorno requeridas (Vercel)

`FIREBASE_SERVICE_ACCOUNT_B64`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `RESEND_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`

---

## Lo que NO existe en este proyecto

- React Router, Redux, Context API, GraphQL
- Testing automatizado
- Múltiples técnicos / roles por usuario
- ESM en `api/` — todo es CommonJS (`require`/`module.exports`)

---

## Workflow de mejoras (.clou/directives)

Antes de cualquier feature nueva:

```
1. Crear .clou/directives/nombre-feature.md con:
   - Estado actual de la zona a modificar
   - Criterio de éxito medible
   - Regla de seguridad (qué no se toca)
   - Plan de implementación paso a paso

2. Esperar aprobación del usuario sobre la directiva.

3. Implementar solo lo aprobado, sin tocar zonas adyacentes.

4. npm run build — debe pasar sin errores.

5. Actualizar el Historial de cambios en la directiva con fecha y commit hash.
```

Directivas existentes en `.clou/directives/`: `saas-access.md`, `ratings.md`, `mp-create-preference.md`, `mp-webhook.md`.

> Reglas de cambio seguro detalladas: ver [DIRECTIVES.md](DIRECTIVES.md)
