# ESTADO DEL PROYECTO - MotoGestion

> Leer este archivo al inicio de cada sesion, sea Claude o Codex.
> Actualizar al final de cada sesion antes de cerrar.

---

## HEAD en produccion

| Entorno | Proyecto Vercel | SHA | Fecha deploy |
|---|---|---|---|
| `app.motogestion.ar` | `motogestion-app` | `1947b2f` | 2026-06-22 |
| `admin.motogestion.ar` | `motogestion-admin` | `1947b2f` | 2026-06-22 |

> Nota: produccion no fue redesployada para commits de documentacion posteriores a `1947b2f`.

## HEAD en GitHub (origin/main)

SHA: `2009f2d` — chore: add code review standards to CLAUDE.md

## HEAD local

SHA: `2009f2d` — en sync con origin/main.

---

## Mapa canonico de carpetas, GitHub y Vercel

| Entorno | Ubicacion / Proyecto | Estado |
|---|---|---|
| CPU produccion app | `C:\Users\Usuario\johnny-blaze-os` | Unica carpeta de trabajo real. Claude y Codex implementan unicamente aqui. |
| CPU monorepo OneDrive | `C:\Users\Usuario\OneDrive\ANTIGRAVITI_PROYECTOS\Motogestion.ar` | Descartada por decision del usuario (2026-06-22). No usar bajo ninguna circunstancia. |
| CPU preservacion | `C:\Users\Usuario\Proyectos\MotoGestion\repositorio` | Preservacion historica. No produccion activa. |
| GitHub app | `github.com/Matias2015F/johnny-blaze-os` rama `main` | Fuente remota de la app. |
| GitHub landing | `github.com/Matias2015F/motogestion-landing` | Fuente remota de landing. |
| Vercel app | `motogestion-app` -> `app.motogestion.ar` | App del mecanico / usuario taller. |
| Vercel admin | `motogestion-admin` -> `admin.motogestion.ar` | Administracion SaaS. |
| Vercel landing | `motogestion-landing` -> `motogestion.ar` | Landing publica. |

Regla: si la sesion no esta parada en `C:\Users\Usuario\johnny-blaze-os`, no asumir que esta trabajando sobre produccion.

---

## Fuente de verdad para reglas de IA

| Herramienta | Archivo que lee | Regla |
|---|---|---|
| Claude Code | `CLAUDE.md` | Documento maestro completo. |
| Codex | `AGENTS.md` | Puntero fino: debe leer `.clou/ESTADO.md` y `CLAUDE.md`. |

No duplicar reglas largas entre `CLAUDE.md` y `AGENTS.md`. Si cambia una regla del proyecto, actualizar `CLAUDE.md`.

---

## Limite de funciones API (CRITICO)

Vercel Hobby permite exactamente **12 funciones** en `api/`.
Estado actual: **12/12 usadas**.
No agregar ningun archivo nuevo en `api/` sin eliminar otro primero.

---

## Ultima sesion

**Fecha:** 2026-06-22
**IA:** Claude (Sonnet 4.6) + Codex
**Trabajo realizado:**
- Codex: `5783351` - copy mas claro para mecanicos (6 archivos)
- Codex: `9619003` - VerifyReceiptView simplificado (estrella -> descarga directa)
- Codex: `1947b2f` - boton eliminar para ordenes en estado `diagnostico`
- Claude: push de los 3 commits a origin/main
- Claude: deploy admin.motogestion.ar sincronizado a `1947b2f`
- Claude: `e8b6c34` - creacion de `.clou/ESTADO.md`
- Claude/Codex: `d0afcf4` - actualizacion de estado en `origin/main`
- Codex: normalizacion de `AGENTS.md` como puntero a `CLAUDE.md` y documentacion del mapa canonico de carpetas/proyectos.
- Codex: `a92493f` - `AGENTS.md` versionado como puntero fino y `.clou/ESTADO.md` actualizado con mapa canonico.
- Claude: `5ddbb2b` - sync CLAUDE.md + AGENTS.md + ESTADO.md
- Claude: `2009f2d` - estandares de revision de codigo en CLAUDE.md

---

## Pendientes documentados

_(vacio - no hay deuda tecnica critica conocida)_

---

## Archivos sin commitear (untracked)

Estos archivos existen localmente pero NO estan en git:

- `.claude/agent-memory/` - memoria interna de agentes (no versionar)
- `.claude/agents/motogestion-auditor.md`
- `.clou/directives/configview-split.md`
- `.clou/skills/funcion-unica.md`
- `e2e/verify-sync-indicator.js`
- `scripts/set-mp-vars.cjs`

---

## Reglas de coordinacion Claude <-> Codex

1. Al iniciar sesion: leer este archivo primero. No asumir el estado del repo.
2. Despues leer `CLAUDE.md`, incluso si la herramienta es Codex.
3. Al terminar sesion: actualizar HEAD, fecha, trabajo realizado y pendientes.
4. Push: siempre pushear antes de cerrar. Si no se pudo, anotarlo en Pendientes.
5. Deploy admin: requiere swap manual de `.vercel/project.json` (ver `CLAUDE.md` o `.clou/COMANDOS.md`).
6. Si hay conflicto de merge: no hacer force push. Resolver conflicto y commitear.

---

## Referencias rapidas

| Recurso | Ubicacion |
|---|---|
| Reglas completas del proyecto | `CLAUDE.md` (raiz) |
| Reglas para Codex | `AGENTS.md` (puntero a `CLAUDE.md`) |
| Comandos disponibles | `.clou/COMANDOS.md` |
| Directivas por feature | `.clou/directives/` |
| Deploy admin (swap protocol) | `CLAUDE.md` seccion Deploy |
| Limite API Vercel | 12 funciones exactas en `api/` |
| Firebase Storage rules | Editar desde consola web (CLI falla) |
| Admin UID | `TNwwuKJsIXN29zJg8HWfORawdFm1` |
