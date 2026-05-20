# Johnny Blaze OS — Roadmap de Desarrollo Activo

Actualizado: 2026-05-20

---

## PRODUCCION — Completado

### Core
- [x] Auth Firebase (email/password + recupero)
- [x] Flujo OT: diagnóstico → presupuesto → aprobación → reparación → finalización → pago → PDF
- [x] Cálculo automático por valor hora × dificultad × margen
- [x] Clientes, motos, titularidades
- [x] Presupuestos independientes (PRE-000001), conversión a OT
- [x] Historial de cambios de estado (audit log en orden.historial[])

### SaaS / Monetización
- [x] Trial 30 días → modo lectura → pantalla suscripción
- [x] MercadoPago producción: pago → webhook → Firestore → desbloqueo automático
- [x] Panel admin: resumen usuarios, historial de cobros (billingInvoices)
- [x] Planes base / pro configurables desde Firestore admin_settings/global
- [x] Modo Lectura: suscripción vencida → acceso restringido (ver OT, no crear)
- [x] Banner "Plan vencido" persistente sobre nav bar con botón Renovar
- [x] Periodo de gracia: banner amber, tiempo en horas si < 24h
- [x] Retorno MP `?pago=ok` → Bottom Sheet con fecha activoHasta

### Recordatorios de service
- [x] Colección `recordatorios` en Firestore
- [x] Input km objetivo en OrderDetailView (buildProximoControl)
- [x] Creación automática del recordatorio al cerrar OT (PagoView + PrePdfView)
- [x] RecordatoriosView: lista, filtros, WhatsApp, marcar hecho
- [x] Cron push diario 9AM: notificaciones Web Push por recordatorio activo

### Infraestructura
- [x] Vercel API serverless con Firebase Admin
- [x] Rate limiting por IP en todos los endpoints
- [x] Webhook MP: HMAC-SHA256 + timestamp freshness + HMAC failure tracker
- [x] Backup local (JSON) + cloud backup
- [x] Service Worker: network-only para /version.json, auto-update en iOS PWA
- [x] Terser obfuscation (minify: 2 passes, mangle toplevel, drop console)
- [x] 2FA en cuenta admin
- [x] Firestore rules: noModificaCamposSuscripcion()
- [x] Dominio motogestion.ar + app.motogestion.ar → Vercel
- [x] SEO: JSON-LD, sitemap, Google Search Console

---

## PENDIENTES — Próximos a implementar

### UX / Ergonomía de entrada (NewOrderView)
- [x] Dictado por voz: botón Web Speech API (`webkitSpeechRecognition`, locale `es-AR`) en campo Falla
- [x] Macro-chips de carga rápida: "Cambio de aceite", "Service general", etc. → inyectan texto en el campo
- [x] Foco continuo (desktop): `useRef` + `onKeyDown` Enter para saltar entre campos sin mouse

### UX / Funcionalidad
- [x] Actualización de km de moto al cerrar OT (kmEntrega → moto.kilometrajeActual)
- [x] Recordatorios por tiempo (días) además de km
- [ ] Editar recordatorio existente desde RecordatoriosView
- [ ] Filtro por moto/cliente en RecordatoriosView

### Agenda
- [ ] AgendaView: turnos confirmados con recordatorio previo (base existente)

### Admin / Analítica
- [ ] Métricas de conversión trial → pago en panel admin
- [ ] Exportar lista de usuarios a CSV

### Técnico
- [ ] Code splitting HistoryView (842 kB, warning en build)
- [ ] npm audit: vulnerabilidades transitivas (no afectan producción, fixes son breaking changes — no ejecutar)

---

## DESCARTADO / FUERA DE SCOPE

- React Router (ruteo por estado string es suficiente y más simple)
- Redux / Context API (LS + useCollection resuelve el estado)
- Testing automatizado (MVP prioriza velocidad de iteración)
- Múltiples técnicos / roles
- `.agents/skills/` sync script (carpetas eliminadas del repo)
- Layout sidebar/bottom-nav responsivo para desktop (app es mobile-first, no hay demanda real)
- `CONTEXTO_APP.txt` (deprecado, reemplazado por CLAUDE.md)
