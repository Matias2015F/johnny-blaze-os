---
name: cierre-sesion-motogestion
description: Protocolo de salida automatizado para MotoGestion / Johnny Blaze OS. Genera copias de seguridad de contexto, actualiza el checkpoint de arquitectura y valida el estado limpio del repositorio.
disable-model-invocation: false
---

# Skill: MotoGestion — Cierre de Sesion

**Comando:** `/cierre`

Invocar al terminar una sesion de trabajo antes de cerrar Claude Code.
Este skill no ejecuta codigo. Genera el traspaso completo para que la proxima sesion
arranque con contexto total sin preguntas.

---

## PROTOCOLO DE CIERRE — 6 pasos obligatorios

Al invocar `/cierre`, ejecutar en orden:

### Paso 1 — Verificar produccion

```bash
# Confirmar que el ultimo commit esta en produccion:
curl https://app.motogestion.ar/version.json
git log --oneline -5
```

Reportar: SHA local vs SHA en produccion. Si no coinciden, advertir antes de cerrar.

### Paso 2 — Generar resumen de sesion

Responder estas preguntas basandose en lo trabajado en la sesion actual:

```
QUE SE HIZO:
  - [lista de cambios concretos con archivo y descripcion]

COMMITS GENERADOS:
  - [SHA corto] [mensaje] — [fecha]

DECISIONES TOMADAS:
  - [decisiones de arquitectura, patrones adoptados, descartados]

PROBLEMAS ENCONTRADOS Y COMO SE RESOLVIERON:
  - [problema] -> [solucion]

ESTADO DE PRODUCCION AL CIERRE:
  - Commit: [SHA]
  - Build: [timestamp del version.json]
  - URL verificada: app.motogestion.ar
```

### Paso 2b — Verificacion de build y hooks huerfanos

Antes de consolidar el cierre, ejecutar lectura pasiva (sin correr comandos):
- Verificar que el ultimo `npm run build` no dejo advertencias activas en los hooks nuevos
- Confirmar que ningun import en las vistas apunta a logica que fue movida al hook pero quedo duplicada
- Si hay advertencias conocidas sin resolver, registrarlas en la tarjeta de cierre como DEUDA ACTIVA

### Paso 2c — Escribir backup externo en Downloads

Usando la herramienta `Write` (nunca terminal), crear un archivo de contingencia fuera del repo:

Ruta: `C:\Users\Usuario\Downloads\motogestion-cierre-[YYYY-MM-DD].txt`

Contenido: la tarjeta de cierre completa del Paso 6 (ver mas abajo).
Esto garantiza un respaldo legible aunque no se tenga acceso al repo Git.

### Paso 3 — Actualizar `.clou/contexto-motogestion-actual.md`

Usando la herramienta `Write`, actualizar el archivo con:
- Nuevo commit de produccion
- Hooks marcados como DONE (mover de PENDIENTES a DONE en la tabla)
- Nuevos pendientes descubiertos durante la sesion
- Alertas tecnicas resueltas o nuevas

### Paso 4 — Actualizar `.clou/skills/motogestion/SKILL.md`

En la seccion "BACKLOG SRP — ESTADO VERIFICADO":
- Mover a DONE los hooks extraidos en esta sesion
- Agregar al backlog cualquier nuevo candidato identificado
- Actualizar la fecha y commit de la ultima verificacion

### Paso 5 — Actualizar memoria persistente

Usando la herramienta `Write` sobre los archivos en:
`C:\Users\Usuario\.claude\projects\C--Users-Usuario\memory\`

Actualizar `project_johnny_blaze.md` con:
- HEAD de produccion nuevo
- Pendientes actualizados
- Cualquier decision nueva que afecte sesiones futuras

### Paso 6 — Reporte de despedida (4 puntos exactos)

Mostrar este bloque estructurado al usuario. No agregar ni quitar puntos.

```
================================================================================
CIERRE DE SESION — MOTOGESTION
Fecha: [fecha actual] | Commit: [SHA] | Build: [timestamp version.json]
================================================================================

1. RESPALDOS CONSOLIDADOS
   - .clou/contexto-motogestion-actual.md -> actualizado
   - .clou/skills/motogestion/SKILL.md   -> backlog actualizado
   - memory/project_johnny_blaze.md       -> memoria actualizada
   - C:\Users\Usuario\Downloads\motogestion-cierre-[FECHA].txt -> backup externo

2. HITOS FIJADOS EN ESTA SESION
   [lista de hooks extraidos o features completadas con commit SHA]

3. BACKLOG REMANENTE — PROXIMO EN LA TRINCHERA
   P1: [nombre del hook o tarea mas urgente pendiente]
   P2: [segundo en la lista]
   Deuda critica: [deadline o riesgo activo mas importante]

4. BLOQUEO DE CONFIRMACION
   Contexto congelado. Archivos actualizados. Produccion verificada.
   La sesion NO se considera cerrada hasta que el usuario confirme con "OK".
   Para reanudar: /motogestion o "continuamos con MotoGestion"
================================================================================
```

La sesion permanece abierta hasta recibir confirmacion explicita del usuario.

---

## REGLAS DEL CIERRE

- No cerrar si hay cambios sin commitear (`git status` limpio es condicion de salida)
- No cerrar si produccion no refleja el ultimo commit (verificar version.json)
- Si hay deuda tecnica critica sin resolver, dejarla explicitamente en la tarjeta de cierre
- El archivo `contexto-motogestion-actual.md` SIEMPRE debe quedar actualizado antes de cerrar
- La tarjeta de cierre es el unico documento que el usuario necesita para reanudar — debe ser autocontenida

---

## PARA LA PROXIMA SESION

Al reanudar, el usuario puede:

**Opcion A — Reanudar con comando:**
```
continuamos con MotoGestion
```
Claude leera `contexto-motogestion-actual.md` automaticamente.

**Opcion B — Reanudar con skill:**
```
/motogestion
```
Activa el supervisor completo: carga contexto, verifica produccion, reporta backlog.

**Opcion C — Reanudar con tarjeta:**
Pegar la tarjeta de cierre en el primer mensaje de la nueva sesion.
Es la opcion mas rapida si no se tiene acceso al repo.

---

## QUE PRESERVA ESTE PROTOCOLO

| Categoria | Donde queda guardado |
|---|---|
| Progreso de hooks SRP | `.clou/skills/motogestion/SKILL.md` seccion backlog |
| Estado de produccion | `.clou/contexto-motogestion-actual.md` |
| Decisiones de arquitectura | `.clou/directives/*.md` |
| Reglas de sesion y entorno | `CLAUDE.md` + `.clou/COMANDOS.md` |
| Memoria cross-sesion | `C:\Users\Usuario\.claude\projects\...\memory\project_johnny_blaze.md` |
| Historial de commits | `git log` (fuente de verdad) |
| Tarjeta de traspaso rapido | Generada por este skill, copiada por el usuario |
