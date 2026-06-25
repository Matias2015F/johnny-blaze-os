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

### Fase 2.1 — Validación en LoginScreen (PENDIENTE)
- Reemplazar `Field` + `PrimaryButton` con `Input` + `Button`
- Verificar que componentes renderizan correctamente
- Testear en móvil: touch targets, responsive, interactividad

**Criterio de éxito:** LoginScreen compila, visual coherente, botones 44px mínimo

### Fase 2.2 — Rollout a vistas de alto tráfico (PENDIENTE)
Prioridad:
1. **HomeView** — dashboard principal
2. **OrderDetailView** — formulario complejo (ya 1600 líneas)
3. **ConfigView** — 3500 líneas, refactor crítico

**Patrón:** reemplazar todas las instancias inline de button/input con componentes

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
| PENDIENTE | — | Fase 2.1: LoginScreen validation |
| PENDIENTE | — | Fase 2.2: HomeView/OrderDetailView/ConfigView refactor |
| PENDIENTE | — | Fase 2.3: Resto de vistas |
| PENDIENTE | — | Fase 2.4: Mobile optimization |
