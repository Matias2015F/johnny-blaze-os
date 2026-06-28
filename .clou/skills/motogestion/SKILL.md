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
src/utils/calc.js
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

## 3. BACKLOG SRP — ESTADO VERIFICADO (2026-06-27, commit 35aaf77)

### DONE — Ya tienen hook extraido

*Ultima verificacion: 2026-06-27 | HEAD local: `5e5a55f` | Produccion: `35aaf77`*

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

### PENDIENTES — Backlog ordenado por prioridad

**P1 — Logica de dominio + Firestore directo mezclado en vista (abordar primero):**

```
[ ] useVerifyReceipt       <- VerifyReceiptView.jsx
    11 useState, getDoc Firestore (publicReceipts/{token}), 3 fetch async
    (/api/submit-rating, /api/download-receipt-pdf, /api/verify-document)
    Vista publica sin auth — la mas cargada y mas critica para el cliente externo

[ ] useRetentionOffer      <- RetentionOfferView.jsx
    fetch /api/retention-offer (init), fetch /api/mp-create-preference?mode=retention (accion)
    Maquina de estados: cargando | login | ok | activa | error
    Patron identico a useSuscripcionPanel

[ ] useTallerPublicView    <- TallerPublicView.jsx
    getDoc directo a Firestore (publicWorkshops/{uid})
    Estado: cargando | ok | error
```

**P2 — Logica mezclada con form state:**

```
[ ] useEsperandoAprobacion <- EsperandoAprobacionView.jsx
    useEffect carga orden/cliente/moto desde LS
    Timer con setInterval
    5 calculos de totales inline en render (totalTareas, totalRepuestos, etc.)
    handleAprobar llama actualizarOrden — debe retornar { ok } y la vista navega

[ ] useNuevoPresupuesto    <- NuevoPresupuestoView.jsx
    getDoc directo a Firestore: users/{uid}/clienteBeneficios/{patente}
    useMemo para coincidenciaMoto
    Estado: beneficio (dato de Firestore), ignorarSugerencia
```

**P3 — Derivados puros (menor urgencia):**

```
[ ] usePreciosPanel        <- PreciosView.jsx
    2 useMemo: sugerencias y stats/filtrados
    Form state (busqueda, ccFiltro) queda en la vista

[ ] calcularResultadosOrden en BikeProfileView.jsx
    Llamado inline en JSX — mover import a hook

[ ] PresupuestosView.jsx
    1 useMemo de filtrado — caso minimo
```

### Vistas LIMPIAS (no requieren hook)

HomeView, AgendaView, RecordatoriosView, NewOrderView, RetiroView, EjecucionView

---

## 4. DEUDA TECNICA ACTIVA

```
[ ] Node.js 24.x — DEADLINE 2026-10-01
    Agregar en package.json: "engines": { "node": "24.x" }

[ ] HistoryView chunk 845KB
    Aplicar dynamic import() en TallerPanel.jsx:
    const HistoryView = lazy(() => import("./views/HistoryView"))

[ ] EsperandoAprobacionView usa emojis en produccion
    Reemplazar por iconos lucide-react (reglas del proyecto prohiben emojis)

[ ] admin.motogestion.ar desactualizado
    Hacer deploy con swap de project.json al proyecto motogestion-admin
```

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
