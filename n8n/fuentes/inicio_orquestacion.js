/*@include _config*/
/*@include _util*/
// Nodo: "Inicio orquestación" — el orquestador crea el plan y el estado del caso.
const ctx = $('Decidir ruta').first().json;
const esAclaracion = $('Preparar aclaración').isExecuted;
const prev = esAclaracion ? $('Preparar aclaración').first().json : null;
const st = {
  caso_id: ctx.caso_id || ctx.folio,
  canal: ctx.canal,
  chat_id: ctx.chat_id || '',
  usuario_ps: ctx.usuario_ps,
  rol: ctx.rol,
  texto: prev ? prev.texto_solicitud : ctx.texto_mascarado,
  demo: prev ? prev.caso_previo.demo : (ctx.demo || ''),
  limite_costo_usd: prev && prev.caso_previo.limite_costo_usd ? prev.caso_previo.limite_costo_usd : ctx.limite_costo_usd,
  gasto_usd: 0,
  gasto_previo_usd: prev ? prev.caso_previo.costo_usd : 0,
  llamadas_previas: prev ? prev.caso_previo.llamadas : 0,
  inicio_ms: Date.now(),
  llamadas: [],
  traza: [],
  iteracion: 0,
  version_propuesta: prev ? prev.caso_previo.version_propuesta : 0,
  a2_intentos: 0,
  correcciones: [],
  historial_revisiones: [],
  estado: 'en_proceso',
  motivo: '',
  plan: ['A1', 'A2', 'A3', 'A4'],
  siguiente: 'skills'
};
anotar(st, 'plan', 'ORQ', 'en_proceso',
  'canal=' + st.canal + ' rol=' + st.rol + ' limite_usd=' + st.limite_costo_usd + (st.demo ? ' demo=' + st.demo : ''),
  'plan=A1>A2>A3<>A4>aprobacion · max_iter=' + CONFIG.max_iteraciones_calidad + ' · max_llamadas=' + CONFIG.max_llamadas_caso);
return [{ json: st }];
