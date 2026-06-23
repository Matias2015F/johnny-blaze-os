# ESTADO DEL PROYECTO — MotoGestión

> Leer este archivo al inicio de cada sesión, sea Claude o Codex.
> Actualizar al final de cada sesión antes de cerrar.

---

## HEAD en producción

| Entorno | Proyecto Vercel | SHA | Fecha deploy |
|---|---|---|---|
| `app.motogestion.ar` | `motogestion-app` | `1947b2f` | 2026-06-22 |
| `admin.motogestion.ar` | `motogestion-admin` | `1947b2f` | 2026-06-22 |

> Nota: producción no fue redesployada para e8b6c34 (solo docs, no requiere deploy).

## HEAD en GitHub (origin/main)

SHA: `e8b6c34` — chore: add .clou/ESTADO.md for Claude-Codex session handoff

## HEAD local

SHA: `e8b6c34` — en sync con origin/main.

---

## Límite de funciones API (CRÍTICO)

Vercel Hobby permite exactamente **12 funciones** en `api/`.
Estado actual: **12/12 usadas**.
No agregar ningún archivo nuevo en `api/` sin eliminar otro primero.

---

## Última sesión

**Fecha:** 2026-06-22
**IA:** Claude (Sonnet 4.6) + Codex
**Trabajo realizado:**
- Codex: `5783351` — copy más claro para mecánicos (6 archivos)
- Codex: `9619003` — VerifyReceiptView simplificado (estrella → descarga directa)
- Codex: `1947b2f` — botón eliminar para órdenes en estado `diagnostico`
- Claude: push de los 3 commits a origin/main
- Claude: deploy admin.motogestion.ar sincronizado a `1947b2f`
- Claude: `e8b6c34` — creación de `.clou/ESTADO.md` (este archivo)

---

## Pendientes documentados

_(vacío — no hay deuda técnica crítica conocida)_

---

## Archivos sin commitear (untracked)

Estos archivos existen localmente pero NO están en git:

- `.claude/agent-memory/` — memoria interna de agentes (no versionar)
- `.claude/agents/motogestion-auditor.md`
- `.clou/directives/configview-split.md`
- `.clou/skills/funcion-unica.md`
- `AGENTS.md`
- `e2e/verify-sync-indicator.js`
- `scripts/set-mp-vars.cjs`

---

## Reglas de coordinación Claude ↔ Codex

1. **Al iniciar sesión:** leer este archivo primero. No asumir el estado del repo.
2. **Al terminar sesión:** actualizar HEAD, fecha, trabajo realizado y pendientes.
3. **Push:** siempre pushear antes de cerrar. Si no se pudo, anotarlo en Pendientes.
4. **Deploy admin:** requiere swap manual de `.vercel/project.json` (ver CLAUDE.md o `COMANDOS.md`).
5. **Si hay conflicto de merge:** no hacer force push. Resolver conflicto y commitear.

---

## Referencias rápidas

| Recurso | Ubicación |
|---|---|
| Reglas completas del proyecto | `CLAUDE.md` (raíz) |
| Comandos disponibles | `.clou/COMANDOS.md` |
| Directivas por feature | `.clou/directives/` |
| Deploy admin (swap protocol) | `CLAUDE.md` sección Deploy |
| Límite API Vercel | 12 funciones exactas en `api/` |
| Firebase Storage rules | Editar desde consola web (CLI falla) |
| Admin UID | `TNwwuKJsIXN29zJg8HWfORawdFm1` |
