# Johnny Blaze OS — Roadmap de Desarrollo Activo

Actualizado: 2026-05-19

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
- [x] Trial 30 días → bloqueo → pantalla suscripción
- [x] MercadoPago producción: pago → webhook → Firestore → desbloqueo automático
- [x] Panel admin: resumen usuarios, historial de cobros (billingInvoices)
- [x] Planes base / pro configurables desde Firestore admin_settings/global

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

### UX / Funcionalidad
- [ ] Input dictado (Web Speech API) en campo "Falla" de NewOrderView
- [ ] Actualizacion de km de moto al cerrar OT (campo kmEntrega → moto.kilometrajeActual)
- [ ] Recordatorios por tiempo (días) además de km
- [ ] Editar recordatorio existente desde RecordatoriosView
- [ ] Filtro por moto/cliente en RecordatoriosView

### Agenda
- [ ] Vista AgendaView: turnos confirmados con recordatorio previo (ya tiene base)

### Admin / Analítica
- [ ] Métricas de conversión trial → pago en panel admin
- [ ] Exportar lista de usuarios a CSV

### Técnico
- [ ] Code splitting HistoryView (842 kB → mayor a 500 kB, warning en build)
- [ ] Actualizar `CONTEXTO_APP.txt` → deprecado, usar `CLAUDE.md`
- [ ] npm audit: vulnerabilidades transitivas en firebase-admin y vite/esbuild (no afectan producción, fixes son breaking changes)

---

## DESCARTADO / FUERA DE SCOPE

- React Router (el ruteo manual por estado es suficiente y más simple)
- Redux / Context API (LS + useCollection resuelve el estado)
- Testing automatizado (MVP prioriza velocidad de iteración)
- Múltiples técnicos / roles (fuera de roadmap actual)
- `.agents/skills/` sync script (la carpeta no existe en producción)
