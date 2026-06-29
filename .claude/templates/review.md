# Template: Review

Ticket: [NOMBRE o PR]
Alcance: [ ] diff actual  [ ] archivo específico  [ ] flujo completo

## Qué revisar
- [ ] Corrección lógica
- [ ] Dependencias no declaradas
- [ ] Imports sin usar
- [ ] Lógica de negocio en componente JSX (violación SRP)
- [ ] Lectura directa a Firestore fuera de storage.js
- [ ] useEffect sin cleanup
- [ ] Funciones potencialmente candidatas a SRP

## Qué NO revisar en este ticket
[Excluir explícitamente lo que está fuera de alcance para no abrir nuevos frentes.]

## Formato de reporte
Por cada hallazgo:
- Archivo + línea
- Descripción del problema
- Severidad: crítico / advertencia / sugerencia
- Acción sugerida

## Criterio de cierre
- [ ] Hallazgos críticos resueltos o documentados como deuda
- [ ] No se abrieron nuevos tickets sin aprobación
