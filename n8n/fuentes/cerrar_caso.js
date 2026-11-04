/*@include _config*/
/*@include _util*/
// Nodo: "Cerrar caso" — único punto de cierre: estado honesto, filas para tablas y notificaciones.
const st = JSON.parse(JSON.stringify($input.first().json));
delete st.request_body;
const terminales = ['pendiente_aprobacion', 'requiere_aclaracion', 'fuera_de_politica', 'escalado_humano', 'detenido_presupuesto', 'detenido_limite', 'error_validacion', 'error_api', 'error_skill'];
if (terminales.indexOf(st.estado) < 0) { st.motivo = 'Cierre inesperado desde estado ' + st.estado; st.estado = 'error_validacion'; }
// Nunca liberar sin aprobación vigente del revisor:
if (st.estado === 'pendiente_aprobacion' && !(st.revision && st.revision.veredicto_final === 'aprobado' && st.revision.version_revisada === st.version_propuesta)) {
  st.estado = 'escalado_humano'; st.motivo = 'Cierre bloqueado: la versión vigente no tiene aprobación del Agente 4.';
}
const ahora = ahoraISO();
anotar(st, 'cierre', 'ORQ', st.estado, 'llamadas=' + st.llamadas.length + ' · iteraciones=' + st.iteracion,
  'gasto_usd=' + st.gasto_usd + ' de ' + st.limite_costo_usd + (st.motivo ? ' · ' + st.motivo : ''));
const req = st.requerimiento || {};
const propuesta = st.calculo && st.redaccion ? {
  version: st.version_propuesta, perfil_aplicado: st.calculo.perfil_aplicado, lineas: st.calculo.lineas, metricas: st.calculo.metricas,
  supuestos: st.calculo.supuestos.concat(st.redaccion.supuestos), riesgos: st.redaccion.riesgos, resumen: st.redaccion.resumen,
  fuente: 'VALORIA-CAT (ficticio)', modo: 'SIMULADO'
} : null;
const fila = {
  caso_id: st.caso_id,
  estado: st.estado,
  version_propuesta: st.version_propuesta,
  perfil_riesgo: req.perfil_riesgo || '',
  monto_mxn: req.monto_mxn || 0,
  horizonte_anios: req.horizonte_anios || 0,
  restricciones: (req.restricciones || []).join(','),
  requerimiento_json: st.requerimiento ? JSON.stringify(st.requerimiento) : '',
  propuesta_json: propuesta ? JSON.stringify(propuesta) : '',
  revision_json: st.revision ? JSON.stringify({ ultima: st.revision, historial: st.historial_revisiones }) : '',
  resumen: st.redaccion ? st.redaccion.resumen.slice(0, 1500) : '',
  iteraciones: st.iteracion,
  llamadas: (st.llamadas_previas || 0) + st.llamadas.length,
  costo_usd: redondear6((st.gasto_previo_usd || 0) + st.gasto_usd),
  actualizado_en: ahora,
  aprobacion_expira_en: st.aprobacion_expira_en || '',
  motivo: (st.motivo || '').slice(0, 500)
};
// Notificaciones
const notifs = [];
const cab = 'Caso ' + st.caso_id + ' · ' + st.estado.replace(/_/g, ' ');
if (st.estado === 'pendiente_aprobacion') {
  const lineas = st.calculo.lineas.map(function (l) { return '• ' + l.id + ' ' + l.peso_pct + '% (' + l.monto_mxn.toLocaleString('es-MX') + ' MXN)'; }).join('\n');
  const texto = '🟡 Aprobación requerida · ' + cab + ' · v' + st.version_propuesta + '\n' +
    'Perfil ' + req.perfil_riesgo + ' (aplicado: ' + st.calculo.perfil_aplicado + ') · ' + req.monto_mxn.toLocaleString('es-MX') + ' MXN · ' + req.horizonte_anios + ' años\n' +
    lineas + '\n' +
    'Rend. esperado ilustrativo ' + st.calculo.metricas.rend_esperado_anual_pct + '% · volatilidad aprox. ' + st.calculo.metricas.volatilidad_aprox_pct + '%\n\n' +
    st.redaccion.resumen.slice(0, 1400) + '\n\n' +
    'Acción a aprobar: envío SIMULADO de la propuesta informativa. Vence: ' + st.aprobacion_expira_en.slice(11, 16) + ' UTC.\n' +
    'Iteraciones: ' + st.iteracion + ' · costo IA: ' + st.gasto_usd + ' USD';
  notifs.push({ chat_id: CONFIG.asesor_chat_id, texto: texto, botones: true,
    cb_aprobar: 'ap|' + st.caso_id + '|' + st.version_propuesta, cb_rechazar: 're|' + st.caso_id + '|' + st.version_propuesta });
}
if (st.canal === 'telegram' && !(st.estado === 'pendiente_aprobacion' && st.chat_id === CONFIG.asesor_chat_id)) {
  let t = cab + '\n';
  if (st.estado === 'pendiente_aprobacion') t += 'La propuesta pasó la revisión y espera aprobación del asesor.';
  else if (st.estado === 'requiere_aclaracion') t += st.motivo + '\nResponde con: /aclarar ' + st.caso_id + ' <dato faltante>';
  else t += (st.motivo || '') ;
  t += '\nResultado simulado.';
  notifs.push({ chat_id: st.chat_id, texto: t, botones: false, cb_aprobar: '', cb_rechazar: '' });
}
if (st.canal === 'voz' && st.estado !== 'pendiente_aprobacion') {
  notifs.push({ chat_id: CONFIG.asesor_chat_id, texto: 'ℹ️ Caso creado por voz · ' + cab + '\n' + (st.motivo || ''), botones: false, cb_aprobar: '', cb_rechazar: '' });
}
return [{ json: { caso_id: st.caso_id, fila: fila, costos: st.llamadas, traza: st.traza, notificaciones: notifs, estado: st.estado } }];
