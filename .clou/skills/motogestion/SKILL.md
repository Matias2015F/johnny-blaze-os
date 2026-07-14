# Skill: MotoGestion — Supervisor de Sesion

**Comando de activacion:** `/motogestion`

Invocar al inicio de cada sesion o cuando se retoma el proyecto tras un corte de contexto.
Este skill no ejecuta codigo. Carga el estado real del proyecto, activa las reglas de sesion
y coordina los agentes especializados existentes.

---

## 1. ACCION AL ACTIVARSE

Al invocar `/motogestion`, ejecutar estos pasos en orden antes de responder cualquier tarea:

1. Leer `.clou/contexto-motogestion-actual.md` — estado de progreso y produccion
2. Leer `CLAUDE.md` del proyecto — reglas de operacion y Baseline de Oro
3. Leer `.clou/COMANDOS.md` — comandos disponibles del proyecto
4. Confirmar commit de produccion: `https://app.motogestion.ar/version.json`
5. Reportar en una tabla: que hooks estan DONE y cuales PENDIENTES (ver seccion 3)

Solo despues de esos 5 pasos, responder al usuario con el estado resumido de la sesion.

---

## 2. REGLAS DE SESION ACTIVAS

### SRP — Patron obligatorio (no negociable)

```
src/hooks/use[Nombre].js  ->  logica de dominio, estado async, efectos
src/views/*.jsx            ->  solo render + wrappers handle* que llaman showToast(mensaje)
```

Contrato de retorno de hooks:
- Acciones async siempre retornan `{ ok: bool, mensaje: string }`
- `irAPagar` retorna `{ ok, url, sandbox, mensaje }` (unico caso especial)
- NUNCA `showToast` dentro de un hook
- NUNCA `setView`/`navigate` dentro de un hook
- `initError`: hook expone el string de error del init, vista lo toastea via `useEffect([initError])`
- Hooks que leen cfg externo reciben `{ cfg, setCfg }` como parametros

### Baseline de Oro (NUNCA tocar sin instruccion explicita)

```
src/App.jsx                  src/TallerPanel.jsx
src/lib/storage.js           src/services/saasService.js
src/services/counterService.js
api/mp-webhook.js            api/mp-create-preference.js
api/cancel-plan.js           api/retention-offer.js
api/send-welcome.js          api/verify-document.js
api/_firebase-admin.js       firestore.rules
src/lib/calc.js
```

### Limite critico de API

Vercel Hobby = 12 funciones exactas en `api/`. Estado: 12/12.
NO crear nuevo archivo en `api/` sin eliminar otro.
Patron: `?mode=nuevo_modo` en funcion existente + rewrite en `vercel.json`.

### Entorno Windows

- Usar herramienta `Write` para archivos de documentacion o contexto masivo (nunca terminal)
- Sintaxis PowerShell para comandos Git: cadenas literales `@' ... '@`
- No usar heredocs Unix ni `cat` para flujos de archivos
- No declarar tarea terminada sin confirmacion explicita del usuario

---

## 3. BACKLOG SRP — ESTADO VERIFICADO (2026-07-14, HEAD 4536309)

### DONE — Ya tienen hook extraido

*Ultima verificacion: 2026-07-14 | HEAD local: `4536309` | Produccion app: `53bd8b8`*

| Vista | Hook | Commit |
|---|---|---|
| ConfigView / OrderDetailView | `useOrderDetailView.js` | `5c91ec6` |
| ConfigView / PantallaTaller | `useTallerConfig.js` | `143db0e` |
| ConfigView / PantallaDatos | `useBackupPanel.js` | `c0c29db` |
| ConfigView / PantallaSistema | `useSistemaActions.js` | `4060a47` |
| ConfigView / PantallaSuscripcion | `useSuscripcionPanel.js` | `a2dd3ce` |
| ConfigView / PantallaReputacion | `useReputacionPanel.js` | `114886e` |
| ConfigView / PantallaResumen | `useResumenPanel.js` | `cbee5b7` |
| ConfigView / PublicarRedCard | `usePublicarRedCard.js` | `35aaf77` |
| HistoryView | `useHistoryView.js` | (sesion previa) |
| FinalizacionView | `useFinalizacionView.js` | `04e6d17` |
| PresupuestoDetailView | `usePresupuestoDetailView.js` | `8a61bb3` |
| VerifyReceiptView | `useVerifyReceipt.js` | `e538ac4` (2026-06-28) |
| RetentionOfferView | `useRetentionOffer.js` | `147df6e` (2026-06-28) |
| TallerPublicView | `useTallerPublicView.js` | `e4c308d` (2026-06-28) |
| EsperandoAprobacionView | `useEsperandoAprobacion.js` | `ee0202a` (2026-06-28) |
| NuevoPresupuestoView | `useNuevoPresupuesto.js` | `a340f65` (2026-06-28) |
| PreciosView | `usePreciosPanel.js` | `bc9b694` (2026-06-28) |
| PresupuestosView | `usePresupuestosView.js` | `89f05eb` (2026-06-28) |
| BikeProfileView | `useBikeProfile.js` (envuelve `calcularResultadosOrden`) | (sesion 2026-06-28) |

Confirmado 2026-07-14: `VerifyReceiptView.jsx` no tiene imports de `firebase/firestore` ni `fetch` directo.
`npm run build` OK, `npm run lint` OK (0 errores, 59 warnings heredados).

### PENDIENTES — Backlog ordenado por prioridad

Ninguno. Todo el backlog P1/P2/P3 registrado el 2026-06-27 fue completado el 2026-06-28
(ver tabla DONE arriba). Verificado item por item el 2026-07-14 contra el codigo real,
no contra este documento.

### Vistas LIMPIAS (no requieren hook)

HomeView, AgendaView, RecordatoriosView, NewOrderView, RetiroView, EjecucionView

---

## 4. DEUDA TECNICA ACTIVA

*Verificado 2026-07-14 — los 4 items historicos ya estaban resueltos desde 2026-06-28:*

```
[x] Node.js 24.x — RESUELTO commit `9045b9f` (2026-06-28)
    package.json tiene "engines": { "node": "24.x" }. Node local verificado: v24.14.1.

[x] HistoryView chunk — RESUELTO
    TallerPanel.jsx:25 ya usa lazy(() => import("./views/HistoryView.jsx")).
    Chunk actual en build: ~151KB (gzip 53KB), lejos de los 845KB originales.

[x] EsperandoAprobacionView usa emojis — RESUELTO
    Sin emojis en el archivo. Usa iconos de lucide-react (ArrowLeft, etc.)

[x] admin.motogestion.ar desactualizado — SIN ACCION REQUERIDA
    Ver .clou/ESTADO.md: admin queda 1 commit atras de app (64a1915 vs 53bd8b8)
    sin diff de codigo. Auto-deploy via Git integration de Vercel.
```

No hay deuda tecnica activa pendiente en esta lista. Antes de asumir un item como
pendiente, verificar contra el codigo real — este archivo se desactualiza rapido.

---

## 5. AGENTES ESPECIALIZADOS DISPONIBLES

Este skill coordina con dos agentes existentes en `.claude/agents/`:

### `auditor-arquitectura` — Guardian preventivo (antes de escribir codigo)

Invocar ANTES de tocar cualquier archivo en `src/views/` o `src/components/`.
Responde en formato: `AUDITOR-ARQUITECTURA / Veredicto: OK | FRENAR / Motivo: ...`
No bloquea cambios en `src/hooks/`, `src/services/`, `src/lib/`, `api/`.

**Cuando invocarlo:**
- Antes de agregar `useState`/`useEffect` en una vista
- Antes de agregar un `getDoc`/`getDocs` en una vista
- Antes de calcular un derivado de negocio inline en JSX

### `motogestion-auditor` — Auditor de estado y vendibilidad (bajo demanda)

Invocar cuando se necesita un diagnostico completo del estado real del proyecto.
Verifica: build, deploy, reglas Firestore, API, flujos criticos, credenciales.
Produce el reporte ejecutivo con veredicto DEPLOYABLE / NOT DEPLOYABLE / SELLABLE.

**Cuando invocarlo:**
- Antes de mostrar la app a un cliente potencial
- Antes de un deploy critico tras cambios grandes
- Cuando se sospecha regresion en flujos de pago/PDF/calificaciones

---

## 6. CADENA DE TRABAJO OBLIGATORIA

Todo cambio debe seguir este orden. Si falta un paso, la tarea no esta terminada:

```
1. Leer directiva en .clou/directives/ si existe para la zona a modificar
2. Invocar auditor-arquitectura (para cambios en views/ o components/)
3. Implementar solo lo aprobado
4. npm run build — debe pasar sin errores
5. git diff — verificar que solo se tocaron archivos necesarios
6. git commit
7. git push origin main
8. npx vercel --prod --scope matias2015fs-projects
9. Verificar: https://app.motogestion.ar/version.json muestra el nuevo SHA
10. Confirmar con el usuario — solo entonces declarar la tarea terminada
```

---

## 7. CONTEXTO DE INFRAESTRUCTURA

```
Repos:
  github.com/Matias2015F/johnny-blaze-os     -> App + Admin (mismo repo)
  github.com/Matias2015F/motogestion-landing -> Landing publica

Vercel (scope: matias2015fs-projects):
  motogestion-app    | app.motogestion.ar   | prj_X415e2TPGQsMXnjvfCBXqgh0m5Fn
  motogestion-admin  | admin.motogestion.ar | prj_SMj9OfT4md9tZTvBHMfl7b2Ro9ZT

Env vars ambos proyectos:
  FIREBASE_SERVICE_ACCOUNT_B64 | MP_ACCESS_TOKEN | MP_WEBHOOK_SECRET | PUBLIC_APP_URL
Env vars solo motogestion-app:
  CRON_SECRET | RESEND_API_KEY | VAPID_PUBLIC_KEY | VAPID_PRIVATE_KEY

Admin UID: ERqAgJfizDNXihicDEegT2u5tws2 (matias4604@gmail.com)
```
