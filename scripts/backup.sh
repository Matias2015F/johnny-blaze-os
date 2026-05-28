#!/usr/bin/env bash
# backup.sh — Copia los archivos críticos del Baseline de Oro a backups/YYYY-MM-DD_HHMM/
# Uso: bash scripts/backup.sh
# Ejecutar desde la raíz del proyecto.

set -e

BASE="$(cd "$(dirname "$0")/.." && pwd)"
TS=$(date +"%Y-%m-%d_%H%M")
BK="$BASE/backups/$TS"

mkdir -p "$BK/src/lib"
mkdir -p "$BK/src/services"
mkdir -p "$BK/src/utils"
mkdir -p "$BK/api"

FILES=(
  "src/App.jsx"
  "src/TallerPanel.jsx"
  "src/lib/storage.js"
  "src/services/saasService.js"
  "src/services/counterService.js"
  "src/utils/format.js"
  "api/mp-webhook.js"
  "api/mp-create-preference.js"
  "api/_firebase-admin.js"
  "firestore.rules"
  "vercel.json"
  "CLAUDE.md"
  "DIRECTIVES.md"
)

COUNT=0
MISSING=()

for f in "${FILES[@]}"; do
  if [ -f "$BASE/$f" ]; then
    cp "$BASE/$f" "$BK/$f"
    COUNT=$((COUNT + 1))
  else
    MISSING+=("$f")
  fi
done

GIT_HEAD=$(cd "$BASE" && git rev-parse HEAD 2>/dev/null || echo "no-git")

# Manifiesto JSON
cat > "$BK/BACKUP_MANIFEST.json" <<EOF
{
  "timestamp": "$TS",
  "trigger": "manual",
  "git_head": "$GIT_HEAD",
  "files_copied": $COUNT,
  "files_missing": $(printf '%s\n' "${MISSING[@]}" | jq -R . | jq -s . 2>/dev/null || echo "[]")
}
EOF

echo ""
echo "Backup listo: backups/$TS/"
echo "Archivos copiados: $COUNT / ${#FILES[@]}"
[ ${#MISSING[@]} -gt 0 ] && echo "Archivos no encontrados: ${MISSING[*]}"
echo "Git HEAD: $GIT_HEAD"
echo ""

# Alerta si hay demasiados backups
BACKUP_COUNT=$(ls -d "$BASE/backups"/*/ 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 20 ]; then
  echo "AVISO: Hay $BACKUP_COUNT backups acumulados. Revisar y limpiar manualmente."
fi
