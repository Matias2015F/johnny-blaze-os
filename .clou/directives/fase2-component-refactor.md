# Directiva: Fase 2 – Refactor de Componentes UI con Librería Estándar

**Estado actual:** `IMPLEMENTED` (librería base creada)

## Objetivo

Unificar toda la UI de MotoGestión con una librería de componentes reutilizables (`Button`, `Input`, `Card`, `Badge`) que garantice:
- Paleta de colores única y coherente
- Estados visuales consistentes (hover, active, disabled)
- Touch targets mínimos de 44px (accesibilidad móvil)
- Responsive mobile-first

## Decisiones

### Componentes creados (src/components/ui/)

1. **Button.jsx** — 4 variantes (primary/secondary/danger/ghost), 3 tamaños (sm/md/lg)
2. **Input.jsx** — inputs unificados con opcional icon, error states, sizes
3. **Card.jsx** — 3 variantes (default/accent/alert), subcomponentes CardHeader/CardBody/CardFooter
4. **Badge.jsx** — 5 status variants (primary/success/warning/error/muted), StatusBadge helper
5. **index.js** — barrel export

### Design Tokens añadidos (tailwind.config.js)

```
jb.success = #10B981 (emerald)
jb.warning = #F59E0B (amber)
jb.error = #EF4444 (red)
jb.info = #3B82F6 (blue)
```

## Fases de rollout

### Fase 2.1 — Validación en LoginScreen ✅ COMPLETADA
- ✅ Reemplazado `Field` + `PrimaryButton` con `Input` + `Button` 
- ✅ Componentes renderizan correctamente
- ✅ Build passing (commit 654f6df)

**Criterio de éxito:** LoginScreen compila ✓, visual coherente ✓, botones 44px mínimo ✓

### Fase 2.2 — Rollout a vistas de alto tráfico (PENDIENTE)
Prioridad:
1. **HomeView (500 líneas, ~45 botones/cards)** — dashboard principal
   - Patrón 1: Botones grandes CTA (`rounded-[2.5rem] p-6 bg-orange-600`) → `Button variant="primary" size="lg"`
   - Patrón 2: Cards navegación (`rounded-[2rem] border-zinc-800 bg-zinc-900 p-5`) → `Card` + `Button` hover state
   - Patrón 3: Cards de estado (`bg-emerald-500/10 border-emerald-500/30`) → `Card variant="success"` / `"warning"` / `"error"`
   - Patrón 4: Pequeños botones utilidad → `Button size="md"` o `Button variant="ghost" size="sm"`
   
2. **OrderDetailView (1600 líneas)** — formulario complejo, muchos botones de acción
   - Mismo approach que HomeView + validación de estado dinámico
   
3. **ConfigView (3500 líneas)** — más grande, refactor crítico
   - Dividir en secciones (Suscripción, Taller, Precios, Garantía)
   - Refactor sección por sección

**Estrategia HomeView (primer bloque):**
- Semana 1: Header + cards de estado (emerald/orange/yellow/red)
- Semana 2: CTA buttons (Nuevo ingreso, Presupuestos)
- Semana 3: Navigation cards (Trabajos, Pagos, Recordatorios, Historial, Agenda, Más)
- Semana 4: Alerts + acciones urgentes

### Fase 2.3 — Rollout a resto de vistas (PENDIENTE)
- 19+ vistas restantes
- Aplicar refactor incremental

### Fase 2.4 — Mobile optimization (PENDIENTE)
- Validar touch targets en todas las vistas
- Fijar overflow issues
- Safe-area padding en PWA

## Zonas protegidas (NO MODIFICAR durante este refactor)

- `saasService.js` — lógica de acceso SaaS
- `storage.js` — LS singleton (único punto de escritura)
- `firebase.js` — init Firebase
- `firestore.rules` — reglas de seguridad
- API routes (`api/`) — lógica de pagos, auth, webhooks

## Historial

| Fecha | Commit | Acción |
|---|---|---|
| 2026-06-24 | 506a9a2 | Fase 2.0: UI component library created + design tokens |
| 2026-06-25 | 654f6df | Fase 2.1: LoginScreen refactorizado con componentes Input + Button |
| PENDIENTE | — | Fase 2.2: HomeView header + cards de estado (bloque 1) |
| PENDIENTE | — | Fase 2.2: HomeView CTA buttons (bloque 2) |
| PENDIENTE | — | Fase 2.2: HomeView navigation cards (bloque 3) |
| PENDIENTE | — | Fase 2.2: HomeView alerts + urgentes (bloque 4) |
| PENDIENTE | — | Fase 2.2: OrderDetailView refactor |
| PENDIENTE | — | Fase 2.2: ConfigView refactor (seccional) |
| PENDIENTE | — | Fase 2.3: Resto de vistas (19+) |
| PENDIENTE | — | Fase 2.4: Mobile optimization |
