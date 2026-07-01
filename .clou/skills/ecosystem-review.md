# Ecosystem Review

## Objetivo

Auditar un ecosistema digital compuesto por múltiples superficies.
No evaluar páginas aisladas.
Evaluar el recorrido completo del usuario a través de todas las superficies del sistema.

Pregunta central:
¿El ecosistema genera un efecto de red, o simplemente entrega un software?

---

## Aplicación

Diseñado para Sistemas Operativos de Negocio (SON): productos donde la propuesta de valor
no vive en una pantalla, sino en el circuito completo entre superficies.

Primer caso de uso: MotoGestión.
Reutilizable para cualquier SON futuro con la misma metodología.

---

## Paso 1 — Mapear el circuito

Antes de auditar, construir el mapa de superficies del ecosistema en orden de recorrido del usuario.

Ejemplo (MotoGestión):
```
Landing
  ↓
WhatsApp / CTA
  ↓
Registro (trial)
  ↓
App — operación del taller
  ↓
Comprobante PDF
  ↓
Calificación del cliente
  ↓
Reputación pública del taller
  ↓
Ranking / perfil verificado
  ↓
Historial certificado de la moto
  ↓
Retención del mecánico
  ↓
Renovación de suscripción
```

---

## Paso 2 — Auditar cada superficie

Para cada superficie en el mapa, registrar:
- ¿Tiene un siguiente paso claro hacia la próxima superficie?
- ¿Existe fricción que corta el flujo?
- ¿Comunica la misma promesa central del ecosistema?

---

## Paso 3 — Métricas de ecosistema

### ICR-1 — Índice de Comprensión

¿Un usuario que llega por primera vez entiende espontáneamente:

1. qué gana usando el sistema
2. por qué debe realizar la acción clave (calificar, verificar, registrarse)
3. qué valor concreto tiene el artefacto principal (comprobante, historial, garantía)
4. qué es este sistema y qué lo diferencia

Resultado por ítem: SI / PARCIAL / NO

### ICR-2 — Índice de Propagación

Después de usar el sistema completo, ¿existe un motivo real para que el usuario
exija este sistema en otro contexto (otro taller, otra empresa, otro proveedor)?

Resultado: NO / POSIBLE / PROBABLE / MUY PROBABLE

Este indicador mide el efecto de red real.
El éxito no es que el usuario complete una acción. El éxito es que, seis meses después,
entre a otro contexto y pregunte: "¿Ustedes trabajan con este sistema?"
Si eso ocurre, el crecimiento deja de depender exclusivamente de la capacidad comercial.

### ICE — Índice de Coherencia del Ecosistema

Puntúa de 0 a 10 la consistencia de la promesa central en cada superficie.
¿Todas las superficies comunican el mismo sistema, con el mismo lenguaje y la misma propuesta?

Escala:
- 10: la promesa es idéntica, el lenguaje es consistente
- 7-9: coherencia alta, variaciones menores
- 4-6: desconexión notable en alguna superficie
- 0-3: superficies que contradicen o ignoran la promesa central

Resultado: tabla con puntaje por superficie + ICE promedio.

---

## Paso 4 — Entregable

Para cada superficie: PASS / PARCIAL / FAIL + evidencia concreta.

Tabla ICE:
| Superficie | Puntaje |
|---|---|
| ... | ... |
| ICE promedio | ... / 10 |

ICR-1: SI / PARCIAL / NO por cada ítem.
ICR-2: NO / POSIBLE / PROBABLE / MUY PROBABLE.

Veredicto final: PASS / CONDICIONAL / FAIL
+ descripción de bloqueantes si los hay.
+ descripción de oportunidades de mejora si las hay.
