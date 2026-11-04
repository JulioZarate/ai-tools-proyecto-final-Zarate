// Nodo: "Preparar aclaración" — solo el mismo usuario y solo si el caso pidió aclaración.
const ctx = $('Decidir ruta').first().json;
const filas = $input.all().map(function (i) { return i.json; }).filter(function (r) { return r && r.caso_id === ctx.folio; });
const caso = filas[0];
let ok = true, motivo = '';
if (!caso) { ok = false; motivo = 'No existe el caso ' + ctx.folio + '.'; }
else if (caso.estado !== 'requiere_aclaracion') { ok = false; motivo = 'El caso ' + ctx.folio + ' está en estado "' + caso.estado + '" y no admite aclaraciones.'; }
else if (caso.usuario_ps !== ctx.usuario_ps) { ok = false; motivo = 'Solo quien creó el caso puede aclararlo.'; }
if (!ok) {
  return [{ json: { valida: false, canal: ctx.canal, chat_id: ctx.chat_id, texto: motivo, voz: { ok: false, mensaje: motivo } } }];
}
const texto = (String(caso.texto_solicitud || '') + ' | Aclaración: ' + ctx.texto_mascarado).slice(0, 600);
return [{ json: {
  valida: true,
  fila: { caso_id: caso.caso_id, estado: 'recibido', texto_solicitud: texto, actualizado_en: new Date().toISOString() },
  caso_previo: { version_propuesta: Number(caso.version_propuesta || 0), iteraciones: Number(caso.iteraciones || 0), costo_usd: Number(caso.costo_usd || 0), limite_costo_usd: Number(caso.limite_costo_usd || 0), llamadas: Number(caso.llamadas || 0), demo: caso.demo || '' },
  texto_solicitud: texto
} }];
