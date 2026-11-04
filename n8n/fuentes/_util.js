// ===== Utilidades compartidas (se copian en cada nodo Code que las usa) =====
function hashCorto(s) {
  let h = 2166136261;
  s = String(s);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ('00000000' + (h >>> 0).toString(16)).slice(-8);
}
function ahoraISO() { return new Date().toISOString(); }
function enmascarar(t) {
  return String(t || '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[correo]')
    .replace(/\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/gi, '[curp]')
    .replace(/\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/gi, '[rfc]')
    .replace(/\b(?:\d[ -]?){13,19}\b/g, '[numero]')
    .replace(/\+?\d[\d\s-]{8,}\d/g, '[telefono]')
    .slice(0, 600);
}
function extraerJSON(texto) {
  if (texto === null || texto === undefined) return null;
  if (typeof texto === 'object') return texto;
  try { return JSON.parse(texto); } catch (e) { /* sigue */ }
  const i = texto.indexOf('{'), j = texto.lastIndexOf('}');
  if (i >= 0 && j > i) { try { return JSON.parse(texto.slice(i, j + 1)); } catch (e) { /* sigue */ } }
  return null;
}
function estimarTokens(texto) { return Math.ceil(String(texto || '').length / 3); }
function tarifaPara(tokensPrompt, t) {
  const alta = tokensPrompt > t.umbral_prompt_tokens;
  return { pin: alta ? t.entrada_alta_usd_mtok : t.entrada_usd_mtok, pout: alta ? t.salida_alta_usd_mtok : t.salida_usd_mtok, pcache: alta ? t.cache_lectura_usd_mtok * 5 : t.cache_lectura_usd_mtok };
}
// Ci = (Tentrada*Pentrada + Tsalida*Psalida + Tcache*Pcache) / 1,000,000
function costoUSD(tin, tout, tcache, t) {
  const tf = tarifaPara(tin + tcache, t);
  return (tin * tf.pin + tout * tf.pout + tcache * tf.pcache) / 1000000;
}
function redondear6(x) { return Math.round(x * 1e6) / 1e6; }

// Guardia del loop de seguridad y costo: se evalúa ANTES de cada llamada LLM.
function guardia(st, agente, system, user) {
  const cfg = CONFIG;
  const permitidos = { A1: true, A2: true, A3: true, A4: true };
  const maxTok = cfg.max_tokens[agente];
  const estTin = estimarTokens(system) + estimarTokens(user);
  const estimado = costoUSD(estTin, maxTok, 0, cfg.tarifas);
  const disponible = st.limite_costo_usd * (1 - cfg.reserva_pct) - st.gasto_usd;
  const transcurrido = Date.now() - st.inicio_ms;
  let motivo = null;
  if (!permitidos[agente]) motivo = 'agente_no_autorizado';
  else if (st.llamadas.length >= cfg.max_llamadas_caso) motivo = 'limite_llamadas';
  else if (transcurrido > cfg.tiempo_max_caso_ms) motivo = 'limite_tiempo';
  else if (estimado > disponible) motivo = 'presupuesto';
  return { ok: motivo === null, motivo: motivo, estimado_usd: redondear6(estimado), disponible_usd: redondear6(disponible), max_tokens: maxTok };
}

function cuerpoLLM(system, user, maxTokens) {
  // Haiku 5.5: sin temperature/top_k ni prefill (la API los rechaza).
  return { model: CONFIG.modelo, max_tokens: maxTokens, system: system, messages: [{ role: 'user', content: user }] };
}

// Registra la llamada (éxito o error) y devuelve el texto de la respuesta.
function registrarLlamada(st, agente, etapa, resp, prep) {
  const cfg = CONFIG;
  const id = st.caso_id + '-L' + String((st.llamadas_previas || 0) + st.llamadas.length + 1).padStart(2, '0');
  const fila = {
    fecha_hora: ahoraISO(), caso_id: st.caso_id, llamada_id: id, etapa: etapa, agente: agente,
    proveedor: cfg.tarifas.proveedor, modelo: cfg.modelo, tokens_entrada: 0, tokens_salida: 0, tokens_cache: 0,
    duracion_voz_seg: 0, unidad_cobro: 'tokens', tarifa_entrada: cfg.tarifas.entrada_usd_mtok, tarifa_salida: cfg.tarifas.salida_usd_mtok,
    costo_usd: 0, moneda: 'USD', estado: 'ok', reintento: 0, origen_dato: 'medido_api', iteracion: st.iteracion || 0,
    duracion_ms: Date.now() - (prep.t0 || Date.now())
  };
  let texto = null, error = null;
  if (!resp || resp.error || !resp.content) {
    error = resp && resp.error ? (resp.error.message || JSON.stringify(resp.error)).slice(0, 200) : 'respuesta_vacia';
    fila.estado = 'error';
    // Si la API falló no hay uso reportado: se registra la estimación de entrada, marcada como estimada.
    fila.tokens_entrada = prep.est_tokens_entrada || 0;
    fila.costo_usd = 0;
    fila.origen_dato = 'estimado_sin_cobro_confirmado';
  } else {
    const u = resp.usage || {};
    fila.tokens_entrada = u.input_tokens || 0;
    fila.tokens_salida = u.output_tokens || 0;
    fila.tokens_cache = (u.cache_read_input_tokens || 0);
    fila.costo_usd = redondear6(costoUSD(fila.tokens_entrada, fila.tokens_salida, fila.tokens_cache, cfg.tarifas));
    const bloque = (resp.content || []).filter(function (b) { return b.type === 'text'; })[0];
    texto = bloque ? bloque.text : null;
    if (!texto) { error = 'sin_texto (stop_reason=' + resp.stop_reason + ')'; fila.estado = 'sin_texto'; }
    if (resp.stop_reason === 'refusal') { error = 'refusal'; fila.estado = 'refusal'; }
  }
  st.gasto_usd = redondear6(st.gasto_usd + fila.costo_usd);
  st.llamadas.push(fila);
  return { texto: texto, error: error, llamada_id: id };
}

function anotar(st, paso, agente, estado, entrada, salida, extra) {
  const e = extra || {};
  st.traza.push({
    caso_id: st.caso_id, paso: st.traza.length + 1, agente: agente, accion: paso, estado: estado,
    entrada_resumen: String(entrada || '').slice(0, 300), salida_resumen: String(salida || '').slice(0, 500),
    skill: e.skill || '', version_skill: e.version_skill || '', huella_skill: e.huella_skill || '',
    llamada_id: e.llamada_id || '', version_propuesta: st.version_propuesta || 0, iteracion: st.iteracion || 0,
    timestamp: ahoraISO()
  });
}
