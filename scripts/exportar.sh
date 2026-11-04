#!/usr/bin/env bash
# Descarga la exportación sanitizada desde n8n Cloud y regenera panel, costos y matriz.
# Variables (no las guardes en el repo):  VALORIA_EXPORT_URL  (URL de producción del webhook valoria-export)
#                                        VALORIA_KEY         (valor del encabezado x-valoria-key)
# Frecuencia documentada: manual, después de cada sesión de pruebas y antes de entregar. Retraso esperado: minutos.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${VALORIA_EXPORT_URL:?Define VALORIA_EXPORT_URL}"
: "${VALORIA_KEY:?Define VALORIA_KEY}"
mkdir -p datos/export
curl -sSf -H "x-valoria-key: ${VALORIA_KEY}" "${VALORIA_EXPORT_URL}" -o datos/export/export_sanitizado.json.tmp
node -e 'const j=JSON.parse(require("fs").readFileSync("datos/export/export_sanitizado.json.tmp","utf8")); const x=Array.isArray(j)?j[0]:j; if(x.esquema!=="valoria-export/1") throw new Error("esquema inesperado"); require("fs").writeFileSync("datos/export/export_sanitizado.json", JSON.stringify(x,null,2));'
rm datos/export/export_sanitizado.json.tmp
node scripts/build_panel.mjs
node scripts/costos.mjs
echo "Listo. Revisa con: git diff --stat ; luego: git add datos/export web/data costos && git commit -m 'Actualiza datos sanitizados' && git push"
