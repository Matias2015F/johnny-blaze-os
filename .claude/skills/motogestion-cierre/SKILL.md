---
name: motogestion-cierre
description: Protocolo manual de cierre de ticket MotoGestion. Invocar al terminar una sesion de trabajo. NO ejecuta commits ni deploys automaticamente — todo requiere confirmacion explicita del usuario.
disable-model-invocation: true
---

# Skill: MotoGestion — Cierre de Sesion

**Comando:** `/cierre`

Invocar al terminar una sesion de trabajo antes de cerrar Claude Code.
Este skill no ejecuta codigo. Genera el traspaso completo para que la proxima sesion
arranque con contexto total sin preguntas.

IMPORTANTE: Ningun commit ni deploy se ejecuta sin confirmacion explicita del usuario.
Si el usuario no confirma cada paso, el skill se detiene y reporta el estado pendiente.

---

## PROTOCOLO DE CIERRE — 6 pasos obligatorios

Al invocar `/cierre`, ejecutar en orden:

### Paso 1 — Verificar estado del repo

```bash
git status
git log --oneline -5
```

- Si hay archivos modificados sin commitear: reportarlos y DETENERSE. No continuar hasta que el usuario decida.
- Si el repo esta limpio: continuar al Paso 2.

### Paso 2 — Verificar produccion

```bash
curl https://app.motogestion.ar/version.json
```

Reportar: SHA local vs SHA en produccion.
- Si no coinciden: advertir y preguntar al usuario si quiere deployar antes de cerrar.
- NO ejecutar deploy automaticamente. Solo sugerir el comando y esperar confirmacion.

### Paso 2b — Verificacion de build (pasiva)

Antes de consolidar el cierre, reportar sin correr comandos:
- Si el ultimo `npm run build` dejo advertencias conocidas en hooks nuevos.
- Si algun import en las vistas apunta a logica movida al hook pero quedo duplicada.
- Registrar deuda activa en la tarjeta de cierre.

Si el usuario quiere ejecutar lint/build antes de cerrar, sugerir los comandos y esperar confirmacion:

```bash
npm run lint
npm run build
```

NO ejecutarlos automaticamente.

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

Mostrar el diff antes de escribir. Si el usuario no confirma, no escribir.

### Paso 4 — Actualizar `.clou/skills/motogestion/SKILL.md`

En la seccion "BACKLOG SRP — ESTADO VERIFICADO":
- Mover a DONE los hooks extraidos en esta sesion
- Agregar al backlog cualquier nuevo candidato identificado
- Actualizar la fecha y commit de la ultima verificacion

Mostrar el diff antes de escribir. Si el usuario no confirma, no escribir.

### Paso 5 — Actualizar `.clou/ESTADO.md`

Verificar si los campos de HEAD en produccion y ultima sesion estan desactualizados.
Si lo estan, proponer el contenido nuevo y esperar confirmacion antes de escribir.

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
   - .clou/ESTADO.md                     -> sincronizado
   - C:\Users\Usuario\Downloads\motogestion-cierre-[FECHA].txt -> backup externo

2. HITOS FIJADOS EN ESTA SESION
   [lista de cambios concretos con archivo y SHA]

3. BACKLOG REMANENTE — PROXIMO EN LA TRINCHERA
   P1: [nombre del hook o tarea mas urgente pendiente]
   P2: [segundo en la lista]
   Deuda critica: [deadline o riesgo activo mas importante]

4. BLOQUEO DE CONFIRMACION
   Contexto congelado. Archivos actualizados. Produccion verificada.
   La sesion NO se considera cerrada hasta que el usuario confirme con "OK".
   Para reanudar: /motogestion o "continuamos con MotoGestion"
   Para limpiar contexto: /clear
================================================================================
```

La sesion permanece abierta hasta recibir confirmacion explicita del usuario.

---

## REGLAS DEL CIERRE

- No cerrar si hay cambios sin commitear (`git status` limpio es condicion de salida)
- No cerrar si produccion no refleja el ultimo commit — advertir, pero no deployar automaticamente
- Si hay deuda tecnica critica sin resolver, dejarla explicitamente en la tarjeta de cierre
- El archivo `contexto-motogestion-actual.md` SIEMPRE debe quedar actualizado antes de cerrar
- La tarjeta de cierre es el unico documento que el usuario necesita para reanudar — debe ser autocontenida
- NO ejecutar `git commit` sin confirmacion explicita del usuario
- NO ejecutar `npx vercel --prod` sin confirmacion explicita del usuario
- Al finalizar el protocolo, sugerir `/clear` para limpiar el contexto de la sesion

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
| Estado general del proyecto | `.clou/ESTADO.md` |
| Historial de commits | `git log` (fuente de verdad) |
| Tarjeta de traspaso rapido | Generada por este skill, copiada por el usuario |
