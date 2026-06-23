# Threat Model: MotoGestión

## 1. System context

MotoGestión es un SaaS PWA para mecánicos independientes de motos en Argentina. El mecánico usa `app.motogestion.ar` para gestionar órdenes de trabajo, presupuestos, cobros y emitir comprobantes PDF verificables. Los clientes finales solo interactúan con la página pública `/verificar/:token` y el endpoint `submit-rating`. El administrador de plataforma opera desde `admin.motogestion.ar`.

Stack: React 18 + Vite 5 en el frontend (SPA estática en Vercel), Firebase Auth + Firestore + Storage como backend de datos, y 12 funciones serverless Node.js en Vercel Hobby (`api/`) que manejan pagos (Mercado Pago webhook), rating de clientes, crons de vencimiento, notificaciones push y operaciones admin. Los pagos se procesan exclusivamente vía webhook de Mercado Pago verificado con HMAC-SHA256. La generación de PDF es 100% client-side (html2canvas + jsPDF en el browser del mecánico).

El modelo de negocio SaaS depende de que los campos de suscripción (`estado`, `plan`, `activoHasta`) solo sean modificables por el Admin SDK del servidor — esta invariante está enforced en Firestore rules por `noModificaCamposSuscripcion()`. El rate limiting es per-instance en memoria (resetea en cold start de Vercel). El único operador de plataforma es una sola persona con acceso exclusivo al dashboard de Vercel y a Firebase Console. Los logs de funciones viven solo en Vercel dashboard con retención corta (~1-7 días) — sin persistencia externa ni SIEM.

## 2. Assets

| asset | description | sensitivity |
|---|---|---|
| Credenciales de admin de plataforma | UID `TNwwuKJsIXN29zJg8HWfORawdFm1` + email `matias4604@gmail.com` — acceso completo a todos los datos y operaciones | critical |
| Firebase service account | `FIREBASE_SERVICE_ACCOUNT_B64` en Vercel — Admin SDK con acceso irrestricto a Firestore, Storage y Auth | critical |
| Estado de suscripción de usuarios | Campos `estado`, `plan`, `activoHasta`, `currentPlanKey` — determinan el acceso al servicio y el revenue | critical |
| MP_WEBHOOK_SECRET | Verifica autenticidad de pagos entrantes — si se compromete, permite inyectar suscripciones gratis | critical |
| Datos de pago y facturación | `billingInvoices`, `billingEvents`, `paymentId`, montos, preferenceId de Mercado Pago | high |
| MP_ACCESS_TOKEN | Acceso a la API de Mercado Pago para consultas y operaciones de pago | high |
| Datos del taller | Órdenes de trabajo, presupuestos, historial de motos, clientes, caja — bajo `users/{uid}/` | high |
| PII de clientes finales | Nombres, últimos 4 dígitos de teléfono (hasheados con salt per-token), comentarios de calificación | high |
| Comprobantes públicos | `publicReceipts/{token}` — legibles por cualquiera con el token; 128 bits de entropía | medium |
| Disponibilidad del servicio | Límite de 12 funciones Vercel Hobby; interrupción afecta a todos los talleres | medium |
| Capacidad forense | Logs solo en Vercel dashboard, retención ~1-7 días, sin exportación — ventana corta ante incidente | medium |

## 3. Entry points & trust boundaries

| entry_point | description | trust_boundary | reachable_assets |
|---|---|---|---|
| MP Webhook (`/api/mp-webhook`) | Recibe notificaciones de pago de Mercado Pago. POST sin autenticación Firebase. | HMAC-SHA256 timingSafeEqual + timestamp freshness 5 min → activación de suscripción | Estado de suscripción, datos de pago |
| Submit Rating (`/api/submit-rating`) | Endpoint público para que clientes finales califiquen un servicio. POST sin auth. | Token regex `r[a-f0-9]{32}` + phone-last-4 SHA-256(last4:token) + Firestore transaction atómica | PII clientes, comprobantes públicos, ratings |
| Verify Document (`/api/verify-document?mode=*`) | Multiplex de 8 operaciones vía `?mode=` — incluye descarga de PDFs desde Storage. KNOWN_MODES allowlist activo desde `d828ed4`. | Rate limit per-instance + Firebase Auth condicional por modo + allowlist de modos | Comprobantes, Storage PDFs, datos de taller |
| Cron expirations (`/api/check-expirations`) | Cron diario que detecta vencimientos y aplica gracia/suspensión a todos los usuarios. | `Authorization: Bearer ${CRON_SECRET}` — Vercel-generated, entropía alta | Estado de suscripción de todos los usuarios |
| Cron push (`/api/push-send-recordatorios`) | Cron diario que envía push notifications de recordatorios. | `Authorization: Bearer ${CRON_SECRET}` | Subscripciones push, datos de recordatorios |
| Admin Dashboard (`/api/admin-dashboard`) | Panel SaaS — operaciones sobre usuarios, billing, moderación. | Firebase ID token + assertAdmin (UID/email allowlist + Firestore rol check) | Todos los assets |
| Firebase Auth (Google/email) | Registro e inicio de sesión de mecánicos. | Firebase Auth SDK; 2FA activo en cuenta de admin | Datos de taller, estado de suscripción |
| Firestore client SDK | Escrituras directas desde el frontend autenticado. | Firestore security rules — `noModificaCamposSuscripcion()`, `isOwner()`, `isPlatformAdmin()` | Datos de taller, suscripción (gated) |
| Comprobante público (`/verificar/:token`) | SPA que lee `publicReceipts/{token}` sin autenticación. | Token 128-bit entropy — sin auth de usuario | Comprobantes públicos, PII parcial |
| Supply chain (npm, Vercel build) | Dependencias: html2canvas, jsPDF, pdfjs-dist, mercadopago, web-push, html5-qrcode, leaflet. npm audit en CI desde `d828ed4`. | npm audit --audit-level=high en CI; sin hash pinning de integridad | Todos los assets |

## 4. Threats

| id | threat | actor | surface | asset | impact | likelihood | status | controls | evidence |
|---|---|---|---|---|---|---|---|---|---|
| T1 | Compromiso de cuenta admin de plataforma permite acceso completo a todos los datos y modificación de suscripciones | remote_unauth | Firebase Auth (Google/email) | Credenciales de admin, estado de suscripción, datos de taller, PII clientes | critical | possible | partially_mitigated | 2FA activo en matias4604@gmail.com, Firebase Auth; acceso exclusivo (un solo operador) | |
| T2 | Filtración del service account de Firebase permite control total del sistema sin runbook de respuesta | insider, supply_chain | Vercel env vars, build pipeline | Firebase service account, todos los assets | critical | rare | partially_mitigated | Almacenado como env var Vercel, no en git; sin proceso de rotación documentado [Owner-states] | |
| T4 | Compromiso de MP_WEBHOOK_SECRET permite inyectar pagos aprobados falsos y activar suscripciones sin pagar | remote_unauth | MP Webhook (`/api/mp-webhook`) | Estado de suscripción, datos de pago | critical | rare | partially_mitigated | HMAC-SHA256 timingSafeEqual, timestamp freshness 5 min, per-instance failure tracker; sin rotación documentada [Owner-states] | |
| T5 | Compromiso de MP_ACCESS_TOKEN permite consultar o modificar pagos de Mercado Pago directamente | insider, supply_chain | Vercel env vars | Datos de pago y facturación | high | rare | partially_mitigated | Almacenado como env var Vercel; sin rotación documentada [Owner-states] | |
| T3 | Rate limit bypass vía distribución multi-instancia de Vercel permite brute-force de phone-last-4 en submit-rating | remote_unauth | Submit Rating (`/api/submit-rating`) | PII clientes, ratings | high | possible | partially_mitigated | Rate limit per-instance (12 req/min), Firestore transaction previene doble-uso, phone hash SHA-256 con salt per-token; sin actividad anómala observada [Owner-states] | |
| T7 | isPlatformAdmin() realiza lectura Firestore por cada operación, amplificando costos y creando vector de DoS económico en escala | remote_auth | Firestore client SDK, Admin Dashboard | Disponibilidad del servicio | medium | possible | unmitigated | Firestore throttling nativo; tráfico actual bajo [Owner-states] | |
| T10 | Compromiso de dependencia npm en una actualización permite ejecución de código arbitrario en build o runtime | supply_chain | Supply chain (npm, build pipeline) | Todos los assets | critical | rare | mitigated | npm audit --audit-level=high en CI desde `d828ed4`; Dependabot habilitado desde `1be3944`; sin hash pinning de integridad | |
| T6 | Modo no reconocido en `?mode=` de verify-document cae en rama inesperada | remote_unauth | Verify Document (`/api/verify-document?mode=*`) | Comprobantes, Storage PDFs | medium | possible | mitigated | KNOWN_MODES allowlist + fallback 400 desde `d828ed4` | |
| T9 | HTML injection en email de lead via interpolación sin escapar en handleLead | remote_unauth | Verify Document (`/api/verify-document?mode=lead`) | PII admin (bandeja de entrada) | medium | possible | mitigated | escapeHtml() aplicado en nombreTaller/ciudad/telefono desde `d828ed4` | |
| T11 | Token de comprobante expuesto en historial de WhatsApp/SMS permite a un tercero leer datos del comprobante | remote_unauth | Comprobante público (`/verificar/:token`) | Comprobantes públicos, PII parcial | medium | possible | risk_accepted | Entropía de 128 bits hace inviable la enumeración; exposición solo por sharing accidental del link | |
| T12 | perfilUsuarioInicialSeguro() permite crear perfil con plan=base en Firestore, potencialmente confundiendo lógica de acceso | remote_auth | Firestore client SDK | Estado de suscripción | medium | rare | partially_mitigated | resolveSaasAccess() valida estado además de plan; Firestore rule requiere estado=trial en create | |
| T8 | CRON_SECRET comprometido permite activar manualmente cron de expiraciones y suspender suscripciones activas | remote_unauth | Cron expirations (`/api/check-expirations`) | Estado de suscripción | high | rare | risk_accepted | CRON_SECRET generado por Vercel (entropía alta); sin rotación — sin incidente que la justifique [Owner-states] | |

## 5. Deprioritized

| threat | reason |
|---|---|
| SQL injection | No hay base de datos SQL; Firestore SDK usa queries parametrizadas nativas |
| CSRF en API serverless | Las funciones no usan cookies de sesión — autenticación via Firebase ID token en headers o HMAC |
| SSRF desde webhook | El único fetch externo en mp-webhook es a `api.mercadopago.com` con URL hardcodeada |
| Elevation de privilegio por colisión de UID | Firebase Auth genera UIDs con entropía suficiente |
| Repudiation en acciones admin | criticalAuditLogs registra acciones con uid del actor, append-only; adminAuditLogs solo admin |
| XSS en SPA React | React escapa strings por defecto; no se encontró dangerouslySetInnerHTML en paths críticos |
| PDF injection (server-side) | Generación de PDF es 100% client-side en browser del mecánico autenticado [Code-verified: ExportPdfView.jsx] |

## 6. Open questions

- **[Resuelto]** verify-document fallback para modos no reconocidos → fijado en `d828ed4`
- **[Resuelto]** PDF client-side vs server-side → 100% client-side confirmado en `ExportPdfView.jsx`
- **[Resuelto]** CRON_SECRET entropía → generado por Vercel, entropía alta [Owner-states]
- **[Resuelto]** Actividad anómala en submit-rating → ninguna observada [Owner-states]
- **[Pendiente — acción requerida]** Sin runbook de rotación para `FIREBASE_SERVICE_ACCOUNT_B64`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`. Afecta T2/T4/T5. Ver sección 8, M1.
- **[Pendiente — acción requerida]** Logs de Vercel sin persistencia externa (retención ~1-7 días). Si hay un incidente, la ventana forense es corta. Ver sección 8, M6.

## 7. Provenance

- mode: bootstrap-then-interview
- date: 2026-06-23
- target: C:\Users\Usuario\johnny-blaze-os @ d828ed4
- inputs: git-log + código fuente (firestore.rules, api/*.js, package.json, vercel.json, ExportPdfView.jsx); seed THREAT_MODEL.md bootstrap
- owner: presente (Matias Fleischmann)

## 8. Recommended mitigations

| mitigation | threat_ids | closes_class | effort |
|---|---|---|---|
| Documentar runbook de rotación de credenciales: pasos concretos para rotar FIREBASE_SERVICE_ACCOUNT_B64 (nueva SA en Firebase Console + update en Vercel), MP_ACCESS_TOKEN y MP_WEBHOOK_SECRET (regenerar en MP + update en Vercel + test webhook) | T2, T4, T5 | partial | S |
| Migrar admin check a Firebase Custom Claims — elimina la lectura Firestore per-request en `isPlatformAdmin()` y el UID hardcodeado en reglas | T1, T7 | partial | M |
| Reemplazar rate limiter in-memory por rate limit distribuido (Upstash Redis o Vercel KV) para que el estado persista entre instancias y cold starts | T3 | yes | M |
| ~~Habilitar Dependabot en el repo para alertas automáticas de vulnerabilidades en dependencias npm~~ — **DONE** `1be3944` | T10 | partial | S |
| Mover HMAC failure tracker de mp-webhook a KV compartido para que persista entre cold starts de Vercel | T4 | partial | M |
| Exportar logs de funciones a un destino persistente (Vercel Log Drain → servicio externo) para extender la ventana forense ante incidentes | T2, T4, T5 | partial | M |
