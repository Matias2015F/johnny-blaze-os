# Comprobante Rules

## Qué protege

Protege la verificabilidad, la publicabilidad y la trazabilidad documental del comprobante.

## Flujo afectado

Generación de comprobante -> verificación pública -> publicación.

## Funciones puras

- `evaluarComprobante(comprobante)`
- `obtenerMotivosBloqueoComprobante(comprobante)`
- `isComprobanteListoParaVerificacion(comprobante)`
- `isComprobanteListoParaPublicacion(comprobante)`

## Dónde no está aplicada todavía

- No está conectada al PDF real
- No está conectada al backend público
- No está conectada a la verificación pública

## Qué falta para integrarla al flujo vivo

- consumir estas reglas desde servicios o backend
- agregar tests de comprobante verificable/publicable
