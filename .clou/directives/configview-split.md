# Directiva: Split ConfigView.jsx — Función Única

## Estado actual

`src/views/ConfigView.jsx` — 3863 líneas con 2 responsabilidades mezcladas:

| Sección | Líneas aprox | Responsabilidad |
|---|---|---|
| TABS (datos, backup, sistema, ubicación, exportar, recordatorios) | 1-241, 1200-3863 | Configuración del taller |
| PantallaAdmin (dashboard, planes, usuarios, cobros, calificaciones) | 242-1199 | Panel de administración de plataforma |

Violación directa de Función Única: un archivo cambia si cambia la config del taller Y si cambia el panel admin.

## Criterio de éxito

Después del split:

```
ConfigView.jsx        < 400 líneas — solo config del taller
AdminPanelView.jsx    < 600 líneas — solo panel admin
```

Cada uno responde UNA pregunta:
- ConfigView: "¿Cómo configuro mi taller?"
- AdminPanelView: "¿Cómo gestiono la plataforma?"

Build OK, 0 errores nuevos, comportamiento idéntico.

## Plan de implementación

### Paso 1: Extraer PantallaAdmin

Crear `src/views/AdminPanelView.jsx` con:
- `function PantallaAdmin` (actualmente en ConfigView.jsx líneas 242-716)
- `ADMIN_TABS` constant (líneas 139-162)
- `AdminPlanPriceBlock`, `MoneyValue`, `StatBox` sub-componentes internos del admin
- Todos los imports que usa PantallaAdmin únicamente

### Paso 2: Actualizar ConfigView.jsx

- Eliminar `PantallaAdmin` y sus sub-componentes
- Eliminar `ADMIN_TABS`
- Eliminar imports usados solo por admin
- Importar y montar `AdminPanelView` donde antes estaba `<PantallaAdmin />`
  ó crear una vista separada (preferido — sigue Función Única)

### Paso 3: Agregar ruta en TallerPanel.jsx

```js
import AdminPanelView from "./views/AdminPanelView";
// ...
case "adminPanel":
  return <AdminPanelView showToast={showToast} />;
```

### Paso 4: Actualizar navegación

El botón "Panel Admin" en ConfigView (actualmente un tab dentro) pasa a ser `setView("adminPanel")`.

## Regla de seguridad

NO tocar durante este refactor:
- Lógica de autenticación admin (`isPlatformAdmin()`)
- Escrituras a Firestore desde admin (cambio de precios, moderación)
- `mp-webhook.js`, `mp-create-preference.js`
- `saasService.js`
- `firestore.rules`

## Archivos a tocar

| Archivo | Cambio |
|---|---|
| `src/views/ConfigView.jsx` | Eliminar PantallaAdmin + sub-componentes |
| `src/views/AdminPanelView.jsx` | NUEVO — contiene PantallaAdmin |
| `src/TallerPanel.jsx` | Agregar import + case "adminPanel" |

## Riesgo

MEDIO — ConfigView es Baseline de Oro. Mitigación:
- Cirugía mínima: mover bloque, no reescribir
- Build después de cada paso
- Sin cambios en lógica, solo reubicación

## Historial

| Fecha | Acción |
|---|---|
| 2026-06-18 | Directiva creada — skill Función Única aplicado |
