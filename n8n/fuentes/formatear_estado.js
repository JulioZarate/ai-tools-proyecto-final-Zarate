// Nodo: "Formatear estado" — lee el registro persistente; nunca inventa un estado.
const ctx = $('Decidir ruta').first().json;
const filas = $input.all().map(function (i) { return i.json; }).filter(function (r) { return r && r.caso_id === ctx.folio; });
const caso = filas[0];
if (!caso) {
  const msg = 'No encontré el caso ' + ctx.folio + ' en el registro. Verifica el folio.';
  return [{ json: { canal: ctx.canal, chat_id: ctx.chat_id || '', texto: msg, voz: { ok: false, folio: ctx.folio, estado: 'no_encontrado', mensaje: msg }, expirar: null } }];
}
let estado = caso.estado;
let expirar = null;
if (estado === 'pendiente_aprobacion' && caso.aprobacion_expira_en && Date.now() > Date.parse(caso.aprobacion_expira_en)) {
  estado = 'expirado';
  expirar = { caso_id: caso.caso_id, estado: 'expirado', decision: 'expirado', decidido_por: 'sistema', decidido_en: new Date().toISOString(), actualizado_en: new Date().toISOString(), motivo: 'Venció el plazo de aprobación' };
}
let prop = null;
try { prop = caso.propuesta_json ? JSON.parse(caso.propuesta_json) : null; } catch (e) { prop = null; }
const m = prop && prop.metricas ? prop.metricas : null;
const etiquetas = {
  recibido: 'recibido', en_proceso: 'en proceso', pendiente_aprobacion: 'pendiente de aprobación del asesor',
  aprobado_simulado: 'aprobado (envío simulado)', rechazado: 'rechazado por el asesor', expirado: 'expirado sin aprobación',
  requiere_aclaracion: 'requiere aclaración', fuera_de_politica: 'fuera de política', bloqueado_politica: 'bloqueado por política',
  escalado_humano: 'escalado a revisión humana', detenido_presupuesto: 'detenido por presupuesto', detenido_limite: 'detenido por límite',
  error_validacion: 'error de validación', error_api: 'error del servicio de IA', error_skill: 'error al cargar skills'
};
const lineas = [
  'Caso ' + caso.caso_id + ' · ' + (etiquetas[estado] || estado),
  'Actualizado: ' + String(caso.actualizado_en || '').slice(0, 16).replace('T', ' ') + ' UTC',
  'Versión de propuesta: ' + (caso.version_propuesta || 0) + ' · iteraciones: ' + (caso.iteraciones || 0)
];
if (caso.perfil_riesgo) lineas.push('Perfil: ' + caso.perfil_riesgo + ' · monto: ' + caso.monto_mxn + ' MXN · horizonte: ' + caso.horizonte_anios + ' años');
if (m) lineas.push('Rendimiento esperado ilustrativo: ' + m.rend_esperado_anual_pct + '% anual · volatilidad aprox.: ' + m.volatilidad_aprox_pct + '%');
if (caso.motivo) lineas.push('Nota: ' + caso.motivo);
lineas.push('Resultado simulado; no constituye una recomendación.');
const texto = lineas.join('\n');
return [{ json: {
  canal: ctx.canal, chat_id: ctx.chat_id || '', texto: texto, expirar: expirar,
  voz: { ok: true, folio: caso.caso_id, estado: estado, estado_legible: etiquetas[estado] || estado, actualizado_en: caso.actualizado_en,
         rendimiento_esperado_pct: m ? m.rend_esperado_anual_pct : null, version_propuesta: caso.version_propuesta, nota: caso.motivo || '',
         mensaje: texto }
} }];
