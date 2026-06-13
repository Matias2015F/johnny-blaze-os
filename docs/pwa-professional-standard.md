# PWA Professional Standard - MotoGestión

## Propósito

MotoGestión se considera un sistema de negocio SaaS para talleres de motos. No se define como un conjunto de pantallas ni como una PWA "instalable", sino como una plataforma que resuelve procesos reales con trazabilidad, seguridad, estado controlado y comportamiento predecible.

La regla base de esta fase es:

- Sistema antes que pantalla.
- Proceso antes que diseño.
- Reglas antes que botones.
- Datos antes que estética.
- Trazabilidad antes que velocidad aparente.

## 1. Principios obligatorios de producto

- La app es un sistema de negocio, no una suma de pantallas.
- El flujo principal debe estar blindado.
- Cada función nueva debe justificar qué problema real resuelve.
- No se agregan funciones que no mejoren flujo, confianza, tiempo, ingresos o reducción de errores.

## 2. Dominio central de MotoGestión

### Usuario
- Campos obligatorios: `uid`, `email`
- Campos opcionales: `rol`, `displayName`, `phoneNumber`
- Estados posibles: `activo`, `trial`, `vencido`, `suspendido`, `admin`
- Reglas críticas: no puede operar fuera de su taller o permiso
- Relaciones: pertenece a uno o más talleres

### Taller
- Campos obligatorios: `tallerId`, `nombre`, `usuarioPropietarioId`
- Campos opcionales: `direccion`, `ciudad`, `provincia`, `lat`, `lng`, `telefono`, `logo`, `perfilPublico`
- Estados posibles: `registrado`, `verificado`, `suspendido`, `publicado`
- Reglas críticas: un taller nunca ve datos de otro taller
- Relaciones: contiene clientes, motos, órdenes, suscripción, reputación

### Cliente
- Campos obligatorios: `clienteId`, `nombre`
- Campos opcionales: `telefono`, `whatsapp`, `email`, `etiquetas`, `activo`
- Estados posibles: `activo`, `inactivo`
- Reglas críticas: debe poder asociarse a una o más motos y órdenes
- Relaciones: cliente -> motos -> órdenes -> pagos -> beneficios

### Moto
- Campos obligatorios: `motoId`, `patente`, `clienteId`
- Campos opcionales: `marca`, `modelo`, `cilindrada`, `km`, `kilometrajeActual`, `estado`
- Estados posibles: `activa`, `retenida`, `vendida`, `inactiva`
- Reglas críticas: la patente es identificador humano, no clave técnica
- Relaciones: pertenece a cliente y a historial técnico

### Orden de trabajo
- Campos obligatorios: `ordenId`, `tallerId`, `clienteId`, `motoId`, `estado`, `createdAt`
- Campos opcionales: `presupuesto`, `pagos`, `garantia`, `pdf`, `observaciones`, `repuestos`, `tareas`
- Estados posibles: ver sección 4
- Reglas críticas: el estado controla acciones permitidas
- Relaciones: depende de cliente, moto, pagos, comprobante, beneficio

### Presupuesto
- Campos obligatorios: `presupuestoId`, `ordenId`, `montoTotal`, `estado`
- Campos opcionales: `detalle`, `descuento`, `vigencia`, `observaciones`
- Estados posibles: `borrador`, `enviado`, `aprobado`, `rechazado`, `vencido`
- Reglas críticas: debe versionarse y auditarse
- Relaciones: pertenece a una orden

### Tarea
- Campos obligatorios: `tareaId`, `nombre`, `monto`
- Campos opcionales: `horas`, `dificultad`, `reemplazada`, `observaciones`
- Estados posibles: `activa`, `rechazada`, `aprobada`
- Reglas críticas: integra cálculo de presupuesto y orden
- Relaciones: pertenece a una orden

### Repuesto
- Campos obligatorios: `repuestoId`, `nombre`, `monto`
- Campos opcionales: `cantidad`, `montoCosto`, `codigo`, `marca`
- Estados posibles: `activo`, `rechazado`
- Reglas críticas: no duplicar cobro ni costo
- Relaciones: pertenece a una orden o historial de precios

### Pago
- Campos obligatorios: `pagoId`, `ordenId`, `monto`, `fecha`
- Campos opcionales: `medio`, `referencia`, `estado`, `observacion`
- Estados posibles: `pendiente`, `aprobado`, `rechazado`, `anulado`
- Reglas críticas: no duplicar pagos
- Relaciones: pertenece a una orden y a billing si aplica

### Garantía
- Campos obligatorios: `garantiaId`, `ordenId`, `texto`
- Campos opcionales: `excepciones`, `recomendaciones`, `vigenciaDias`, `vigenciaKm`
- Estados posibles: `borrador`, `activa`, `vencida`, `anulada`
- Reglas críticas: no emitir sin datos mínimos
- Relaciones: derivada de una orden cerrada

### Comprobante PDF
- Campos obligatorios: `comprobanteId`, `ordenId`, `tallerId`, `pdfUrl`
- Campos opcionales: `garantia`, `excepciones`, `recomendaciones`, `trabajosRealizados`, `repuestos`, `pagos`, `fechaCierre`, `estadoVerificacion`
- Estados posibles: `borrador`, `generado`, `verificado`, `anulado`
- Reglas críticas: debe ser trazable y reconstruible
- Relaciones: depende de orden, cliente, moto y taller

### Calificación
- Campos obligatorios: `ratingId`, `tallerId`, `clienteId`, `motoId`, `ordenId`, `rating`
- Campos opcionales: `comentario`, `estadoPublicacion`
- Estados posibles: `pendiente`, `aprobada`, `publicada`, `moderada`
- Reglas críticas: token único, una calificación por flujo habilitado
- Relaciones: deriva de una orden cerrada y comprobante válido

### Beneficio/descuento
- Campos obligatorios: `beneficioId`, `tallerId`, `clienteId`, `motoId`, `ordenOrigenId`, `porcentaje`, `estado`
- Campos opcionales: `fechaCreacion`, `fechaVencimiento`
- Estados posibles: `DISPONIBLE`, `USADO`, `VENCIDO`
- Reglas críticas: sólo para la próxima atención de la misma moto en el mismo taller
- Relaciones: deriva de una calificación/verificación válida

### Estado de retiro
- Campos obligatorios: `ordenId`, `estadoRetiro`
- Campos opcionales: `fechaRetiro`, `observacionRetiro`
- Estados posibles: `pendiente`, `confirmado`, `anulado`
- Reglas críticas: cobrar no significa finalizar
- Relaciones: controla el paso a PDF final

### Suscripción
- Campos obligatorios: `uid`, `estado`, `plan`
- Campos opcionales: `activoHasta`, `trialEndsAt`, `graceEndsAt`, `nextBillingAt`
- Estados posibles: `trial`, `activo`, `vencido`, `suspendido`, `admin`
- Reglas críticas: no extender manualmente desde la UI
- Relaciones: habilita o bloquea operación SaaS

### Reclamo/ticket
- Campos obligatorios: `ticketId`, `uid`, `tipo`, `estado`, `mensaje`
- Campos opcionales: `ordenId`, `plan`, `requestedPlanKey`
- Estados posibles: `nuevo`, `en_proceso`, `resuelto`, `cerrado`
- Reglas críticas: soporte auditable
- Relaciones: asociado a usuario/taller/suscripción

### Auditoría
- Campos obligatorios: `eventoId`, `actorId`, `accion`, `fecha`
- Campos opcionales: `entidad`, `entidadId`, `antes`, `despues`, `metadatos`
- Estados posibles: no aplica como flujo, sí como trazabilidad
- Reglas críticas: registrar acciones sensibles
- Relaciones: transversal a todas las entidades

## 3. Flujo crítico blindado

cliente -> moto -> orden -> diagnóstico -> presupuesto -> aprobación -> trabajo -> cobro -> retiro -> garantía/PDF -> reputación -> próximo beneficio

Este flujo tiene prioridad absoluta sobre cualquier mejora estética o secundaria.

## 4. Estados de orden obligatorios

Estados canónicos:

- `BORRADOR`
- `DIAGNOSTICO`
- `PRESUPUESTADO`
- `AUTORIZADO`
- `EN_REPARACION`
- `ESPERANDO_REPUESTOS`
- `PENDIENTE_PAGO`
- `COBRADO_PENDIENTE_RETIRO`
- `LISTO_PARA_ENTREGA`
- `ENTREGADO`
- `CERRADO_CON_PDF`
- `CANCELADO`

Regla crítica:

- Cobrar no significa finalizar la orden.
- Si una orden está cobrada pero la moto no fue retirada:
  - `estado = COBRADO_PENDIENTE_RETIRO`
  - no se permite PDF final
  - no se considera orden cerrada
  - no debe generarse garantía final
  - la próxima acción correcta debe ser `Confirmar retiro de moto`

## 5. Reglas de PDF final

No se puede generar PDF final si:

- la moto no fue retirada
- la orden está en `COBRADO_PENDIENTE_RETIRO`
- falta garantía
- faltan excepciones
- faltan observaciones o recomendaciones obligatorias
- faltan datos mínimos de cliente, moto, taller u orden

El PDF debe ser trazable y reconstruible. Debe registrar:

- quién lo generó
- cuándo
- con qué datos
- sobre qué orden
- qué garantía tenía
- qué repuestos incluía
- qué observaciones se declararon
- qué cliente recibió el enlace
- si hubo calificación posterior

## 6. Separación UI / lógica / datos

- La pantalla no decide reglas críticas.
- Las reglas críticas deben vivir en contratos, rules o services de dominio.
- La UI consume decisiones; no las inventa.

## 7. Seguridad desde diseño

- El frontend no es fuente de verdad.
- Toda acción crítica debe validarse también fuera de la UI.

Acciones que deben impedirse aunque se manipule el navegador:

- generar PDF sin retiro
- ver órdenes de otro taller
- modificar datos de otro taller
- usar descuento ajeno
- reutilizar token de calificación
- extender suscripción manualmente
- aplicar descuento dos veces
- duplicar pagos
- generar documentos duplicados

## 8. Multi-tenant obligatorio

- Todo dato operativo debe depender de `tallerId`.
- Un taller nunca debe ver, modificar ni consultar datos de otro taller.
- Toda entidad sensible debe tener relación directa o indirecta con `tallerId`.

## 9. Idempotencia obligatoria

Acciones críticas idempotentes:

- generar PDF
- aplicar descuento
- registrar pago
- enviar comprobante
- enviar link de calificación
- sincronizar cambios offline
- procesar webhook de Mercado Pago

Si una acción se repite, no debe duplicar datos peligrosos.

## 10. Auditoría obligatoria

Eventos que deben auditarse:

- creación de orden
- cambio de presupuesto
- aprobación de presupuesto
- carga de pago
- cambio de estado
- confirmación de retiro
- generación de PDF
- envío de WhatsApp
- emisión de link de calificación
- uso de beneficio
- cambio de garantía
- anulación o corrección de documento
- cambio de plan/suscripción

## 11. Beneficios/descuentos

Un beneficio sólo puede aplicarse si:

- `estado = DISPONIBLE`
- coincide `tallerId`
- coincide `clienteId`
- coincide `motoId`
- no está vencido
- no fue usado
- proviene de una orden real cerrada/calificada
- aplica a la próxima atención de esa misma moto en ese mismo taller

## 12. Tokens de reputación

Los tokens deben ser:

- únicos
- opacos
- no predecibles
- asociados a `tallerId`, `clienteId`, `motoId` y `ordenId`
- con estado
- con uso controlado
- anulables si corresponde
- no reutilizables si la regla del negocio lo exige

## 13. Offline inteligente

Debería funcionar offline para:

- ver clientes cargados
- ver motos cargadas
- ver órdenes recientes
- crear nota técnica local
- guardar diagnóstico local
- dejar cambios en cola

No debería operar offline sin control para:

- cobrar con Mercado Pago
- emitir comprobantes finales
- validar suscripción
- enviar WhatsApp
- publicar reputación
- aplicar beneficios definitivos
- subir archivos pesados sin cola

## 14. UX orientada a decisión

Cada estado debe mostrar la próxima acción correcta:

- `PRESUPUESTADO` -> `Marcar como aprobado`
- `EN_REPARACION` -> `Registrar avance / cargar repuesto`
- `PENDIENTE_PAGO` -> `Registrar pago`
- `COBRADO_PENDIENTE_RETIRO` -> `Confirmar retiro de moto`
- `ENTREGADO` -> `Completar garantía y generar PDF final`

## 15. Testing mínimo obligatorio futuro

Reglas que deberán tener test:

- no generar PDF si no hay retiro
- no generar PDF si falta garantía
- no cerrar orden con saldo pendiente
- no aplicar descuento dos veces
- no usar beneficio de otra moto
- no usar beneficio vencido
- no reutilizar token de calificación
- no crear orden sin cliente
- no crear orden sin moto
- no procesar dos veces el mismo webhook de Mercado Pago
- no permitir acceso cruzado entre talleres

## 16. Documentación viva esperada

Documentación objetivo futura:

- `README.md`
- `ARCHITECTURE.md`
- `DATA_MODEL.md`
- `BUSINESS_RULES.md`
- `TESTING.md`
- `DEPLOY.md`
- `CHANGELOG.md`
- `SECURITY.md`

No hace falta crearlos ahora. Forman parte del estándar futuro.

## 17. Checklist de aceptación para próximas fases

Antes de tocar `storage.js`, `OrderDetailView.jsx`, `ConfigView.jsx`, PDF, Mercado Pago, WhatsApp o reputación, toda propuesta debe responder:

- qué problema real resuelve
- qué entidad modifica
- qué regla de negocio toca
- qué puede fallar
- qué pasa sin internet
- qué permiso requiere
- cómo se audita
- cómo se prueba
- cómo se revierte
- cómo se evita duplicación
- qué impacto tiene en otros talleres o tenants

## Criterio de cierre

Este estándar es obligatorio antes de avanzar a FASE 3B-C. Si una propuesta no cumple este documento, se considera bloqueada.
