# ESTADO DEL PROYECTO - MotoGestion

> Leer este archivo al inicio de cada sesion, sea Claude o Codex.
> Actualizar al final de cada sesion antes de cerrar.

---

## HEAD en produccion

| Entorno | Proyecto Vercel | SHA | Fecha deploy |
|---|---|---|---|
| `app.motogestion.ar` | `motogestion-app` | `a4912f9` | 2026-06-29 |
| `admin.motogestion.ar` | `motogestion-admin` | `114b416` | 2026-06-25 |

## HEAD en GitHub (origin/main)

SHA: `a4912f9` — perf(P2.2-B): separar pdfjs-dist del chunk HistoryView

## HEAD local

SHA: `a4912f9` — en sync con origin/main.

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

**Fecha:** 2026-06-29
**IA:** Claude (Sonnet 4.6)
**Trabajo realizado:**
- Deploy verificado: `5634dde` en produccion (`app.motogestion.ar/version.json` confirmado)
- Committeado: `5634dde` chore(package-lock): sincronizar engines node a 24.x
- Lint: 0 errors, 59 warnings preexistentes (ninguno nuevo)
- Build local: OK en 15.44s / Build Vercel: OK en 36.04s
- Node runtime: 24.x (engines sincronizado en package.json + package-lock.json)

**Estado por fase:**
- P1: completo
- P2.0 (Node 24): completo
- P2.1 (resolverTicketSoporte): completo
- P2.2-A (dynamic imports HistoryView): aplicado pero PARCIAL — ver nota abajo
- P2.2-B: PENDIENTE

**Nota P2.2-B — COMPLETADO:**
`HistoryView` bajo de 512 kB a **150.92 kB** (-70%).
`pdfjs-dist` separado en chunk independiente `pdf-*.js` (361 kB, cargado on-demand).
Warning de Vite >500 kB: eliminado. Produccion verificada en `a4912f9`.

**Proximo ticket:** DX-001 — Arquitectura del entorno de desarrollo.
Alcance acotado: crear `.claude/templates/` unicamente. No mover reglas, no tocar CLAUDE.md, no tocar agentes ni skills existentes.

---

## Pendientes documentados

| Item | Prioridad | Referencia |
|---|---|---|
| ~~Runbook de rotación de credenciales~~ — DONE `e52d1d7` | Alta | `.clou/runbook-rotacion-credenciales.md` |
| ~~Dependabot habilitado en el repo~~ — DONE `1be3944` | S | THREAT_MODEL.md sección 8, M4 |
| ~~Custom Claims para isPlatformAdmin()~~ — DONE `a846c0d` | M | `api/_firebase-admin.js`, `firestore.rules` |
| Rate limiter distribuido (Upstash Redis) | M | THREAT_MODEL.md sección 8, M3 |
| Log Drain de Vercel a destino externo | M | THREAT_MODEL.md sección 8, M6 |

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
| Admin UID | `ERqAgJfizDNXihicDEegT2u5tws2` |
