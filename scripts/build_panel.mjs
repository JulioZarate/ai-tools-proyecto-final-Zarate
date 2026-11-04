#!/usr/bin/env node
// Construye web/data/panel.json a partir de la exportación sanitizada de n8n.
// Entrada (primera que exista): datos/export/export_sanitizado.json  →  datos/muestra/export_muestra.json
// Falla (exit 1) si la entrada no cumple el esquema o contiene campos personales.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const K = require(path.join(RAIZ, 'web/assets/kpis.js'));

const candidatos = [
  { archivo: 'datos/export/export_sanitizado.json', origen: 'export_n8n', etiqueta: 'Exportación sanitizada de n8n Cloud (casos de prueba con datos ficticios)' },
  { archivo: 'datos/muestra/export_muestra.json', origen: 'muestra_simulador', etiqueta: 'MUESTRA: ejecución local de n8n con simulador de la API (tokens y costos simulados, no reales)' }
];
const elegido = candidatos.find((c) => fs.existsSync(path.join(RAIZ, c.archivo)));
if (!elegido) { console.error('✗ No hay exportación ni muestra.'); process.exit(1); }
const exp = JSON.parse(fs.readFileSync(path.join(RAIZ, elegido.archivo), 'utf8'));

export const CAMPOS_PROHIBIDOS = ['usuario_ps', 'usuario_raw', 'chat_id', 'texto_solicitud', 'texto', 'resumen', 'entrada_resumen', 'salida_resumen', 'decidido_por', 'monto_mxn', 'requerimiento_json'];
const errores = [];
if (exp.esquema !== 'valoria-export/1') errores.push('esquema distinto de valoria-export/1');
if (exp.datos_ficticios !== true) errores.push('datos_ficticios debe ser true');
for (const k of ['casos', 'costos', 'traza']) if (!Array.isArray(exp[k])) errores.push('falta arreglo ' + k);
const revisar = (filas, nombre) => filas.forEach((f, i) => { for (const p of CAMPOS_PROHIBIDOS) if (p in f) errores.push(nombre + '[' + i + '] contiene campo personal "' + p + '"'); });
if (!errores.length) { revisar(exp.casos, 'casos'); revisar(exp.costos, 'costos'); revisar(exp.traza, 'traza'); }
for (const c of exp.casos || []) if (!/^VAL-\d{6}-[A-Z0-9]{4}$/.test(c.caso_id)) errores.push('caso_id inválido ' + c.caso_id);
if (errores.length) { console.error('✗ Exportación rechazada:\n  ' + errores.slice(0, 20).join('\n  ')); process.exit(1); }

const fechas = exp.casos.map((c) => c.creado_en).filter(Boolean).sort();
// Agentes que aportaron por caso (para la tabla de detalle).
const agentesPorCaso = {};
for (const t of exp.traza) {
  if (!['A1', 'A2', 'A3', 'A4'].includes(t.agente)) continue;
  (agentesPorCaso[t.caso_id] = agentesPorCaso[t.caso_id] || new Set()).add(t.agente);
}
const casos = exp.casos.map((c) => ({ ...c, agentes: agentesPorCaso[c.caso_id] ? [...agentesPorCaso[c.caso_id]].sort().join(',') : '' }))
  .sort((a, b) => (a.creado_en < b.creado_en ? 1 : -1));
const panel = {
  esquema: 'valoria-panel/1',
  generado_en: new Date().toISOString(),
  exportado_en: exp.generado_en,
  origen: elegido.origen,
  fuente: elegido.etiqueta,
  datos_ficticios: true,
  periodo: { desde: fechas[0] || null, hasta: fechas[fechas.length - 1] || null },
  kpis: K.calcularKPIs(casos),
  estados: K.contarEstados(casos),
  costo_por_agente: K.costoPorAgente(exp.costos),
  totales: { casos: casos.length, llamadas_llm: exp.costos.length, costo_usd: Math.round(exp.costos.reduce((a, k) => a + k.costo_usd, 0) * 1e6) / 1e6 },
  costos: exp.costos.map((k) => ({ caso_id: k.caso_id, agente: k.agente, costo_usd: k.costo_usd, tokens_entrada: k.tokens_entrada, tokens_salida: k.tokens_salida })),
  casos
};
fs.mkdirSync(path.join(RAIZ, 'web/data'), { recursive: true });
fs.writeFileSync(path.join(RAIZ, 'web/data/panel.json'), JSON.stringify(panel, null, 2) + '\n');
console.log('✓ web/data/panel.json · origen=' + panel.origen + ' · casos=' + casos.length + ' · llamadas=' + exp.costos.length);
