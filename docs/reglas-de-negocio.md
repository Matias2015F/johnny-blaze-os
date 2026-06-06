# Reglas de Negocio - MotoGestion.ar

Este documento define reglas reales del negocio. No es una guia visual ni una lista de ideas. Si una pantalla, API o funcion calcula distinto a este documento, el codigo esta mal.

## Bloque 1: Configuracion del Taller y Motor Matematico de Precios

### 1. Parametros del perfil

#### Datos publicos

Estos datos pueden mostrarse en landing, mapa, perfil publico y red MotoGestion:

- Nombre comercial o nombre del mecanico.
- Direccion de atencion.
- Telefono de contacto publico.
- Coordenadas de geolocalizacion guardadas por el taller.
- Reputacion general por estrellas.
- Cantidad de calificaciones verificadas cuando exista muestra suficiente.

#### Datos privados

Estos datos son de uso interno de la app y no deben exponerse en landing ni mapa publico:

- Logica financiera del taller.
- Datos bancarios.
- Alias, CBU, CVU, billeteras y datos de cobro.
- Configuracion de mensajes.
- Porcentaje de adelanto.
- Margenes de ganancia.
- Costos internos.
- Notas internas del trabajo.

### 2. Motor matematico de mano de obra

El valor de la hora facturada al cliente se calcula cruzando:

```txt
Costo Hora Base
Margen de Ganancia
Multiplicador de Dificultad
```

#### Tarifa plana base

El taller carga manualmente un `costoHoraBase`.

```txt
costoHoraBase = valor definido por el mecanico
```

#### Precio hora cliente

El precio hora cliente se calcula aplicando margen al costo base.

```txt
precioHoraCliente = costoHoraBase * (1 + margenGananciaPct / 100)
```

Reglas:

- `margenGananciaPct` minimo: 5%.
- `margenGananciaPct` maximo: 300%.
- Si el valor ingresado queda fuera del rango, la app debe bloquear o corregir segun regla explicita de UI.

#### Multiplicador de complejidad operativa

Cada tarea puede ajustar la tarifa horaria segun dificultad:

| Dificultad | Factor | Regla |
|---|---:|---|
| Facil | 0.5 | Reduce la tarifa horaria a la mitad |
| Normal | 1.0 | Mantiene la tarifa horaria |
| Dificil | 1.5 | Incrementa la tarifa un 50% |
| Complicado | 2.0 | Duplica la tarifa por riesgo, herramienta o complejidad |

Formula por tarea:

```txt
precioManoObraTarea = horasEstimadas * precioHoraCliente * factorDificultad
```

Ejemplo con `precioHoraCliente = ARS 55.000`:

```txt
Facil:      ARS 27.500 por hora
Normal:     ARS 55.000 por hora
Dificil:    ARS 82.500 por hora
Complicado: ARS 110.000 por hora
```

### 3. Motor de total de orden

El total del trabajo se calcula como:

```txt
totalOrden =
  totalManoObra
  + totalRepuestos
  + totalInsumos
  + totalFletes
  + totalAdicionales
  - descuentosAplicados
```

Reglas:

- Los costos internos no se muestran al cliente.
- El comprobante debe mostrar total cobrado, total pagado, saldo pendiente y estado de pago sin ambiguedad.
- Si hay descuento por fidelizacion, debe mostrarse como descuento separado.

### 4. Adelanto obligatorio en presupuestos

Todo mensaje de presupuesto puede calcular automaticamente un `montoAdelantoObligatorio`.

```txt
montoAdelantoObligatorio = totalPresupuesto * (adelantoPct / 100)
```

Reglas:

- `adelantoPct` lo configura el taller.
- El mensaje de WhatsApp debe incluir el monto de adelanto si el taller lo activo.
- El mensaje puede incluir datos privados de cobro solo en el WhatsApp enviado al cliente, nunca en landing publica.
- Datos posibles de cobro: billetera, alias, CBU, CVU.
- El mensaje debe incluir plazo de validez del presupuesto en dias cuando este configurado.

### 5. Fidelizacion por calificacion

Cuando un cliente califica desde un comprobante verificable, el taller puede otorgar un beneficio para la proxima visita.

Reglas:

- El porcentaje lo configura el taller.
- El beneficio se guarda asociado a la moto y/o cliente.
- El beneficio se aplica exclusivamente sobre mano de obra.
- No se aplica sobre repuestos, insumos ni fletes.
- No se aplica dos veces sobre el mismo trabajo.
- En la siguiente orden, la app debe avisar que existe beneficio disponible.
- El presupuesto debe mostrar que el descuento fue aplicado por fidelizacion/calificacion.

Formula:

```txt
descuentoFidelizacion = totalManoObra * (loyaltyDiscountPct / 100)
```

## Ordenes

- Una orden nace con cliente y moto asociados.
- Una orden puede avanzar de estado, pero no debe retroceder sin auditoria.
- Una orden cerrada con comprobante emitido no debe permitir cambios que alteren el comprobante.
- Si el cliente rechaza presupuesto, se emite constancia de diagnostico/presupuesto cerrado.

## Presupuestos

- El presupuesto debe tener total claro y estado claro.
- Aprobar presupuesto habilita reparacion.
- Rechazar presupuesto no debe crear una reparacion falsa.
- Todo presupuesto enviado por WhatsApp debe respetar la misma formula que la pantalla.

## Comprobantes

- Cada comprobante emitido debe tener `receiptToken`.
- El link publico debe apuntar a `/verificar/{token}`.
- El QR es canal secundario, no la unica forma de calificar.
- El bloque de pago debe mostrar `saldoPendiente` y `estado`, no textos ambiguos.
- El comprobante debe priorizar historial tecnico: motivo de ingreso, diagnostico, trabajos, repuestos, garantia, proximo service y validacion.

## Ratings y reputacion

- El taller no puede crear calificaciones manualmente.
- Una calificacion debe estar asociada a un comprobante real.
- Una calificacion no debe poder editarse desde el taller.
- Solo ratings aprobados o validados suman reputacion publica.
- La reputacion publica debe salir de `workshopReputation`, no de `users/{uid}`.

## Mapa publico

- El pin publico solo se muestra si el taller habilito perfil publico y ubicacion.
- El mapa usa coordenadas guardadas y bloqueadas por el taller.
- El boton "Como llegar" debe abrir Google Maps con lat/lng.
