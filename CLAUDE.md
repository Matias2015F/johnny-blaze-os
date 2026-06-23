# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Filtro MotoGestión — Obligatorio antes de cualquier tarea

Antes de escribir, modificar o agregar código, pasar por estos 3 filtros en orden:

**S1 — Golden Path:** ¿Esto ayuda al mecánico a recibir, diagnosticar, presupuestar, cobrar, entregar o documentar?
Si NO → no es prioridad. Posponer.

**S2 — Protección del Mecánico:** ¿Qué pérdida evita? (dinero, tiempo, conflictos, garantías, olvidos, responsabilidad legal)
Si ninguna → posponer.

**S3 — Evidencia Jurídica:** ¿El resultado es demostrable en 6 meses? ¿Queda en Firestore?
Si NO → agregar evidencia antes que UI.

Aplicar también al cerrar cada tarea:
**S5 — Persistencia:** Crear → Guardar → F5 → Recuperar → Otro dispositivo. Si falla, no está terminado.

---

## Carpeta de trabajo única — Claude y Codex

`C:\Users\Usuario\johnny-blaze-os` es la única carpeta de trabajo real para esta app. Tanto Claude (vía `CLAUDE.md`) como Codex (vía `AGENTS.md`, que apunta a este archivo) operan exclusivamente acá.

Cualquier otra ubicación local (por ejemplo carpetas en OneDrive, copias de preservación, monorepos paralelos) está fuera de uso. No se implementan features, no se corren builds, no se hacen commits ahí. Si una sesión de Claude o Codex arranca parada en otra carpeta, debe detenerse y señalar que la ubicación correcta es esta.

---

## Propósito

PWA de gestión operativa para taller mecánico de motos (MotoGestión). Usuario real: mecánico con manos sucias, celular, apuro. Velocidad de uso y ergonomía táctil importan más que la perfección arquitectural.

Objetivo actual: 1 taller real usando el sistema diariamente sin pérdida de datos. Después: 10 talleres. Después: escalar.

---

## Ecosistema MotoGestión

MotoGestión no es una app aislada. Es un ecosistema de dos piezas conectadas:

- **App** (`app.motogestion.ar`) — operación interna del taller: clientes, motos, diagnósticos, presupuestos, comprobantes, PDF, garantías, historial, trazabilidad.
- **Landing** (`motogestion.ar`) — reputación pública: presenta el sistema, capta talleres, muestra calificaciones, certifica talleres, puede incluir mapa y ranking.

La app genera documentación y datos reales del servicio.
La landing transforma esa trazabilidad en reputación pública y captación de clientes.

### Regla de ecosistema

Antes de modificar landing o app, considerar el impacto sobre el sistema completo.
Toda mejora debe fortalecer el circuito:
uso de la app → documentación del trabajo → reputación pública → captación de clientes.

No tratar los dos proyectos como repositorios aislados.

### Dominios — no confundir

| Dominio | Proyecto | Repositorio |
|---|---|---|
| `motogestion.ar` | Landing pública | github.com/Matias2015F/motogestion-landing |
| `app.motogestion.ar` | App operativa | github.com/Matias2015F/johnny-blaze-os |

Cualquier cambio de DNS, Vercel alias o dominio debe verificar que afecta el proyecto correcto antes de ejecutar.

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

### Cadena de trabajo obligatoria

Todo cambio debe seguir este orden completo. Si falta un paso, la tarea no está terminada:

```
Idea
→ contrato de datos (qué guarda, dónde, quién lee, quién escribe, qué pasa si falla)
→ implementación mínima
→ npm run build
→ npm run lint
→ prueba funcional real
→ commit
→ push
→ deploy
→ verificación en producción
```

### Protocolo de commit y deploy — OBLIGATORIO antes de declarar cualquier tarea terminada

Ningún cambio se considera completo hasta haber ejecutado estos 10 pasos en orden. Sin excepciones.

0. `git status` — verificar repo limpio. Si hay archivos modificados sin explicar, detenerse.
1. `npm run build` — debe pasar sin errores
2. `npm run lint` — no debe introducir errores nuevos respecto al estado anterior
3. `git diff` — verificar que solo se tocaron los archivos necesarios, nada más
4. Probar el flujo funcional afectado (no solo que compila — el dato tiene que aparecer en la pantalla)
5. Commit separado por fase o tema: `git commit -m "descripcion concisa"`
6. Push a GitHub: `git push origin main`
7. Deploy en Vercel: `npx vercel --prod --scope matias2015fs-projects`
8. Verificar en produccion: `https://app.motogestion.ar/version.json` debe mostrar el nuevo build
9. Informe final: qué se hizo, qué se probó, qué queda pendiente

**Si algún paso no se puede completar, la tarea NO está terminada.** No declarar "listo" sin commit + push + deploy + verificación.

### Protocolo de skills — MotoGestión (Plan de Blindaje Operativo)

**Activación conjunta — palabra clave `SKILL C+B`:**

Cuando el usuario escribe `SKILL C+B` (o los skills están activos por contexto), se ejecutan simultáneamente la Opción C y la Opción B. No son opcionales ni separables. `SKILL C+B` es la señal de que el protocolo está corriendo.

**Regla del asistente (Opción C) — OBLIGATORIO:**

Antes de tocar cualquier archivo, el asistente DEBE declarar explícitamente qué skills va a correr y en qué orden. Sin excepción. Formato obligatorio:

```
SKILL C+B — PLAN DE SKILLS:
- /respaldo — [motivo]
- /seguro — [motivo]
- /revision — [motivo]
[continúa con la tarea]
```

Si el asistente toca un archivo sin haber declarado este bloque primero, es una violación del protocolo. El usuario puede y debe interrumpir.

**Hábito del fundador (Opción B):**

El usuario incluye el skill directamente en la instrucción:

```
"SKILL C+B — modificá el flujo del PDF"
"SKILL C+B — antes de tocar App.jsx implementá el cambio"
```

Si el usuario no escribe `SKILL C+B` pero da una instrucción de código, el asistente igualmente ejecuta el bloque de declaración (Opción C) antes de proceder.

**Auditoría de estado previa a la tarea (CONSEJO04) — se activa con SKILL C+B:**

Antes de escribir código, el asistente verifica el estado real de cada feature o cambio usando estos 5 estados:

```
DECIDED            — existe la decisión/directiva/doc
IMPLEMENTED        — código escrito en el dominio correcto
CONNECTED_TO_UI    — la pantalla lo llama y lo muestra
ENFORCED_RUNTIME   — activo en producción y verificado
DEPLOYED           — en app.motogestion.ar/version.json
```

Ningún estado implica el siguiente. "Hay un doc que lo dice" no es IMPLEMENTED. "Compiló" no es DEPLOYED. El asistente debe mapear el estado real antes de decir que algo "ya está hecho". Esto previene confundir worktrees, repos locales, builds y deploys de Vercel.

**Mapa de triggers obligatorios:**

- `/respaldo` — antes de modificar cualquier archivo del Baseline de Oro, o antes de cambios que toquen 2+ archivos
- `/seguro` — antes de tocar `LoginScreen.jsx`, `App.jsx`, `api/mp-*.js`, `api/cancel-plan.js`, `api/retention-offer.js`, `firestore.rules`, `saasService.js`
- `/revision` — antes de cada `git commit` (build + lint + diff)
- `/deploy` — para gestionar deploys, verificar version.json, y hacer rollback

Los skills están definidos en `.clou/COMANDOS.md`. Leerlos al inicio de cada sesión.

### Regla de repo limpio antes de empezar

Antes de tocar cualquier archivo: ejecutar `git status`. Si hay modificaciones sin commit no relacionadas con la tarea actual, resolver o stashear antes de continuar. No acumular cambios de tareas distintas en el mismo estado de trabajo.

### Regla de contrato antes de código

Para cada función nueva o dato nuevo definir antes de implementar:
- Qué dato guarda
- Dónde lo guarda (colección Firestore, localStorage, Firestore global)
- Quién lo lee (frontend, API, landing)
- Quién puede escribirlo (usuario, admin, webhook)
- Qué pasa si falla

Si no está definido, no se implementa.

### Regla de archivos grandes

`ConfigView.jsx` (3500+ líneas) y `OrderDetailView.jsx` (1600+ líneas) son zonas de alto riesgo. Antes de modificar cualquiera de ellos:
1. Grep del símbolo exacto que se va a tocar.
2. Leer el bloque completo donde está el símbolo.
3. Confirmar que no hay otro lugar que lo referencia.
No refactorizar estos archivos "de paso" durante otro fix.

### Regla de features completas

No publicar pantallas con datos falsos, mocks, números inventados o botones que no hacen nada. Si una feature no tiene el flujo completo funcionando (crear → guardar → leer → mostrar), no va a producción.

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
7. `npm run lint` para verificar que no se introdujeron errores nuevos.

### Regla de mejora incremental

El código actual es la base estable. Todo cambio futuro es una mejora incremental, no una reconstrucción.

1. Lo que hoy está hecho funciona.
2. La app ya es usable.
3. La estructura actual cumple su objetivo.
4. No se debe romper ningún flujo existente.
5. No se debe reescribir código funcional solo por preferencia estética o técnica.
6. Toda mejora debe ser mínima, justificada y reversible.
7. Antes de tocar código: ejecutar `/respaldo`, luego `/seguro`, luego `/mejora`.
8. Si no hay 90% de certeza de que el cambio no rompe dependencias, no se toca código.
9. Si una mejora implica riesgo, primero presentar opciones con pros y contras.
10. Si algo funciona, no cambiarlo salvo que haya una razón concreta.

### Regla de contexto

No depender del historial de conversación para instrucciones importantes. Toda regla permanente debe estar en un archivo. Si una instrucción es crítica para seguridad, pagos, acceso SaaS, datos o deploy, debe quedar escrita antes de implementar en:
- `CLAUDE.md` o `~/.claude/CLAUDE.md`
- `.clou/COMANDOS.md`
- `.clou/directives/nombre-feature.md`

### Regla de features sin directiva

Los archivos `api/cancel-plan.js`, `api/retention-offer.js` y las vistas/libs agregados en mayo 2026 (`RetentionOfferView`, `cloudBackup`, `integrity`, `telemetry`, `timer`, `theme`, `priceLearning`, `receiptVerificationService`) no tienen directiva en `.clou/directives/`. Antes de modificar cualquiera de ellos, crear la directiva correspondiente con estado actual, criterio de éxito y zona protegida.

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
| `api/mp-create-preference.js` | Generación de preferencias MP + modo retention (oferta de descuento). |
| `api/cancel-plan.js` | Cancelación + oferta retención. Escribe en `retentionOffers` y `soporteTickets`. |
| `api/retention-offer.js` | Valida token de oferta antes de aplicar descuento. Consumido por `mp-create-preference?mode=retention`. |
| `api/send-welcome.js` | Email bienvenida (idempotente) + password reset. Dos modos, distintos niveles de auth. |
| `api/verify-document.js` | Puente app↔landing: talleres públicos, publicación de perfil, leads, verificación de comprobantes. |
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
  mp-reconcile.js      — conciliación manual de pagos MP (no tiene URL pública en vercel.json, invocado directamente)
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
| `/api/download-receipt-pdf` | `verify-document.js` | `download-pdf` |

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

---

## /arquitectura-soberana — Protocolo de Aislamiento por Dominio

**Comando:** `/arquitectura-soberana`

**Propósito:** Garantizar que ninguna modificación altere la frontera de datos, UI o configuración entre los tres entornos del monorepo.

**Freno de entrada obligatorio:** Ante cualquier solicitud de cambio, suspender y confirmar:

```
Filtro de Dominio Activo. Confirmar entorno:
[1] App Usuario: app.motogestion.ar (operaciones del taller, mecánicos, órdenes)
[2] App Administración: admin.motogestion.ar (suscripciones, control de pagos, métricas)
[3] Landing Page: motogestion.ar (captación, red de confianza, pasarela del cliente)
```

**Reglas del skill:**
1. Solo tocar archivos que pertenezcan al entorno elegido o a servicios globales compartidos aislados (`firebase.js`, helpers de `api/_*`)
2. Si el entorno es [2] Admin: verificar que `firebase.js` se importe ANTES del mount de React en `main.jsx` (garantía de init)
3. Verificar que variables de entorno Firebase estén en AMBOS proyectos Vercel (`motogestion-app` y `motogestion-admin`) antes de cualquier cambio que use el Admin SDK
4. Bloquear importaciones cruzadas redundantes entre superficies

**Proyectos Vercel por dominio:**

| Dominio | Proyecto Vercel | Project ID |
|---|---|---|
| `app.motogestion.ar` | `motogestion-app` | `prj_X415e2TPGQsMXnjvfCBXqgh0m5Fn` |
| `admin.motogestion.ar` | `motogestion-admin` | `prj_SMj9OfT4md9tZTvBHMfl7b2Ro9ZT` |
| `motogestion.ar` | `motogestion-landing` | — |

**Deploy por dominio:**

```bash
# App usuario (default)
npx vercel --prod --scope matias2015fs-projects

# Admin
npx vercel --prod --scope matias2015fs-projects --project motogestion-admin
```

---

## Radar de arquitectura — pendiente próximo ciclo

Items conocidos, intencionalmente no tocados hoy. No son bugs. Son deuda de documentación o mejora planificada.

| Item | Estado | Acción futura | Decisión |
|---|---|---|---|
| `api/mp-reconcile.js` | Activo en producción, documentado en mapa de API | Agregar URL pública en `vercel.json` si se expone, o dejarlo como función interna | Por diseño: conciliación manual, sin alias público |
| `CRON_SECRET` solo en `motogestion-app` | Correcto por diseño | Documentar que `motogestion-admin` no corre cron | El cron de expiraciones (`check-expirations.js`) corre sobre el proyecto base, no sobre admin |
| `e2e/screenshots-ci/` y `e2e/screenshots-gp/` | Agregados a `.gitignore` en `c503b8c` | Verificar que no queden rastreados si ya fueron staged antes | Carpetas de pruebas locales, no van a producción |
| Auditoría de acciones críticas (CONSEJO03 P1) | `DECIDED`, no `IMPLEMENTED` | Próximo ciclo: loguear en Firestore uid + fecha + hora + acción + IP para creación/modificación/eliminación/pagos | Prioridad P1 post-validación comercial |
