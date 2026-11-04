// Integridad del paquete: workflows sincronizados con fuentes, sin secretos, panel sanitizado y costos conciliados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');
const K = require(path.join(RAIZ, 'web/assets/kpis.js'));

function csv(p) {
  const lineas = leer(p).trim().split(/\r?\n/);
  const parse = (l) => { const out = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };
  const cab = parse(lineas[0]);
  return { cab, filas: lineas.slice(1).map((l) => Object.fromEntries(parse(l).map((v, i) => [cab[i], v]))) };
}

test('n8n: los JSON exportados coinciden con n8n/fuentes y agentes/', () => {
  execFileSync(process.execPath, [path.join(RAIZ, 'n8n/build_workflows.mjs'), '--check'], { stdio: 'pipe' });
});

test('n8n: el cálculo y la revisión dentro de los nodos Code son idénticos a agentes/*.js', () => {
  const wf = JSON.parse(leer('n8n/WF1_valoria_principal.json'));
  const quitar = (s) => s.replace(/\/\/ <export>[\s\S]*?\/\/ <\/export>\n?/, '');
  const calc = quitar(leer('agentes/calculo_portafolio.js'));
  const rev = quitar(leer('agentes/revision_cumplimiento.js'));
  const nodo = (n) => wf.nodes.find((x) => x.name === n).parameters.jsCode;
  assert.ok(nodo('A3 preparar').includes(calc));
  assert.ok(nodo('A2 preparar').includes(calc));
  assert.ok(nodo('A4 preparar').includes(rev));
});

test('n8n: una sola entrada Telegram, voz autenticada y sin secretos ni IDs personales', () => {
  const todos = ['WF0_crear_tablas.json', 'WF1_valoria_principal.json', 'WF2_export_sanitizado.json'].map((f) => [f, leer('n8n/' + f)]);
  const wf1 = JSON.parse(todos[1][1]);
  assert.equal(wf1.nodes.filter((n) => n.type === 'n8n-nodes-base.telegramTrigger').length, 1);
  const voz = wf1.nodes.find((n) => n.name === 'Webhook voz (ElevenLabs)');
  assert.equal(voz.parameters.authentication, 'headerAuth');
  for (const [f, txt] of todos) {
    assert.ok(!/sk-ant-[A-Za-z0-9_-]{10,}/.test(txt), f + ': posible API key de Anthropic');
    assert.ok(!/\b\d{8,10}:[A-Za-z0-9_-]{30,}\b/.test(txt), f + ': posible token de bot de Telegram');
    assert.ok(!/xi-api-key|sk_[a-f0-9]{30,}/i.test(txt), f + ': posible clave de ElevenLabs');
    assert.ok(!/'\d{6,12}': '(asesor|analista)'/.test(txt), f + ': ID real de Telegram en CONFIG (usa scripts/sanitizar_n8n.mjs)');
    assert.ok(!/asesor_chat_id: '\d{5,}'/.test(txt), f + ': chat ID real en CONFIG');
  }
});

test('panel: esquema, rótulo de ficticio, sin campos personales y KPIs reproducibles', () => {
  const p = JSON.parse(leer('web/data/panel.json'));
  assert.equal(p.esquema, 'valoria-panel/1');
  assert.equal(p.datos_ficticios, true);
  assert.ok(p.fuente && p.generado_en);
  const prohibidos = ['usuario_ps', 'chat_id', 'texto_solicitud', 'resumen', 'decidido_por', 'monto_mxn', 'entrada_resumen', 'salida_resumen'];
  for (const c of p.casos) for (const k of prohibidos) assert.ok(!(k in c), 'campo personal ' + k);
  assert.deepEqual(K.calcularKPIs(p.casos), p.kpis, 'los KPIs publicados no coinciden con la fórmula');
  const costo = Math.round(p.costos.reduce((a, k) => a + k.costo_usd, 0) * 1e6) / 1e6;
  assert.equal(costo, p.totales.costo_usd);
});

test('costos.csv: columnas obligatorias y fórmula Ci conciliada', () => {
  const { cab, filas } = csv('costos/costos.csv');
  const req = ['fecha_hora', 'caso_id', 'llamada_id', 'etapa', 'agente', 'proveedor', 'modelo', 'tokens_entrada', 'tokens_salida', 'tokens_cache', 'duracion_voz_seg', 'unidad_cobro', 'tarifa_entrada', 'tarifa_salida', 'costo_usd', 'moneda', 'estado', 'reintento', 'origen_dato'];
  for (const c of req) assert.ok(cab.includes(c), 'falta columna ' + c);
  assert.ok(filas.length > 0);
  const ids = new Set();
  for (const f of filas) {
    assert.ok(!ids.has(f.llamada_id), 'llamada_id duplicado ' + f.llamada_id); ids.add(f.llamada_id);
    assert.ok(f.origen_dato, 'sin origen_dato en ' + f.llamada_id);
    if (f.unidad_cobro === 'tokens') {
      const esperado = (Number(f.tokens_entrada) * Number(f.tarifa_entrada) + Number(f.tokens_salida) * Number(f.tarifa_salida)) / 1e6;
      assert.ok(Math.abs(esperado - Number(f.costo_usd)) < 2e-6, f.llamada_id + ': costo ' + f.costo_usd + ' ≠ ' + esperado);
    }
  }
});

test('pruebas.csv: matriz mínima P01–P14 con columnas exigidas', () => {
  const { cab, filas } = csv('tests/pruebas.csv');
  for (const c of ['id', 'fecha', 'version', 'caso_id', 'entrada', 'resultado_esperado', 'resultado_obtenido', 'estado', 'evidencia']) assert.ok(cab.includes(c), 'falta ' + c);
  for (let i = 1; i <= 14; i++) assert.ok(filas.some((f) => f.id === 'P' + String(i).padStart(2, '0')), 'falta P' + i);
});
