# Shadow Diagnostics Integration

Esta vista interna muestra el comportamiento de la nueva arquitectura en modo diagnóstico.

## Qué es

Una superficie secundaria, sólo de lectura, para observar decisiones de la capa shadow sin afectar la app operativa.

## Cómo se activa

- mediante `VITE_ENABLE_ORDEN_SHADOW_DIAGNOSTICS=true`
- en desarrollo, usando esa variable en el entorno local

## URL exacta

- `http://localhost:5173/__diagnostics/orden-shadow`

## Cómo se desactiva

- no configurando la variable
- o seteando `VITE_ENABLE_ORDEN_SHADOW_DIAGNOSTICS=false`
- en producción queda desactivada por defecto

## Variable de entorno

- `VITE_ENABLE_ORDEN_SHADOW_DIAGNOSTICS`

## Qué datos utiliza

- fixtures no productivos
- órdenes legacy pasadas por props
- shadow integration
- shadow presenter
- nunca usa datos productivos

## Auditoria de compatibilidad

La vista tambien puede recibir un snapshot legacy pegado manualmente o cargado desde un archivo local.

Antes de evaluarlo:

- se sanitiza el contenido
- se calcula el reporte de compatibilidad
- se muestran campos reconocidos
- se muestran campos legacy no reconocidos
- se muestran campos criticos ausentes
- se muestra el snapshot ya sanitizado

## Regla de uso

Usar solo snapshots sanitizados. No pegar nombres, telefonos, documentos, patentes reales, direcciones, tokens ni informacion de clientes.

## Qué no modifica

- no escribe datos
- no toca Firestore
- no toca localStorage
- no dispara PDF
- no cambia estados
- no toca WhatsApp
- no sube ni persiste archivos
- no realiza llamadas de red

## Cómo verificarla manualmente

1. Activar la flag en desarrollo.
2. Abrir `http://localhost:5173/__diagnostics/orden-shadow`.
3. Confirmar que los fixtures se muestran.
4. Confirmar que el panel sólo informa y no actúa.
5. Cambiar entre fixtures desde el selector.

## Cómo hacer rollback

- desactivar la feature flag
- retirar el montaje interno
- la app operativa queda igual

## Qué falta antes de integrarla en una pantalla operativa

- definir la superficie visible
- validar que no interfiere con acciones reales
- acordar qué datos reales, si alguno, podrían verse en un entorno interno
- hoy todavía sólo gobierna la superficie interna de diagnóstico

## Checklist manual

1. Feature flag desactivada.
2. La app funciona exactamente igual que antes.
3. Feature flag activada en desarrollo.
4. La vista diagnóstica muestra los fixtures.
5. La orden cobrada pendiente de retiro muestra bloqueo.
6. La orden entregada completa muestra decisión permitida.
7. Ninguna acción modifica datos.
8. Desactivar flag elimina la superficie diagnóstica.
