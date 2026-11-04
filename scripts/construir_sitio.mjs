#!/usr/bin/env node
// Copia web/ y skills/ a _site/ y bloquea la publicación si encuentra secretos, datos personales
// o faltan archivos obligatorios. Los secretos de Actions nunca se escriben en el sitio.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITIO = path.join(RAIZ, '_site');
fs.rmSync(SITIO, { recursive: true, force: true });
fs.cpSync(path.join(RAIZ, 'web'), SITIO, { recursive: true });
fs.cpSync(path.join(RAIZ, 'skills'), path.join(SITIO, 'skills'), { recursive: true });
fs.writeFileSync(path.join(SITIO, '.nojekyll'), '');

const obligatorios = ['index.html', 'assets/app.js', 'assets/kpis.js', 'assets/styles.css', 'data/panel.json',
  'skills/propuesta-portafolio/SKILL.md', 'skills/revision-cumplimiento/SKILL.md'];
const errores = [];
for (const f of obligatorios) if (!fs.existsSync(path.join(SITIO, f))) errores.push('Falta archivo obligatorio: ' + f);

const PATRONES = [
  [/sk-ant-[A-Za-z0-9_-]{10,}/, 'API key de Anthropic'],
  [/\b\d{8,10}:[A-Za-z0-9_-]{30,}\b/, 'token de bot de Telegram'],
  [/xi-api-key\s*[:=]/i, 'API key de ElevenLabs'],
  [/\bsk_[a-f0-9]{32,}\b/, 'API key de ElevenLabs'],
  [/x-valoria-key\s*[:=]\s*["']?[A-Za-z0-9]{12,}/i, 'clave del webhook'],
  [/ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/, 'token de GitHub'],
  [/"(usuario_ps|chat_id|texto_solicitud|decidido_por)"\s*:/, 'campo personal en datos públicos'],
  [/[\w.+-]+@(gmail|hotmail|outlook|yahoo)\.com/i, 'correo personal']
];
const avisos = [];
function recorrer(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { recorrer(p); continue; }
    if (!/\.(html|js|json|css|md|txt)$/.test(e.name)) continue;
    const txt = fs.readFileSync(p, 'utf8');
    for (const [re, que] of PATRONES) if (re.test(txt)) errores.push(que + ' detectado en ' + path.relative(SITIO, p));
  }
}
recorrer(SITIO);
const html = fs.readFileSync(path.join(SITIO, 'index.html'), 'utf8');
if (/REEMPLAZAR_AGENT_ID/.test(html)) avisos.push('index.html aún no tiene el agent-id público de ElevenLabs (el widget mostrará la alternativa).');
const panel = JSON.parse(fs.readFileSync(path.join(SITIO, 'data/panel.json'), 'utf8'));
if (panel.origen !== 'export_n8n') avisos.push('El panel usa la MUESTRA local; publica una exportación real de n8n antes de entregar.');

avisos.forEach((a) => console.log('⚠ ' + a));
if (errores.length) { console.error('✗ Publicación bloqueada:\n  ' + errores.join('\n  ')); process.exit(1); }
console.log('✓ _site listo (' + obligatorios.length + ' archivos obligatorios, sin secretos detectados)');
