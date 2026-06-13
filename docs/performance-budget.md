# Presupuesto de rendimiento y carga

Este repositorio adopta rendimiento como requisito estructural. El objetivo es que la primera pantalla sea utilizable rápido, que las visitas posteriores aprovechen la caché y que los módulos pesados se carguen sólo cuando el usuario los necesita.

## Objetivos internos

- Primera pantalla utilizable en menos de 2,5 s.
- Respuesta visual a interacción en menos de 200 ms.
- Sin saltos visuales innecesarios al cargar.
- Segunda visita más rápida que la primera gracias a caché local.
- Módulos pesados bajo demanda.

## Presupuesto interno de arranque

- JavaScript comprimido inicial: 150-200 KB objetivo, 250 KB máximo.
- CSS comprimido inicial: 20-35 KB objetivo, 50 KB máximo.
- Primera pantalla: 300-400 KB objetivo, 500 KB máximo.
- Solicitudes iniciales: menos de 20 objetivo, 30 máximo.

## Estrategia aplicada

- Shell mínimo visible desde el arranque.
- Rutas públicas y panel del taller separadas por carga diferida.
- Service worker con:
  - cache-first para recursos estáticos;
  - network-first para navegación y versionado;
  - sin captura de rutas API privadas.
- Componentes pesados cargados bajo demanda.

## Reglas operativas

- No agregar dependencias pesadas sin justificar el costo de arranque.
- No ampliar el bundle inicial con pantallas que no forman parte de la primera experiencia.
- No tratar igual archivos estáticos, navegación y datos operativos.

## Seguimiento

Cada cambio relevante de UI o navegación debe volver a validar:

- tamaño del bundle inicial;
- tiempo de carga percibido;
- comportamiento offline básico;
- cacheo correcto de shell y activos estáticos.
