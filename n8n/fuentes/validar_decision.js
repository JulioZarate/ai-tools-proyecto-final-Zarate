// Nodo: "Validar decisión" — aprobación vinculada a caso + usuario autorizado + versión vigente + plazo.
const ctx = $('Decidir ruta').first().json;
const d = ctx.decision;
const filas = $input.all().map(function (i) { return i.json; }).filter(function (r) { return r && r.caso_id === d.caso_id; });
const caso = filas[0];
const ahora = new Date().toISOString();
let actualizar = null, texto = '', resultado = '';
if (!caso) { texto = 'No existe el caso ' + d.caso_id + '.'; resultado = 'no_encontrado'; }
else if (caso.estado !== 'pendiente_aprobacion') { texto = 'El caso ' + d.caso_id + ' ya no está pendiente (estado: ' + caso.estado + '). No se ejecutó nada.'; resultado = 'no_pendiente'; }
else if (Number(caso.version_propuesta) !== d.version) { texto = 'Ese botón corresponde a la versión ' + d.version + ', pero la vigente es la ' + caso.version_propuesta + '. No se ejecutó nada.'; resultado = 'version_no_vigente'; }
else if (caso.aprobacion_expira_en && Date.now() > Date.parse(caso.aprobacion_expira_en)) {
  texto = 'El plazo de aprobación del caso ' + d.caso_id + ' venció. Se marca como expirado y no se ejecuta la acción.';
  resultado = 'expirado';
  actualizar = { caso_id: caso.caso_id, estado: 'expirado', decision: 'expirado', decidido_por: 'sistema', decidido_en: ahora, actualizado_en: ahora, motivo: 'Venció el plazo de aprobación' };
} else if (d.accion === 'ap') {
  texto = '✅ Caso ' + d.caso_id + ' v' + d.version + ' APROBADO. Acción de prueba registrada: "envío simulado de propuesta informativa". Resultado simulado; no se contactó a ningún cliente.';
  resultado = 'aprobado_simulado';
  actualizar = { caso_id: caso.caso_id, estado: 'aprobado_simulado', decision: 'aprobado', decidido_por: ctx.usuario_ps, decidido_en: ahora, actualizado_en: ahora, motivo: 'Aprobado por asesor (simulado)' };
} else {
  texto = '❌ Caso ' + d.caso_id + ' v' + d.version + ' RECHAZADO por el asesor. No se ejecuta ninguna acción.';
  resultado = 'rechazado';
  actualizar = { caso_id: caso.caso_id, estado: 'rechazado', decision: 'rechazado', decidido_por: ctx.usuario_ps, decidido_en: ahora, actualizado_en: ahora, motivo: 'Rechazado por asesor' };
}
return [{ json: {
  canal: 'telegram', chat_id: ctx.chat_id, texto: texto, callback_id: ctx.callback_id,
  aviso: texto.slice(0, 190),
  actualizar: actualizar,
  traza: { caso_id: d.caso_id, paso: 0, agente: 'HUMANO', accion: 'decision_' + d.accion, estado: resultado,
    entrada_resumen: 'version_boton=' + d.version + ' usuario=' + ctx.usuario_ps, salida_resumen: texto.slice(0, 300),
    skill: '', version_skill: '', huella_skill: '', llamada_id: '', version_propuesta: d.version, iteracion: 0, timestamp: ahora }
} }];
