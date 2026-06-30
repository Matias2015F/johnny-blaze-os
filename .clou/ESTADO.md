# ESTADO DEL PROYECTO - MotoGestion

> Leer este archivo al inicio de cada sesion, sea Claude o Codex.
> Actualizar al final de cada sesion antes de cerrar.

---

## HEAD en produccion

| Entorno | Proyecto Vercel | SHA | Fecha deploy |
|---|---|---|---|
| `app.motogestion.ar` | `motogestion-app` | `9efd7d2` | 2026-06-29 |
| `admin.motogestion.ar` | `motogestion-admin` | `114b416` | 2026-06-25 |

## HEAD en GitHub (origin/main)

SHA: `9efd7d2` — feat(ONBOARD-001-B): reforzar captura de telefono para reputacion verificada

## HEAD local

SHA: `9efd7d2` — en sync con origin/main (cambio sin commitear: .clou/ESTADO.md, este archivo).

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

# RC-1 — CERTIFICADA

Fecha: 2026-06-29

Estado:
CERTIFICADA

Superficies auditadas:

- QA-001 — Aplicacion → APROBADA
- QA-002 — Panel Administrador → APROBADA
- QA-003 — Landing → APROBADA (RC1-FIX-001 deployado, `57968ec`)
- QA-004 — Sistema de Reputacion → CERTIFICABLE (sin bloqueantes)

Resultado:

No existen bloqueantes funcionales para comenzar la etapa comercial.

Hallazgos pendientes (no bloqueantes):

HF-QA004-1
Bug latente en `moderate-rating.js`: lee `ratingData.score` que `submit-rating.js` nunca escribe.
`usuarios/{uid}.reputacion.sumaScore` siempre incrementa en 0. Campo no leido hoy en `src`.
Corregir antes de construir dashboards RC-3/DI-001 que consuman `reputacion`.
Prioridad: P2

HF-QA004-2
`publicWorkshops.ratingAvg` es un snapshot que solo se recalcula al republicar manualmente
(`usePublicarRedCard.js`). Calificaciones aprobadas despues no refrescan el promedio publico.
Prioridad: P2

HF-QA004-3
`garantiasRegistradas` hardcodeado en 0 en `publish-workshop` (`verify-document.js:201`).
El perfil publico siempre muestra 0 garantias. Cosmetico.
Prioridad: P3

Conclusion:

RC-1 queda cerrada.
La siguiente etapa del proyecto pasa a ser RC-2 (Growth).

---

ETAPA ACTUAL

Construccion: FINALIZADA
Certificacion RC-1: FINALIZADA
Etapa activa: RC-2 — Growth

---

## Ultima sesion

**Fecha:** 2026-06-29
**IA:** Claude (Sonnet 4.6 / Opus 4.x)
**Tickets cerrados:** RC1-FIX-001 + QA-004 (RC-1 CERTIFICADA) + ONBOARD-001 (verificacion) + ONBOARD-001-A

**Trabajo RC-2 (esta sesion, mas reciente):**
- RC1-FIX-001 `57968ec`: validacion defensiva de planDurations en api/verify-document.js
  (handlePublicPrices) y src/services/saasService.js (normalizeAdminSettings).
  Firestore tenia planDurations.base=3; la landing mostraba "ARS / 3 dias". API ya devuelve 30.
  HF-QA003-1 resuelto. QA-003 -> APROBADA.
- QA-004: auditoria del Sistema de Reputacion como circuito. CERTIFICABLE, sin bloqueantes.
  RC-1 CERTIFICADA (ver bloque RC-1 arriba). Hallazgos HF-QA004-1/2/3 documentados.
- ONBOARD-001: verificacion del embudo usuario nuevo (registro -> trial -> primer OT ->
  comprobante). Embudo tecnico sano. Hallazgos HF-OB-1/2/3.
- ONBOARD-001-A `19da164`: fix HF-OB-1 en App.jsx. Reintento x1 + estado error_perfil
  recuperable cuando ensureAccountProfile falla en el primer login (antes: loading infinito).
  Aditivo, solo App.jsx. Directiva: .clou/directives/onboard-profile-bootstrap.md.
  Deploy verificado en produccion (version.json 19da164). Camino feliz verificado en preview.

- ONBOARD-001-B `9efd7d2`: fix HF-OB-2. Refuerzo no bloqueante de captura de telefono.
  PrePdfView: si el cliente no tiene telefono al emitir, advertencia ambar + input inline
  que persiste el tel (LS.updateDoc) para emitir verificado; se puede emitir igual sin tel.
  NewOrderView: hint bajo el campo Telefono. No toca crearPublicReceipt, submit-rating,
  irAlPdf ni Baseline. Directiva: .clou/directives/onboard-phone-capture.md.
  Deploy verificado (version.json 9efd7d2). Hint verificado en preview; advertencia
  PrePdfView compila pero no gatillada interactivamente (requiere flujo completo real).

**Proximo ticket RC-2 (pendiente de decision):**
- GROWTH-001/002 (landing: testimonios reales + beneficio 15% en hero).
- CAPTACION-001 (outreach con growth-specialist).
- HF-QA004-1 (P2): corregir antes de construir dashboards RC-3/DI-001.

---

## Sesiones anteriores

**Fecha:** 2026-06-29
**IA:** Claude (Sonnet 4.6)
**Tickets cerrados:** Bugfix RC-1 (P0-A + P0-B) + QA-001 + QA-002 + QA-003

**Trabajo realizado:**
- QA-001: auditoria completa de produccion (8 hallazgos catalogados)
- QA-001.1: verificacion HF-001 (disenyo intencional), HF-005 (REAL), HF-006 (REAL)
- P0-A `740b364`: corregir precio plan Mensual ARS 1 -> ARS 65.000
  - DEFAULT_SAAS_ADMIN_SETTINGS.precios.base: 125000 -> 65000
  - normalizeAdminSettings: validacion defensiva >= 1000
  - Firestore admin_settings/global.precios.base: actualizado a 65000 via admin panel
- P0-B `dfdd0ee`: reemplazar window.confirm con modal React en ELIMINAR orden
  - window.confirm es suprimido en PWAs instaladas y auto-confirmado en CDP
  - localConfirm state + overlay modal identico al patron de OrderDetailView
- Deploy `dfdd0ee` verificado en produccion (version.json + re-test QA-001.1)
- Re-test QA-001.1: HF-005 PASS (ARS 65.000 en pantalla), HF-006 PASS (modal React funciona)
- Lint: 0 errors, 59 warnings preexistentes
- QA-002: auditoria funcional completa de admin.motogestion.ar (6 areas, sin bloqueantes)

**Veredicto QA-001:** RC-1 APROBABLE — condicionada a que QA-002 y QA-003 no levanten bloqueantes.
HF-002, HF-003, HF-004, HF-007 quedan como deuda conocida, no bloquean RC-1.

**Veredicto QA-002:** PASS — admin.motogestion.ar certifica datos coherentes, acciones criticas funcionan.
Hallazgos:
- HF-QA002-1 (Baja — inconsistencia administrativa): fefe@gmail.com badge TRIAL con activoHasta vencido.
  Impacto: solo panel admin. App aplica resolveSaasAccess correctamente. No bloquea RC-1.
- HF-QA002-INFO-1 (Informativo): 3 cobros sandbox (ARS 3,00) en billingInvoices de aerovision.dji@gmail.com.
  Documentar para no confundir con pagos reales futuros.
- MF-QA002-1 (Mejora futura, prioridad baja): hardening del panel admin — validacion de precio minimo,
  duracion minima y advertencias de cambios criticos antes de guardar configuracion.

**Veredicto QA-003:** CONDICIONAL
Motivo: existe un unico defecto confirmado de comunicacion comercial (HF-QA003-1) cuya
correccion requiere unicamente modificar el copy de la landing. No existen defectos
estructurales en el embudo ni inconsistencias entre App, Admin y la propuesta de valor.

Hallazgos:
- HF-QA003-1 — DEFECTO CONFIRMADO (Bloquea RC-1, Alta)
  Area: Landing / Pricing
  Defecto: el plan Mensual muestra "3 dias" cuando el periodo comercial real es 30 dias.
  Evidencia: verificacion manual sobre produccion. saasService + Firestore usan 30 dias.
    La landing muestra 3 dias. Discrepancia confirmada entre copy y sistema.
  Impacto: puede generar expectativa falsa sobre la duracion del plan y afectar conversion.
  Estado: pendiente de correccion.
  Fix: 1 linea en motogestion-landing/landing.html. Sin deploy de app.
- HF-QA003-2 (Mejora futura): formulario de contacto sin SLA de respuesta
- HF-QA003-3 (Mejora futura): sin testimonios de talleres reales
- HF-QA003-4 (Mejora futura): beneficio 15% descuento no visible en el hero
- HF-QA003-5 (Mejora futura): "REPUTACION" sin tilde en navegacion

Metricas ecosistema:
- ICR-1 (Comprension): 3 SI / 1 PARCIAL
- ICR-2 (Propagacion): POSIBLE — arquitectura correcta, masa critica en construccion
- ICE (Coherencia): 8.3/10

Benchmark competitivo:
- Gestioo: software generico, sin nicho, sin trial, sin pricing visible. No competidor real.
- TallerPro: competidor directo mas fuerte (Argentina, talleres mecanicos, pricing claro, testimonios).
  Sin sistema de reputacion, sin QR, sin historial certificado — vacio que MotoGestion ocupa solo.
- Disfil: e-commerce mayorista de insumos. No competidor.

Estado del ciclo RC-1:
| Superficie | Ticket | Estado |
|---|---|---|
| App (Producto) | QA-001 | Aprobada |
| Panel Administrador (Operacion) | QA-002 | Aprobada |
| Landing + Embudo Comercial | QA-003 | Condicional |
| Sistema de Reputacion | QA-004 | Pendiente |
| RC-1 | — | CERTIFICABLE (pendiente RC1-FIX-001 + QA-004) |

RC-1 es CERTIFICABLE: todas las auditorias pasaron o tienen defecto unico localizado.
No hay deuda estructural oculta.

QA-004 — Sistema de Reputacion (pendiente):
Auditar como unidad independiente el circuito completo:
VerifyReceiptView (app.motogestion.ar/verificar/:token)
  -> PDF + QR generado
  -> Verificacion por telefono
  -> Calificacion vinculada al comprobante
  -> Reputacion acumulada en panel del taller
  -> Ranking publico en Red MotoGestion (motogestion.ar)
  -> Descuento automatico en proximo presupuesto
Es el principal diferencial competitivo segun el benchmark.
Hasta hoy aparece distribuido entre QA-001 y QA-003 pero no fue certificado como circuito.

**Proximo ticket:** RC1-FIX-001
Repositorio: motogestion-landing
Archivo: landing.html
Cambio: "3 dias" -> "30 dias" en copy del plan Mensual
Validacion: deploy + verificar produccion + re-ejecutar QA-003 HF-QA003-1
Resultado: QA-003 Aprobada. Luego ejecutar QA-004. Luego RC-1 Certificada.

**Roadmap post-RC-1:**
RC-2 — Growth: captacion de talleres, landing, SEO, contenido, conversion
RC-3 — Decision Intelligence: dashboard ICE/ICR, embudos, hipotesis, recomendaciones
  Directiva: .clou/directives/decision-intelligence.md (DI-001)
RC-4 — Network Effects: historial certificado, ranking, garantia, QR, valor de reventa
RC-5 — Escalabilidad: performance, arquitectura, observabilidad, automatizacion

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
