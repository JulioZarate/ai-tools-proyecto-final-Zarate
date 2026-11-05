// Simulador LOCAL de la API de Anthropic para probar el flujo de n8n sin costo ni red.
// Responde por agente (?agente=A1..A4) con salidas plausibles y uso de tokens estimado.
// No se usa en producción: solo en tests/n8n_local/correr.mjs.
import http from 'node:http';

const PUERTO = Number(process.env.MOCK_PORT || 8787);
let modoFalla = process.env.MOCK_FALLA || ''; // '' | 'caida' (500 en todo)

function tokens(s) { return Math.ceil(String(s).length / 3.6); }

function a1(user) {
  const t = (user.match(/<solicitud>([\s\S]*?)<\/solicitud>/) || [])[1] || '';
  const tl = t.toLowerCase();
  const perfil = ['conservador', 'moderado', 'agresivo'].find((p) => tl.includes(p)) || null;
  let monto = null;
  const mMil = tl.match(/(\d+(?:[.,]\d+)?)\s*(mil|k)\b/);
  const mMill = tl.match(/(\d+(?:[.,]\d+)?)\s*(millones|millón|millon)/);
  const mNum = tl.match(/monto\s*(\d{4,})/) || tl.match(/(\d{5,})/);
  if (mMill) monto = Number(mMill[1].replace(',', '.')) * 1e6; else if (mMil) monto = Number(mMil[1].replace(',', '.')) * 1000; else if (mNum) monto = Number(mNum[1]);
  const mH = tl.match(/(\d+)\s*(años|anos|año)/);
  const restr = [];
  if (tl.includes('esg')) restr.push('solo_esg');
  if (tl.includes('sin extranjero') || tl.includes('solo méxico') || tl.includes('solo mexico')) restr.push('sin_extranjero');
  const fuera = /cripto|derivado|garantiz|apalanc/.test(tl);
  const faltantes = [];
  if (!perfil) faltantes.push('perfil_riesgo');
  if (!monto) faltantes.push('monto_mxn');
  if (!mH) faltantes.push('horizonte_anios');
  return { perfil_riesgo: perfil, monto_mxn: monto, horizonte_anios: mH ? Number(mH[1]) : null, objetivo: (tl.match(/objetivo:?\s*([^,|]+)/) || [])[1] || 'no indicado',
    restricciones: restr, solicita_fuera_de_politica: fuera, faltantes, pregunta_aclaracion: faltantes.length ? '¿Puedes indicar ' + faltantes.join(' y ') + '?' : null, senales_riesgo: [] };
}
function a2(user) {
  const json = user.slice(user.indexOf('{', user.indexOf('elegibles:')));
  const clases = JSON.parse(json.split('\nCorrección')[0]);
  const seleccion = {}, justificaciones = {}, insuficiencias = [];
  for (const [c, info] of Object.entries(clases)) {
    if (c === 'liquidez') { if (!info.elegibles.length) insuficiencias.push(c); continue; }
    // Comportamientos reales observados: omite liquidez, elige solo 1 y a veces inventa un ID.
    seleccion[c] = info.elegibles.slice(0, 1).map((e) => e.id);
    if (c === 'renta_variable') seleccion[c].push('RV-99');
    seleccion[c].forEach((id) => { justificaciones[id] = 'Elegible para el perfil; riesgo y liquidez adecuados.'; });
    if (!info.elegibles.length) insuficiencias.push(c);
  }
  for (const c of Object.keys(seleccion)) if (!seleccion[c]) delete seleccion[c];
  return { seleccion, justificaciones, insuficiencias, fuentes: ['VALORIA-CAT v1.0.0'] };
}
function a3(user) {
  const m = user.match(/Cálculo \(no lo cambies\): (\{.*\})\n/);
  const calc = JSON.parse(m[1]);
  const partes = calc.lineas.map((l) => l.peso_pct + '% en ' + l.id).join(', ');
  const tot = {}; calc.lineas.forEach((l) => { tot[l.clase] = (tot[l.clase] || 0) + l.peso_pct; });
  const deuda = Math.round(((tot.deuda_gubernamental || 0) + (tot.deuda_corporativa || 0)) * 100) / 100;
  return {
    resumen: 'Resultado simulado. Para el perfil ' + calc.perfil_aplicado + ' se propone ' + partes +
      '. La deuda suma ' + deuda + '% del portafolio. El rendimiento esperado ilustrativo es de ' + calc.metricas.rend_esperado_anual_pct + '% anual con volatilidad aproximada de ' + calc.metricas.volatilidad_aprox_pct +
      '%. Los rendimientos no están garantizados y este documento no constituye una recomendación.',
    supuestos: ['Rendimientos del catálogo ficticio.', 'Correlación cero entre instrumentos.'],
    riesgos: ['Riesgo de tasa de interés.', 'Riesgo de mercado en renta variable.'],
    advertencias: []
  };
}
function a4(user) {
  const h = JSON.parse((user.match(/hallazgos_codigo: (\[.*\])\s*$/) || [])[1] || '[]');
  return h.length ? { veredicto: 'devuelto', correcciones: h.map((x) => 'Corregir: ' + x), comentario: 'Hay hallazgos automáticos.' }
    : { veredicto: 'aprobado', correcciones: [], comentario: 'Cifras y lenguaje coherentes.' };
}

http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    if (req.url.startsWith('/__falla')) { modoFalla = new URL(req.url, 'http://x').searchParams.get('modo') || ''; res.end('ok ' + modoFalla); return; }
    if (modoFalla === 'caida') { res.writeHead(529, { 'content-type': 'application/json' }); res.end(JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded (simulado)' } })); return; }
    const agente = new URL(req.url, 'http://x').searchParams.get('agente');
    let b; try { b = JSON.parse(body); } catch { res.writeHead(400); res.end('{}'); return; }
    const user = b.messages[0].content;
    const salida = { A1: a1, A2: a2, A3: a3, A4: a4 }[agente](user);
    const texto = agente === 'A1' ? 'Aquí está la extracción:\n```json\n' + JSON.stringify(salida, null, 2) + '\n```' : JSON.stringify(salida);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ id: 'msg_mock', type: 'message', role: 'assistant', model: b.model, stop_reason: 'end_turn',
      content: [{ type: 'text', text: texto }], usage: { input_tokens: tokens(b.system) + tokens(user), output_tokens: tokens(texto) } }));
  });
}).listen(PUERTO, () => console.log('mock anthropic en', PUERTO));
