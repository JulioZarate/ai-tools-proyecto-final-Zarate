// Nodo: "Acuse de recibo" — respuesta inmediata con folio (Telegram o voz).
const ctx = $('Decidir ruta').first().json;
const folio = ctx.caso_id || ctx.folio;
const texto = (ctx.ruta === 'aclarar' ? 'Aclaración recibida para ' : 'Caso creado: ') + folio +
  '\nEstado: en proceso (4 agentes + revisión). Te aviso al terminar. Resultado simulado.';
return [{ json: {
  canal: ctx.canal,
  chat_id: ctx.chat_id || '',
  texto: texto,
  voz: { ok: true, folio: folio, estado: 'en_proceso', mensaje: 'Caso ' + folio + ' creado. Se procesa en menos de un minuto y el asesor recibirá la propuesta en Telegram para aprobarla. Puedes pedirme el estado con el folio.' }
} }];
