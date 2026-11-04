// Nodo: "Crear caso" — fila inicial en valoria_casos (columnas exactas de la tabla).
const ctx = $('Decidir ruta').first().json;
const ahora = new Date().toISOString();
return [{ json: {
  caso_id: ctx.caso_id,
  canal: ctx.canal,
  usuario_ps: ctx.usuario_ps,
  estado: 'recibido',
  version_propuesta: 0,
  texto_solicitud: ctx.texto_mascarado,
  perfil_riesgo: '',
  monto_mxn: 0,
  horizonte_anios: 0,
  restricciones: '',
  requerimiento_json: '',
  propuesta_json: '',
  revision_json: '',
  resumen: '',
  iteraciones: 0,
  llamadas: 0,
  costo_usd: 0,
  limite_costo_usd: ctx.limite_costo_usd,
  creado_en: ahora,
  actualizado_en: ahora,
  aprobacion_expira_en: '',
  decision: '',
  decidido_por: '',
  decidido_en: '',
  motivo: '',
  demo: ctx.demo || ''
} }];
