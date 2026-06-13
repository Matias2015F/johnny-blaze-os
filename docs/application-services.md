# Application Services

Esta capa resuelve el consumo seguro de la capa de dominio sin tocar UI ni backend.

## Qué problema resuelve

Los adaptadores traducen datos legacy.  
Los application services convierten esa traducción en decisiones listas para consumo de una futura UI.

## Diferencia entre capas

- **Contratos**: definen formas, estados y campos.
- **Reglas**: responden si algo está permitido o bloqueado.
- **Domain services**: empaquetan reglas en decisiones de dominio.
- **Adapters**: traducen datos legacy a contratos de dominio.
- **Application services**: preparan decisiones finales con `source`, `codigo`, `mensaje`, `motivos` y `accionSugerida`.

## Por qué todavía no toca UI

Porque esta capa debe poder probarse sola y no arrastrar React, hooks ni flujos vivos.

## Qué decisiones devuelve

- PDF final de órdenes
- cierre documental de órdenes
- publicación de comprobantes
- verificación de comprobantes
- publicación de calificaciones
- aplicación de beneficios

## Integración futura

Más adelante la UI consumirá estas fachadas en vez de decidir reglas críticas por su cuenta.

## Archivos no conectados todavía

- `src/components/OrderDetailView.jsx`
- `src/views/ConfigView.jsx`
- `src/TallerPanel.jsx`
- `src/lib/storage.js`
- `api/*`

