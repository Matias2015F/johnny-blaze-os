# Checkpoint previo a recuperación de regresión de TaskManagerView

Fecha: 2026-06-15

## Estado Git

- Repositorio permanente: `C:\Users\Usuario\Proyectos\MotoGestion\repositorio`
- Rama: `codex/motogestion-preservacion-20260613`
- HEAD: `2dc20791fc65f17c3765744685693b1d99b53d50`
- Último commit: `2dc2079 chore: preserve current MotoGestión state before workspace reorganization`
- Árbol inicial: limpio

## Regresión congelada

- Último commit funcional: `59ea5f1a808e1dfb801e0d16d474e2eb9b009043`
- Primer commit regresivo: `6caea28db410024f4104ecf06b4f34ba9a4ca085`
- Archivo afectado: `src/components/TaskManagerView.jsx`

Capacidades comprobablemente eliminadas o degradadas:

1. Reutilización completa de un service anterior.
2. Clonación de repuestos e insumos.
3. Recuperación del próximo control.
4. Asociación de materiales con la tarea.
5. Navegación secuencial por pasos.

## Validación previa

- `npm run lint`: OK, 0 errores y 50 warnings heredados.
- `npm run build`: OK, 2261 módulos transformados.
- `npm test`: OK, 26 archivos y 130 tests aprobados.

## Restricciones de recuperación

- No reemplazar el archivo completo.
- No revertir completamente `6caea28`.
- No modificar `OrderDetailView.jsx`, `TallerPanel.jsx`, `App.jsx` ni `storage.js`.
- No tocar Firebase, Firestore rules, APIs, Mercado Pago, PDF, WhatsApp, shadow, rollout o navegación global.
- No hacer commit, push ni deploy sin aprobación explícita.
