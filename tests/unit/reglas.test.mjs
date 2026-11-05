// Pruebas deterministas (node --test). Las ejecuta GitHub Actions antes de publicar: si alguna falla, NO se despliega.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');
const C = require(path.join(RAIZ, 'agentes/calculo_portafolio.js'));
const R = require(path.join(RAIZ, 'agentes/revision_cumplimiento.js'));
const K = require(path.join(RAIZ, 'web/assets/kpis.js'));
const CAT = JSON.parse(leer('datos/catalogo_instrumentos.json'));
const bloque = (p) => JSON.parse(leer(p).match(/```json reglas\s*([\s\S]*?)```/)[1]);
const RN = bloque('skills/propuesta-portafolio/SKILL.md');
const RR = bloque('skills/revision-cumplimiento/SKILL.md');
const ej = (p) => JSON.parse(leer(p));

function seleccionDeterminista(req) {
  const b = C.filtrarElegibles(req, CAT, RN);
  const sel = {};
  for (const [clase, lista] of Object.entries(b.elegibles)) sel[clase] = lista.slice(0, RN.instrumentos_por_clase_max).map((i) => i.id);
  return sel;
}

test('catálogo: IDs únicos, clases y rangos válidos', () => {
  const ids = CAT.instrumentos.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const i of CAT.instrumentos) {
    assert.ok(i.riesgo >= 1 && i.riesgo <= 5, i.id);
    assert.ok(i.rend_esperado_anual >= 0 && i.rend_esperado_anual < 1, i.id);
    assert.ok(i.monto_min_mxn > 0, i.id);
  }
  assert.equal(CAT.datos_ficticios, true);
});

test('cálculo: suma 100%, concentración ≤40%, riesgo ≤ tope y mínimos, en todas las combinaciones', () => {
  const montos = [50000, 80000, 250000, 1200000, 5000000];
  const horizontes = [1, 2, 5, 15];
  const restricciones = [[], ['solo_esg'], ['sin_extranjero'], ['liquidez_alta'], ['sin_renta_variable'], ['solo_esg', 'sin_extranjero']];
  let validos = 0, escalados = 0;
  for (const perfil of Object.keys(RN.perfiles)) for (const monto_mxn of montos) for (const horizonte_anios of horizontes) for (const r of restricciones) {
    const req = { perfil_riesgo: perfil, monto_mxn, horizonte_anios, objetivo: 'prueba', restricciones: r };
    const c = C.calcularPropuesta(req, CAT, RN, seleccionDeterminista(req));
    if (!c.valido) { escalados++; assert.ok(c.errores.length > 0); continue; }
    validos++;
    assert.ok(Math.abs(c.metricas.suma_pesos_pct - 100) <= 0.01, JSON.stringify(req));
    const tope = RN.perfiles[c.perfil_aplicado].riesgo_max;
    for (const l of c.lineas) {
      assert.ok(l.peso_pct <= 40 + 1e-9, l.id + ' ' + l.peso_pct);
      assert.ok(l.riesgo <= tope, l.id);
      assert.ok(!['derivados', 'cripto'].includes(l.clase));
      assert.ok(l.monto_mxn >= CAT.instrumentos.find((i) => i.id === l.id).monto_min_mxn, l.id);
    }
  }
  assert.ok(validos > 300, 'casos válidos: ' + validos + ', escalados: ' + escalados);
});

test('cálculo: agresivo con horizonte corto usa la mezcla moderada y lo declara', () => {
  const req = { perfil_riesgo: 'agresivo', monto_mxn: 1200000, horizonte_anios: 2, objetivo: 'x', restricciones: [] };
  const c = C.calcularPropuesta(req, CAT, RN, seleccionDeterminista(req));
  assert.equal(c.perfil_aplicado, 'moderado');
  assert.ok(c.supuestos.some((s) => s.includes('Horizonte menor')));
});

test('cálculo: un ID no elegible forzado (cripto) se rechaza', () => {
  const e = ej('skills/propuesta-portafolio/ejemplos/rechazo_cripto.json');
  const c = C.calcularPropuesta(e.requerimiento, CAT, RN, e.seleccion_forzada);
  assert.ok(c.errores.some((x) => x.includes('CRI-01')));
  assert.equal(c.valido, false);
});

test('skill propuesta-portafolio: ejemplo válido y ejemplo de aclaración', () => {
  const v = ej('skills/propuesta-portafolio/ejemplos/valido_moderado.json');
  const c = C.calcularPropuesta(v.requerimiento, CAT, RN, v.seleccion_agente2);
  assert.equal(c.valido, true);
  assert.equal(c.metricas.suma_pesos_pct, 100);
  const a = ej('skills/propuesta-portafolio/ejemplos/aclaracion_sin_monto.json');
  const val = C.validarRequerimiento(a.salida_agente1, RN);
  assert.deepEqual(val.faltantes, a.faltantes_esperados);
});

test('validarRequerimiento: rangos y enums los decide el código', () => {
  assert.deepEqual(C.validarRequerimiento({ perfil_riesgo: 'temerario', monto_mxn: 100000, horizonte_anios: 5, restricciones: [] }, RN).faltantes, ['perfil_riesgo']);
  assert.deepEqual(C.validarRequerimiento({ perfil_riesgo: 'moderado', monto_mxn: 1000, horizonte_anios: 5, restricciones: [] }, RN).faltantes, ['monto_mxn']);
  assert.deepEqual(C.validarRequerimiento({ perfil_riesgo: 'moderado', monto_mxn: 100000, horizonte_anios: 50, restricciones: ['apalancamiento'] }, RN).faltantes, ['horizonte_anios']);
  assert.deepEqual(C.validarRequerimiento({ perfil_riesgo: 'moderado', monto_mxn: 100000, horizonte_anios: 5, restricciones: ['apalancamiento', 'solo_esg'] }, RN).req.restricciones, ['solo_esg']);
});

test('skill revision-cumplimiento: aprueba lo correcto y devuelve el V1 defectuoso', () => {
  const a = ej('skills/revision-cumplimiento/ejemplos/aprobar.json');
  const ca = C.calcularPropuesta(a.requerimiento, CAT, RN, a.seleccion_agente2);
  assert.deepEqual(R.revisarPropuesta(ca, a.redaccion, RN, RR), a.esperado);
  const d = ej('skills/revision-cumplimiento/ejemplos/devolver_garantizado.json');
  const cd = C.calcularPropuesta(d.requerimiento, CAT, RN, d.seleccion_agente2);
  const h = R.revisarPropuesta(cd, d.redaccion, RN, RR);
  for (const p of d.esperado_prefijos) assert.ok(h.some((x) => x.startsWith(p)), 'falta hallazgo ' + p + ' en ' + h.join(' | '));
});

test('skills: estructura exigida por la guía y versión coherente', () => {
  const secciones = ['## Propósito', '## Alcance', '## Entradas', '## Fuentes permitidas', '## Procedimiento', '## Instrucciones para el agente', '## Reglas verificables',
    '## Herramientas permitidas', '## Evidencia', '## Salida', '## Alertas y errores', '## Límites', '## Criterios de aceptación', '## Ejemplos', '## Uso y carga', '## Historial de versiones', '## Autoevaluación'];
  for (const s of ['propuesta-portafolio', 'revision-cumplimiento']) {
    const md = leer('skills/' + s + '/SKILL.md');
    const fm = md.match(/^---\n([\s\S]*?)\n---/)[1];
    for (const campo of ['name:', 'description:', 'version:', 'activador:']) assert.ok(fm.includes(campo), s + ' sin ' + campo);
    for (const sec of secciones) assert.ok(md.includes(sec), s + ' sin sección ' + sec);
    assert.equal(fm.match(/version:\s*([0-9.]+)/)[1], bloque('skills/' + s + '/SKILL.md').version, s + ': versión del encabezado ≠ bloque de reglas');
    const auto = md.match(/\| (\d) \| (\d) \| (\d) \| (\d) \| (\d) \| \*\*(\d+)\/20\*\* \|/);
    assert.ok(auto, s + ' sin autoevaluación');
    const pts = auto.slice(1, 6).map(Number);
    assert.equal(pts.reduce((a, b) => a + b, 0), Number(auto[6]));
    assert.ok(Number(auto[6]) >= 16 && Math.min(...pts) >= 3, s + ': autoevaluación < 16/20 o algún aspecto < 3');
  }
});

test('KPIs: fórmulas sobre un conjunto conocido', () => {
  const casos = [
    { estado: 'aprobado_simulado', decision: 'aprobado', ciclo_decision_min: 4, aprobado_primera_revision: true, costo_usd: 0.002 },
    { estado: 'rechazado', decision: 'rechazado', ciclo_decision_min: 10, aprobado_primera_revision: false, costo_usd: 0.004 },
    { estado: 'pendiente_aprobacion', decision: '', ciclo_decision_min: null, aprobado_primera_revision: true, costo_usd: 0.003 },
    { estado: 'error_api', decision: '', ciclo_decision_min: null, aprobado_primera_revision: null, costo_usd: 0 },
    { estado: 'requiere_aclaracion', decision: '', ciclo_decision_min: null, aprobado_primera_revision: null, costo_usd: 0.0003 }
  ];
  const k = K.calcularKPIs(casos);
  assert.equal(k.aprobacion_primera_revision.valor, 66.7);
  assert.equal(k.aprobacion_primera_revision.denominador, 3);
  assert.equal(k.ciclo_decision_mediana_min.valor, 7);
  assert.equal(k.costo_por_caso_completado.valor, 0.003);
  assert.equal(k.costo_por_caso_completado.n_fallidos, 1);
});

test('revisión con redacción realista: aprueba textos correctos y rechaza promesas o cifras falsas', () => {
  const req = { perfil_riesgo: 'moderado', monto_mxn: 250000, horizonte_anios: 5, objetivo: 'retiro', restricciones: ['solo_esg'] };
  const calc = C.calcularPropuesta(req, CAT, RN, { deuda_gubernamental: ['GOB-03'], deuda_corporativa: ['CORP-02'], renta_variable: ['RV-02', 'RV-04'] });
  const extra = { supuestos: ['Rendimientos ilustrativos.', 'Correlación cero.'], riesgos: ['Tasa de interés.', 'Mercado.'] };
  const buenos = [
    // % antes del ID, totales por clase y negación de garantía (estilo típico de un modelo real)
    'Resultado simulado. Para un perfil moderado con restricción ESG se propone 40% en GOB-03 (bono verde soberano), 20% en CORP-02, 17.5% en RV-02, 17.5% en RV-04 y 2.5% en LIQ-01 y 2.5% en LIQ-02. La deuda representa 60% del portafolio y la renta variable 35%. El rendimiento esperado ilustrativo es 9.45% anual con volatilidad aproximada de 4.03%. Los rendimientos no están garantizados. Este documento no constituye una recomendación.',
    // ID primero con porcentajes pegados
    'Resultado simulado. GOB-03: 40%; CORP-02: 20%; RV-02: 17.5%; RV-04: 17.5%; LIQ-01: 2.5%; LIQ-02: 2.5%. Rendimiento esperado ilustrativo 9.45%, volatilidad 4.03%. No se garantiza ningún rendimiento y no constituye una recomendación.'
  ];
  for (const t of buenos) assert.deepEqual(R.revisarPropuesta(calc, { resumen: t, ...extra }, RN, RR), [], t.slice(0, 60));
  const promesa = 'Resultado simulado. GOB-03 40%, CORP-02 20%, RV-02 17.5%, RV-04 17.5%, LIQ-01 2.5%, LIQ-02 2.5%. Rendimiento garantizado de 9.45%. No constituye una recomendación.';
  assert.ok(R.revisarPropuesta(calc, { resumen: promesa, ...extra }, RN, RR).some((x) => x.startsWith('R5')));
  const cifraFalsa = buenos[0].replace('40% en GOB-03', '45% en GOB-03');
  const h = R.revisarPropuesta(calc, { resumen: cifraFalsa, ...extra }, RN, RR);
  assert.ok(h.some((x) => x.startsWith('R6 · resumen · GOB-03')) && h.some((x) => x.startsWith('R7')), h.join(' | '));
});
