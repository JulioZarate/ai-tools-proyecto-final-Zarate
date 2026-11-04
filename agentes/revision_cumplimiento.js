// Valoria — chequeos deterministas R1–R10 del skill revision-cumplimiento (Agente 4, parte verificable).
// Única fuente: se copia a n8n por el generador y se prueba en GitHub Actions.

function normalizarTexto(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function porcentajesEnTexto(texto) {
  const out = [];
  const re = /(\d+(?:[.,]\d+)?)\s*%/g;
  let m;
  while ((m = re.exec(String(texto || ''))) !== null) out.push(Number(m[1].replace(',', '.')));
  return out;
}

/**
 * calculo: salida de calcularPropuesta(); redaccion: {resumen, supuestos, riesgos};
 * reglasNeg: reglas de propuesta-portafolio; reglasRev: reglas de revision-cumplimiento.
 * Devuelve lista de hallazgos "Rn · campo · detalle". Lista vacía = pasa.
 */
function revisarPropuesta(calculo, redaccion, reglasNeg, reglasRev) {
  const h = [];
  const tol = reglasRev.tolerancia_pp;
  const resumen = String((redaccion && redaccion.resumen) || '');
  const supuestos = (redaccion && Array.isArray(redaccion.supuestos)) ? redaccion.supuestos : [];
  const riesgos = (redaccion && Array.isArray(redaccion.riesgos)) ? redaccion.riesgos : [];
  const todo = [resumen].concat(supuestos, riesgos).join(' \n ');
  const nTodo = normalizarTexto(todo);
  const nRes = normalizarTexto(resumen);

  // R1 suma
  if (Math.abs(calculo.metricas.suma_pesos_pct - reglasRev.suma_objetivo_pct) > reglasRev.suma_tolerancia_pp)
    h.push('R1 · metricas.suma_pesos_pct · ' + calculo.metricas.suma_pesos_pct + '% ≠ 100%');
  // R2 concentración
  calculo.lineas.forEach(function (l) {
    if (l.peso_pct > reglasRev.concentracion_max_pct + 1e-9) h.push('R2 · lineas.' + l.id + ' · ' + l.peso_pct + '% > ' + reglasRev.concentracion_max_pct + '%');
  });
  // R3 riesgo vs perfil aplicado
  const tope = reglasNeg.perfiles[calculo.perfil_aplicado].riesgo_max;
  calculo.lineas.forEach(function (l) {
    if (l.riesgo > tope) h.push('R3 · lineas.' + l.id + ' · riesgo ' + l.riesgo + ' > tope ' + tope + ' (' + calculo.perfil_aplicado + ')');
  });
  // R4 frases obligatorias
  reglasRev.frases_obligatorias.forEach(function (f) {
    if (nRes.indexOf(normalizarTexto(f)) < 0) h.push('R4 · resumen · falta "' + f + '"');
  });
  // R5 palabras prohibidas
  reglasRev.palabras_prohibidas.forEach(function (p) {
    if (nTodo.indexOf(normalizarTexto(p)) >= 0) h.push('R5 · resumen/supuestos/riesgos · contiene "' + p + '"');
  });
  // R6 cada ID con su porcentaje
  calculo.lineas.forEach(function (l) {
    const i = resumen.indexOf(l.id);
    if (i < 0) { h.push('R6 · resumen · no menciona ' + l.id); return; }
    const ventana = resumen.slice(i, i + 90);
    const pcts = porcentajesEnTexto(ventana);
    if (!pcts.some(function (p) { return Math.abs(p - l.peso_pct) <= tol; })) h.push('R6 · resumen · ' + l.id + ' sin su peso ' + l.peso_pct + '%');
  });
  // R7 todo % del resumen existe en el cálculo
  const validos = calculo.lineas.map(function (l) { return l.peso_pct; }).concat([
    calculo.metricas.rend_esperado_anual_pct, calculo.metricas.volatilidad_aprox_pct, calculo.metricas.suma_pesos_pct,
    reglasRev.concentracion_max_pct
  ]);
  const mezcla = reglasNeg.perfiles[calculo.perfil_aplicado].mezcla;
  Object.keys(mezcla).forEach(function (k) { validos.push(Math.round(mezcla[k] * 10000) / 100); });
  porcentajesEnTexto(resumen).forEach(function (p) {
    if (!validos.some(function (v) { return Math.abs(v - p) <= tol; })) h.push('R7 · resumen · ' + p + '% no existe en el cálculo');
  });
  // R8 longitud
  const palabras = resumen.trim().split(/\s+/).filter(Boolean).length;
  if (palabras > reglasRev.max_palabras_resumen) h.push('R8 · resumen · ' + palabras + ' palabras > ' + reglasRev.max_palabras_resumen);
  // R9 supuestos y riesgos
  if (supuestos.length < reglasRev.min_supuestos) h.push('R9 · supuestos · ' + supuestos.length + ' < ' + reglasRev.min_supuestos);
  if (riesgos.length < reglasRev.min_riesgos) h.push('R9 · riesgos · ' + riesgos.length + ' < ' + reglasRev.min_riesgos);
  // R10 inyección / secretos en la salida
  reglasRev.patrones_inyeccion_salida.forEach(function (p) {
    if (nTodo.indexOf(normalizarTexto(p)) >= 0) h.push('R10 · salida · patrón sospechoso "' + p + '"');
  });
  return h;
}

// <export>
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { revisarPropuesta: revisarPropuesta, porcentajesEnTexto: porcentajesEnTexto, normalizarTexto: normalizarTexto };
}
// </export>
