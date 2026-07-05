# Contexto MotoGestion — Estado actual
**Fecha:** 2026-07-05 | **Commit HEAD/origin:** `ec44cf2` | **Commit deploy Vercel:** `ec44cf2` | **Produccion:** `app.motogestion.ar`

**Comando de inicio:** `/motogestion`

---

## 0. Ultima reanudacion verificada (2026-07-05)

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
- Proximo ticket: CAPTACION-001-C, propuesta comercial. No iniciar outreach antes.

---

## 0.1 Reanudacion anterior (2026-07-05)

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
| `origin/main` | `ec44cf2` | en sync con local |
| Vercel app.motogestion.ar | `ec44cf2` | sincronizado y verificado por `version.json` |
| Vercel admin.motogestion.ar | desconocido | verificar antes de sync |

---

## 3. Backlog Remanente — Proximo en la Trinchera

| Prioridad | Tarea |
|---|---|
| **P1** | `useVerifyReceipt` <- `src/views/VerifyReceiptView.jsx` |
| **P2** | `useEsperandoAprobacion` <- `src/views/EsperandoAprobacionView.jsx` |
| **Deuda critica** | Node.js 24.x en `package.json` — **DEADLINE: 2026-10-01** |

### Vistas candidatas SRP (por complejidad/impacto)

```bash
# Auditar antes de tocar:
grep -n "useState\|useEffect\|fetch\|LS\." src/views/NombreView.jsx
```

1. `src/views/HomeView.jsx`
2. `src/views/NewOrderView.jsx`
3. `src/views/HistoryView.jsx` (chunk 845KB — deuda futura: dynamic import)
4. `src/views/AgendaView.jsx`
5. `src/views/RecordatoriosView.jsx`

### Otros pendientes

- Sync `admin.motogestion.ar` con commits actuales
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
api/_firebase-admin.js  firestore.rules  src/utils/calc.js
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
