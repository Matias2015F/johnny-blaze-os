# Skill: Función Única (Single Responsibility Principle)

## Principio

```
Una cosa. Un problema. Una responsabilidad.
```

Si un archivo necesita cambiar por más de una razón, está mal diseñado.

## Test de aplicación

Preguntarse: **¿Por qué cambiaría este archivo?**

- Una sola razón → OK
- Múltiples razones → Dividir

## Señales de violación

- Archivo > 300 líneas en vistas, > 150 en servicios
- Nombre con "Y": "gestiona pagos Y presupuestos"
- Imports de 5+ dominios distintos
- Funciones de capas mezcladas (UI + Firebase + cálculo en el mismo archivo)

## Aplicación por capa

| Capa | Responsabilidad única permitida |
|---|---|
| Vista (View) | Responder UNA pregunta de negocio |
| Servicio (Service) | Resolver UN caso de uso |
| Repositorio (Repository) | CRUD de UNA colección |
| API endpoint | UN objetivo de negocio |

## Prioridad de refactor en este proyecto

```
P1: ConfigView.jsx (3863 líneas)
     → ConfigTallerView.jsx  (datos taller, ubicación, WhatsApp)
     → AdminPanelView.jsx    (usuarios, suscripciones, métricas, calificaciones)

P1: OrderDetailView.jsx (1600+ líneas)
     → Ya tiene separados: TaskManagerView, PaymentView, LogisticsView
     → Pendiente: extraer lógica de PDF y garantía

P2: App.jsx
     → Separar telemetry y backup en hooks propios

P3: storage.js
     → Meta-largo plazo: repositorios por colección
```

## Regla de oro

Antes de crear cualquier módulo nuevo:

```
¿Qué ÚNICO problema resuelve?
```

Si la respuesta usa la palabra "y" → son dos módulos distintos.
