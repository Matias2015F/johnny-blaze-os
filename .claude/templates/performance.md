# Template: Performance

Ticket: [NOMBRE]
Objetivo: [qué se va a optimizar y por qué]

## Métrica de entrada (ANTES — obligatorio)
| Métrica | Valor |
|---|---|
| [chunk / tiempo / tamaño] | [valor medido] |

## Hipótesis
[Una sola frase: qué cambio producirá qué resultado.]

## Archivos afectados
- [ruta] — [qué cambia y por qué]

## Plan
1. Leer archivo(s) afectado(s)
2. Identificar el import / cálculo / dependencia que genera el problema
3. Proponer cambio mínimo
4. Esperar aprobación
5. Implementar
6. npm run build
7. Reportar métrica DESPUÉS

## Métrica de salida (DESPUÉS — obligatorio antes de commitear)
| Métrica | Antes | Después | Delta |
|---|---|---|---|
| [chunk / tiempo / tamaño] | | | |

## Criterio de aceptación
- [ ] Mejora medible y documentada
- [ ] Build OK sin warnings nuevos
- [ ] Un solo archivo modificado (si es posible)

## Evidencia
Adjuntar el fragmento del build donde aparecen las métricas finales.
No alcanza con escribir el número. La evidencia debe provenir de la salida real del build.
