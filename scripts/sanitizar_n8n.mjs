#!/usr/bin/env node
// Limpia un workflow EXPORTADO desde n8n Cloud antes de guardarlo en el repo:
// IDs de Telegram en CONFIG → REEMPLAZAR_*, IDs de credenciales → REEMPLAZAR, datos fijados (pinData) → vacío.
// Uso: node scripts/sanitizar_n8n.mjs ruta/al/export.json > n8n/exportado_desde_cloud.json
import fs from 'node:fs';
const wf = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
wf.pinData = {};
delete wf.staticData;
for (const n of wf.nodes || []) {
  if (n.credentials) for (const k of Object.keys(n.credentials)) n.credentials[k].id = 'REEMPLAZAR';
  if (n.parameters && typeof n.parameters.jsCode === 'string') {
    n.parameters.jsCode = n.parameters.jsCode
      .replace(/'(\d{5,})': '(asesor|analista)'/g, (_, __, rol) => "'REEMPLAZAR_ID_TELEGRAM_" + rol.toUpperCase() + "': '" + rol + "'")
      .replace(/asesor_chat_id: '[-\d]+'/, "asesor_chat_id: 'REEMPLAZAR_CHAT_ID_ASESOR'");
  }
  delete n.webhookId;
}
process.stdout.write(JSON.stringify(wf, null, 2) + '\n');
