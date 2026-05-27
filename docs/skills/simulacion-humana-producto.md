# Skill — Simulación humana de producto

Ejecutar al final de cada fase importante del ROADMAP.

## Objetivo

Probar MotoGestión como lo usaría una persona real, no como lo revisaría un programador.
No modificar código durante la simulación. Solo observar, documentar y proponer.

## Roles

1. Mecánico tradicional poco digital (45-60 años, cuaderno, apuro)
2. Mecánico joven / técnico (25-40 años, WhatsApp, quiere verse profesional)
3. Dueño de taller apurado (celular en mano, datos inestables, interrupciones)
4. Cliente desconfiado (recibe PDF, teme que le cobren de más)
5. Cliente que quiere vender la moto (necesita historial verificable)
6. Cliente problemático (rechaza presupuesto, luego reclama garantía)

## Flujo a probar

crear cliente → cargar moto → abrir orden → cargar diagnóstico → cerrar trabajo →
emitir PDF → registrar pago → verificar comprobante → validar como cliente →
calificar → revisar reputación → backup → suscripción → admin

## Patrones a simular

- Cliente que pregunta "¿cuánto me sale?" sin querer pagar diagnóstico
- Cliente que reclama garantía sin haber autorizado la reparación
- Mecánico que anota en cuaderno y nunca usó un sistema
- Moto que vuelve a fallar a los 15 días
- Presupuesto que cambia al desarmar
- Cliente que quiere vender la moto con historial documentado
- Taller que quiere diferenciarse de mecánicos improvisados

## Dimensiones a evaluar (1-5)

- Claridad de la interfaz
- Facilidad de uso en celular
- Comprensión sin ayuda (primer día)
- Fricción operativa
- Manejo de errores y estados vacíos
- Sensación profesional del PDF
- Confianza que genera en el cliente
- Utilidad real para el mecánico
- Capacidad de venta del servicio

## Entregables

- Problemas críticos (bloquean la venta o destruyen confianza)
- Problemas medios (fricción o confusión sin bloqueo total)
- Mejoras rápidas (copy, UI, estados vacíos — bajo costo, alto impacto)
- Mejoras futuras (features grandes, para otra fase)
- Veredicto: Vendible ahora / Vendible con ajustes / No vendible todavía

## Restricciones durante la simulación

No usar jerga técnica en el informe (no "Firestore", "localStorage", "token", "hash").
Si una palabra de la app no la entendería un mecánico de 55 años, marcarla.
Escribir desde la perspectiva del usuario, no del programador.
