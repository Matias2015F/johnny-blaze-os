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

### Fase 2.2 — Rollout a vistas de alto tráfico

**HomeView — estado real por patrón:**

| Patrón | Descripción | Estado |
|---|---|---|
| Mini-stat row (Listas/Ingresos/Cobrado) | 3 divs `rounded-[2rem] bg-zinc-900` | ✅ DONE — `<Card>` (commit 6ef5b19) |
| ESTADO_BADGE badges | span con clases dinámicas por estadoCron | ✅ DONE — `<Badge variant>` (commit 6ef5b19) |
| Contenedor "Trabajos en curso" | div `rounded-[2rem] bg-zinc-900` | ✅ DONE — `<Card>` (commit actual) |
| Contenedor "Por dónde empezar" | div `rounded-[2rem] bg-zinc-900/80` + button CTA interno | ✅ DONE — `<Card>` + `<Button>` (commit actual) |
| CTA buttons grandes (Nuevo ingreso, Presupuestos) | `<button>` con layout interno icono+título+subtítulo | NO REFACTORIZABLE — layout complejo (icon + dos líneas de texto) no cabe en Button API actual. Quedan como están. |
| Navigation cards (Trabajos, Pagos, Historial, Más, Agenda) | `<button>` estilizado como card | NO REFACTORIZABLE — son `<button>`, Card es `<div>`. Layout custom con icono. Quedan como están. |

**Decisión documentada:** Los botones-card con layout icono+título+subtítulo no son candidatos para Button/Card sin extender la API del componente. Extender la API introduce complejidad que no está justificada por la directiva actual.

2. **OrderDetailView (1600 líneas)** — siguiente prioridad
3. **ConfigView (3500 líneas)** — refactor seccional

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
| 2026-06-25 | 6ef5b19 | Fase 2.2: HomeView mini-stats → Card, ESTADO_BADGE → Badge |
| 2026-06-25 | (pendiente commit) | Fase 2.2: HomeView "Trabajos en curso" + "Por dónde empezar" → Card + Button |
| PENDIENTE | — | Fase 2.2: OrderDetailView refactor |
| PENDIENTE | — | Fase 2.2: ConfigView refactor (seccional) |
| PENDIENTE | — | Fase 2.3: Resto de vistas (19+) |
| PENDIENTE | — | Fase 2.4: Mobile optimization |
