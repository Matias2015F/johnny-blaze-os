# DI-001 — Decision Intelligence

## Objetivo

Transformar datos del ecosistema en decisiones accionables.
El panel deja de responder "¿qué está pasando?" y pasa a responder "¿qué debería hacer?".

---

## Principios

1. Nunca mostrar una métrica sin una decisión asociada.
2. Toda recomendación debe estar respaldada por datos reales.
3. Nunca inventar métricas. Si el dato no existe en Firestore, no se muestra.
4. Primero instrumentar. Después visualizar.
5. Toda nueva métrica debe superar la prueba: "¿Qué decisión permite tomar?"

---

## Fuentes actuales (buildable hoy)

| Colección | KPIs disponibles |
|---|---|
| `usuarios` | Trial → Pago, Retención, Estado por usuario |
| `billingInvoices` | Renovación, Cobrado este mes, Total histórico |
| `ratings` | Calificaciones por taller, Promedio por categoría |
| `publicReceipts` | Comprobantes emitidos, Tokens generados |
| `soporteTickets` | Tickets pendientes, Tiempo de resolución |
| `admin_settings` | Precios actuales, Días de trial, Grace days |

## Fuentes futuras (requieren instrumentación nueva)

| Colección | Propósito |
|---|---|
| `ecosystemSnapshots/{fecha}` | Historial mensual de ICE, ICR, conversión — habilita evolución del ecosistema |
| `usageEvents/{uid}/events` | Primer comprobante, primera calificación, primera OT cerrada |
| `receiptEvents` | Comprobante descargado por el cliente final (VerifyReceiptView) |
| `landingEvents` | Clicks en CTA desde motogestion.ar (requiere pixel en landing) |
| `whatsappEvents` | Apertura de link verificable desde WhatsApp |

---

## KPIs

### Conversión
- Trial → Pago (%)
- Tiempo promedio trial → primer pago
- Renovación (%)

### Retención
- Usuarios activos / total
- Tiempo promedio hasta vencimiento sin renovar
- Churn mensual

### Reputación
- Calificaciones emitidas / comprobantes generados (%)
- Promedio por categoría (Atención, Calidad, Plazos, Claridad)
- Talleres con 10+ calificaciones vs. sin calificaciones

### Ecosistema
- ICE — Índice de Coherencia del Ecosistema (0-10 por superficie)
- ICR-1 — Comprensión (SI / PARCIAL / NO por ítem)
- ICR-2 — Propagación (NO / POSIBLE / PROBABLE / MUY PROBABLE)
- ICG — Índice de Confianza Generada (variables: calificación + PDF + garantía + historial + recurrencia)

---

## Arquitectura de capas

```
Datos (Firestore)
      ↓
KPIs (cálculo sobre colecciones existentes)
      ↓
Indicadores compuestos (ICE, ICR, ICG, Conversión, Retención)
      ↓
Motor de diagnóstico (reglas sobre indicadores)
      ↓
Hipótesis (por qué un indicador está bajo)
      ↓
Recomendaciones (qué acción tomar)
```

---

## Dashboards

### OPERACIÓN
Usuarios activos, trial, vencidos, gracia.
Cobros del mes, total histórico, pagos por usuario.
Tickets pendientes.

### INTELIGENCIA
ICE por superficie.
ICR-1 y ICR-2.
Embudo: usuarios → comprobantes → calificaciones → renovaciones.
Hipótesis activas.
Decision Cards.

### CRECIMIENTO
Conversión trial → pago (tendencia mensual).
Talleres en la red (mapa, ranking, calificaciones).
Calificaciones por taller.
Comprobantes verificados.

---

## Decision Cards

Formato de cada tarjeta:

```
DECISIÓN #N
Problema detectado
[qué indicador está bajo y cuánto]
Diagnóstico
[por qué ocurre, basado en datos]
Impacto: Alto / Medio / Bajo
Área: [Landing / App / WhatsApp / PDF / Admin]
Recomendación
[acción concreta a tomar]
Resultado esperado
[qué debería cambiar y en cuánto tiempo]
```

Las Decision Cards son reglas primero, IA después.
No requieren ML para la primera versión — solo umbrales sobre KPIs existentes.

---

## Historial del ecosistema

Colección: `ecosystemSnapshots/{YYYY-MM}`
Campos: ICE por superficie, ICR-1, ICR-2, conversion_trial_pago, calificaciones_mes, talleres_activos.
Frecuencia de escritura: manual por el admin o automático mensual (cron).
Propósito: validar si los cambios implementados realmente mueven las métricas.

---

## Estado de implementación

| Capa | Estado |
|---|---|
| Fuentes actuales documentadas | DECIDED |
| Fuentes futuras definidas | DECIDED |
| KPIs calculables hoy | DECIDED, no IMPLEMENTED |
| Dashboard OPERACIÓN | parcialmente en admin actual |
| Dashboard INTELIGENCIA | no IMPLEMENTED |
| Dashboard CRECIMIENTO | no IMPLEMENTED |
| Decision Cards | no IMPLEMENTED |
| ecosystemSnapshots | no IMPLEMENTED |
| ICG | DECIDED, no IMPLEMENTED |

---

## Historial

| Fecha | Acción |
|---|---|
| 2026-06-29 | Directiva creada. Contexto: post-QA-002, pre-RC-1. |
