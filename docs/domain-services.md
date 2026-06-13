# Domain Services

Esta capa es una traducción pura de reglas de dominio hacia decisiones estructuradas.

## Objetivo

- Consumir reglas ya testeadas.
- Producir respuestas estables para capas superiores.
- No tocar UI, Firestore, backend, Mercado Pago, PDF ni WhatsApp.

## Servicios

### Ordenes

Archivo: `src/modules/ordenes/orden.domainService.js`

Expone decisiones para:

- estado de orden
- cierre de orden
- PDF final

### Comprobantes

Archivo: `src/modules/comprobantes/comprobante.domainService.js`

Expone decisiones para:

- verificación
- publicación

### Reputacion

Archivo: `src/modules/reputacion/reputacion.domainService.js`

Expone decisiones para:

- calificación pública
- aplicación de beneficio

## Formato de salida

Cada service devuelve:

```js
{
  permitido: false,
  codigo: "PDF_BLOQUEADO_MOTO_NO_RETIRADA",
  mensaje: "No podés generar el PDF final porque la moto todavía no fue retirada.",
  motivos: [],
  accionSugerida: "Confirmar retiro de moto"
}
```

## Regla

Los services son puros. No leen ni escriben:

- React
- Firestore
- localStorage
- backend
- Mercado Pago
- PDF real
- WhatsApp
- reputación pública

