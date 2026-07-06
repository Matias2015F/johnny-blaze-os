# ESTADO DEL PROYECTO - MotoGestion

> Leer este archivo al inicio de cada sesion, sea Claude o Codex.
> Actualizar al final de cada sesion antes de cerrar.

---

## HEAD en produccion

| Entorno | Proyecto Vercel | SHA | Fecha deploy |
|---|---|---|---|
| `app.motogestion.ar` | `motogestion-app` | `ec44cf2` | 2026-07-05 |
| `admin.motogestion.ar` | `motogestion-admin` | `114b416` | 2026-06-25 (recuperado via HF-INFRA-002) |
| `motogestion.ar` | `motogestion-landing` | `237b1a0` | 2026-07-05 |

## HEAD en GitHub (origin/main)

SHA: `9c16472` - documentacion CAPTACION-001-D versionada. No cambios de codigo.

## HEAD local

SHA: en sync con origin/main. Repo limpio. No deploy requerido (documentacion pura).

## HEAD en GitHub (origin/main)

SHA: cierre documental posterior a `ec44cf2` - codigo Plan Free desplegado en `ec44cf2`; landing publica desplegada en `237b1a0`; material comercial CAPTACION-001-C versionado en docs

## HEAD local

SHA: en sync con origin/main. Codigo Plan Free desplegado en `ec44cf2`; landing publica desplegada en `237b1a0`; cierre documental/comercial posterior sin redeploy de app requerido.

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

HF-QA004-1 — RESUELTO `d8cf35f` (2026-07-01)
`moderate-rating.js` ya no lee el campo inexistente `ratingData.score`. Nueva funcion
`ratingScore()` calcula el promedio real (1-5) desde scoreAtencion/Claridad/Trabajo/Cumplimiento.
Increment/decrement simetricos. Sin impacto de UI (campo no leido en `src` aun). Deploy verificado.

HF-QA004-4 — RESUELTO `cc9767f` (2026-07-01)
La ruta auto-aprobada de `submit-rating.js` ahora acumula `reputacion.aprobados` y `sumaScore`
(fire-and-forget post-transaccion, mismo patron que el beneficio). Calculo compartido extraido
a `api/_reputation.js` (`ratingScore`, prefijo _ no cuenta en el limite de 12). moderate-rating.js
importa el helper (elimina copia local). Sin doble conteo: moderate chequea prevStatus antes de
incrementar. No se toco transaccion, antifraude ni ranking publico. Deploy verificado.

Con HF-QA004-1 + HF-QA004-4 cerrados, ambas rutas (admin y auto) acumulan reputacion correctamente.
`reputacion` queda como fuente confiable para dashboards RC-3/DI-001.

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

**Fecha:** 2026-07-05
**IA:** Claude (Haiku)
**Ticket cerrado:** CAPTACION-001-D - Lista piloto de 20 talleres

**Trabajo realizado:**
- Se compila lista piloto de 20 talleres mecanicos de motos reales en zona prioritaria
  (Rosario, Paraná, Diamante, Crespo, Oro Verde).
- Fuentes de datos verificadas: directorios publicos (licuo.com.ar, paranaonline.com.ar,
  ciclolandiamotos.com.ar, fulltimemotos.com.ar), Google Maps y redes sociales (IG/FB).
- Datos mínimos por taller: nombre, ciudad, provincia, teléfono/WhatsApp, redes,
  prioridad (Alta/Media/Baja), motivo de prioridad, primer mensaje recomendado.
- Marcado de confiabilidad: "Verificado" si 2+ fuentes, "No verificado" si falta confirmación.
- Talleres de prioridad Alta (6): Moto Garage, Mecánica Leo (Rosario); Motomecánica El Ruso,
  CRESPO MOTOS, Delgado Motos (zona prioritaria núcleo).
- Talleres de prioridad Media (8): Paraná, bajo overhead de conversión, perfil objetivo
  cuaderno/papel.
- Talleres de prioridad Baja (6): confirmación de rubro/estado antes de contactar.
- Documento entregable: `docs/comercial/CAPTACION-001-D-lista-piloto-20-talleres.md`.
- Indice actualizado: `docs/INDEX.md`.
- NO contactar todavía: lista es insumo para revisión y personalización manual del equipo
  comercial. Mensaje adaptado por tipo de taller segun guion CAPTACION-001-C.

**Validacion:**
- `npm run build`: OK.
- `npm run lint`: OK, 0 errores, 59 warnings heredados.
- No se modifico codigo, app, admin, API ni landing.
- No hubo deploy: documentacion pura.
- Commit: `9c16472` — docs(captacion): lista piloto de 20 talleres para outreach manual.
- Push a GitHub: OK.

**Estado operativo:**
```txt
DECIDED:
- CAPTACION-001: Fase piloto: 20 talleres reales para contacto manual estratégico.

IMPLEMENTED_IN_DOMAIN:
- Si, lista compilada y documentada.

CONNECTED_TO_UI:
- No aplica. Documentacion pura.

ENFORCED_IN_RUNTIME:
- No aplica. App/admin/landing sin cambios.

DEPLOYED:
- No aplica. Documentacion versionada en repo.
```

**Proximo ticket recomendado:**
- CAPTACION-001-E - Contacto manual de los 6 talleres prioritarios Alta, adaptación de
  mensajes segun respuesta, seguimiento y metricas de conversion a Plan Free.

---

## Sesion anterior

**Fecha:** 2026-07-05
**IA:** Codex
**Ticket cerrado:** CAPTACION-001-C - Propuesta comercial y guion de outreach

**Trabajo realizado:**
- Se crea `docs/comercial/CAPTACION-001-C-propuesta-y-outreach.md` como material
  comercial base para propuesta, WhatsApp, email, llamada y manejo de objeciones.
- Se enlaza el documento desde `docs/INDEX.md`.
- El contrato usado queda alineado al cierre vigente:
  Plan Free = 30 dias, 1 usuario, hasta 10 clientes, 10 motos, 10 ordenes,
  10 presupuestos, 10 comprobantes, sin tarjeta, sin compromiso.
  Plan Mensual = ARS 65.000, facturacion cada 30 dias.
- El material evita vender el Mensual como primer paso: la accion principal es
  probar el Free con trabajos reales.
- Se agregan reglas de uso para no prometer capacidad sin limite, no inventar
  testimonios/datos y personalizar siempre con un dato real del taller.

**Validacion:**
- Documento comercial verificado sin caracteres fuera de ASCII.
- Documento comercial verificado sin patrones viejos: `14 dias`, `60 clientes`,
  `60 motos`, `20 trabajos`, `20 presupuestos`, `15 comprobantes`, `125000`,
  `125.000`, `Plan Base`.
- `npm run build`: OK.
- `npm run lint`: OK, 0 errores, 59 warnings heredados.
- No se modifico codigo, app, admin, API ni landing.
- No hubo deploy: no corresponde para documentacion comercial.

**Estado operativo:**
```txt
DECIDED:
- Si, contrato Free/Mensual confirmado por CAPTACION-001-A/B.

IMPLEMENTED_IN_DOMAIN:
- Si, material comercial en docs/comercial.

CONNECTED_TO_UI:
- No aplica. No hubo cambio de producto.

ENFORCED_IN_RUNTIME:
- No aplica. App runtime sigue en ec44cf2 y landing real en 237b1a0.

DEPLOYED:
- No aplica. Documentacion versionada en repo.
```

**Respaldo:**
- `bash scripts/backup.sh` no puede ejecutarse porque WSL no tiene distribuciones instaladas.
- Respaldo equivalente realizado con PowerShell en `backups/2026-07-05_2123/`.
- Resultado: 12/13 archivos copiados; `DIRECTIVES.md` no existe en el repo.

**Siguiente ticket recomendado:**
- CAPTACION-001-D - Lista piloto de 20 talleres. No enviar en masa sin revisar
  personalizacion por taller.

---

## Sesion anterior

**Fecha:** 2026-07-05
**IA:** Codex
**Ticket cerrado:** CAPTACION-001-B - Alinear limites reales del Plan Free y landing publica

**Trabajo realizado:**
- `ec44cf2`: Plan Free queda alineado a 30 dias + 10 clientes + 10 motos +
  10 ordenes + 10 presupuestos + 10 comprobantes.
- `src/services/usageLimitService.js`: `FREE_PLAN_LIMITS` ahora usa 10 para los
  cinco recursos y `canUseFreeResource()` soporta deltas prospectivos.
- `src/services/clienteMotoService.js`: se agrega preview sin escritura para saber si
  una orden/presupuesto va a crear cliente o moto.
- `src/TallerPanel.jsx`: crear orden, crear presupuesto y convertir presupuesto a OT
  bloquean solo si la accion superaria algun limite. Usar cliente/moto existente no
  bloquea por estar justo en 10. `prePdf` queda conectado al limite de comprobantes.
- `api/mp-create-preference.js` y `api/verify-document.js`: fallback del plan Mensual
  alineado a ARS 65.000 si Firestore no responde.
- `api/send-welcome.js` e `index.html`: fallback/copy heredado de 14 dias actualizado a 30.
- `docs/landing.html` y `growth-specialist`: copy interno alineado para no prometer
  Trial ilimitado ni precio viejo.
- Landing real (`C:\Users\Usuario\motogestion-landing`) cerrada en `237b1a0`:
  `index.html` ya no promete trial ilimitado ni precio Mensual viejo. Muestra 30 dias,
  1 usuario, hasta 10 clientes, 10 motos, 10 ordenes, 10 presupuestos, 10 comprobantes,
  sin tarjeta, sin compromiso, y Plan Mensual ARS 65.000 / 30 dias.

**Validacion:**
- `git diff --check`: OK (solo avisos LF -> CRLF de Windows).
- `npm run build`: OK.
- `npm run lint`: OK, 0 errores, 59 warnings heredados.
- Deploy productivo Vercel OK: `app.motogestion.ar/version.json` -> SHA `ec44cf2`,
  buildTime `2026-07-05T18:12:20.600Z`.
- `https://app.motogestion.ar/api/public-prices` -> `base: 65000`, `pro: 300000`,
  `full: 900000`, `planDurations.base: 30`.
- HTML productivo de `app.motogestion.ar` confirma "30 dias gratis" y ya no muestra 14 dias.
- Landing local verificada con servidor estatico: HTTP 200, sin patrones contradictorios
  (`14 dias`, `carga ilimitada`, `125000`, `125.000`, `60 clientes`, `20 presupuestos`,
  `15 comprobantes`, `plan Base`).
- Deploy productivo landing Vercel OK: `motogestion.ar` aliasado desde
  `dpl_BikV7Mk3UquL2ta8qXDS2Rzr72rA`.
- HTML productivo de `motogestion.ar` confirma `lowPrice: 65000`, "30 dias de prueba",
  "Hasta 10 clientes y 10 motos", "Hasta 10 ordenes", "Hasta 10 presupuestos y
  10 comprobantes", "PLAN MENSUAL" y "65.000". No aparecen las contradicciones buscadas.

**Estado operativo:**
```txt
DECIDED:
- CAPTACION-001-A: Plan Free = 30 dias + limites 10/10/10/10/10.

IMPLEMENTED_IN_DOMAIN:
- Si, en usageLimitService + preview de cliente/moto + fallbacks API.

CONNECTED_TO_UI:
- Si, TallerPanel enforcea nueva orden, nuevo presupuesto, conversion a OT y prePdf.
- Si, AdminPanelView lee la misma constante FREE_PLAN_LIMITS.

ENFORCED_IN_RUNTIME:
- Si, deploy productivo verificado en app.motogestion.ar.

DEPLOYED:
- Si. App: SHA ec44cf2. Landing: SHA 237b1a0.
```

**Respaldo:**
- `bash scripts/backup.sh` no puede ejecutarse porque WSL no tiene distribuciones instaladas.
- Respaldo equivalente realizado con PowerShell en `backups/2026-07-05_1504/`.
- Resultado: 12/13 archivos copiados; `DIRECTIVES.md` no existe en el repo.

**Pendiente comercial:**
- Recién ahora queda habilitado escribir propuesta comercial y guiones de outreach
  con Free = 30 dias y limites 10.

---

## Sesion anterior

**Fecha:** 2026-07-05
**IA:** Codex
**Ticket cerrado:** HF-PRIV-001 - Telemetria de comprobantes sin datos sensibles

**Trabajo realizado:**
- `8f5e332`: `src/components/PrePdfView.jsx` deja de enviar `total` y `hashVerificacion`
  en `telemetryEvents.metadata` durante `trackEvent("emitir_comprobante")`.
- Se conserva `numeroComprobante` como metadata operativa suficiente.
- No se toca `snapshotFinal`, QR, `publicReceipts`, `receiptToken`, PDF ni evidencia juridica
  del comprobante. El hash sigue guardado donde corresponde para verificacion documental.
- Motivo: `trackEvent` persiste eventos globales en `telemetryEvents`; el total cobrado y el
  hash de verificacion no son necesarios para metricas de uso.

**Validacion:**
- `git diff --check`: OK (solo aviso de LF -> CRLF en Windows para `PrePdfView.jsx`).
- `npm run build`: OK.
- `npm run lint`: OK, 0 errores, 59 warnings heredados.
- Deploy productivo Vercel OK: `app.motogestion.ar/version.json` -> SHA `8f5e332`,
  buildTime `2026-07-05T00:44:08.686Z`.

**Estado operativo:**
```txt
DECIDED:
- HF-PRIV-001: no persistir total ni hashVerificacion en metadata de telemetria.

IMPLEMENTED_IN_DOMAIN:
- Si, en PrePdfView.jsx.

CONNECTED_TO_UI:
- Si, el flujo de emision de comprobante usa ese trackEvent.

ENFORCED_IN_RUNTIME:
- Si, deploy productivo verificado en app.motogestion.ar.

DEPLOYED:
- Si, SHA 8f5e332.
```

**Respaldo:**
- `bash scripts/backup.sh` no pudo ejecutarse porque WSL no tiene distribuciones instaladas.
- Respaldo equivalente realizado con PowerShell en `backups/2026-07-04_2141/`.
- Resultado: 12/13 archivos copiados; `DIRECTIVES.md` no existe en el repo.

**Pendiente local no tocado:**
- `ESTADO_CHAT_MOTOGESTION_2026-07-01.md` sigue untracked y contiene datos desfasados.
  No se commiteo ni borro para no mezclarlo con el fix.

---

## Sesion anterior

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

**GROWTH-001 — CERRADO `8c1cbb2` (2026-07-01, repo motogestion-landing / master):**
Hero de motogestion.ar antes del scroll: chips de diferenciadores (comprobante verificable,
garantia digital, historial certificado) + beneficio 15%, y fila de prueba social REAL en vivo
(talleres/trabajos/calificaciones/recomienda) espejando el endpoint existente public-workshops
(misma fuente que la seccion red; hoy 2/35/19/100%). Sin datos inventados; si falla el fetch la
fila queda oculta. CSS aditivo, sin tocar precios/URLs/estructura/app/admin. Deploy a motogestion.ar
verificado (markup live). GROWTH-002 quedo absorbido en GROWTH-001 (misma zona/objetivo).

**HF-INFRA-001 — RESUELTO OPERATIVAMENTE (P0/P1, 2026-07-01):**
`admin.motogestion.ar` no mostraba la app de administracion: cargaba la landing en su lugar.
Reportado por el usuario al intentar entrar al panel admin para cambiar duracionTrialDias.

Diagnostico confirmado por `curl -I` (read-only, sin credenciales) a los 3 dominios:

| Dominio | Content-Type/tamano | Headers |
|---|---|---|
| `motogestion.ar` (landing) | text/html, ~152 KB | Sin CSP - landing estatica |
| `admin.motogestion.ar` | text/html, ~149 KB | Sin CSP - misma forma que la landing |
| `app.motogestion.ar` | text/html, 5.6 KB | CSP estricta + X-Frame-Options DENY - SPA real |

Diagnostico corregido con API/CLI Vercel: el dominio estaba en `motogestion-admin`, pero el ultimo
deployment productivo del proyecto admin habia sido generado desde el repo `motogestion-landing`.
Por eso el alias `admin.motogestion.ar` servia landing aunque el dominio figurara en el proyecto
admin.

Accion ejecutada:
`npx vercel alias set motogestion-admin-34r61yotp-matias2015fs-projects.vercel.app admin.motogestion.ar --scope matias2015fs-projects`

Deployment restaurado:
- Project: `motogestion-admin` (`prj_SMj9OfT4md9tZTvBHMfl7b2Ro9ZT`)
- Deployment: `dpl_J45kPonmB234uTkmq5pcU7qyxjt7`
- URL origen: `motogestion-admin-34r61yotp-matias2015fs-projects.vercel.app`
- Repo/commit: `johnny-blaze-os` `114b416779e2f5348ee0a9daa59b3fb4150d59c7`

Verificacion post-fix:
| Dominio | Resultado |
|---|---|
| `admin.motogestion.ar/version.json` | `200`, JSON, SHA `114b416`, CSP estricta, `X-Frame-Options: DENY` |
| `admin.motogestion.ar/` | `200`, SPA, ~5.6 KB, CSP estricta, `X-Frame-Options: DENY` |
| `motogestion.ar/` | landing publica intacta |
| `app.motogestion.ar/version.json` | app intacta |

Impacto: admin real recuperado. Ya no bloquea el paso 2 de CAPTACION-001.

Riesgo pendiente: el proyecto `motogestion-admin` sigue teniendo historial reciente de deployments
desde `motogestion-landing`. Corregir o desconectar la integracion Git incorrecta en Vercel para
que un push futuro de landing no vuelva a pisar el admin.

**HF-INFRA-002 — RESUELTO (P0/P1, 2026-07-01):**
Corregida la integracion Git del proyecto Vercel `motogestion-admin`.

Estado anterior confirmado via API:
- `link.repo`: `motogestion-landing`
- `link.productionBranch`: `master`
- `outputDirectory`: `apps/dashboard-admin/dist` (ruta vieja/inexistente en el repo canonico)

Acciones ejecutadas:
1. Vinculo local temporal a `motogestion-admin`.
2. `vercel git disconnect` para desconectar `Matias2015F/motogestion-landing`.
3. `vercel git connect https://github.com/Matias2015F/johnny-blaze-os`.
4. PATCH `/v9/projects/prj_SMj9OfT4md9tZTvBHMfl7b2Ro9ZT`:
   - `buildCommand`: `npm run build:admin`
   - `outputDirectory`: `dist`
   - `rootDirectory`: `null`
5. Vinculo local restaurado a `motogestion-app`.

Estado final verificado:
- `link.repo`: `johnny-blaze-os`
- `link.productionBranch`: `main`
- `buildCommand`: `npm run build:admin`
- `outputDirectory`: `dist`
- `rootDirectory`: `null`
- `admin.motogestion.ar` resuelve a `dpl_J45kPonmB234uTkmq5pcU7qyxjt7`
- `admin.motogestion.ar/version.json` responde SHA `114b416`
- `.vercel/project.json` local queda restaurado a `motogestion-app`

Nota: `vercel promote motogestion-admin-34r61yotp...` devolvio 409 porque Vercel ya considera
ese deployment como produccion corriente. No hubo deploy nuevo.

**CAPTACION-001 (paso trial 30 dias) — CERRADO (2026-07-01):**
Decision de negocio confirmada: extender trial Free de 14 a 30 dias (Plan Mensual ARS 65.000
sin cambios, facturacion cada 30 dias sin cambios, Trimestral/Anual sin cambios).

Secuencia ejecutada:
1. `admin_settings/global.duracionTrialDias` actualizado a 30 desde `admin.motogestion.ar`
   (panel, con audit log) una vez resuelto HF-INFRA-001/002. Guardado sin error de validacion
   (adminValidationService.js ya aceptaba 0-30, sin cambio de logica).
2. Commit app `1dda30d` — `src/services/saasService.js:33` fallback
   DEFAULT_SAAS_ADMIN_SETTINGS.duracionTrialDias 14->30. Build+lint OK (0 errores, 59 warnings
   preexistentes). Push a `origin/main`.
3. Commit landing `7fa7ccd` — `motogestion-landing/index.html`, 3 referencias comerciales
   "14 dias"->"30 dias" (og:description, twitter:description, CTA hero). Referencias tecnicas
   no tocadas (vigencia calificaciones, periodo de facturacion, ya decian 30). Push a
   `origin/master`.
4. Deploy `npx vercel --prod` en ambos proyectos (`motogestion-app`, `motogestion-landing`).
5. Verificacion en produccion:
   - `app.motogestion.ar/version.json` -> SHA `1dda30d` (coincide con el commit).
   - `motogestion.ar` -> `curl` confirma "Empezar gratis — 30 dias" y cero ocurrencias de
     "14 dias"/"14 días".
   - Panel admin (`admin.motogestion.ar`) -> duracionTrialDias=30 confirmado por el usuario tras
     HF-INFRA-002.

Hallazgo posterior resuelto en CAPTACION-001-B (`ec44cf2`, 2026-07-05):
`src/services/usageLimitService.js` quedo alineado a Plan Free 30 dias con limites 10/10/10/10/10.

**Proximo ticket RC-2:**
- CAPTACION-001-C: redactar propuesta comercial completa con Plan Free 30 dias y limites 10.
- Luego preparar guion de outreach (growth-specialist), en ese orden.
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
