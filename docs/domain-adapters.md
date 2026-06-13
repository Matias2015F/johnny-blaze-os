# Domain Adapters

Los adaptadores resuelven el puente entre datos legacy y la capa de dominio.

## Problema que resuelven

Hoy existen varias formas antiguas de representar una orden, un comprobante o un beneficio.  
La capa de dominio trabaja con contratos más estrictos.  
Los adaptadores traducen una forma a la otra sin escribir datos ni tocar el flujo vivo.

## Qué traducen

### Ordenes

- `estado` y `status`
- `pagado`, `cobrado`, `retirado`, `motoRetirada`
- `cliente`, `clienteId`
- `moto`, `motoId`
- `taller`, `tallerId`
- `garantia`, `excepciones`, `observaciones`, `recomendaciones`
- `trabajos`, `repuestos`, `pagos`

### Comprobantes

- `pdfUrl`, `pdf`, `urlPdf`
- `comprobanteId`, `receiptId`, `id`
- `estadoVerificacion`, `verificationState`, `verificacion`
- `fechaCierre`, `closedAt`, `cierreAt`

### Reputacion y beneficios

- `rating`, `puntaje`, `score`
- `token`, `reviewToken`
- `beneficio`, `descuento`, `porcentaje`
- `estado`, `estadoPublicacion`
- `usado`, `venceAt`, `fechaVencimiento`

## Servicios de dominio consumidos

- `src/modules/ordenes/orden.domainService.js`
- `src/modules/comprobantes/comprobante.domainService.js`
- `src/modules/reputacion/reputacion.domainService.js`

## Por qué no escriben datos

Porque esta capa solo traduce y evalúa.  
Es reversible, testeable y no introduce efectos laterales.

## Por qué no dependen de React

Porque React pertenece a la capa de consumo visual.  
Los adaptadores deben poder ejecutarse igual en tests, scripts o futuros servicios.

## Qué falta para integrarlos al flujo vivo

- conectar los adaptadores a pantallas o hooks
- decidir dónde se consume cada decisión
- reemplazar lecturas legacy directas en UI por estas traducciones

## Qué archivos no están conectados todavía

- `src/components/OrderDetailView.jsx`
- `src/views/ConfigView.jsx`
- `src/TallerPanel.jsx`
- `src/lib/storage.js`
- `api/*`

