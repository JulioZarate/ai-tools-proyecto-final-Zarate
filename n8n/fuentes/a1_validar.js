/*@include _config*/
/*@include _util*/
/*@include calculo_portafolio*/
// Nodo: "A1 validar" — registra consumo y valida el contrato del Agente 1 con código.
const st = JSON.parse(JSON.stringify($('A1 preparar').first().json));
delete st.request_body;
const resp = $input.first().json;
const reg = registrarLlamada(st, 'A1', 'agente_1_intake', resp, st);
const r = st.skills.negocio.reglas;
if (reg.error) {
  st.estado = 'error_api'; st.motivo = 'A1: ' + reg.error; st.siguiente = 'cerrar';
  anotar(st, 'intake', 'A1', 'error_api', 'texto_enmascarado', reg.error, { llamada_id: reg.llamada_id });
  return [{ json: st }];
}
const o = extraerJSON(reg.texto);
const claves = ['perfil_riesgo', 'monto_mxn', 'horizonte_anios', 'objetivo', 'restricciones', 'solicita_fuera_de_politica', 'faltantes', 'pregunta_aclaracion', 'senales_riesgo'];
if (!o || claves.some(function (k) { return !(k in o); })) {
  st.estado = 'error_validacion'; st.motivo = 'A1 devolvió una salida que no cumple el contrato JSON.'; st.siguiente = 'cerrar';
  anotar(st, 'intake', 'A1', 'invalido', 'texto_enmascarado', String(reg.texto).slice(0, 200), { llamada_id: reg.llamada_id });
  return [{ json: st }];
}
// Validación determinista: el LLM extrae, el código decide (validarRequerimiento del cálculo compartido).
const val = validarRequerimiento(o, r);
const req = val.req, faltantes = val.faltantes, notas = val.notas;
st.requerimiento = req;
const senales = Array.isArray(o.senales_riesgo) ? o.senales_riesgo : [];
if (o.solicita_fuera_de_politica === true) {
  st.estado = 'fuera_de_politica';
  st.motivo = 'La solicitud pide productos o garantías fuera de política (derivados, cripto, apalancamiento, rendimientos garantizados u órdenes). Se escala al asesor.';
  st.siguiente = 'cerrar';
} else if (faltantes.length) {
  st.estado = 'requiere_aclaracion';
  st.motivo = 'Faltan o son inválidos: ' + faltantes.join(', ') + (notas.length ? ' (' + notas.join('; ') + ')' : '') + '. ' + (o.pregunta_aclaracion ? 'Pregunta: ' + String(o.pregunta_aclaracion).slice(0, 200) : '');
  st.faltantes = faltantes;
  st.siguiente = 'cerrar';
} else {
  st.estado = 'en_proceso';
  st.siguiente = 'A2';
}
anotar(st, 'intake', 'A1', st.siguiente === 'A2' ? 'completo' : st.estado, 'texto_enmascarado(' + st.texto.length + ' car.)',
  JSON.stringify(req) + (senales.length ? ' · señales=' + senales.length : ''), { llamada_id: reg.llamada_id, skill: 'propuesta-portafolio', version_skill: st.skills.negocio.version });
return [{ json: st }];
