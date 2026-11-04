// Nodo: "Respuesta directa" — ayuda, entradas inválidas, rechazos y duplicados. No llama a ningún modelo.
const ctx = $('Decidir ruta').first().json;
const textos = {
  ayuda: 'Valoria Casa de Bolsa (ficticia) · modo SIMULADO\n\n' +
    '/nuevo <solicitud> — crea un caso. Ej.: /nuevo perfil moderado, 250 mil pesos a 5 años, objetivo retiro, solo ESG\n' +
    '/estado VAL-AAMMDD-XXXX — consulta un caso\n' +
    '/aclarar VAL-AAMMDD-XXXX <dato> — completa un caso que pidió aclaración\n\n' +
    'Las propuestas son informativas y requieren aprobación del asesor. Resultado simulado.',
  invalido: 'No pude procesar el mensaje: ' + (ctx.motivo || 'entrada inválida') + '\nEscribe /ayuda para ver ejemplos.',
  bloqueado: 'Solicitud bloqueada por política: ' + ctx.motivo + ' No se envió al modelo.',
  rechazo_acceso: 'Este bot es de uso restringido para usuarios de prueba autorizados.',
  rechazo_permiso: 'Acción no permitida: ' + ctx.motivo,
  duplicado: 'Este evento ya fue recibido' + (ctx.caso_previo ? ' (caso ' + ctx.caso_previo + ')' : '') + '. No se ejecutó de nuevo.'
};
const texto = textos[ctx.ruta] || textos.invalido;
return [{ json: {
  canal: ctx.canal,
  chat_id: ctx.chat_id || '',
  texto: texto,
  voz: { ok: ctx.ruta === 'duplicado', estado: ctx.ruta, folio: ctx.caso_previo || ctx.folio || '', mensaje: texto },
  traza: (ctx.ruta === 'ayuda' || ctx.ruta === 'duplicado') ? null : {
    caso_id: ctx.caso_id || 'SIN-CASO', paso: 0, agente: 'GUARDRAIL', accion: 'rechazo_entrada', estado: ctx.ruta,
    entrada_resumen: 'canal=' + ctx.canal + ' evento=' + ctx.evento_id, salida_resumen: ctx.motivo || '',
    skill: '', version_skill: '', huella_skill: '', llamada_id: '', version_propuesta: 0, iteracion: 0, timestamp: new Date().toISOString()
  }
} }];
