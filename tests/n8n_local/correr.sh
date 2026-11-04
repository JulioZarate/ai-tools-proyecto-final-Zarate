#!/usr/bin/env bash
# Prueba de integración LOCAL del workflow de n8n (opcional; no sustituye la prueba en n8n Cloud).
# Requisitos: Node >= 24, n8n instalado (N8N_BIN), python3. Usa un simulador de Anthropic y no llama a Telegram.
# Uso: N8N_BIN=/ruta/a/n8n bash tests/n8n_local/correr.sh
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
N8N_BIN="${N8N_BIN:-n8n}"
TMP="${TMP_N8N:-/tmp/valoria-n8n-prueba}"
rm -rf "$TMP" && mkdir -p "$TMP/home" "$TMP/wf"
export N8N_USER_FOLDER="$TMP/home" N8N_DIAGNOSTICS_ENABLED=false N8N_PERSONALIZATION_ENABLED=false N8N_LOG_LEVEL=warn \
       N8N_PORT=5690 N8N_LISTEN_ADDRESS=127.0.0.1 N8N_RUNNERS_ENABLED=true N8N_SECURE_COOKIE=false

node "$RAIZ/n8n/build_workflows.mjs" --test "$TMP/wf" >/dev/null
# WF0 en prueba: disparador por webhook para poder ejecutarlo con el servidor en marcha.
node -e '
const fs=require("fs"),d=process.argv[1];
const ids={"WF0_crear_tablas.json":"valoriaPruebaWF0","WF1_valoria_principal.json":"valoriaPruebaWF1","WF2_export_sanitizado.json":"valoriaPruebaWF2"};
for (const [f,id] of Object.entries(ids)){ const w=JSON.parse(fs.readFileSync(d+"/"+f)); w.id=id; w.active=false;
  if(f.startsWith("WF0")){ const t=w.nodes.find(n=>n.type==="n8n-nodes-base.manualTrigger"); t.type="n8n-nodes-base.webhook"; t.typeVersion=2; t.parameters={httpMethod:"POST",path:"valoria-setup-prueba",responseMode:"lastNode",options:{}}; t.webhookId="valoria-setup-prueba"; }
  fs.writeFileSync(d+"/"+f, JSON.stringify(w)); }' "$TMP/wf"

for f in "$TMP"/wf/WF*.json; do "$N8N_BIN" import:workflow --input="$f" >/dev/null 2>&1; done
for id in valoriaPruebaWF0 valoriaPruebaWF1 valoriaPruebaWF2; do "$N8N_BIN" publish:workflow --id="$id" >/dev/null 2>&1 || "$N8N_BIN" update:workflow --id="$id" --active=true >/dev/null 2>&1; done

node "$RAIZ/tests/n8n_local/mock_anthropic.mjs" > "$TMP/mock.log" 2>&1 & MOCK=$!
(cd "$RAIZ" && python3 -m http.server 8788 --bind 127.0.0.1 > "$TMP/static.log" 2>&1) & STATIC=$!
"$N8N_BIN" start > "$TMP/n8n.log" 2>&1 & N8N=$!
trap 'kill $MOCK $STATIC $N8N 2>/dev/null || true' EXIT
for i in $(seq 1 90); do curl -sf http://127.0.0.1:5690/healthz >/dev/null 2>&1 && break; sleep 2; done
sleep 3
node "$RAIZ/tests/n8n_local/escenarios.mjs"
