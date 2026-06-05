# Arquitectura - MotoGestion.ar

## Objetivo

MotoGestion debe funcionar como un sistema vendible para talleres de motos: ordenar el trabajo diario, documentar servicios, emitir comprobantes verificables, cobrar suscripciones y construir reputacion publica basada en datos reales.

## Regla principal

No escribir codigo sin contrato de datos y flujo definido.

Cada modulo debe respetar responsabilidad unica:

- UI: muestra datos y captura acciones.
- Application: ejecuta casos de uso.
- Domain: contiene reglas puras del negocio.
- Data: lee y escribe datos.
- Infrastructure: integra Firebase, Mercado Pago, email, PDF, mapas y APIs externas.

## Capas de la app

```txt
React UI
  -> casos de uso
    -> reglas de dominio
      -> repositorios
        -> Firebase / localStorage / APIs / Storage
```

La UI no debe decidir reglas de negocio. Ejemplo: un boton puede pedir "cerrar orden", pero la regla de si la orden puede cerrarse vive en application/domain.

## Dominios principales

```txt
auth
users
workshops
subscriptions
clients
bikes
workOrders
estimates
payments
receipts
ratings
reputation
admin
publicNetwork
```

## Estructura objetivo

```txt
src/
  app/
    App.jsx
    routes.js
    providers/

  modules/
    auth/
      ui/
      application/
      domain/
      data/

    subscriptions/
      ui/
      application/
      domain/
      data/

    workOrders/
      ui/
      application/
      domain/
      data/

    receipts/
      ui/
      application/
      domain/
      data/

    reputation/
      ui/
      application/
      domain/
      data/

  shared/
    ui/
    utils/
    constants/
    contracts/

  infrastructure/
    firebase/
    mercadoPago/
    email/
    pdf/
    maps/
```

## Landing

La landing `motogestion.ar` no debe leer datos privados de `users/{uid}`.

Debe consumir solo datos publicos:

```txt
publicWorkshops/{publicSlug}
workshopReputation/{uid}
publicPrices
publicNetworkStats
```

La landing vende el producto. La app administra el taller. El portal publico valida comprobantes.

## Regla para APIs Vercel

El plan actual tiene limite de funciones serverless. No crear archivos nuevos en `api/` sin revisar el limite.

Si se necesita un endpoint nuevo, preferir:

```txt
api/verify-document.js?mode=...
api/mp-create-preference.js?mode=...
api/push-send-recordatorios.js?mode=...
```

## Migracion segura

No reescribir todo de una vez.

Orden recomendado:

1. Documentar contratos.
2. Congelar nombres de campos y estados.
3. Extraer funciones puras sin cambiar comportamiento.
4. Crear repositorios por modulo.
5. Reemplazar pantallas grandes por casos de uso.
6. Probar flujo real.
7. Recién ahi mejorar UI.
