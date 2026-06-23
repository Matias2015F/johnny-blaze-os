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

SHA: `8e6ec95` — docs(security): complete threat model — bootstrap-then-interview mode

## HEAD local

SHA: `8e6ec95` — en sync con origin/main.

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

**Fecha:** 2026-06-23
**IA:** Claude (Sonnet 4.6)
**Trabajo realizado:**
- Claude: configuracion de comportamiento proactivo de skills en `~/.claude/CLAUDE.md`
- Claude: `b08c4e9` - landing motogestion.ar — CRO + SEO (hero reescrito, CTA, title, meta)
- Claude: deploy landing a produccion (motogestion.ar)
- Claude: skill `find-skills` instalado (vercel-labs/skills)
- Claude: skill `threat-model` instalado (anthropics/defending-code-reference-harness)
- Claude: `412b506` - commit skills-lock.json + .agents/ a origin/main
- Claude: `d828ed4` - fix(security): quick wins T6/T9/T10 — KNOWN_MODES allowlist, escapeHtml en handleLead, npm audit en CI
- Claude: `8e6ec95` - docs(security): THREAT_MODEL.md completo — modo bootstrap-then-interview, 6 preguntas cerradas, 6 mitigaciones recomendadas

---

## Pendientes documentados

| Item | Prioridad | Referencia |
|---|---|---|
| Runbook de rotación de credenciales (FIREBASE_SERVICE_ACCOUNT_B64, MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET) | Alta | THREAT_MODEL.md sección 8, M1 |
| ~~Dependabot habilitado en el repo~~ — DONE `1be3944` | S | THREAT_MODEL.md sección 8, M4 |
| Custom Claims para isPlatformAdmin() | M | THREAT_MODEL.md sección 8, M2 |
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
| Admin UID | `TNwwuKJsIXN29zJg8HWfORawdFm1` |
