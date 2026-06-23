# Threat Model: MotoGestión

## 1. System context

MotoGestión es un SaaS PWA para mecánicos independientes de motos en Argentina. El mecánico usa `app.motogestion.ar` para gestionar órdenes de trabajo, presupuestos, cobros y emitir comprobantes PDF verificables. Los clientes finales solo interactúan con la página pública `/verificar/:token` y el endpoint `submit-rating`. El administrador de plataforma opera desde `admin.motogestion.ar`.

Stack: React 18 + Vite 5 en el frontend (SPA, build estático en Vercel), Firebase Auth + Firestore + Storage como backend de datos, y 12 funciones serverless Node.js en Vercel Hobby (`api/`) que manejan pagos (Mercado Pago webhook), rating de clientes, crons de vencimiento, notificaciones push y operaciones admin. Los pagos se procesan exclusivamente vía webhook de Mercado Pago verificado con HMAC-SHA256.

El modelo de negocio SaaS depende de que los campos de suscripción (`estado`, `plan`, `activoHasta`) solo sean modificables por el Admin SDK del servidor — esta invariante está enforced en Firestore rules por `noModificaCamposSuscripcion()`. El rate limiting es per-instance en memoria (resetea en cold start de Vercel). El único admin de plataforma es una cuenta Firebase única cuyo UID está hardcodeado en reglas de Firestore y en `admin-dashboard.js`.

## 2. Assets

| asset | description | sensitivity |
|---|---|---|
| Credenciales de admin de plataforma | UID `TNwwuKJsIXN29zJg8HWfORawdFm1` + email `matias4604@gmail.com` — acceso completo a todos los datos y operaciones | critical |
| Firebase service account | `FIREBASE_SERVICE_ACCOUNT_B64` en Vercel — Admin SDK con acceso irrestricto a Firestore, Storage y Auth | critical |
| Estado de suscripción de usuarios | Campos `estado`, `plan`, `activoHasta`, `currentPlanKey` — determinan el acceso al servicio y el revenue | critical |
| Datos de pago y facturación | `billingInvoices`, `billingEvents`, `paymentId`, montos, preferenceId de Mercado Pago | high |
| Datos del taller | Órdenes de trabajo, presupuestos, historial de motos, clientes, caja — bajo `users/{uid}/` | high |
| PII de clientes finales | Nombres, últimos 4 dígitos de teléfono (hasheados), comentarios de calificación | high |
| MP_ACCESS_TOKEN / MP_WEBHOOK_SECRET | Credenciales de Mercado Pago — acceso a pagos y verificación de webhooks | high |
| Comprobantes públicos | `publicReceipts/{token}` — legibles por cualquiera con el token | medium |
| Disponibilidad del servicio | Límite de 12 funciones Vercel Hobby — cualquier interrupción afecta a todos los talleres | medium |
| CRON_SECRET | Protege los endpoints de cron contra ejecución no autorizada | medium |

## 3. Entry points & trust boundaries

| entry_point | description | trust_boundary | reachable_assets |
|---|---|---|---|
| MP Webhook (`/api/mp-webhook`) | Recibe notificaciones de pago de Mercado Pago. POST sin autenticación Firebase. | HMAC-SHA256 + timestamp freshness 5 min → activación de suscripción | Estado de suscripción, datos de pago |
| Submit Rating (`/api/submit-rating`) | Endpoint público para que clientes finales califiquen un servicio. POST sin auth. | Token regex + phone-last-4 SHA-256 hash + Firestore transaction → rating write | PII clientes, comprobantes públicos, ratings |
| Verify Document (`/api/verify-document?mode=*`) | Multiplex de 8 operaciones vía `?mode=` query param — incluye descarga de PDFs desde Storage. | Rate limit per-instance + Firebase Auth condicional por modo | Comprobantes, Storage PDFs, datos de taller |
| Cron expirations (`/api/check-expirations`) | Cron diario que detecta vencimientos y aplica gracia/suspensión. | `Authorization: Bearer ${CRON_SECRET}` | Estado de suscripción de todos los usuarios |
| Cron push (`/api/push-send-recordatorios`) | Cron diario que envía push notifications de recordatorios. | `Authorization: Bearer ${CRON_SECRET}` | Subscripciones push, datos de recordatorios |
| Admin Dashboard (`/api/admin-dashboard`) | Panel SaaS — operaciones sobre usuarios, billing, moderación. | Firebase ID token + assertAdmin (UID/email allowlist + Firestore rol check) | Todos los assets |
| Firebase Auth (Google/email) | Registro e inicio de sesión de mecánicos. | Firebase Auth SDK | Datos de taller, estado de suscripción |
| Firestore client SDK | Escrituras directas desde el frontend autenticado. | Firestore security rules (noModificaCamposSuscripcion, isOwner, isPlatformAdmin) | Datos de taller, suscripción (gated) |
| Comprobante público (`/verificar/:token`) | SPA que lee `publicReceipts/{token}` sin autenticación. | Token de 128 bits de entropía — sin auth de usuario | Comprobantes públicos, PII parcial |
| Supply chain (npm, Vercel build) | Dependencias: html2canvas, jsPDF, pdfjs-dist, mercadopago, web-push, html5-qrcode, leaflet. | Sin pinning de hash de integridad verificado | Todos los assets |

## 4. Threats

| id | threat | actor | surface | asset | impact | likelihood | status | controls | evidence |
|---|---|---|---|---|---|---|---|---|---|
| T1 | Compromiso de cuenta admin de plataforma permite acceso completo a todos los datos y modificación de suscripciones | remote_unauth | Firebase Auth (Google/email) | Credenciales de admin, estado de suscripción, datos de taller, PII clientes | critical | possible | partially_mitigated | 2FA activo en matias4604@gmail.com, Firebase Auth | |
| T2 | Filtración del service account de Firebase permite control total del sistema (Firestore, Storage, Auth, Admin SDK) | insider, supply_chain | Vercel env vars, build pipeline | Firebase service account, todos los assets | critical | rare | partially_mitigated | Almacenado como env var Vercel, no en git, acceso solo server-side | |
| T3 | Rate limit bypass vía distribución multi-instancia de Vercel permite brute-force de phone-last-4 en submit-rating | remote_unauth | Submit Rating (`/api/submit-rating`) | PII clientes, ratings | high | likely | partially_mitigated | Rate limit per-instance (12 req/min), Firestore transaction previene doble-uso, phone hash con salt per-token | |
| T4 | Compromiso de MP_WEBHOOK_SECRET permite inyectar pagos aprobados falsos y activar suscripciones sin pagar | remote_unauth | MP Webhook (`/api/mp-webhook`) | Estado de suscripción, datos de pago | critical | rare | partially_mitigated | HMAC-SHA256 timingSafeEqual, timestamp freshness 5 min, per-instance failure tracker (reset en cold start) | |
| T5 | Compromiso de MP_ACCESS_TOKEN permite consultar o modificar pagos de Mercado Pago directamente | insider, supply_chain | Vercel env vars | Datos de pago y facturación | high | rare | partially_mitigated | Almacenado como env var Vercel | |
| T6 | Modo no reconocido en `?mode=` de verify-document cae en rama inesperada, potencialmente exponiendo datos o ejecutando lógica no prevista | remote_unauth | Verify Document (`/api/verify-document?mode=*`) | Comprobantes, Storage PDFs | medium | possible | unmitigated | Rate limit per-instance | |
| T7 | isPlatformAdmin() realiza lectura Firestore por cada operación admin, amplificando costos y creando vector de DoS económico | remote_auth | Firestore client SDK, Admin Dashboard | Disponibilidad del servicio | medium | possible | unmitigated | Firestore throttling nativo | |
| T8 | CRON_SECRET débil o filtrado permite activar manualmente el cron de expiraciones, suspendiendo suscripciones activas en masa | remote_unauth | Cron expirations (`/api/check-expirations`) | Estado de suscripción, disponibilidad | high | rare | partially_mitigated | CRON_SECRET como env var Vercel | |
| T9 | Inyección de contenido en nombres/descripciones de tareas afecta el renderizado del PDF generado con html2canvas | remote_auth | Firestore client SDK (datos de taller) | Datos de taller, comprobantes públicos | medium | rare | unmitigated | Slicing de strings en cleanString() solo en el endpoint de rating, no en generación PDF | |
| T10 | Compromiso de dependencia npm (html2canvas, jsPDF, web-push) en una actualización permite ejecución de código arbitrario en build o runtime | supply_chain | Supply chain (npm, build pipeline) | Todos los assets | critical | rare | unmitigated | No se encontró verificación de integridad de hashes en lockfile | |
| T11 | Token de comprobante expuesto en historial de WhatsApp/SMS permite a un tercero leer el comprobante y datos parciales del cliente | remote_unauth | Comprobante público (`/verificar/:token`) | Comprobantes públicos, PII parcial | medium | possible | risk_accepted | Entropía de 128 bits hace inviable la enumeración, exposición solo por sharing accidental del link | |
| T12 | perfilUsuarioInicialSeguro() permite crear perfil con plan=base en Firestore, potencialmente confundiendo lógica de acceso si resolveSaasAccess() no valida estado=trial | remote_auth | Firestore client SDK | Estado de suscripción | medium | rare | partially_mitigated | resolveSaasAccess() en saasService.js valida estado además de plan, Firestore rule requiere estado=trial en create | |

## 5. Deprioritized

| threat | reason |
|---|---|
| SQL injection | No hay base de datos SQL; todo pasa por Firestore SDK con queries parametrizadas nativas |
| CSRF en API serverless | Las funciones Vercel no usan cookies de sesión — autenticación via Firebase ID token en headers o HMAC |
| Server-side request forgery desde webhook | El único fetch externo en mp-webhook es a `api.mercadopago.com` con URL hardcodeada, no construida desde input |
| Elevation de privilegio por colisión de UID | Firebase Auth genera UIDs con suficiente entropía; no hay asignación predecible |
| Repudiation en acciones admin | criticalAuditLogs registra acciones con uid del actor, append-only desde cliente para talleres, solo admin puede escribir en adminAuditLogs |
| XSS en SPA React | React escapa por defecto; no se encontró uso de dangerouslySetInnerHTML en paths críticos |

## 6. Open questions

- ¿El `verify-document.js` tiene un handler de fallback explícito para modos no reconocidos (retorna 400 / 404), o cae silenciosamente a un estado no definido? (ver T6)
- ¿El CRON_SECRET tiene una longitud y entropía mínima definida? ¿Está rotado? (ver T8)
- ¿El rate limiter per-instance es suficiente para el modelo de amenaza actual, o hay talleres reales con volumen que podrían activar falsos positivos? (ver T3)
- ¿Los PDFs se generan íntegramente en el cliente (html2canvas en browser) o hay algún componente server-side? Si es client-side, T9 es menor; si hay server-side rendering el riesgo sube.
- ¿Hay un proceso de rotación de credenciales definido para FIREBASE_SERVICE_ACCOUNT_B64 y MP_ACCESS_TOKEN si se sospecha compromiso? (ver T2, T5)
- ¿Los logs de Vercel (consola) están siendo persistidos o monitoreados? Algunos paths loguean `paymentId`, `uid`, `email` — ¿quién tiene acceso a esos logs?
- ¿`npm audit` o `dependabot` están activos en el repo? (ver T10)

## 7. Provenance

- mode: bootstrap
- date: 2026-06-23
- target: C:\Users\Usuario\johnny-blaze-os @ a122848
- inputs: git-log + código fuente (firestore.rules, api/*.js, package.json, vercel.json)
- owner: unset (entrevista pendiente — ver sección 6)

## 8. Recommended mitigations

| mitigation | threat_ids | closes_class | effort |
|---|---|---|---|
| Migrar admin check a Firebase Custom Claims en lugar de lectura Firestore en `isPlatformAdmin()` — elimina las lecturas por-request y el UID hardcodeado en reglas | T1, T7 | partial | M |
| Reemplazar rate limiter in-memory por rate limit distribuido (Upstash Redis + @upstash/ratelimit o KV de Vercel) | T3 | yes | M |
| Agregar handler de fallback explícito en verify-document.js para modos no reconocidos: `return res.status(400).json({ error: "Modo inválido" })` | T6 | yes | S |
| Agregar `npm audit --audit-level=high` en CI y habilitar Dependabot en el repo | T10 | partial | S |
| Implementar rotación de credenciales y runbook documentado para FIREBASE_SERVICE_ACCOUNT_B64, MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET | T2, T4, T5 | partial | M |
| Mover HMAC failure tracker a KV compartido (mismo store que rate limit) para que persista entre cold starts | T4 | partial | M |
| Sanitizar campos de texto libre antes de pasarlos a html2canvas (truncar y strip HTML en nombres de taller, tareas, clientes) | T9 | yes | S |
