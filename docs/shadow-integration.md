# Shadow Integration

El modo sombra conecta la arquitectura nueva con el flujo legacy sin bloquear acciones reales.

## Qué es

Es una capa de lectura que calcula decisiones con la arquitectura nueva y las compara contra el estado actual.

## Qué problema resuelve

Permite validar que las reglas nuevas coinciden con el comportamiento actual antes de reemplazar nada.

## Qué decisiones calcula

- decisión de PDF de orden
- próxima acción sugerida
- warnings de bloqueo
- divergencias entre legacy y dominio

## Qué no modifica

- no escribe datos
- no toca Firestore
- no toca backend
- no toca PDF real
- no cambia estados
- no bloquea acciones

## Por qué va antes de activar reglas reales

Porque primero hay que medir la divergencia entre el flujo viejo y el nuevo sin afectar al usuario.

## Cómo se debería usar después

Primero se puede mostrar en una pantalla de lectura o en un panel lateral.  
Después, si las decisiones coinciden con el flujo real, se puede pasar a bloqueo progresivo.

## Cómo detectar divergencias

Comparando:

- `permitido`
- `codigo`
- `motivos`
- `accionSugerida`

Si el legacy y el dominio no coinciden, la integración sombra lo reporta en `divergencias`.

## Archivos todavía no conectados

- `src/components/OrderDetailView.jsx`
- `src/views/ConfigView.jsx`
- `src/TallerPanel.jsx`
- `src/lib/storage.js`
- `api/*`

