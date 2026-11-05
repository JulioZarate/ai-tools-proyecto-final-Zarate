/*@include _config*/
/*@include _util*/
// Nodo: "A2 validar" — verifica que cada ID exista y sea elegible (el LLM no puede introducir instrumentos).
const st = JSON.parse(JSON.stringify($('A2 preparar').first().json));
delete st.request_body;
const resp = $input.first().json;
const reg = registrarLlamada(st, 'A2', 'agente_2_datos', resp, st);
const r = st.skills.negocio.reglas;
if (reg.error) {
  st.estado = 'error_api'; st.motivo = 'A2: ' + reg.error; st.siguiente = 'cerrar';
  anotar(st, 'seleccion', 'A2', 'error_api', 'elegibles', reg.error, { llamada_id: reg.llamada_id });
  return [{ json: st }];
}
const o = extraerJSON(reg.texto);
// Solo un JSON ilegible justifica repetir la llamada. Lo demás lo corrige el código y lo declara.
if (!o || typeof o.seleccion !== 'object' || o.seleccion === null) {
  st.a2_intentos += 1;
  if (st.a2_intentos <= CONFIG.max_correcciones_a2) {
    st.a2_feedback = 'Tu respuesta no fue JSON válido con la clave "seleccion". Responde solo con el JSON pedido.';
    st.siguiente = 'A2';
    anotar(st, 'seleccion', 'A2', 'devuelto', 'elegibles', 'JSON inválido; se pide de nuevo', { llamada_id: reg.llamada_id });
  } else {
    st.estado = 'error_validacion'; st.motivo = 'A2 no entregó JSON válido tras ' + st.a2_intentos + ' intentos.';
    st.siguiente = 'cerrar';
    anotar(st, 'seleccion', 'A2', 'invalido', 'elegibles', st.motivo, { llamada_id: reg.llamada_id });
  }
  return [{ json: st }];
}
const seleccion = {};
const ajustes = [];
for (const clase of Object.keys(st.elegibles.clases)) {
  const info = st.elegibles.clases[clase];
  const validos = info.elegibles.map(function (e) { return e.id; });
  const pedidos = Array.isArray(o.seleccion[clase]) ? o.seleccion[clase].map(String) : [];
  const malos = pedidos.filter(function (id) { return validos.indexOf(id) < 0; });
  if (malos.length) ajustes.push(clase + ': se descartaron IDs no elegibles ' + malos.join(','));
  let buenos = pedidos.filter(function (id, k) { return validos.indexOf(id) >= 0 && pedidos.indexOf(id) === k; }).slice(0, r.instrumentos_por_clase_max);
  if (clase !== r.clase_destino_sobrante && info.peso_pct > 0 && buenos.length < info.minimo) {
    const faltan = validos.filter(function (id) { return buenos.indexOf(id) < 0; }).slice(0, info.minimo - buenos.length);
    if (faltan.length) { buenos = buenos.concat(faltan); ajustes.push(clase + ': el código completó ' + faltan.join(',') + ' para respetar la concentración máxima'); }
  }
  seleccion[clase] = buenos;
}
st.ajustes_a2 = ajustes;
st.seleccion = seleccion;
st.justificaciones = o.justificaciones || {};
st.insuficiencias = Array.isArray(o.insuficiencias) ? o.insuficiencias : [];
st.siguiente = 'A3';
delete st.a2_feedback;
anotar(st, 'seleccion', 'A2', ajustes.length ? 'ok_con_ajustes' : 'ok', 'perfil=' + st.elegibles.perfil_aplicado, JSON.stringify(seleccion) + (st.insuficiencias.length ? ' · insuficiencia: ' + st.insuficiencias.join(',') : '') + (ajustes.length ? ' · ajustes: ' + ajustes.join(' | ') : ''), { llamada_id: reg.llamada_id, skill: 'propuesta-portafolio', version_skill: st.skills.negocio.version });
return [{ json: st }];
