#!/usr/bin/env node
// Registro de costos auditable: une filas manuales (desarrollo, plataforma, voz) con las llamadas LLM medidas
// en n8n (export sanitizado) y genera resumen por etapa/caso y proyecciones mensuales.
// Salidas: costos/costos.csv, costos/resumen.md, costos/proyecciones.md
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (p) => path.join(RAIZ, p);
function leerCSV(p) {
  const l = fs.readFileSync(P(p), 'utf8').trim().split(/\r?\n/);
  const parse = (s) => { const o = []; let c = '', q = false; for (const ch of s) { if (ch === '"') q = !q; else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; };
  const cab = parse(l[0]);
  return l.slice(1).map((x) => Object.fromEntries(parse(x).map((v, i) => [cab[i], v])));
}
const celda = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const tarifas = Object.fromEntries(leerCSV('costos/tarifas.csv').map((t) => [t.concepto, Number(t.valor)]));
const fuenteExp = fs.existsSync(P('datos/export/export_sanitizado.json')) ? 'datos/export/export_sanitizado.json' : 'datos/muestra/export_muestra.json';
const real = fuenteExp.includes('export_sanitizado');
const exp = JSON.parse(fs.readFileSync(P(fuenteExp), 'utf8'));

const COLS = ['fecha_hora', 'caso_id', 'llamada_id', 'etapa', 'agente', 'proveedor', 'modelo', 'tokens_entrada', 'tokens_salida', 'tokens_cache', 'duracion_voz_seg', 'unidad_cobro', 'tarifa_entrada', 'tarifa_salida', 'costo_usd', 'moneda', 'estado', 'reintento', 'origen_dato', 'notas'];
const manual = leerCSV('costos/costos_manual.csv');
const llm = exp.costos.map((k) => {
  const cIn = tarifas.llm_entrada, cOut = tarifas.llm_salida;
  const costo = Math.round(((k.tokens_entrada * cIn + k.tokens_salida * cOut) / 1e6) * 1e6) / 1e6;
  return { fecha_hora: k.fecha_hora, caso_id: k.caso_id, llamada_id: k.llamada_id, etapa: k.etapa, agente: k.agente, proveedor: k.proveedor, modelo: k.modelo,
    tokens_entrada: k.tokens_entrada, tokens_salida: k.tokens_salida, tokens_cache: k.tokens_cache || 0, duracion_voz_seg: 0, unidad_cobro: 'tokens',
    // Solo una caída de la API (estado "error") no se cobra; sin_texto/refusal sí consumen tokens reportados.
    tarifa_entrada: cIn, tarifa_salida: cOut, costo_usd: k.estado === 'error' ? 0 : costo, moneda: 'USD', estado: k.estado, reintento: 0,
    origen_dato: real ? (k.origen_dato || 'medido_api') : 'simulado_local_no_facturable',
    notas: k.estado === 'error' ? 'error de API: sin cobro confirmado; tokens estimados' : 'iteracion=' + k.iteracion + (k.estado !== 'ok' ? ' · ' + k.estado + ' (cobrado)' : '') };
}).map((f) => (f.estado === 'error' ? { ...f, tokens_salida: 0, costo_usd: 0, unidad_cobro: 'tokens_estimados' } : f));
const filas = manual.concat(llm);
fs.writeFileSync(P('costos/costos.csv'), COLS.join(',') + '\n' + filas.map((f) => COLS.map((c) => celda(f[c])).join(',')).join('\n') + '\n');

// ---------- Resumen ----------
const suma = (xs) => xs.reduce((a, f) => a + Number(f.costo_usd || 0), 0);
const fmt = (x, d = 6) => Number(x).toFixed(d);
const porEtapa = {};
for (const f of filas) (porEtapa[f.etapa] = porEtapa[f.etapa] || []).push(f);
const COMPLETOS = ['pendiente_aprobacion', 'aprobado_simulado', 'rechazado', 'expirado'];
const FALLIDOS = ['error_api', 'error_validacion', 'error_skill', 'detenido_presupuesto', 'detenido_limite'];
const casos = exp.casos;
const costoCaso = (id) => suma(llm.filter((f) => f.caso_id === id));
const comp = casos.filter((c) => COMPLETOS.includes(c.estado));
const fall = casos.filter((c) => FALLIDOS.includes(c.estado));
const otros = casos.filter((c) => !COMPLETOS.includes(c.estado) && !FALLIDOS.includes(c.estado));
const cProm = comp.length ? suma(comp.map((c) => ({ costo_usd: costoCaso(c.caso_id) }))) / comp.length : 0;
const llamadasProm = comp.length ? llm.filter((f) => comp.some((c) => c.caso_id === f.caso_id)).length / comp.length : 0;
const TC = tarifas.tipo_cambio_mxn_usd;
let md = '# Resumen de costos por etapa y por caso\n\n';
md += '> Fuente de llamadas LLM: `' + fuenteExp + '`' + (real ? ' (medido por la API de Anthropic en n8n Cloud).' : ' — **MUESTRA con simulador local: tokens simulados, no facturables.** Sustituir por la exportación real.') + '\n';
md += '> Fórmula por llamada: Cᵢ = (T_entrada × P_entrada + T_salida × P_salida) / 1 000 000, con P = ' + tarifas.llm_entrada + ' / ' + tarifas.llm_salida + ' USD por millón (Claude Haiku 5.5). Generado: ' + new Date().toISOString().slice(0, 16) + ' UTC.\n\n';
md += '## Por etapa\n\n| Etapa | Filas | Tokens entrada | Tokens salida | Costo USD | Tokenización |\n|---|---:|---:|---:|---:|---|\n';
for (const [e, fs_] of Object.entries(porEtapa)) {
  const tok = fs_.some((f) => f.unidad_cobro.startsWith('tokens'));
  md += '| ' + e + ' | ' + fs_.length + ' | ' + fs_.reduce((a, f) => a + Number(f.tokens_entrada || 0), 0) + ' | ' + fs_.reduce((a, f) => a + Number(f.tokens_salida || 0), 0) + ' | ' + fmt(suma(fs_)) + ' | ' + (tok ? 'sí' : 'no aplica') + ' |\n';
}
md += '| **Total** | ' + filas.length + ' | | | **' + fmt(suma(filas)) + '** | |\n\n';
md += '## Por caso\n\n| Caso | Canal | Estado | Llamadas | Costo USD | Costo MXN |\n|---|---|---|---:|---:|---:|\n';
for (const c of casos) md += '| ' + c.caso_id + ' | ' + c.canal + ' | ' + c.estado + ' | ' + llm.filter((f) => f.caso_id === c.caso_id).length + ' | ' + fmt(costoCaso(c.caso_id)) + ' | ' + fmt(costoCaso(c.caso_id) * TC, 4) + ' |\n';
md += '\n## Indicadores\n\n';
md += '- **C_promedio (completados)** = ' + fmt(cProm) + ' USD/caso (n = ' + comp.length + ') ≈ ' + fmt(cProm * TC, 4) + ' MXN/caso con TC = ' + TC + ' MXN/USD (Banxico FIX; ver tarifas.csv).\n';
md += '- **Costo de casos fallidos** (reportado aparte) = ' + fmt(suma(fall.map((c) => ({ costo_usd: costoCaso(c.caso_id) })))) + ' USD (n = ' + fall.length + ').\n';
md += '- **Otros cierres** (aclaración, fuera de política, escalados) = ' + fmt(suma(otros.map((c) => ({ costo_usd: costoCaso(c.caso_id) })))) + ' USD (n = ' + otros.length + ').\n';
md += '- Llamadas LLM promedio por caso completado: ' + llamadasProm.toFixed(2) + '.\n';
md += '- Conciliación: Σ filas LLM = ' + fmt(suma(llm)) + ' USD = Σ por caso = ' + fmt(casos.reduce((a, c) => a + costoCaso(c.caso_id), 0)) + ' USD. Los skills y loops NO tienen filas propias: se refieren a las llamadas A2–A4 que los ejecutan (evita doble conteo).\n';
fs.writeFileSync(P('costos/resumen.md'), md);

// ---------- Proyecciones ----------
const EUR = tarifas.eur_usd;
const escenarios = [
  { nombre: 'Base', pct_voz: 0.30, min_voz: 2.0, factor_llm: 1.0, ejec_por_caso: 3 },
  { nombre: 'Mayor consumo', pct_voz: 0.60, min_voz: 4.0, factor_llm: 1.6, ejec_por_caso: 4 }
];
const volumen = [100, 1000, 10000];
function planN8n(ejec) {
  if (ejec <= 2500) return { plan: 'Starter', usd: tarifas.n8n_starter * EUR };
  if (ejec <= 10000) return { plan: 'Pro', usd: tarifas.n8n_pro * EUR };
  if (ejec <= 40000) return { plan: 'Business (autohospedado)', usd: tarifas.n8n_business * EUR };
  return { plan: 'Enterprise / autohospedaje (cotizar)', usd: NaN };
}
let pj = '# Proyecciones mensuales (100 · 1 000 · 10 000 casos)\n\n';
pj += '> C_mes = cargos fijos mensuales + cargos variables no incluidos en el plan. Costo LLM por caso tomado de `costos/resumen.md` (' + (real ? 'medido' : '**muestra simulada: rehacer con datos reales**') + '): ' + fmt(cProm) + ' USD/caso.\n';
pj += '> Supuestos declarados: % de casos por voz, minutos por conversación, ejecuciones de n8n por caso (/nuevo + botón + /estado), factor de LLM por más iteraciones del loop y reintentos. Minutos de voz incluidos en el plan: ' + tarifas.voz_minutos_incluidos_plan + '/mes (ajustar a tu plan). No se extrapola la prueba gratuita de n8n como permanente.\n\n';
pj += '| Escenario | Casos/mes | LLM agentes USD | Min voz | Voz USD (excedente + LLM voz) | Ejecuciones n8n | Plan n8n | n8n USD | GitHub + Telegram | **Total USD/mes** | Total MXN/mes | USD por caso |\n|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|\n';
for (const e of escenarios) for (const n of volumen) {
  const llmUsd = n * cProm * e.factor_llm;
  const min = n * e.pct_voz * e.min_voz;
  const vozUsd = Math.max(0, min - tarifas.voz_minutos_incluidos_plan) * tarifas.voz_minuto + min * tarifas.voz_llm_minuto;
  const ejec = n * e.ejec_por_caso;
  const p = planN8n(ejec);
  const total = llmUsd + vozUsd + p.usd;
  pj += '| ' + e.nombre + ' | ' + n.toLocaleString('es-MX') + ' | ' + fmt(llmUsd, 2) + ' | ' + Math.round(min) + ' | ' + fmt(vozUsd, 2) + ' | ' + ejec.toLocaleString('es-MX') + ' | ' + p.plan + ' | ' + (isNaN(p.usd) ? 'cotizar' : fmt(p.usd, 2)) + ' | 0.00 | **' + (isNaN(total) ? 'cotizar' : fmt(total, 2)) + '** | ' + (isNaN(total) ? '—' : fmt(total * TC, 0)) + ' | ' + (isNaN(total) ? '—' : fmt(total / n, 4)) + ' |\n';
}
pj += '\n## Lectura para decidir\n\n';
pj += '- El costo de tokens de los 4 agentes es pequeño frente a la **voz** y al **plan de n8n**: al multiplicar el volumen por 10, el salto de plan de n8n (por ejecuciones) y los minutos de voz dominan.\n';
pj += '- A 10 000 casos/mes el Starter y el Pro no alcanzan por ejecuciones; hay que pasar a Business o autohospedar n8n.\n\n';
pj += '## Optimización propuesta (sin reducir controles)\n\n';
pj += '1. **Regla determinista en lugar del Agente 1 para solicitudes estructuradas.** Si el texto trae `perfil= monto= horizonte=`, el código extrae los campos y se omite la llamada A1. Ahorro estimado: la fracción de costo de A1 (ver «Por etapa») en esos casos. Calidad: igual o mejor (sin ambigüedad); el código sigue validando rangos. Riesgo: ninguno sobre seguridad, los guardrails de entrada no cambian.\n';
pj += '2. **Reducir contexto del Agente 2:** enviar solo `id, riesgo, esg, extranjero, liquidez` (sin nombre ni rendimiento) baja los tokens de entrada de A2 ~30% (medir antes/después con la misma muestra).\n';
pj += '3. **Prompt caching** del system prompt + instrucciones del skill (estables entre casos): lectura de caché a 0.01 USD/MTok frente a 0.10. Requiere medir el mínimo cacheable del modelo.\n\n';
pj += 'Comparación antes/después: correr los mismos 3 casos de prueba con la optimización 1 activada y registrar costo por caso y tasa de aprobación en primera revisión (KPI 1). No se acepta la optimización si el KPI 1 baja.\n';
fs.writeFileSync(P('costos/proyecciones.md'), pj);
console.log('✓ costos/costos.csv (' + filas.length + ' filas) · resumen.md · proyecciones.md · fuente=' + fuenteExp);
