# Contexto MotoGestion — Estado actual
**Fecha:** 2026-06-27 | **Commit:** `35aaf77` | **Produccion:** `app.motogestion.ar`

**Comando de inicio:** `"continuamos con MotoGestion"`

---

## 1. Progreso y Hitos — Refactor SRP

Objetivo completado: separacion absoluta Capa Presentacion (UI) de Capa Dominio (logica).
Regla: "La UX no cumple funciones. Primero extrae la logica a un hook."

### ConfigView.jsx — 100% desacoplado de Firestore

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

### Resultado

- `firebase/firestore` import eliminado por completo de ConfigView.jsx
- `db` eliminado del import de firebase.jsx en ConfigView
- Imports de saasService reducidos a solo `PLATFORM_ADMIN_EMAILS`, `PLATFORM_ADMIN_UIDS`
- Imports de appUpdate y pushService reducidos a `getDisplayModeInfo` e `isPushSupported`
- `calcularResultadosOrden` de calc.js eliminado (movido a useResumenPanel)
- `deleteUser` de firebase/auth eliminado (movido a useSistemaActions)

---

## 2. Arquitectura y Conexiones

### Ecosistema

```
app.motogestion.ar    -> github.com/Matias2015F/johnny-blaze-os (rama main)
admin.motogestion.ar  -> mismo repo, proyecto Vercel: motogestion-admin
motogestion.ar        -> github.com/Matias2015F/motogestion-landing
```

### Patron SRP establecido

```
src/hooks/use[Nombre].js  -- logica de dominio, estado async, efectos
src/views/*.jsx            -- solo render + wrappers handle* que llaman showToast(mensaje)
```

Contrato de hooks:
- Acciones async -> `{ ok: bool, mensaje: string }`
- `irAPagar` -> `{ ok, url, sandbox, mensaje }` (caso especial MP)
- NUNCA `showToast` dentro de un hook
- NUNCA `setView`/`navigate` dentro de un hook
- `initError`: hook expone el error del init, vista lo toastea en `useEffect([initError])`
- Hooks que leen cfg reciben `{ cfg, setCfg }` como parametros (no poseen el estado)

### Storage — Filtro Anti-Derroche

`storage.js` centraliza el unico punto de escritura a Firestore desde el frontend.
`useCollection(col)` es el unico punto de suscripcion reactiva con `onSnapshot`.
Las vistas no escriben directamente a Firestore.
Esto protege la cuota de Firebase para 500+ usuarios sin micro-lecturas basura.

---

## 3. Agentes y Skills Activos

### Agente guardian (si existe)
`.claude/agents/auditor-arquitectura.md` — vigila que la UI se mantenga tonta,
bloquea la inyeccion de logica de negocio en vistas y listeners duplicados de DB.

### Skills a activar por dominio
- Arquitectura/refactor: `engineering-skills:senior-architect`, `engineering-skills:senior-frontend`
- Firebase: `firebase-basics`, `firebase-firestore`, `firebase-auth-basics`
- Deploy: `vercel:deploy`
- Revision: `engineering-skills:code-reviewer`
- Seguridad: `engineering-skills:senior-security`

---

## 4. Alertas Tecnicas

### URGENTE: Node.js 20.x deprecated en Vercel
**Deadline: 2026-10-01**
```json
// package.json -- agregar:
"engines": { "node": "24.x" }
```

### Chunk grande
`HistoryView-*.js` = 845KB minified.
Deuda futura: `dynamic import()` para code-split HistoryView.

### API limit
12/12 funciones serverless en `api/` (limite Vercel Hobby).
NO crear archivo nuevo sin eliminar otro. Patron: `?mode=` + rewrite en `vercel.json`.

---

## 5. Pendientes y Proximos Pasos

### A) Continuar refactor SRP — vistas candidatas

```bash
# Auditar una vista antes de tocarla:
grep -n "useState\|useEffect\|fetch\|LS\." src/views/NombreView.jsx
```

Ordenadas por complejidad/impacto:
1. `src/views/HomeView.jsx`
2. `src/views/NewOrderView.jsx`
3. `src/views/HistoryView.jsx` (chunk mas grande)
4. `src/views/AgendaView.jsx`
5. `src/views/RecordatoriosView.jsx`

### B) Node.js 24.x en package.json (Deadline 2026-10-01)

### C) Sync admin.motogestion.ar con commits de esta sesion

### D) Limpiar repos y proyectos Vercel sin uso (pedido del usuario)
```bash
gh repo list --limit 50
npx vercel ls --scope matias2015fs-projects
```
Confirmar con el usuario antes de borrar — es irreversible.
Conservar: app usuario, admin, landing.

---

## 6. Archivos Protegidos (Baseline de Oro)

Modificar sin instruccion explicita esta prohibido:
```
src/App.jsx  src/TallerPanel.jsx  src/lib/storage.js
src/services/saasService.js  src/services/counterService.js
api/mp-webhook.js  api/mp-create-preference.js  api/cancel-plan.js
api/retention-offer.js  api/send-welcome.js  api/verify-document.js
api/_firebase-admin.js  firestore.rules  src/utils/calc.js
```

`noModificaCamposSuscripcion()` en `firestore.rules` bloquea autopromociones de plan.
Si se rompe, cualquier usuario puede escalar su plan sin pagar.

---

*Generado 2026-06-27. Para continuar: "continuamos con MotoGestion"*
