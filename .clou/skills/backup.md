# Skill: Backup de Archivos Críticos

## Propósito

SOP obligatorio antes de cualquier sesión de mejoras. Copia los archivos del Baseline de Oro a `backups/YYYY-MM-DD_HHMM/` para permitir restauración exacta si algo falla.

---

## Cuándo ejecutar

- **Antes de cualquier sesión** en la que se vayan a modificar archivos del Baseline de Oro.
- **Antes de activar el modo `/plan`** con cambios que toquen más de un archivo.
- **Antes de un deploy** a producción si los cambios no fueron validados con build limpio.
- **No ejecutar** si ya existe un backup con menos de 30 minutos de antigüedad (verificar carpeta `backups/`).

---

## Archivos que siempre se respaldan

```
src/App.jsx
src/TallerPanel.jsx
src/lib/storage.js
src/services/saasService.js
src/services/counterService.js
src/utils/format.js
api/mp-webhook.js
api/mp-create-preference.js
api/_firebase-admin.js
firestore.rules
vercel.json
CLAUDE.md
DIRECTIVES.md
```

---

## Procedimiento paso a paso

### Paso 1 — Determinar timestamp

```bash
TS=$(date +"%Y-%m-%d_%H%M")
BK="backups/$TS"
```

### Paso 2 — Crear estructura de directorios

```bash
mkdir -p "$BK/src/lib"
mkdir -p "$BK/src/services"
mkdir -p "$BK/src/utils"
mkdir -p "$BK/api"
```

### Paso 3 — Copiar archivos críticos

```bash
BASE="." # raíz del proyecto

cp "$BASE/src/App.jsx"                   "$BK/src/App.jsx"
cp "$BASE/src/TallerPanel.jsx"           "$BK/src/TallerPanel.jsx"
cp "$BASE/src/lib/storage.js"            "$BK/src/lib/storage.js"
cp "$BASE/src/services/saasService.js"   "$BK/src/services/saasService.js"
cp "$BASE/src/services/counterService.js" "$BK/src/services/counterService.js"
cp "$BASE/src/utils/format.js"           "$BK/src/utils/format.js"
cp "$BASE/api/mp-webhook.js"             "$BK/api/mp-webhook.js"
cp "$BASE/api/mp-create-preference.js"   "$BK/api/mp-create-preference.js"
cp "$BASE/api/_firebase-admin.js"        "$BK/api/_firebase-admin.js"
cp "$BASE/firestore.rules"               "$BK/firestore.rules"
cp "$BASE/vercel.json"                   "$BK/vercel.json"
cp "$BASE/CLAUDE.md"                     "$BK/CLAUDE.md"
cp "$BASE/DIRECTIVES.md"                 "$BK/DIRECTIVES.md"
```

### Paso 4 — Escribir el manifiesto

```bash
GIT_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "no-git")
cat > "$BK/BACKUP_MANIFEST.json" <<EOF
{
  "timestamp": "$TS",
  "trigger": "pre-session",
  "git_head": "$GIT_HEAD",
  "files": [
    "src/App.jsx", "src/TallerPanel.jsx", "src/lib/storage.js",
    "src/services/saasService.js", "src/services/counterService.js",
    "src/utils/format.js", "api/mp-webhook.js",
    "api/mp-create-preference.js", "api/_firebase-admin.js",
    "firestore.rules", "vercel.json", "CLAUDE.md", "DIRECTIVES.md"
  ]
}
EOF
```

### Paso 5 — Confirmar al usuario

Reportar: `Backup listo en backups/$TS/ — 13 archivos copiados. Git HEAD: $GIT_HEAD.`
No continuar con ninguna modificación hasta dar esta confirmación.

---

## Protocolo de restauración

Si un cambio rompe el build o el comportamiento esperado:

1. **No hacer parches rápidos.** Restaurar primero.
2. Identificar el backup más reciente previo al cambio:
   ```bash
   ls -lt backups/ | head -5
   ```
3. Copiar los archivos afectados de vuelta desde el backup:
   ```bash
   cp backups/TIMESTAMP/src/App.jsx src/App.jsx
   # ... archivo por archivo, solo los que se modificaron
   ```
4. Verificar con `npm run build` que el baseline se restauró.
5. Identificar qué regla de la directiva se omitió antes de reintentar.

---

## Reglas de retención

- **Prohibido borrar** cualquier carpeta de backups sin confirmación explícita del usuario.
- **Máximo 20 backups** en la carpeta. Si se supera ese número, informar al usuario y esperar instrucción antes de limpiar.
- Los backups no se suben al repositorio git (verificar que `backups/` esté en `.gitignore`).

---

## Comando rápido (script)

Ver `scripts/backup.sh` para ejecución en una línea:
```bash
bash scripts/backup.sh
```
