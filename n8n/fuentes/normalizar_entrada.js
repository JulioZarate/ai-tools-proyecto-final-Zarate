/*@include _config*/
/*@include _util*/
// Nodo: "Normalizar y validar entrada" — entrada única para Telegram y voz.
// Guardrails aplicados aquí, ANTES de cualquier llamada a un modelo:
// acceso (lista de usuarios), longitud, patrones de inyección/URLs, formato de folio, modo SIMULADO.
const ev = $input.first().json;
const cfg = CONFIG;
const ctx = { recibido_en: ahoraISO(), modo: cfg.modo, motivo: '', demo: '', presupuesto_solicitado: null };

function nuevoCasoId() {
  const d = new Date();
  const p = function (n) { return String(n).padStart(2, '0'); };
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return 'VAL-' + String(d.getUTCFullYear()).slice(2) + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + '-' + s;
}
function bloqueado(texto) {
  return cfg.patrones_bloqueo.filter(function (p) { return new RegExp(p, 'i').test(texto); });
}
function extraerParametros(texto) {
  // Parámetros de prueba permitidos: demo=falla_v1 y presupuesto=<usd> (solo puede BAJAR el límite).
  let t = texto;
  const mDemo = t.match(/\bdemo=(falla_v1)\b/i);
  if (mDemo) { ctx.demo = mDemo[1].toLowerCase(); t = t.replace(mDemo[0], ''); }
  const mPres = t.match(/\bpresupuesto=([0-9]*\.?[0-9]+)\b/i);
  if (mPres) { ctx.presupuesto_solicitado = Number(mPres[1]); t = t.replace(mPres[0], ''); }
  return t.replace(/\s+/g, ' ').trim();
}

if (ev.update_id !== undefined) {
  ctx.canal = 'telegram';
  ctx.evento_id = 'tg:' + ev.update_id;
  if (ev.callback_query) {
    const cq = ev.callback_query;
    ctx.tipo = 'callback';
    ctx.usuario_raw = String(cq.from.id);
    ctx.chat_id = String(cq.message ? cq.message.chat.id : cq.from.id);
    ctx.callback_id = cq.id;
    const partes = String(cq.data || '').split('|');
    ctx.decision = { accion: partes[0], caso_id: String(partes[1] || '').toUpperCase(), version: Number(partes[2] || 0) };
    ctx.folio = ctx.decision.caso_id;
    ctx.ruta = (partes.length === 3 && (partes[0] === 'ap' || partes[0] === 're')) ? 'decision' : 'invalido';
    if (ctx.ruta === 'invalido') ctx.motivo = 'Botón no reconocido.';
  } else if (ev.message) {
    const m = ev.message;
    ctx.tipo = 'mensaje';
    ctx.usuario_raw = String(m.from.id);
    ctx.chat_id = String(m.chat.id);
    const texto = String(m.text || '').trim();
    const primera = texto.split(/\s+/)[0] || '';
    const cmd = primera.toLowerCase().replace(/@.*/, '');
    const resto = texto.slice(primera.length).trim();
    ctx.comando = cmd;
    if (cmd === '/nuevo') { ctx.ruta = 'nuevo'; ctx.texto = extraerParametros(resto); }
    else if (cmd === '/aclarar') {
      const f = resto.split(/\s+/)[0] || '';
      ctx.ruta = 'aclarar'; ctx.folio = f.toUpperCase(); ctx.texto = extraerParametros(resto.slice(f.length));
    }
    else if (cmd === '/estado') { ctx.ruta = 'estado'; ctx.folio = (resto.split(/\s+/)[0] || '').toUpperCase(); }
    else if (cmd === '/start' || cmd === '/ayuda' || cmd === '/help') { ctx.ruta = 'ayuda'; }
    else { ctx.ruta = 'invalido'; ctx.motivo = 'Comando no reconocido.'; }
  } else {
    ctx.ruta = 'ignorar';
  }
  ctx.rol = cfg.usuarios[ctx.usuario_raw] || '';
  ctx.usuario_ps = 'u_' + hashCorto(cfg.sal_seudonimo + (ctx.usuario_raw || ''));
  if (!ctx.rol && ctx.ruta !== 'ignorar') { ctx.ruta = 'rechazo_acceso'; ctx.motivo = 'Usuario no autorizado.'; }
} else {
  // Herramienta de servidor de ElevenLabs (el nodo Webhook ya validó el encabezado secreto).
  const b = ev.body || {};
  ctx.canal = 'voz';
  ctx.tipo = 'herramienta_voz';
  ctx.rol = 'voz_publica';
  ctx.usuario_ps = 'voz_publica';
  ctx.chat_id = '';
  const accion = String(b.accion || '').toLowerCase().trim();
  const conv = String(b.conversation_id || 'sin_conversacion').slice(0, 80);
  ctx.evento_id = 'voz:' + hashCorto(conv + '|' + JSON.stringify(b));
  if (accion === 'consultar') {
    ctx.ruta = 'estado';
    ctx.folio = String(b.folio || '').toUpperCase().replace(/\s+/g, '').trim();
  } else if (accion === 'crear') {
    ctx.ruta = 'nuevo';
    const restr = Array.isArray(b.restricciones) ? b.restricciones.join(', ') : String(b.restricciones || 'ninguna');
    ctx.texto = extraerParametros(
      'perfil ' + String(b.perfil_riesgo || 'no indicado') +
      ', monto ' + String(b.monto_mxn || 'no indicado') + ' MXN' +
      ', horizonte ' + String(b.horizonte_anios || 'no indicado') + ' años' +
      ', objetivo: ' + String(b.objetivo || 'no indicado').slice(0, 200) +
      ', restricciones: ' + restr.slice(0, 120)
    );
  } else {
    ctx.ruta = 'invalido';
    ctx.motivo = 'La acción debe ser "crear" o "consultar".';
  }
}

// ---- Validaciones de entrada (no se envía nada inválido al modelo) ----
if (cfg.modo !== 'SIMULADO') { ctx.ruta = 'bloqueado'; ctx.motivo = 'El sistema solo opera en modo SIMULADO.'; }
if (ctx.ruta === 'nuevo' || ctx.ruta === 'aclarar') {
  const hallados = bloqueado(ctx.texto || '');
  if (!ctx.texto) { ctx.ruta = 'invalido'; ctx.motivo = 'La solicitud está vacía. Ejemplo: /nuevo perfil moderado, 250 mil pesos a 5 años, solo ESG'; }
  else if (ctx.texto.length > cfg.max_len_texto) { ctx.ruta = 'invalido'; ctx.motivo = 'La solicitud excede ' + cfg.max_len_texto + ' caracteres.'; }
  else if (hallados.length) { ctx.ruta = 'bloqueado'; ctx.motivo = 'La solicitud contiene instrucciones o contenido no permitido (inyección, secretos o URLs) y no se procesó.'; ctx.patrones = hallados.length; }
}
if ((ctx.ruta === 'estado' || ctx.ruta === 'aclarar' || ctx.ruta === 'decision') && !/^VAL-\d{6}-[A-Z0-9]{4}$/.test(ctx.folio || '')) {
  ctx.ruta = 'invalido'; ctx.motivo = 'Folio inválido. Formato: VAL-AAMMDD-XXXX';
}
if (ctx.ruta === 'decision' && ctx.rol !== 'asesor') { ctx.ruta = 'rechazo_permiso'; ctx.motivo = 'Solo el asesor autorizado puede aprobar o rechazar.'; }
if (ctx.ruta === 'aclarar' && ctx.canal !== 'telegram') { ctx.ruta = 'invalido'; ctx.motivo = 'Las aclaraciones se hacen por Telegram.'; }

if (ctx.presupuesto_solicitado !== null) {
  const p = ctx.presupuesto_solicitado;
  ctx.limite_costo_usd = (p > 0 && p < cfg.presupuesto_caso_usd_max) ? p : cfg.presupuesto_caso_usd_default;
} else {
  ctx.limite_costo_usd = cfg.presupuesto_caso_usd_default;
}
ctx.texto_mascarado = enmascarar(ctx.texto || '');
ctx.caso_id = ctx.ruta === 'nuevo' ? nuevoCasoId() : (ctx.folio || '');
delete ctx.texto; // a partir de aquí solo circula la versión enmascarada
return [{ json: ctx }];
