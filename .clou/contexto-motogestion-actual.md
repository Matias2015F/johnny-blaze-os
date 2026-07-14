# Contexto MotoGestion — Estado actual
**Fecha:** 2026-07-14 | **Commit deploy Vercel:** `2cb4a11` | **Produccion:** `app.motogestion.ar` | **Repo:** `7f98796` (2 commits doc-only posteriores al deploy, sin deploy pendiente)

**Comando de inicio:** `/motogestion`

---

## 0. Ultima reanudacion verificada (2026-07-14)

**Backlog SRP corregido + fix de encoding U+FFFD deployado:**
- Se verifico el backlog de `SKILL.md` (marcado como "pendiente" desde 2026-06-27) contra el
  codigo real: los 8 hooks P1/P2/P3 (`useVerifyReceipt`, `useRetentionOffer`,
  `useTallerPublicView`, `useEsperandoAprobacion`, `useNuevoPresupuesto`, `usePreciosPanel`,
  `usePresupuestosView`, `useBikeProfile`) ya estaban implementados y deployados desde el
  2026-06-28. Los 4 items de "deuda tecnica activa" (Node 24.x, HistoryView lazy-load, emojis,
  sync admin) tambien ya estaban resueltos. `SKILL.md` corregido para reflejar el estado real.
- Se detecto corrupcion real de encoding (caracter de reemplazo Unicode U+FFFD) en texto
  visible al mecanico en `src/views/BikeProfileView.jsx` y `src/views/PreciosView.jsx`
  ("proximo", "diagnostico", "Memoria Tecnica", "Minimo/Maximo Cobrado"), presente desde
  mayo 2026 sin reportar. Tambien en comentarios de `src/TallerPanel.jsx` (Baseline de Oro,
  sin impacto UI, corregido con confirmacion explicita del usuario).
- Corregida la ruta `src/utils/calc.js` (no existe) -> `src/lib/calc.js` (real) en
  `CLAUDE.md`, `SKILL.md`, este archivo, y la memoria del agente `motogestion-auditor`
  que ya habia detectado el mismo drift en una auditoria de 2026-06-02.
- `npm run build`: OK. `npm run lint`: OK, 0 errores, 59 warnings heredados.
- Commits: `da846fd`, `c82acad`, `b7b896a` (docs backlog), `2cb4a11` (fix encoding,
  **deployado**), `157bd83` (docs ESTADO), `7f98796` (docs ruta calc.js).
- Deploy verificado: `https://app.motogestion.ar/version.json` -> SHA `2cb4a11`,
  buildTime `2026-07-14T20:07:31.302Z`.
- Proximo ticket recomendado: ninguno abierto. Backlog SRP completo, sin deuda tecnica activa
  registrada. Ver seccion 3 para candidatas SRP no evaluadas (HomeView, NewOrderView, etc.)

---

## 0.1 Reanudacion anterior (2026-07-05)

**CAPTACION-001-C cerrado como material comercial:**
- Documento creado: `docs/comercial/CAPTACION-001-C-propuesta-y-outreach.md`.
- Indice actualizado: `docs/INDEX.md`.
- Contenido incluido: propuesta comercial completa, version corta para WhatsApp,
  guiones de primer contacto, secuencia de seguimiento, secuencia de email frio,
  guion de llamada/audio, manejo de objeciones, reglas de uso y metricas.
- Contrato comercial usado:
  - Plan Free: 30 dias, 1 usuario, hasta 10 clientes, 10 motos, 10 ordenes,
    10 presupuestos, 10 comprobantes, sin tarjeta, sin compromiso.
  - Plan Mensual: ARS 65.000, facturacion cada 30 dias.
- Validado sin patrones viejos: `14 dias`, `60 clientes`, `60 motos`,
  `20 trabajos`, `20 presupuestos`, `15 comprobantes`, `125000`, `125.000`,
  `Plan Base`.
- `npm run build`: OK.
- `npm run lint`: OK, 0 errores, 59 warnings heredados.
- No se modifico codigo, app, admin, API ni landing. No hubo deploy.
- Proximo ticket recomendado: CAPTACION-001-D, lista piloto de 20 talleres.
  No enviar en masa sin revisar personalizacion por taller.

---

## 0.2 Reanudacion anterior (2026-07-05)

**CAPTACION-001-B cerrado y deployado:**
- Plan Free definido y aplicado: 30 dias, 1 usuario, hasta 10 clientes, 10 motos,
  10 ordenes, 10 presupuestos y 10 comprobantes.
- `src/services/usageLimitService.js` expone `FREE_PLAN_LIMITS` con 10 en los cinco
  recursos y soporta deltas prospectivos.
- `src/TallerPanel.jsx` enforcea nueva orden, nuevo presupuesto, conversion PRE -> OT
  y entrada a `prePdf` para limite de comprobantes.
- Usar cliente/moto existente no bloquea por estar justo en el limite de clientes/motos.
- Fallbacks de precio en `api/mp-create-preference.js` y `api/verify-document.js`
  quedan en ARS 65.000 para el plan Mensual.
- Produccion verificada: `https://app.motogestion.ar/version.json` -> SHA `ec44cf2`,
  buildTime `2026-07-05T18:12:20.600Z`.
- `https://app.motogestion.ar/api/public-prices` devuelve `base: 65000`.
- Validaciones locales: `git diff --check` OK, `npm run build` OK, `npm run lint`
  OK con 59 warnings heredados.
- CAPTACION-001-C ya quedo cerrado como material comercial base.

---

## 0.3 Reanudacion anterior (2026-07-05)

**HF-PRIV-001 cerrado y deployado:**
- `src/components/PrePdfView.jsx` ya no envia `total` ni `hashVerificacion` a
  `telemetryEvents.metadata` durante `trackEvent("emitir_comprobante")`.
- Se mantiene `numeroComprobante` como metadata operativa.
- La evidencia del comprobante no cambia: `snapshotFinal.hash`, QR, `publicReceipts`,
  `receiptToken` y PDF siguen funcionando como antes.
- Produccion verificada: `https://app.motogestion.ar/version.json` -> SHA `8f5e332`,
  buildTime `2026-07-05T00:44:08.686Z`.
- Validaciones locales: `npm run build` OK, `npm run lint` OK con 59 warnings heredados.

**Respaldo de sesion:**
- `bash scripts/backup.sh` fallo porque WSL no tiene distribuciones instaladas.
- Backup equivalente PowerShell creado en `backups/2026-07-04_2141/` con 12/13 archivos.
- Falta `DIRECTIVES.md` porque no existe en el repo.

**Nota local:**
- `ESTADO_CHAT_MOTOGESTION_2026-07-01.md` queda untracked y no fue tocado.

---

## 1. Tarjeta de Cierre de Sesion (2026-06-27)

### Hitos fijados en la sesion

**8 hooks SRP extraidos de `ConfigView.jsx` (cbee5b7 -> 35aaf77):**

| Sub-componente | Hook extraido | Commit |
|---|---|---|
| OrderDetailView | `src/hooks/useOrderDetailView.js` | `5c91ec6` |
| PantallaTaller | `src/hooks/useTallerConfig.js` | `143db0e` |
| PantallaDatos | `src/hooks/useBackupPanel.js` | `c0c29db` |
| PantallaSistema | `src/hooks/useSistemaActions.js` | `4060a47` |
| PantallaSuscripcion | `src/hooks/useSuscripcionPanel.js` | `a2dd3ce` |
| PantallaReputacion | `src/hooks/useReputacionPanel.js` | `114886e` |
| PantallaResumen | `src/hooks/useResumenPanel.js` | `cbee5b7` |
| PublicarRedCard | `src/hooks/usePublicarRedCard.js` | `35aaf77` |

- `firebase/firestore` import eliminado por completo de ConfigView.jsx
- Skills `/motogestion` y `/cierre` creados y commiteados (`5e5a55f`)
- Auditoria integral de `src/views/` con backlog P1/P2/P3 documentado
- Reglas de entorno Windows memorizadas

### Respaldos de sesion

- `.clou/contexto-motogestion-actual.md` — actualizado (fuente de verdad)
- `.clou/skills/motogestion/SKILL.md` — backlog verificado
- `memory/project_johnny_blaze.md` — HEAD actualizado
- `Downloads/motogestion-cierre-2026-06-27.txt` — backup externo

---

## 2. Estado del Repo y Deploy

| Capa | SHA | Estado |
|---|---|---|
| `origin/main` | `7f98796` | en sync con local, repo limpio |
| Vercel app.motogestion.ar | `2cb4a11` | sincronizado y verificado por `version.json`. 2 commits doc-only por delante (`157bd83`, `7f98796`), no requieren deploy |
| Vercel admin.motogestion.ar | `64a1915` | 3 commits atras de origin/main, sin diff de codigo — no requiere accion (ver `.clou/ESTADO.md`) |

---

## 3. Backlog Remanente — Proximo en la Trinchera

Ninguno. El backlog SRP P1/P2/P3 y la deuda tecnica activa (Node 24.x, HistoryView
lazy-load, emojis, sync admin) se verificaron el 2026-07-14 y ya estaban resueltos
en su totalidad desde el 2026-06-28. Ver `.clou/skills/motogestion/SKILL.md` seccion 3-4.

### Vistas candidatas SRP no evaluadas todavia (por complejidad/impacto)

```bash
# Auditar antes de tocar:
grep -n "useState\|useEffect\|fetch\|LS\." src/views/NombreView.jsx
```

1. `src/views/HomeView.jsx`
2. `src/views/NewOrderView.jsx`
3. `src/views/HistoryView.jsx` (ya usa lazy-load; chunk actual ~151KB gzip 53KB)
4. `src/views/AgendaView.jsx`
5. `src/views/RecordatoriosView.jsx`

### Otros pendientes

- Limpiar repos y proyectos Vercel sin uso (`gh repo list`, `npx vercel ls`) — confirmar antes de borrar

---

## 4. Inventario del Ecosistema de Trabajo

### Agentes activos (`.claude/agents/`)

| Agente | Cuando invocar | Modelo |
|---|---|---|
| `auditor-arquitectura` | ANTES de tocar cualquier vista — bloquea logica de dominio inline en JSX y listeners duplicados | Opus |
| `motogestion-auditor` | Estado real del codebase y produccion. Fuente de verdad antes de deployar, vender o presentar | Opus |
| `backend-auditor` | Antes de tocar cualquier archivo en `api/` — audita contra el Baseline de Oro | Sonnet 4.6 |
| `growth-specialist` | Captacion de talleres: leads Google Maps/Reddit, propuestas comerciales, outreach | Opus |
| `mcp-orchestrator` | Integraciones externas (Google Sheets, WhatsApp API, Supabase, Zapier) sin contaminar contexto de codigo | Sonnet 4.6 |
| `programacion-mentor` | Explicar arquitectura y el "por que" en espanol antes de escribir codigo | Opus |
| `database-architect` | Diseno de schema, modelado, migraciones entre servicios | Sonnet 4.6 |

### Skills del proyecto (`.clou/skills/`)

| Comando | Archivo | Funcion |
|---|---|---|
| `/motogestion` | `motogestion/SKILL.md` | Apertura de sesion: carga contexto, backlog SRP, reglas de entorno |
| `/cierre` | `CIERRE.md` | Cierre de sesion: verifica prod, actualiza contexto, genera tarjeta de traspaso |
| — | `backup.md` | SOP backup del Baseline de Oro (13 archivos) a `backups/YYYY-MM-DD_HHMM/` |
| — | `funcion-unica.md` | Principio SRP — guia para extraer hooks de vistas |

---

## 5. Protocolos Especiales

### SKILL C+B (`CLAUDE.md`)

Activa simultaneamente:
- **Opcion C:** El asistente declara skills antes de tocar codigo (`/respaldo`, `/seguro`, `/revision`)
- **Opcion B:** Auditoria de estado `DECIDED / IMPLEMENTED / CONNECTED_TO_UI / ENFORCED_RUNTIME / DEPLOYED`

### `/arquitectura-soberana`

Freno de dominio: confirma entorno antes de cualquier cambio:
- `[1]` App usuario (`app.motogestion.ar`)
- `[2]` App admin (`admin.motogestion.ar`)
- `[3]` Landing (`motogestion.ar`)

---

## 6. Alertas Tecnicas

### API limit

12/12 funciones serverless en `api/` (limite Vercel Hobby).
NO crear archivo nuevo sin eliminar otro. Patron: `?mode=` + rewrite en `vercel.json`.

---

## 7. Archivos Protegidos (Baseline de Oro)

Modificar sin instruccion explicita esta prohibido:
```
src/App.jsx  src/TallerPanel.jsx  src/lib/storage.js
src/services/saasService.js  src/services/counterService.js
api/mp-webhook.js  api/mp-create-preference.js  api/cancel-plan.js
api/retention-offer.js  api/send-welcome.js  api/verify-document.js
api/_firebase-admin.js  firestore.rules  src/lib/calc.js
```

`noModificaCamposSuscripcion()` en `firestore.rules` bloquea autopromociones de plan.

---

## 8. Patron SRP (contrato establecido)

```
src/hooks/use[Nombre].js  -- logica de dominio, estado async, efectos
src/views/*.jsx            -- solo render + wrappers handle* que llaman showToast(mensaje)
```

- Acciones async -> `{ ok: bool, mensaje: string }`
- `irAPagar` -> `{ ok, url, sandbox, mensaje }` (caso especial MP)
- NUNCA `showToast` dentro de un hook
- NUNCA `setView`/`navigate` dentro de un hook
- `initError`: hook expone el error del init, vista lo toastea en `useEffect([initError])`
- Hooks que leen cfg reciben `{ cfg, setCfg }` como parametros (no poseen el estado)

---

*Actualizado 2026-06-28. Para continuar: `/motogestion`*
