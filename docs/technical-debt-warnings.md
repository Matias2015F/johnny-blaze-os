# Technical Debt Warnings

## Lint inventory

| Archivo | Tipo de warning | Riesgo | Corregir ahora |
|---|---|---|---|
| `src/TallerPanel.jsx` | `react-hooks/exhaustive-deps` | Medio | Después |
| `src/components/OrderDetailView.jsx` | `no-unused-vars`, `react-hooks/exhaustive-deps` | Alto | Después |
| `src/components/TaskManagerView.jsx` | `react-hooks/exhaustive-deps` | Medio | Después |
| `src/lib/storage.js` | `no-unused-vars` | Bajo | Después |
| `src/views/ConfigView.jsx` | `no-unused-vars`, `react-hooks/exhaustive-deps` | Alto | Después |
| `src/views/EsperandoAprobacionView.jsx` | `no-unused-vars` | Bajo | Después |
| `src/views/HistoryView.jsx` | `no-unused-vars`, `react-hooks/exhaustive-deps` | Medio | Después |
| `src/views/HomeView.jsx` | `no-unused-vars` | Bajo | Después |
| `src/views/PagoView.jsx` | `no-unused-vars` | Bajo | Después |
| `src/views/PagosView.jsx` | `no-unused-vars` | Bajo | Después |
| `src/views/PreciosView.jsx` | `no-unused-vars` | Bajo | Después |
| `src/views/PresupuestoDetailView.jsx` | `no-unused-vars`, `react-hooks/exhaustive-deps` | Alto | Después |

## Criterio

- Se dejan los warnings de hooks para no cambiar comportamiento.
- Los `no-unused-vars` fuera de flujos críticos se pueden limpiar en una fase posterior si no alteran imports.
- No se toca nada dentro de `OrderDetailView.jsx`, `ConfigView.jsx` ni `TallerPanel.jsx`.

## Motivo

La base está funcional y compila. La deuda actual es de limpieza y encapsulamiento, no de ruptura funcional.
