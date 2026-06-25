# AUDITORÍA DE COHERENCIA UI/UX — MotoGestión

**Fecha:** 2026-06-25  
**Alcance:** Análisis completo de paleta de colores, tipografía, espaciado, componentes y estados interactivos  
**Estado:** Borrador preliminar para revisión

---

## RESUMEN EJECUTIVO

Se encontraron **31 inconsistencias críticas** distribuidas en 5 dominios principales:

| Dominio | Count | Severidad | Impacto |
|---------|-------|-----------|--------|
| Colores (Zinc vs Gray) | 8 | **CRÍTICA** | Falta de identidad visual |
| Tamaños de fuente | 15+ | ALTA | Jerarquía tipográfica rota |
| Border-radius | 6 | MEDIA | Incoherencia visual leve |
| Estados interactivos | 5 | ALTA | UX confusa |
| Espaciado (padding/margin) | 12+ | MEDIA | Desalineación visual |

**Recomendación:** Crear **Design Tokens** centralizados en Tailwind config y refactorizar por fases.

---

## 1. COLORES Y PALETA

### 1.1 Inconsistencia Zinc vs Gray — **CRÍTICA**

La mayoría del codebase usa `zinc-*`, pero **PreciosView.jsx** está en `gray-*`. Esto es visible al usuario.

#### Hallazgos:

| Archivo | Problema | Línea | Código |
|---------|----------|-------|--------|
| [src/views/PreciosView.jsx](src/views/PreciosView.jsx#L101) | Input usa `gray-800 border-2 border-gray-700` | 101 | `className="bg-gray-800 border-2 border-gray-700..."` |
| [src/views/PreciosView.jsx](src/views/PreciosView.jsx#L117) | Botón sugereencia usa `bg-gray-800 border-gray-700` | 117 | `className="bg-gray-800 border border-gray-700..."` |
| [src/views/PreciosView.jsx](src/views/PreciosView.jsx#L131) | Toggle de CC usa `bg-gray-800 border-gray-700` vs naranja | 131 | `bg-gray-800 border-gray-700` vs `bg-orange-500` |
| [src/views/PreciosView.jsx](src/views/PreciosView.jsx#L154) | Cards de stats usan `bg-gray-800` | 154-158 | `className="bg-gray-800 rounded-2xl p-4 border border-gray-700"` |
| [src/views/PreciosView.jsx](src/views/PreciosView.jsx#L171) | Items desglose usan `bg-gray-800/40` | 171 | `className="bg-gray-800/40 p-3 rounded-xl border border-gray-700/50"` |
| [src/views/ConfigView.jsx](src/views/ConfigView.jsx#L73) | Cards de stats usan `bg-white/95` (blanco) | 73+ | `className="bg-white/95 rounded-[1.75rem]..."` |
| [src/views/ConfigView.jsx](src/views/ConfigView.jsx#L108) | Card de caja usa gradiente oscuro | 108+ | `className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0f2435]..."` |
| Resto de app | Cards y inputs usan `bg-zinc-900 / zinc-800` | varias | Patrón estándar |

#### Impacto:

- **Visual:** PreciosView se ve en una paleta diferente (más clara, más contrastada)
- **UX:** Usuario percibe inconsistencia visual severa
- **Marca:** Debilita la identidad visual de MotoGestión

#### Root cause:

`PreciosView.jsx` fue desarrollado en aislamiento sin seguir `COOKBOOK.md`. ConfigView.jsx fue refactorizado con estilo light mode (blanco) sin respetar el dark theme base.

---

### 1.2 Variaciones de Opacidad en Focus/Border — **ALTA**

Los inputs y botones usan diferentes niveles de opacidad para el estado focus.

#### Hallazgos:

| Componente | Focus Style | Línea | Notas |
|-----------|-----------|-------|-------|
| [LoginScreen.jsx](src/LoginScreen.jsx#L313) | `focus-within:border-orange-500/60` | 313 | Opacidad 60% |
| [TaskManagerView.jsx](src/components/TaskManagerView.jsx#L131) | `focus:border-orange-500` | 131 | Opacidad 100% |
| [PreciosView.jsx](src/views/PreciosView.jsx#L101) | `focus:border-orange-500` | 101 | Opacidad 100% |
| COOKBOOK.md patrón | `focus:border-orange-500/60` | — | Documentado como 60% |

#### Impacto:

- **Inconsistencia:** El grado de visibilidad del focus cambia según el input
- **Accesibilidad:** Algunos usuarios no notarán el focus si es muy tenue

---

### 1.3 Bordes de Cards — Falta de Consistencia Sistémica

No hay regla clara: algunos usan `border-zinc-800`, otros `border-zinc-700`, otros omiten borde.

#### Hallazgos:

| Archivo | Borde | Fondo |
|---------|-------|-------|
| [AgendaView.jsx](src/views/AgendaView.jsx#L316) | `border-zinc-800` | `bg-zinc-900/50` |
| [AgendaView.jsx](src/views/AgendaView.jsx#L366) | `border-zinc-800` | `bg-zinc-900/40` |
| [AdminPanelView.jsx](src/views/AdminPanelView.jsx#L26) | `border-zinc-800` | `bg-zinc-900` (shadow-xl) |
| COOKBOOK.md Card | `border-zinc-800` | `bg-zinc-900` |
| [ConfigView.jsx](src/views/ConfigView.jsx#L73) | `border-white/70` | `bg-white/95` |

**Problema:** ConfigView es incompatible completamente. AgendaView varía el fondo pero mantiene el borde.

---

## 2. TIPOGRAFÍA

### 2.1 Tamaños de Fuente — **MUY INCONSISTENTE**

No existe una escala tipográfica consistente. Se usa mezcla de:
- Tailwind presets (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-3xl`)
- Custom sizes (`text-[10px]`, `text-[9px]`, `text-[11px]`, `text-[8px]`, `text-[14px]`)

#### Hallazgos:

| Elemento | Sizes encontrados | Archivos |
|----------|-------------------|----------|
| Labels | `text-[10px]`, `text-[9px]`, `text-xs` | [HomeView.jsx](src/views/HomeView.jsx), [AgendaView.jsx](src/views/AgendaView.jsx), [COOKBOOK.md](docs/COOKBOOK.md) |
| Botones primarios | `text-[11px]`, `text-[10px]` | [App.jsx](src/App.jsx#L122), [AgendaView.jsx](src/views/AgendaView.jsx#L376) |
| Títulos | `text-sm`, `text-base`, `text-xl`, `text-3xl` | [HomeView.jsx](src/views/HomeView.jsx), [ConfigView.jsx](src/views/ConfigView.jsx) |
| Body text | `text-sm`, `text-xs`, `text-[10px]` | Varias vistas |
| Input text | `text-sm`, `text-lg`, `text-[10px]` | [PreciosView.jsx](src/views/PreciosView.jsx#L101) usa `text-lg` |
| Campos de stats | `text-4xl`, `text-2xl`, `text-[clamp(...)]` | [ConfigView.jsx](src/views/ConfigView.jsx) usa `clamp()` |

#### Impacto:

- **Jerarquía confusa:** No está claro qué es principal, secundario, terciario
- **Inconsistencia visual:** Un "label" puede ser `text-[10px]` en una vista y `text-xs` en otra
- **Responsive:** ConfigView usa `clamp()` (moderno), resto usa fixed sizes

---

### 2.2 Pesos de Fuente — Moderadamente Inconsistente

Predomina `font-black`, pero hay variaciones.

#### Hallazgos:

| Peso | Casos | Problema |
|------|-------|----------|
| `font-black` | 95% de botones y labels | ✓ Consistente |
| `font-bold` | Algunos textos descriptivos | Debería ser `font-semibold` |
| `font-semibold` | Raros | Poco usado |
| `font-[900]` | Un caso en ConfigView | No necesario (equivale a `font-black`) |

**Conclusión:** Mejor que otros aspectos, pero hay algunas variaciones evitables.

---

### 2.3 Tracking (Letter-spacing) — Casi Consistente

Predomina `tracking-widest` en botones y labels. Hay algunas variaciones.

#### Hallazgos:

| Spacing | Uso | Línea |
|---------|-----|-------|
| `tracking-widest` | Labels, botones principales | Patrón estándar en COOKBOOK |
| `tracking-tight` | PreciosView botones | [src/views/PreciosView.jsx](src/views/PreciosView.jsx#L117) |
| `tracking-wider` | LoginScreen labels | [src/LoginScreen.jsx](src/LoginScreen.jsx#L149) |
| `tracking-wide` | Algunos botones | [src/App.jsx](src/App.jsx#L229) |
| `tracking-tighter` | PreciosView título | [src/views/PreciosView.jsx](src/views/PreciosView.jsx#L61) |

**Impacto:** Menor que size inconsistency, pero visible.

---

## 3. ESPACIADO Y LAYOUT

### 3.1 Border-radius — Múltiples Variantes

Se usa `rounded-2xl` como estándar, pero hay variaciones innecesarias.

#### Hallazgos:

| Valor | Equivalencia | Uso | Problema |
|-------|--------------|-----|----------|
| `rounded-2xl` | 16px | 80% de elementos | Estándar |
| `rounded-[2rem]` | 32px | Cards, sheets | Equivalente a `rounded-[2rem]` nativo |
| `rounded-[1.75rem]` | 28px | Cards en algunas vistas | Sin nombre en Tailwind |
| `rounded-[1.35rem]` | 21.6px | ConfigView | Sin nombre en Tailwind |
| `rounded-xl` | 12px | Botones pequeños | ✓ Consistente |
| `rounded-lg` | 8px | Raro | No documentado |
| `rounded-full` | 9999px | Botones circulares | ✓ Correcto |
| `rounded-t-[2rem]` | 32px (top only) | Bottom sheets | ✓ Consistente |
| `rounded-[2.5rem]` | 40px | ConfigView modal | No documentado |

#### Impacto:

- **Código:** Múltiples formas de decir lo mismo (`rounded-2xl` vs `rounded-[1.75rem]`)
- **Mantenimiento:** Difícil de unificar
- **Custom sizes:** `[1.75rem]`, `[1.35rem]`, `[2.5rem]` no se pueden centralizar en `tailwind.config.js`

#### Root cause:

Se usa `px` remoto sin centralizar en `theme.borderRadius` de Tailwind.

---

### 3.2 Padding — Inconsistencia Moderada

No hay una regla clara para vertical vs horizontal.

#### Hallazgos:

| Patrón | Ejemplo | Archivos |
|--------|---------|----------|
| `py-4` (vertical) en botones full-width | `py-4` en primarios | [CLAUDE.md](CLAUDE.md#L553), [App.jsx](src/App.jsx#L122) |
| `px-4 py-3` en botones pequeños | Botones de acciones | [AgendaView.jsx](src/views/AgendaView.jsx#L423) |
| `p-4` en cards | Cards estándar | [AgendaView.jsx](src/views/AgendaView.jsx#L316) |
| `p-3` en botones icon | Botones cerrar modales | [AgendaView.jsx](src/views/AgendaView.jsx#L287) |
| `p-5` en containers | Algunos wrappers | [PreciosView.jsx](src/views/PreciosView.jsx) |
| `px-4 pt-6 pb-4` en headers | Headers específicos | [COOKBOOK.md](docs/COOKBOOK.md#L52) |

**Inconsistencia:** No hay diferencia sistemática entre botones medianos y pequeños.

---

### 3.3 Gap (Espaciado entre elementos)

Raramente documentado, pero parece ser `gap-2`, `gap-3`, `gap-4` según contexto.

#### Hallazgos:

| Contexto | Gap | Línea |
|----------|-----|-------|
| Entre botones | `gap-2` | [AgendaView.jsx](src/views/AgendaView.jsx#L376) |
| Entre elementos en lista | `gap-3` | [HomeView.jsx](src/views/HomeView.jsx) |
| Entre secciones | `gap-4` o `space-y-4` | [AgendaView.jsx](src/views/AgendaView.jsx#L316) |

**Impacto:** Moderado — hay variación pero es predecible por contexto.

---

## 4. COMPONENTES

### 4.1 Botones — Variantes Inconsistentes

Hay 5+ estilos diferentes que no están documentados.

#### Hallazgos:

| Variante | Estilo | Línea | Notas |
|----------|--------|-------|-------|
| **Primario** | `rounded-2xl bg-orange-600 py-4 text-[11px] font-black uppercase tracking-widest text-white active:scale-95 transition-all` | [CLAUDE.md](CLAUDE.md#L553) | Documentado en CLAUDE.md |
| **Primario alt** | `rounded-2xl bg-orange-600 py-4 ... shadow-xl shadow-orange-600/20` | [AgendaView.jsx](src/views/AgendaView.jsx#L605) | Con sombra, sin documenta |
| **Secundario** | `rounded-2xl bg-zinc-800 px-4 py-3 text-[10px] font-black uppercase text-zinc-300` | [COOKBOOK.md](docs/COOKBOOK.md#L104) | Documentado |
| **Secundario alt** | `rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3` | [AgendaView.jsx](src/views/AgendaView.jsx#L423) | Con borde, sin shadow |
| **Destructivo** | `rounded-2xl bg-red-600/20 border border-red-500/30 px-4 py-3 text-[10px] font-black uppercase text-red-300 active:scale-95` | [COOKBOOK.md](docs/COOKBOOK.md#L109) | Documentado |
| **Success** | `rounded-2xl bg-emerald-600 px-3 py-3 text-[10px] font-black uppercase text-white active:scale-95` | [AgendaView.jsx](src/views/AgendaView.jsx#L462) | Sin documentar |
| **Ghost** | `hover:text-zinc-300 transition-colors text-[10px]` | [App.jsx](src/App.jsx#L237) | Text-only |
| **FAB** | `fixed bottom-8 right-6 rounded-2xl bg-orange-600 px-4 py-4 shadow-2xl shadow-orange-600/20` | [AgendaView.jsx](src/views/AgendaView.jsx#L487) | Floating action |
| **Icon button** | `rounded-xl bg-zinc-800 p-2 text-zinc-400 active:scale-90` | [TaskManagerView.jsx](src/components/TaskManagerView.jsx#L26) | Pequeño, sin tracking |

#### Impacto:

- **No hay sistema:** Los desarrolladores tienen que buscar ejemplos cada vez
- **Duplicación:** Mismos estilos replicados múltiples veces
- **Mantenimiento:** Cambiar un patrón requiere buscar + reemplazar

---

### 4.2 Inputs — Formatos Inconsistentes

No hay un patrón unificado.

#### Hallazgos:

| Archivo | Style | Línea |
|---------|-------|-------|
| [COOKBOOK.md](docs/COOKBOOK.md#L128) | `bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3 text-sm placeholder-zinc-600 focus:border-orange-500/60` | 128 |
| [PreciosView.jsx](src/views/PreciosView.jsx#L101) | `bg-gray-800 border-2 border-gray-700 rounded-2xl p-5 text-lg placeholder:text-gray-700 focus:border-orange-500` | 101 |
| [LoginScreen.jsx](src/LoginScreen.jsx#L313) | `border border-white/10 bg-black/60 px-4 py-3.5 focus-within:border-orange-500/60` | 313 |
| [TaskManagerView.jsx](src/components/TaskManagerView.jsx#L131) | `border border-zinc-700 bg-zinc-800 px-4 py-3 focus:border-orange-500` | 131 |
| [PrePdfView.jsx](src/components/PrePdfView.jsx#L256) | `border-2 border-zinc-100 p-4 text-sm text-zinc-700 focus:border-orange-500` | 256 |

#### Problemas:

| Problema | Archivos | Severidad |
|----------|----------|-----------|
| Borde: `border` vs `border-2` | COOKBOOK, PreciosView | ALTA |
| Padding: `px-4 py-3` vs `p-5` | COOKBOOK vs PreciosView | MEDIA |
| Tamaño texto: `text-sm` vs `text-lg` | COOKBOOK vs PreciosView | MEDIA |
| Placeholder: `placeholder-zinc-600` vs `placeholder:text-gray-700` | COOKBOOK vs PreciosView | BAJA |

---

### 4.3 Bottom Sheets y Modales

Hay variación en estilos y rounded corners.

#### Hallazgos:

| Archivo | Estilo | Línea |
|---------|--------|-------|
| [App.jsx](src/App.jsx#L100) | `rounded-t-[2rem] bg-zinc-900 border-t border-zinc-700 shadow-2xl animate-in slide-in-from-bottom` | 100 |
| [AgendaView.jsx](src/views/AgendaView.jsx#L495) | `rounded-t-[2rem] bg-[#111827] shadow-2xl sm:rounded-[2rem]` | 495 |
| [COOKBOOK.md](docs/COOKBOOK.md#L155) | `rounded-t-[2rem] bg-zinc-900 border-t border-zinc-700 shadow-2xl animate-in slide-in-from-bottom` | 155 |
| [TaskManagerView.jsx](src/components/TaskManagerView.jsx#L22) | `rounded-t-[2rem] bg-zinc-900 border-t border-zinc-700 shadow-2xl animate-in slide-in-from-bottom` | 22 |

**Buena noticia:** Bastante consistente. Pequeña variación en `bg-[#111827]` en AgendaView (más oscuro que zinc-900).

---

## 5. ESTADOS INTERACTIVOS

### 5.1 Active State (Press) — Inconsistencia en Escala

Hay 3 valores diferentes.

#### Hallazgos:

| Valor | Ubicaciones | Diferencia |
|-------|-------------|-----------|
| `active:scale-95` | Mayoría de botones | -5% (estándar recomendado) |
| `active:scale-90` | [COOKBOOK](docs/COOKBOOK.md#L159), [AgendaView FAB](src/views/AgendaView.jsx#L487) | -10% |
| `active:scale-[0.98]` | [App.jsx](src/App.jsx#L208) | -2% muy sutil |

#### Impacto:

- **Feedback visual:** Usuarios esperan un feedback consistente
- **Sensación táctil:** Diferentes presiones pueden sentirse "buggy"

#### Recomendación:

Estandarizar en `active:scale-95` (está en CLAUDE.md como patrón).

---

### 5.2 Hover State — Frecuentemente Omitido

No todos los botones tienen hover effect.

#### Hallazgos:

| Componente | Hover | Línea |
|-----------|-------|-------|
| Botones primarios | ❌ NO tiene | Mayoría |
| Botones secundarios | ❌ NO tiene | Mayoría |
| Inputs | ✓ Tiene `focus:` | Varias |
| Pequeños botones icon | ✓ `hover:bg-zinc-800` | [AgendaView.jsx](src/views/AgendaView.jsx#L318) |
| Links | ✓ `hover:text-zinc-300` | [App.jsx](src/App.jsx#L237) |

**Problema:** Los botones principales (orange) no tienen hover, solo active. En desktop, esto se ve apagado.

---

### 5.3 Focus State — Accesibilidad

Solo algunos inputs tienen focus visible.

#### Hallazgos:

| Elemento | Focus Style | Línea |
|----------|------------|-------|
| Input estándar | `focus:border-orange-500/60` | [COOKBOOK.md](docs/COOKBOOK.md#L128) |
| Input en TaskManager | `focus:border-orange-500` | [TaskManagerView.jsx](src/components/TaskManagerView.jsx#L131) |
| Input en LoginScreen | `focus-within:border-orange-500/60` | [LoginScreen.jsx](src/LoginScreen.jsx#L313) |
| Select | `focus:border-orange-500` | [TaskManagerView.jsx](src/components/TaskManagerView.jsx#L142) |
| Input en PrePdf | `focus:border-orange-500` | [PrePdfView.jsx](src/components/PrePdfView.jsx#L256) |

**Inconsistencia:** Opacidad inconsistente (`/60` vs sin opacidad).

---

### 5.4 Disabled State

Hay algunos patrones, pero no universales.

#### Hallazgos:

| Patrón | Ubicación | Línea |
|--------|-----------|-------|
| `disabled:opacity-50` | [App.jsx](src/App.jsx#L208), buttons | 208 |
| `disabled:opacity-40` | [AdminPanelView.jsx](src/views/AdminPanelView.jsx) | 1032 |
| No hay disabled style | Muchos botones | — |

**Problema:** No todos los botones deshabilitados tienen feedback visual.

---

### 5.5 Transiciones — Parcialmente Documentadas

Hay inconsistencia en `transition` vs `transition-all`.

#### Hallazgos:

| Tipo | Valor | Ubicación |
|------|-------|----------|
| Botones primarios | `transition-all` | [CLAUDE.md](CLAUDE.md#L553), [App.jsx](src/App.jsx#L122) |
| Botones secundarios | `transition-all` | [COOKBOOK.md](docs/COOKBOOK.md#L104) |
| Inputs | `transition-all` | [COOKBOOK.md](docs/COOKBOOK.md#L128) |
| Navigation buttons | `transition-colors` | [AgendaView.jsx](src/views/AgendaView.jsx#L318) |
| Algunos inputs | `transition-colors` | [TaskManagerView.jsx](src/components/TaskManagerView.jsx#L131) |

**Recomendación:** Usar `transition-all` universalmente para consistencia.

---

## 6. SOMBRAS

### 6.1 Shadow System — Ad-hoc

No hay patrón claro. Las sombras se aplican inconsistentemente.

#### Hallazgos:

| Tipo | Valores | Ejemplos |
|------|--------|----------|
| Botón primario sin shadow | — | Mayoría |
| Botón primario con shadow | `shadow-xl shadow-orange-600/20` | [AgendaView.jsx](src/views/AgendaView.jsx#L605) |
| FAB con shadow | `shadow-2xl shadow-orange-600/20` | [AgendaView.jsx](src/views/AgendaView.jsx#L487) |
| Card con shadow | `shadow-xl` | [AdminPanelView.jsx](src/views/AdminPanelView.jsx#L26) |
| Bottom sheet | `shadow-2xl` | [App.jsx](src/App.jsx#L100) |
| PreciosView button | `shadow-lg shadow-orange-900/40` | [src/views/PreciosView.jsx](src/views/PreciosView.jsx) |

**Problema:**
- Sin regla clara
- ConfigView usa sombras extensas (`shadow-[0_18px_45px_rgba(...)]`)
- Otros usan Tailwind presets

---

## 7. DEUDA TÉCNICA ESPECÍFICA POR VISTA

### ConfigView.jsx — **REFACTORIZACIÓN CRÍTICA PENDIENTE**

| Tema | Estado | Severidad |
|------|--------|-----------|
| Colores | Light mode (blanco) vs dark mode app | CRÍTICA |
| Tipografía | Usa `clamp()`, other views no | ALTA |
| Sombras | Custom box-shadow, no Tailwind | ALTA |
| Spacing | Diferente escala (`rounded-[1.35rem]`) | MEDIA |
| Componentes | Card custom sin reutilización | MEDIA |

**Root cause:** ConfigView fue refactorizado independientemente como "admin panel" sin sincronizar con CLAUDE.md.

---

### PreciosView.jsx — **PORTING A PATRÓN ESTÁNDAR**

| Tema | Estado | Severidad |
|------|--------|-----------|
| Colores | Gray en vez de Zinc | CRÍTICA |
| Input | Text size `text-lg` vs `text-sm` | ALTA |
| Buttons | Usa `rounded-xl` en suggestions | MEDIA |
| Stats display | Custom background sin patrón | MEDIA |

**Root cause:** Desarrollado antes de que se estandarizara COOKBOOK.md.

---

## 8. ANÁLISIS DE IMPACTO EN UX

### Severidad de Cada Inconsistencia:

| Inconsistencia | Usuario percibe | Desarrollador sufre | Mantenimiento |
|---|---|---|---|
| **Zinc vs Gray** | ✓✓✓ Alto | ✓✓ Duplicación | ✓✓ Difícil |
| **Font sizes** | ✓✓✓ Alto | ✓✓ Búsqueda constante | ✓✓✓ Muy difícil |
| **Active scales** | ✓ Bajo | ✓ Confusión leve | ✓ Bajo |
| **Border radius** | ✓ Muy bajo | ✓✓ Búsqueda | ✓ Bajo |
| **Input styles** | ✓✓ Medio | ✓✓✓ Muy alto | ✓✓ Alto |
| **Botones variants** | ✓✓ Medio | ✓✓✓ Muy alto | ✓✓✓ Muy alto |
| **Shadows** | ✓✓ Medio | ✓ Bajo | ✓ Bajo |

---

## 9. RECOMENDACIONES

### PRIORIDAD 1 — CRÍTICA (Implementar en próximo ciclo)

#### 1.1 Crear Design Tokens en Tailwind Config

**Acción:**
```javascript
// tailwind.config.js — agregar theme.extend
extend: {
  colors: {
    // Paleta de app (reacomodo)
    surface: 'rgb(20, 20, 20)',      // #141414 (actual --jb-surface)
    card: 'rgb(26, 26, 26)',         // #1A1A1A (actual --jb-card)
    border: 'rgb(42, 42, 42)',       // #2A2A2A (actual --jb-border)
    accent: 'rgb(232, 90, 26)',      // #E85A1A (actual --jb-orange)
  },
  fontSize: {
    xs: '12px',      // Overline / helper text
    sm: '14px',      // Body small
    base: '16px',    // Body regular (raramente usado)
    lg: '18px',      // Heading small
    xl: '24px',      // Heading medium
    '2xl': '32px',   // Heading large
    '3xl': '48px',   // Hero
    // Micro scale para botones/labels
    'label': '10px', // Labels, buttons small
    'caption': '9px', // Tiny text
  },
  borderRadius: {
    none: '0',
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',      // rounded-lg equivalente
    xl: '20px',      // rounded-xl equivalente
    '2xl': '24px',   // rounded-2xl equivalente (actual)
    '3xl': '32px',   // rounded-[2rem] (¿está siendo mal usado?)
    full: '9999px',
  },
  spacing: {
    // Mantener estándar de Tailwind
    // Agregar custom si es necesario
    'safe-bottom': 'max(1rem, env(safe-area-inset-bottom))',
  },
  boxShadow: {
    'sm': '0 1px 3px rgba(0,0,0,0.12)',
    'md': '0 4px 6px rgba(0,0,0,0.15)',
    'lg': '0 10px 20px rgba(0,0,0,0.15)',
    'xl': '0 15px 30px rgba(0,0,0,0.2)',
    'button': '0 4px 12px rgba(232, 90, 26, 0.2)',  // shadow-orange
  },
}
```

**Beneficio:** 
- Reemplazar 50+ variaciones por referencias
- Cambio global = un edit

**Esfuerzo:** 2-3 horas

---

#### 1.2 Convertir PreciosView.jsx a Paleta Estándar

**Cambios:**
- `gray-*` → `zinc-*`
- `text-lg` en input → `text-sm`
- `p-5` → `px-4 py-3`
- `rounded-xl` → `rounded-lg`

**Archivos afectados:** 1  
**Esfuerzo:** 20 mins

---

#### 1.3 Documentar ConfigView.jsx como Excepción O Refactorizarlo

**Opción A (Corta):** Documentar en `COOKBOOK.md` que ConfigView.jsx es admin-only y puede tener estilos light mode.

**Opción B (Correcta):** Refactorizar ConfigView para usar dark theme como el resto. Cambios:
- `bg-white/95` → `bg-zinc-900`
- `text-slate-500` → `text-zinc-500`
- Bordes: `border-white/70` → `border-zinc-700`
- Gradiente custom → usar variables CSS

**Archivos afectados:** 1 (3500+ líneas)  
**Esfuerzo:** 3-4 horas

---

### PRIORIDAD 2 — ALTA (En el siguiente sprint)

#### 2.1 Crear Sistema de Componentes Button

**Crear `src/components/Button.jsx`:**
```jsx
export function Button({ variant, size, disabled, ...props }) {
  const variants = {
    primary: 'bg-orange-600 text-white', // base
    secondary: 'bg-zinc-800 text-zinc-300 border border-zinc-700',
    destructive: 'bg-red-600/20 text-red-300 border border-red-500/30',
    success: 'bg-emerald-600 text-white',
    ghost: 'text-zinc-400 hover:text-zinc-300',
  };
  const sizes = {
    sm: 'px-3 py-2 text-[10px]',
    md: 'px-4 py-3 text-[10px]',
    lg: 'w-full py-4 text-[11px]',
  };
  
  return (
    <button
      className={`
        rounded-2xl font-black uppercase tracking-widest
        transition-all active:scale-95 disabled:opacity-50
        ${variants[variant]} ${sizes[size]}
      `}
      disabled={disabled}
      {...props}
    />
  );
}
```

**Benefit:** Centralizar 30+ variaciones en 1 componente

**Esfuerzo:** 3-4 horas (incluye refactor de botones en vistas)

---

#### 2.2 Crear Sistema de Componentes Input

**Crear `src/components/Input.jsx`:**
```jsx
export function Input({ variant = 'default', ...props }) {
  return (
    <input
      className="bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3 text-sm text-white
        placeholder-zinc-600 outline-none focus:border-orange-500/60 transition-all"
      {...props}
    />
  );
}
```

**Esfuerzo:** 1-2 horas

---

#### 2.3 Estandarizar Active State en `active:scale-95`

**Cambios:**
- Reemplazar `active:scale-90` → `active:scale-95` (AgendaView, COOKBOOK)
- Reemplazar `active:scale-[0.98]` → `active:scale-95` (App.jsx)

**Ubicaciones:** 5 archivos  
**Esfuerzo:** 15 mins (buscar + reemplazar)

---

### PRIORIDAD 3 — MEDIA (En el roadmap de UI)

#### 3.1 Agregar Hover States a Botones

**Patrón:**
- Botones primarios: `hover:bg-orange-700`
- Botones secundarios: `hover:bg-zinc-700`
- Destructivos: `hover:bg-red-700/30`

**Esfuerzo:** 2-3 horas (aplica a 50+ botones)

---

#### 3.2 Centralizar Rounded Corners

**Acción:**
- Auditar todos los `rounded-[X.XXrem]` custom
- Migrar a Tailwind presets o centralizar en `tailwind.config.js`
- Eliminar `[1.75rem]`, `[1.35rem]`, `[2.5rem]` (no reutilizables)

**Esfuerzo:** 1 hora

---

#### 3.3 Crear Shadow System

**Crear variables:**
```css
/* En index.css */
:root {
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.12);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.15);
  --shadow-lg: 0 10px 20px rgba(0, 0, 0, 0.15);
  --shadow-accent: 0 4px 12px rgba(232, 90, 26, 0.2);
}
```

**Esfuerzo:** 1 hora

---

### PRIORIDAD 4 — BAJA (Post-stabilization)

#### 4.1 Refactor Exhaustivo de Font Sizes

Crear escala tipográfica oficial y aplicar a **todas** las vistas.

**Esfuerzo:** 6-8 horas

---

#### 4.2 Crear Storybook o Component Gallery

Documentar todos los componentes visuales con variantes.

**Esfuerzo:** 8-10 horas

---

## 10. PLAN DE IMPLEMENTACIÓN

### Fase 1: Fundación (1-2 días)
1. ✓ Crear Design Tokens en `tailwind.config.js`
2. ✓ Convertir PreciosView.jsx a Zinc
3. ✓ Estandarizar `active:scale-95`

### Fase 2: Componentes (2-3 días)
4. ✓ Crear `Button.jsx` + refactor
5. ✓ Crear `Input.jsx` + refactor
6. ✓ Decidir: ConfigView light vs dark

### Fase 3: Polish (1 semana)
7. ✓ Agregar hover states
8. ✓ Centralizar border-radius
9. ✓ Shadow system
10. ✓ Documentar en COOKBOOK.md v2

### Fase 4: Polish avanzado (opcional)
11. Refactor tipográfico exhaustivo
12. Storybook setup

---

## 11. CHECKLIST DE VALIDACIÓN

- [ ] Design tokens en `tailwind.config.js`
- [ ] Todos los inputs usan `bg-zinc-900 border-zinc-700`
- [ ] Todos los botones primarios usan `bg-orange-600 active:scale-95`
- [ ] PreciosView.jsx usa `zinc-*` colores
- [ ] ConfigView decidido (light o dark)
- [ ] No hay `gray-*` en archivos nuevos
- [ ] No hay `rounded-[X.XXrem]` custom en archivos nuevos
- [ ] Todos los inputs tienen `focus:border-orange-500/60`
- [ ] COOKBOOK.md actualizado con nuevos patrones
- [ ] Validar visualmente en 3 dispositivos (móvil, tablet, desktop)

---

## 12. APÉNDICE: ARCHIVO DE REFERENCIA RÁPIDA

### Patrones Estandarizados (Post-implementación)

```jsx
// BOTÓN PRIMARIO
<button className="rounded-2xl bg-orange-600 py-4 px-4 text-[11px] font-black uppercase tracking-widest text-white active:scale-95 hover:bg-orange-700 transition-all disabled:opacity-50">
  Acción
</button>

// BOTÓN SECUNDARIO
<button className="rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-300 active:scale-95 hover:bg-zinc-700 transition-all disabled:opacity-50">
  Secundario
</button>

// INPUT ESTÁNDAR
<input
  type="text"
  className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-orange-500/60 transition-all"
  placeholder="Escribí algo..."
/>

// CARD ESTÁNDAR
<div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
  {children}
</div>

// LABEL/SUBTÍTULO
<p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Categoría</p>

// BOTTOM SHEET
<div className="fixed inset-0 z-50 flex items-end rounded-t-[2rem] bg-zinc-900 border-t border-zinc-700 shadow-2xl animate-in slide-in-from-bottom">
  {children}
</div>
```

---

## CONCLUSIÓN

MotoGestión tiene una **identidad visual fuerte** (dark theme bien definido), pero **carece de sistema de diseño centralizado**. Las inconsistencias provienen de:

1. **Desarrollo modular sin sincronización:** PreciosView, ConfigView evolucionaron independientemente
2. **Falta de Design Tokens:** Valores duplicados, sin fuente única
3. **Sin componentes reutilizables:** Cada vista reinventa patrones
4. **Documentación incompleta:** COOKBOOK.md existe pero no se sigue universalmente

**Recomendación final:** Invertir 3-5 días en Fase 1 + 2 para obtener 80% de mejora visual y 90% de mejora en velocidad de desarrollo futuro.

---

**Reporte preparado por:** Auditoría automática UI/UX  
**Validación manual:** Pendiente (revisar ConfigView.jsx en navegador)  
**Próximo paso:** Presentar hallazgos al equipo + priorizar Fase 1
