// Nodo: "Sanitizar exportación" — solo agregados y campos no personales para el panel público.
function filas(nombre) {
  return $(nombre).all().map(function (i) { return i.json; }).filter(function (r) { return r && Object.keys(r).length > 0; });
}
function rangoMonto(m) {
  m = Number(m || 0);
  if (!m) return 'sin_dato';
  if (m < 100000) return '<100k';
  if (m < 500000) return '100k-500k';
  if (m < 1000000) return '500k-1M';
  return '>=1M';
}
const casos = filas('Leer casos').filter(function (c) { return /^VAL-\d{6}-[A-Z0-9]{4}$/.test(c.caso_id || ''); }).map(function (c) {
  let rend = null;
  try { rend = c.propuesta_json ? JSON.parse(c.propuesta_json).metricas.rend_esperado_anual_pct : null; } catch (e) { rend = null; }
  let primeraAprob = null;
  try { const rv = c.revision_json ? JSON.parse(c.revision_json) : null; primeraAprob = rv && rv.historial && rv.historial.length ? rv.historial[0].veredicto === 'aprobado' : null; } catch (e) { primeraAprob = null; }
  const ciclo = c.decidido_en && c.creado_en ? Math.round((Date.parse(c.decidido_en) - Date.parse(c.creado_en)) / 6000) / 10 : null;
  return {
    caso_id: c.caso_id, canal: c.canal, estado: c.estado, version_propuesta: Number(c.version_propuesta || 0),
    perfil_riesgo: c.perfil_riesgo || '', monto_rango: rangoMonto(c.monto_mxn), horizonte_anios: Number(c.horizonte_anios || 0),
    restricciones: c.restricciones || '', iteraciones: Number(c.iteraciones || 0), llamadas: Number(c.llamadas || 0),
    costo_usd: Number(c.costo_usd || 0), rend_esperado_pct: rend, aprobado_primera_revision: primeraAprob,
    decision: c.decision || '', creado_en: c.creado_en, actualizado_en: c.actualizado_en, decidido_en: c.decidido_en || '',
    ciclo_decision_min: ciclo, demo: c.demo || ''
  };
});
const ids = casos.map(function (c) { return c.caso_id; });
const costos = filas('Leer costos').filter(function (r) { return ids.indexOf(r.caso_id) >= 0; }).map(function (r) {
  return { fecha_hora: r.fecha_hora, caso_id: r.caso_id, llamada_id: r.llamada_id, etapa: r.etapa, agente: r.agente, proveedor: r.proveedor,
    modelo: r.modelo, tokens_entrada: Number(r.tokens_entrada || 0), tokens_salida: Number(r.tokens_salida || 0), tokens_cache: Number(r.tokens_cache || 0),
    costo_usd: Number(r.costo_usd || 0), estado: r.estado, origen_dato: r.origen_dato, iteracion: Number(r.iteracion || 0) };
});
const traza = filas('Leer traza').filter(function (r) { return ids.indexOf(r.caso_id) >= 0; }).map(function (r) {
  return { caso_id: r.caso_id, agente: r.agente, accion: r.accion, estado: r.estado, skill: r.skill || '', version_skill: r.version_skill || '',
    llamada_id: r.llamada_id || '', version_propuesta: Number(r.version_propuesta || 0), iteracion: Number(r.iteracion || 0), timestamp: r.timestamp };
});
return [{ json: {
  esquema: 'valoria-export/1',
  generado_en: new Date().toISOString(),
  datos_ficticios: true,
  fuente: 'n8n Data Tables valoria_casos, valoria_costos, valoria_traza (exportación sanitizada)',
  casos: casos, costos: costos, traza: traza
} }];
