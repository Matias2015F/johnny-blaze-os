# AUDITORÍA FASE 2 — Paleta + Componentes + Mobile

**Fecha:** 2026-06-25  
**Scope:** src/views/ (22 vistas) + src/components/ (8 componentes) + src/index.css + tailwind.config.js  
**Análisis:** Paleta de colores, reutilización de componentes, responsividad mobile

---

## 1. MAPA DE COLORES — Inconsistencias Profundas

### 1.1 Design System Definido (tailwind.config.js)

```javascript
jb: {
  bg:              "#0A0A0A",
  surface:         "#141414",
  card:            "#1A1A1A",
  border:          "#2A2A2A",
  muted:           "#3D3D3D",
  orange:          "#E85A1A",
  "orange-hover":  "#C94A14",
  "orange-dim":    "rgba(232,90,26,0.15)",
}
```

### 1.2 Colores Usados FUERA del Design System

| Color Use Case | Hex/Tailwind Actual | Frecuencia | Recomendación | Problema |
|---|---|---|---|---|
| Botón primario (CTA) | `bg-orange-600` | 35+ | Unificar a `jb-orange` (#E85A1A) | Inconsistencia entre `orange-600` (#EA580C) vs `orange-500` (#F97316) |
| Botón primario alt | `bg-emerald-600` | 8 | ELIMINAR — usar `jb-orange` | ❌ verde usado para "Confirmó", "Service completado" — confunde acción vs. estado |
| Botón primario alt 2 | `bg-green-600` | 3 | ELIMINAR — usar `jb-orange` | ❌ verde claro adicional, duplica emerald |
| Botón secundario | `bg-zinc-800` / `bg-zinc-900` | 25+ | Estandarizar a `jb-surface` | ✓ Coherente pero 3 variantes (zinc-700, 800, 900) |
| Botón acción (edit) | `bg-yellow-600` | 4 | MIGRAR a `jb-orange` o crear color de edición | ⚠️ Usado solo en OrderDetailView (tareas/pagos), no visualmente consistente |
| Botón destrucción | `bg-red-600` / `bg-rose-600` | 8 | Estandarizar a `red-600` | ⚠️ Duplica rose-600, usa ambos |
| Estado incompleto (warning) | `bg-red-950/40` / `bg-red-500/10` | 6 | Crear token `jb-warning` | ⚠️ 3 variantes de rojo (opacity 40%, 10%, solid) |
| Estado alerta | `bg-yellow-500/20` / `bg-yellow-500/10` | 4 | Crear token `jb-alert` | ⚠️ Opacidades inconsistentes |
| Estado éxito | `bg-emerald-500/10` / `bg-emerald-500/20` / `bg-green-500/20` | 8 | Crear token `jb-success` | ❌ 3 variantes de verde |
| Fondo modal/card | `bg-zinc-950` / `bg-zinc-900` / `bg-black/30` / `bg-[#141414]` | 45+ | UNIFICAR a `jb-card` (#1A1A1A) | ❌ CRÍTICO: 4 variantes sin razón clara |
| Border | `border-zinc-700` / `border-zinc-800` / `border-white/5` / `border-orange-500/30` | 50+ | Estandarizar a `border-jb-border` (#2A2A2A) | ❌ Multiplicidad extrema |
| Texto activo/highlight | `text-orange-300` / `text-orange-400` / `text-orange-500` | 15 | Unificar a `text-orange-300` | ⚠️ 3 tonos naranjas distintos |
| Texto deshabilitado | `text-zinc-400` / `text-zinc-500` / `text-zinc-600` | 20+ | Unificar a `text-zinc-500` | ⚠️ Gradación innecesaria |
| Sombra acento | `shadow-orange-600/20` / `shadow-orange-600/30` | 6 | Crear `jb-orange-glow` en config | ✓ Presente en config pero no usado consistentemente |
| Fondo botón en nav | `bg-orange-500/20` (active) | 5 | Usar `jb-orange-dim` + `bg-orange-600/20` consistente | ⚠️ Opacidad variable (15%, 20%) |

### 1.3 Matriz de Problemas Críticos

| Problema | Ubicaciones | Impacto | Solución |
|---|---|---|---|
| **Fondos de card sin unificación** | HomeView, ConfigView, OrderDetailView, AgendaView, PagosView (45+ instancias) | Alto: Usuario confundido sobre qué es clickeable | Crear Component `Card` con `bg-jb-card` |
| **Botones primarios múltiples colores** | Generalmente naranja pero 8 botones en emerald-600, 3 en green-600 | Alto: CTA débil en algunas vistas | Reemplazar todos verde → naranja; eliminar variantes |
| **Borders con opacidad inconsistente** | `white/5`, `white/10`, `zinc-700`, `zinc-800`, `orange-500/30` | Medio: Visual incoherente | Crear 3 niveles: border-subtle, border-normal, border-accent |
| **Estados sin estandarización** | Rojo: 4 variantes; Verde: 3 variantes; Amarillo: 2 variantes | Medio: Difícil validar estados a simple vista | Crear color tokens: jb-error, jb-success, jb-warning |
| **Hover/Focus/Active inconsistentes** | Buttons: `active:scale-95`, algunos `hover:bg-zinc-700`, otros nada | Medio: Feedback tactil débil | Crear utility class para button states |

---

## 2. COMPONENTES REUTILIZABLES — Frecuencias

### 2.1 Análisis de Botones

**Variantes encontradas: 16 distintas**

| Tipo | Clase/Patrón | Frecuencia | Tamaño | Color | Ejemplo |
|---|---|---|---|---|---|
| **Primario (CTA)** | `rounded-2xl bg-orange-600 py-4 text-[10px] font-black uppercase text-white active:scale-95` | 12 | `py-4` | naranja | `<button className="w-full rounded-2xl bg-orange-600 py-4 text-[11px] font-black uppercase tracking-widest text-white active:scale-95 transition-all">` (LoginScreen.jsx L330) |
| **Primario alt (verde)** | `rounded-2xl bg-emerald-600 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95` | 8 | `py-3` | emerald | AgendaView.jsx L470 |
| **Primario alt 2** | `rounded-2xl bg-green-600 text-white px-4 py-2 rounded-2xl font-black text-[9px] uppercase flex items-center gap-1 active:scale-95 flex-shrink-0` | 3 | `py-2` | green | BikeProfileView.jsx L84 |
| **Secundario** | `rounded-2xl bg-zinc-800 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-200 active:scale-95` | 18 | `py-3` | zinc-800 | AgendaView.jsx L472 |
| **Secundario alt** | `rounded-2xl bg-zinc-900 border border-zinc-700 px-8 py-4 text-[11px] font-black uppercase tracking-widest text-zinc-400 active:scale-95` | 6 | `py-4` | zinc-900 + border | TallerPanel.jsx L80 |
| **Acción (edit/amarillo)** | `rounded-2xl bg-yellow-600 px-4 py-2.5 text-[10px] font-black uppercase text-white active:scale-95 transition-all disabled:opacity-40` | 4 | `py-2.5` | yellow-600 | OrderDetailView.jsx L1245 |
| **Destrucción** | `rounded-2xl bg-rose-600 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95` | 5 | `py-3` | rose-600 | AgendaView.jsx L473 |
| **Destrucción alt** | `rounded-2xl bg-red-600 text-white px-3 py-2 text-[10px] font-black uppercase tracking-widest active:scale-95` | 3 | `py-2` | red-600 | AdminPanelView.jsx L686 |
| **Icono button** | `p-1.5 rounded-lg bg-zinc-800 text-zinc-400 active:text-orange-300 active:scale-95 transition-all shrink-0` | 12 | `p-1.5` | zinc-800 | TaskManagerView.jsx L579 |
| **Icono button alt** | `p-3 bg-black/40 rounded-2xl border border-white/5 text-white active:scale-95` | 4 | `p-3` | black/40 | OrderListView.jsx L20 |
| **Ghost button (nav)** | `flex flex-col items-center gap-1.5 px-3 py-2 rounded-2xl transition-all text-zinc-500 hover:text-zinc-300` | 5 | `py-2` | transparent/hover | TallerPanel.jsx L929 |
| **Floating action** | `fixed bottom-8 right-6 z-30 flex items-center gap-2 rounded-2xl bg-orange-600 px-4 py-4 text-white shadow-2xl shadow-orange-600/20 active:scale-95` | 3 | `py-4` | orange-600 + shadow | AgendaView.jsx L487 |
| **Estado badge (chip)** | `inline-block text-[8px] font-black px-2 py-0.5 rounded uppercase` + dynamic color | 12 | `py-0.5` | estado-dependiente | OrderListView.jsx L28 |
| **Texto clickeable** | `text-orange-500 flex items-center gap-2 text-xs font-black uppercase active:scale-95 transition-all` | 5 | inline | orange-500 | BikeProfileView.jsx L33 |
| **Confirmación (inline)** | `bg-emerald-400/15 text-emerald-300 rounded-full px-3 py-1 text-[9px]` | 3 | `py-1` | emerald + opacity | ConfigView.jsx L200 |
| **Tab (toggle)** | `rounded-2xl py-3 text-[10px] font-black uppercase tracking-widest` + conditional `bg-orange-600 text-white` / `bg-zinc-900 text-zinc-400` | 4 | `py-3` | orange/zinc | AgendaView.jsx L510 |

**Observación:** 16 variantes **debería ser ≤ 4** (Primary, Secondary, Danger, Ghost)

### 2.2 Análisis de Inputs

**Variantes encontradas: 8 distintas**

| Tipo | Clase/Patrón | Frecuencia | Ejemplo |
|---|---|---|---|
| **Input texto básico** | `w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-black text-white outline-none focus:border-orange-500 transition-colors` | 18 | AgendaView.jsx L544 |
| **Input con icono** | `flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 focus-within:border-orange-500 transition-colors` | 6 | OrderDetailView.jsx L104 |
| **Input número (inputMode numeric)** | `w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 font-black text-white outline-none focus:border-orange-500 transition-colors` | 4 | OrderDetailView.jsx L136 |
| **Select dropdown** | `w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-black text-white outline-none` | 5 | AgendaView.jsx L522 |
| **Textarea** | `w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-black text-white outline-none placeholder:text-zinc-600` | 3 | AgendaView.jsx L590 |
| **Búsqueda con autocomplete** | `flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3` (lista expandible abajo) | 2 | OrderDetailView.jsx L104 |
| **Input con prefix ($)** | `flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 focus-within:border-orange-500 transition-colors` (con span "$") | 3 | OrderDetailView.jsx L153 |
| **Admin light input (blanco)** | `bg-zinc-100 text-zinc-700 rounded-2xl px-4 py-3 border border-zinc-200` | 2 | ConfigView (admin settings) |

**Problema:** No hay unificación. Cada vista reimplementa input styling. Faltan:
- Error states
- Disabled states
- Success states
- Character count helpers
- Validación visual

### 2.3 Análisis de Cards/Panels

**Variantes encontradas: 11 distintas**

| Tipo | Clase | Frecuencia | Ejemplo |
|---|---|---|---|
| **Card oscuro básico** | `rounded-[2rem] border border-zinc-800 bg-zinc-900 p-4` | 12 | HomeView, PagosView |
| **Card oscuro alt 1** | `rounded-[1.75rem] border border-zinc-800 bg-zinc-900/50 p-4` | 8 | AgendaView |
| **Card oscuro alt 2** | `rounded-[2rem] border border-zinc-800 bg-zinc-900/40 p-4` | 4 | AgendaView |
| **Card oscuro alt 3** | `rounded-[1.75rem] border border-zinc-800 bg-zinc-950/90 p-4 shadow-xl` | 3 | AgendaView |
| **Card acento naranja** | `rounded-[2rem] border border-orange-500/20 bg-orange-500/10 p-4` | 8 | OrderDetailView |
| **Card acento rojo** | `rounded-2xl border border-red-500/20 bg-red-500/10 p-4` | 5 | OrderDetailView |
| **Card acento amarillo** | `rounded-[2rem] border border-yellow-500/20 bg-zinc-900/95 p-4 shadow-lg` | 2 | OrderDetailView |
| **Card blanco (admin UI)** | `bg-white/95 rounded-[1.75rem] shadow-[...] border border-white/70 p-5` | 5 | ConfigView (admin settings) |
| **Card con gradiente** | `rounded-[2.5rem] border border-orange-600/20 bg-gradient-to-b from-[#1C1004] via-[#141414] to-[#0A0A0A] p-8 shadow-2xl` | 2 | HomeView (header) |
| **Container header** | `bg-[#141414] p-5 border border-white/5 flex items-center gap-4 sticky top-0 z-40 rounded-[2.5rem]` | 3 | OrderListView |
| **Notificación inline** | `rounded-2xl border border-[color] bg-[color]/10 px-4 py-3` (color variable por tipo) | 15+ | OrderDetailView, homeView |

**Problema:** 11 variantes, opacidades inconsistentes (10%, 15%, 20%, 40%, 50%, 90%), radios duplicados (2rem vs 2.5rem vs 1.75rem)

### 2.4 Análisis de Bottom Sheets / Modales

**Variantes encontradas: 6 distintas**

| Tipo | Clase/Estructura | Frecuencia | Ejemplo |
|---|---|---|---|
| **Bottom Sheet (mobile)** | `fixed inset-0 z-50 flex items-end` + overlay + `rounded-t-[2rem] bg-zinc-900 border-t border-zinc-700` | 8 | OrderDetailView (EditarItemSheet) |
| **Bottom Sheet alt (centered-sm)** | `fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/70 backdrop-blur-sm sm:items-center sm:p-4` | 2 | AgendaView (modal de turno) |
| **Modal centrado (desktop)** | `fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm` + `max-w-lg rounded-[2rem] bg-[#111827]` | 3 | AgendaView (another modal) |
| **Overlay backdrop** | `absolute inset-0 bg-black/70 backdrop-blur-sm` (clickable para cerrar) | 6 | OrderDetailView, AgendaView |
| **Toast/Notificación** | `rounded-2xl border border-zinc-700 bg-zinc-900/95 px-4 py-3 shadow-2xl backdrop-blur` (fixed top o bottom) | 4 | TallerPanel |
| **Confirmación inline (sobre contenido)** | `rounded-[1.5rem] border border-orange-400/25 bg-zinc-950/50 px-4 py-3 shadow-xl backdrop-blur` | 5 | OrderDetailView |

**Problema:** `z-index` inconsistente (30, 40, 50, 120, 300), backdrop blur en algunos sí/no, animaciones falta estandarización

### 2.5 Componentes que DEBERÍA existir (candidatos)

| Componente | Frecuencia | Ubicaciones | Urgencia |
|---|---|---|---|
| `<Button>` | 80+ | Todas las vistas | 🔴 CRÍTICO |
| `<Input>` | 40+ | AgendaView, OrderDetailView, ConfigView, LoginScreen | 🔴 CRÍTICO |
| `<Card>` | 50+ | HomeView, ConfigView, OrderDetailView, todas | 🔴 CRÍTICO |
| `<Badge>` / `<Chip>` | 25+ | HomeView, OrderListView, ConfigView | 🟠 ALTA |
| `<Select>` | 10+ | AgendaView, ConfigView | 🟠 ALTA |
| `<BottomSheet>` | 8 | OrderDetailView, AgendaView | 🟠 ALTA |
| `<Modal>` | 6 | AgendaView, ErrorBoundary | 🟠 ALTA |
| `<Toast>` | 4 | TallerPanel (notifications) | 🟡 MEDIA |
| `<Stepper>` | 2 | ConfigView | 🟡 MEDIA |

---

## 3. PROBLEMAS MOBILE — Por Vista

### 3.1 Vistas con Problemas Responsivos CRÍTICOS

| Vista | Problema | Detalle | Archivo | Solución |
|---|---|---|---|---|
| **OrderDetailView** | Overflow horizontal en section de tareas | Tabla ancha sin `overflow-x-auto` o responsive grid | L1079 `<div className="rounded-2xl border border-white/10 bg-black/25 p-3">` sin flex-col | Envolver en `overflow-x-auto sm:overflow-visible` |
| **OrderDetailView** | Botones en fila (acciones) sin wrapping | 4+ botones lado a lado, en mobile < 320px se cortan | L977-1000 (Generar presupuesto, Cobrar, Entregar, etc.) | Cambiar grid `grid-cols-2 sm:grid-cols-4` → `flex flex-col gap-2 sm:grid` |
| **ConfigView** | Panel admin ancho sin max-width mobile | Inputs de admin settings sin restricción, overflow a derecha | L1000+ (form del admin) | Envolver en `max-w-xs sm:max-w-md mx-auto` |
| **ConfigView** | Stepper component width | El componente `<Stepper>` de +/- con números grandes no se ajusta | L500 (valorHora, etc.) | Cambiar layout de stepper en mobile |
| **OrderDetailView** | Chip de estado (pequeños) | Estados del orden (aprobado/rechazado) muy pequeños en mobile | L1070, L1116, L1121 | Aumentar py-1.5 → py-2 |
| **HomeView** | Acciones urgentes sin truncate | Textos largos de patente + cliente sin `truncate` en card | L200 | Agregar `truncate` a patente y cliente |
| **AgendaView** | Tabla de turno modal full-width | Modal de turno toma 100% ancho en mobile sin `max-w` | L495 `<div className="max-h-[92vh] w-full max-w-lg...">` tiene max-w-lg pero sigue ajustado | Reducir a `max-w-sm` en mobile |

### 3.2 Vistas Sin Problemas Aparentes (Responsive OK)

| Vista | Razón | Archivo |
|---|---|---|
| **HomeView** | Cards ya usan grid grid-cols-2 con gap, fuente responsiva con clamp() | L200+ |
| **OrderListView** | Estructura simple: lista vertical | L20+ |
| **PreciosView** | Layout column, inputs full-width | L50+ |
| **PagosView** | Grid grid-cols-2 gap-3, bien proporcionado | L50+ |

### 3.3 Touch Targets < 44px (WCAG AA)

**Ubicaciones con touch target insuficiente:**

| Elemento | Tamaño Actual | Ubicación | Problema |
|---|---|---|---|
| Close button (X pequeño) | `p-2` (32px) | OrderDetailView.jsx L95 | < 44px |
| Icon buttons (edit/delete) | `p-1.5` (24px) | TaskManagerView.jsx L579 | 🔴 CRÍTICO — demasiado pequeño |
| Checkbox/radio simulados | inline badge `py-0.5` | OrderListView L28 | < 44px |
| Stepper +/- buttons | `w-11 h-11` (44px) | ConfigView L500 | ✓ OK |
| Pagination dots (calendar) | default browser | AgendaView L358 | ✓ OK (browser default 44px) |

### 3.4 Padding / Margin Inconsistencias

| Zona | Valores Encontrados | Estándar Debería Ser | Problema |
|---|---|---|---|
| **Card padding** | p-3, p-4, p-5, p-6, p-8 | p-4 (16px) | 5 variantes para la misma cosa |
| **Button padding** | py-1.5, py-2, py-2.5, py-3, py-4 | py-3 (12px) o py-4 (16px) | 6 variantes |
| **Input padding** | px-3 py-2.5, px-4 py-3 | px-4 py-3 (12px top/bot) | 2 variantes OK, pero inconsistente con buttons |
| **Gap entre elementos** | gap-1.5, gap-2, gap-3, gap-4 | gap-3 (12px) | 4+ variantes |
| **Margin top (space-y)** | space-y-2, space-y-3, space-y-4, space-y-5 | space-y-4 (16px) | 5 variantes |

### 3.5 Navigation Bar Accesibilidad

| Aspecto | Estado | Detalle |
|---|---|---|
| **Bottom nav sticky** | ✓ OK | TallerPanel.jsx L925 — `fixed bottom-0 left-0 right-0 z-[200]` |
| **Touch target (nav items)** | ⚠️ DÉBIL | `px-3 py-2` = 20px height, debería ser ≥ 44px | 
| **Visual feedback** | ✓ OK | Active state: `text-orange-400 bg-orange-500/20 scale-105` |
| **Overflow nav items** | ⚠️ PROBLEMA | Si hay 6+ tabs, horizontal scroll no visible |
| **Safe area (notch)** | ⚠️ FALTA | No hay `pb-safe` en bottom nav |

---

## 4. JERARQUÍA VISUAL

### 4.1 Problemas de Falta de Jerarquía

| Problema | Ubicación | Impacto | Ejemplo |
|---|---|---|---|
| **Botones primarios vs secundarios indistinguibles** | HomeView, ConfigView | Usuario confundido sobre qué clickear primero | `bg-orange-600` y `bg-zinc-900` con border tienen peso visual similar |
| **Estados de orden sin iconografía** | OrderListView, HomeView | Diagnóstico, presupuesto, aprobación — solo texto | L28 `<span className={...ESTADO_CSS...}>` solo color, sin icono |
| **Deshabilitado no visualmente claro** | OrderDetailView (botones disabled) | Usuario intenta clickear botón inactivo | `disabled:opacity-40` muy sutil, debería ser `opacity-30 cursor-not-allowed` |
| **Prioridad de alarmas débil** | HomeView (BLOQUEADO vs ALERTA vs NORMAL) | BLOQUEADO (rojo) no se destaca lo suficiente | L25 badges con opacidad 20%, debería ser 100% |
| **Títulos vs subtítulos** | Todas las vistas | Tamaño inconsistente: text-3xl, text-2xl, text-xl | `<h1>` y `<h2>` usan tamaño dinámico inconsistente |

### 4.2 CTA (Call To Action) Placement

| Vista | CTA Principal | Ubicación | ¿Obvia? | Problema |
|---|---|---|---|---|
| **HomeView** | "Nueva orden" | Floating button (FAB) arriba derecha | ✓ Sí | Pero en hero hay imagen grande, CTA se pierde |
| **OrderListView** | Clickear orden para detalles | Card order completa | ✓ Sí | Pero no hay botón explícito "Ver detalles" |
| **OrderDetailView** | Guardar/Continuar paso | Variado por sección | ⚠️ Débil | Botones variados (amarillo, naranja, rojo) sin jerarquía clara |
| **ConfigView** | Guardar cambios | End of form | ✓ Sí | Pero form es muy largo, botón fuera de viewport |
| **PagosView** | Registrar cobro | Botón "Registrar" en cada orden | ✓ Sí | Pero fondo zinc-800, poco destacado |

---

## 5. ESPACIADO Y BLOQUES VISUALES

### 5.1 Agrupación Lógica (Buena)

| Vista | Agrupación | Nota |
|---|---|---|
| **HomeView** | Header (naranja), Stats (cards 2x2), Acciones urgentes (lista), Alertas (separadas) | ✓ Clara |
| **ConfigView** | Tabs (nav), Contenido (cards blancas), Admin (secciones separadas) | ✓ Buena agrupación visual |
| **OrderDetailView** | Cliente (card), Orden (steps), Tareas (sección), Pagos (sección), Historial (sección) | ✓ OK |

### 5.2 Agrupación Lógica (Mala)

| Vista | Problema | Archivo | Solución |
|---|---|---|---|
| **AgendaView** | Calendario y turnos sin separador visual claro | L366 | Agregar divider o space-y-6 entre secciones |
| **OrderDetailView** | Estados aprobado/rechazado inmiscuidos con tareas | L1070+ | Crear sección separada para "Aprobaciones" |
| **PagosView** | Pendientes y historial sin separación clara | L100+ | Agregar divider con `border-t border-zinc-700` |

### 5.3 Consistencia de Spacing

**Analizado:**
- **Padding interno:** p-3 a p-8 (inconsistente)
- **Margin top/bottom:** space-y-2 a space-y-5 (no hay patrón)
- **Gap en grids:** gap-2 a gap-4 (variado)

**Estándar propuesto:**
```
Espaciado base: 4px
- Tight: 4px (gap-1)
- Normal: 12px (gap-3)
- Loose: 16px (gap-4)
- Very loose: 20px (gap-5)

Padding:
- p-3: 12px (inputs, small cards)
- p-4: 16px (cards, sections)
- p-5: 20px (large cards)
- p-6: 24px (hero sections)
```

---

## 6. ESTRATEGIA DE REFACTORIZACIÓN

### 6.1 Orden Recomendado (Fases)

#### **FASE 1: Crear Componentes Base (Week 1)**
Priority: 🔴 CRÍTICO

1. **Crear `src/components/ui/Button.jsx`**
   - Variantes: primary (orange), secondary (zinc), danger (red), ghost
   - Props: `variant`, `size`, `disabled`, `fullWidth`
   - Estados: hover, focus, active unificados
   - Reemplazar: 80+ instancias en codebase
   - Archivos afectados: TODAS las vistas

2. **Crear `src/components/ui/Input.jsx`**
   - Soportar: text, email, number, select, textarea
   - Estados: focus (border-orange-500), error, disabled
   - Props: `label`, `error`, `icon`, `prefix`
   - Reemplazar: 40+ inputs
   - Archivos afectados: AgendaView, OrderDetailView, ConfigView, LoginScreen

3. **Crear `src/components/ui/Card.jsx`**
   - Props: `variant` (default/accent/alert/success), `shadow`
   - Padding/border unificados
   - Reemplazar: 50+ cards
   - Archivos afectados: TODAS las vistas

4. **Crear `src/components/ui/Badge.jsx`**
   - Estados predefinidos (pending, approved, rejected, etc.)
   - Reemplazar: 25+ badges

#### **FASE 2: Crear Color Tokens + CSS Utilities (Week 1)**
Priority: 🔴 CRÍTICO

1. **Actualizar `src/index.css`**
   - Agregar CSS custom properties para colores
   - Crear utility classes: `.btn-primary`, `.btn-secondary`, `.input-base`, `.card-base`

2. **Actualizar `tailwind.config.js`**
   - Agregar tokens: `jb-error`, `jb-success`, `jb-warning`, `jb-alert`
   - Crear layer de componentes

#### **FASE 3: Reemplazar en Vistas Críticas (Week 2-3)**
Priority: 🟠 ALTA

| Vista | Botones | Inputs | Cards | Prioridad |
|---|---|---|---|---|
| LoginScreen | 2 | 3 | 1 | 1️⃣ |
| HomeView | 3 | 0 | 5 | 2️⃣ |
| OrderDetailView | 8 | 5 | 12 | 2️⃣ |
| ConfigView | 6 | 8 | 8 | 3️⃣ |
| AgendaView | 6 | 8 | 6 | 3️⃣ |

#### **FASE 4: Mobile Fixes (Week 4)**
Priority: 🟠 ALTA

1. **Aumentar touch targets**
   - Icon buttons: `p-1.5` → `p-2.5` (44px)
   - Close buttons: mismo

2. **Responsive tables**
   - Envolver en `overflow-x-auto`
   - O cambiar a list layout en mobile

3. **Bottom sheet + modales**
   - Estandarizar z-index
   - Asegurar safe-area en mobile

4. **Navigation bottom**
   - Aumentar altura de touch target a 44px
   - Agregar safe-area padding

---

## 7. DIRECTIVA DE IMPLEMENTACIÓN

### 7.1 Crear Archivo: `.clou/directives/ui-component-unification.md`

```markdown
# Unificación de Componentes UI

## Estado Actual (2026-06-25)
- 16 variantes de botones (debería ser 4)
- 50+ instancias de card styling inline
- No existe archivo base de componentes en src/components/ui/

## Decisión
Crear componentes reutilizables: Button, Input, Card, Badge, Select

## Zonas Protegidas (NO TOCAR mientras se refactoriza)
- `src/lib/storage.js` — lógica de datos
- `src/services/*` — lógica de negocio
- `firestore.rules` — permisos

## Orden de Refactorización
1. Crear componentes (src/components/ui/)
2. Reemplazar en LoginScreen (test)
3. Reemplazar en HomeView
4. Reemplazar en OrderDetailView
5. Reemplazar en resto de vistas
6. Mobile fixes (touch targets, responsive)

## Historial
- 2026-06-25: Auditoría FASE 2 completada

```

### 7.2 Checklist por Componente

**Button.jsx**
- [ ] Variantes: primary, secondary, danger, ghost
- [ ] Tamaños: sm (py-2), md (py-3), lg (py-4)
- [ ] Estados: hover, focus, active, disabled
- [ ] Props: fullWidth, startIcon, endIcon
- [ ] Tests: renderiza, maneja onClick, disabled

**Input.jsx**
- [ ] Tipo: text, email, number, select, textarea
- [ ] Label + help text
- [ ] Error state (border-red-500, texto error)
- [ ] Icon prop (left side)
- [ ] Focus state (border-orange-500)
- [ ] Disabled state

**Card.jsx**
- [ ] Props: variant (default/accent/alert/success)
- [ ] Padding/border consistency
- [ ] Shadow consistency
- [ ] Responsive OK

---

## 8. RESUMEN EJECUTIVO

### Hallazgos Principales
- ❌ **16 variantes de botón** (debería ser 4)
- ❌ **50+ estilos de card inline** (debería haber Component)
- ❌ **4+ fondos distintos para mismo elemento** (bg-zinc-900, zinc-950, black/30, #141414)
- ❌ **Borders sin estandarización** (white/5, white/10, zinc-700, zinc-800, etc.)
- ⚠️ **Touch targets < 44px en 8+ lugares**
- ⚠️ **Responsive layout problemas en OrderDetailView, ConfigView**
- ⚠️ **Jerarquía visual débil** (primario vs. secundario indistinguibles)

### Impacto en Usuario
1. **Confusión visual** — no claro qué es primario/secundario
2. **Inconsistencia** — mismo tipo de acción con estilos diferentes
3. **Mobile pobre** — touch targets muy pequeños, overflow horizontal
4. **Mantenimiento difícil** — cambiar color = tocar 40+ archivos

### Esfuerzo Estimado
- **Phase 1 (componentes + tokens):** 8-12 horas
- **Phase 2 (reemplazar vistas críticas):** 16-20 horas
- **Phase 3 (vistas restantes):** 12-16 horas
- **Phase 4 (mobile fixes):** 6-8 horas
- **Total:** ~48-56 horas (1.5 semanas a 1 dev)

### Beneficios
- ✅ Coherencia visual extrema
- ✅ Mantenimiento centralizado (1 cambio = aplicado a 80+ botones)
- ✅ Mobile-first desde base
- ✅ Accesibilidad mejorada (touch targets, focus states)
- ✅ Onboarding nuevos devs más rápido

---

## 9. ARCHIVOS ESPECÍFICOS A TOCAR

### Crear (Nuevos)
```
src/components/ui/Button.jsx
src/components/ui/Input.jsx
src/components/ui/Card.jsx
src/components/ui/Badge.jsx
src/components/ui/Select.jsx
src/components/ui/BottomSheet.jsx
src/components/ui/Modal.jsx
src/components/ui/index.js (barrel export)
.clou/directives/ui-component-unification.md
```

### Modificar (Tailwind + CSS)
```
src/index.css
tailwind.config.js
```

### Reemplazar Instancias (Prioridad)
```
Fase 1:
- src/LoginScreen.jsx
- src/App.jsx

Fase 2:
- src/views/HomeView.jsx
- src/components/OrderDetailView.jsx

Fase 3:
- src/views/ConfigView.jsx
- src/views/AgendaView.jsx
- src/views/OrderListView.jsx
- src/views/PagosView.jsx

Fase 4:
- src/views/PreciosView.jsx
- src/views/FinalizacionView.jsx
- src/views/NewOrderView.jsx
- src/views/BikeProfileView.jsx
- src/views/HistoryView.jsx
- src/views/RecordatoriosView.jsx
- src/views/PresupuestosView.jsx
- src/views/NuevoPresupuestoView.jsx
- src/views/PresupuestoDetailView.jsx
- src/views/EjecucionView.jsx
- src/views/RetentionOfferView.jsx
- src/views/RetiroView.jsx
- src/views/TallerPublicView.jsx
- src/views/VerifyReceiptView.jsx
- src/views/EsperandoAprobacionView.jsx
- src/views/AdminPanelView.jsx
- src/components/LogisticsView.jsx
- src/components/TaskManagerView.jsx
- src/components/PaymentView.jsx
- src/components/ExportPdfView.jsx
- src/components/PrePdfView.jsx
- src/components/ErrorBoundary.jsx
- src/components/MapaPicker.jsx
```

---

## 10. PRÓXIMOS PASOS

1. ✅ Auditoría completada (este documento)
2. ⏭️ Crear directiva `.clou/directives/ui-component-unification.md`
3. ⏭️ Crear `src/components/ui/Button.jsx` + tests manuales
4. ⏭️ Crear `src/components/ui/Input.jsx`
5. ⏭️ Crear `src/components/ui/Card.jsx`
6. ⏭️ Reemplazar en LoginScreen → test visual completo
7. ⏭️ Reemplazar en HomeView → test mobile
8. ⏭️ Continuar vistas restantes

---

**Auditoría realizada por:** Claude Copilot  
**Fecha:** 2026-06-25  
**Profundidad:** Código + patrones + accesibilidad mobile  
**Estado:** 🔴 CRÍTICO — Requiere refactorización UI urgente
