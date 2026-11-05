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
const problemas = [];
const seleccion = {};
if (!o || typeof o.seleccion !== 'object' || o.seleccion === null) problemas.push('JSON sin objeto "seleccion"');
else {
  for (const clase of Object.keys(st.elegibles.clases)) {
    const info = st.elegibles.clases[clase];
    const ids = Array.isArray(o.seleccion[clase]) ? o.seleccion[clase].map(String) : [];
    const validos = info.elegibles.map(function (e) { return e.id; });
    const malos = ids.filter(function (id) { return validos.indexOf(id) < 0; });
    if (malos.length) problemas.push(clase + ': IDs no elegibles ' + malos.join(','));
    const buenos = ids.filter(function (id, k) { return validos.indexOf(id) >= 0 && ids.indexOf(id) === k; });
    if (buenos.length > r.instrumentos_por_clase_max) problemas.push(clase + ': más de ' + r.instrumentos_por_clase_max + ' instrumentos');
    // La clase destino del sobrante (liquidez) la completa el código si el agente no la elige.
    if (clase !== r.clase_destino_sobrante && info.peso_pct > 0 && buenos.length < info.minimo) problemas.push(clase + ': se requieren al menos ' + info.minimo + ' instrumentos');
    seleccion[clase] = buenos.slice(0, r.instrumentos_por_clase_max);
  }
}
if (problemas.length) {
  st.a2_intentos += 1;
  if (st.a2_intentos <= CONFIG.max_correcciones_a2) {
    st.a2_feedback = problemas.join('; ');
    st.siguiente = 'A2';
    anotar(st, 'seleccion', 'A2', 'devuelto', 'elegibles', 'Corrección solicitada: ' + st.a2_feedback, { llamada_id: reg.llamada_id });
  } else {
    st.estado = 'error_validacion'; st.motivo = 'A2 no entregó una selección válida tras ' + st.a2_intentos + ' intentos: ' + problemas.join('; ');
    st.siguiente = 'cerrar';
    anotar(st, 'seleccion', 'A2', 'invalido', 'elegibles', st.motivo, { llamada_id: reg.llamada_id });
  }
  return [{ json: st }];
}
st.seleccion = seleccion;
st.justificaciones = o.justificaciones || {};
st.insuficiencias = Array.isArray(o.insuficiencias) ? o.insuficiencias : [];
st.siguiente = 'A3';
delete st.a2_feedback;
anotar(st, 'seleccion', 'A2', 'ok', 'perfil=' + st.elegibles.perfil_aplicado, JSON.stringify(seleccion) + (st.insuficiencias.length ? ' · insuficiencia: ' + st.insuficiencias.join(',') : ''), { llamada_id: reg.llamada_id, skill: 'propuesta-portafolio', version_skill: st.skills.negocio.version });
return [{ json: st }];
