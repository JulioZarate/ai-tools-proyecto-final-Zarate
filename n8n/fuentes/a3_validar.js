/*@include _config*/
/*@include _util*/
// Nodo: "A3 validar" — contrato JSON de la redacción; inyección de defecto SOLO en modo demo declarado.
const st = JSON.parse(JSON.stringify($('A3 preparar').first().json));
delete st.request_body;
const resp = $input.first().json;
const reg = registrarLlamada(st, 'A3', 'agente_3_propuesta', resp, st);
if (reg.error) {
  st.estado = 'error_api'; st.motivo = 'A3: ' + reg.error; st.siguiente = 'cerrar';
  anotar(st, 'redaccion', 'A3', 'error_api', 'v' + st.version_propuesta, reg.error, { llamada_id: reg.llamada_id });
  return [{ json: st }];
}
const o = extraerJSON(reg.texto);
if (!o || typeof o.resumen !== 'string' || !Array.isArray(o.supuestos) || !Array.isArray(o.riesgos)) {
  if (st.iteracion < CONFIG.max_iteraciones_calidad) {
    st.correcciones = ['Tu respuesta anterior no era JSON válido con las claves resumen, supuestos, riesgos y advertencias. Responde solo con ese JSON.'];
    st.siguiente = 'A3';
    anotar(st, 'redaccion', 'A3', 'invalido', 'v' + st.version_propuesta, 'JSON inválido; se reintenta (iteración ' + st.iteracion + ')', { llamada_id: reg.llamada_id });
  } else {
    st.estado = 'escalado_humano'; st.motivo = 'A3 no produjo JSON válido en ' + st.iteracion + ' iteraciones.'; st.siguiente = 'cerrar';
    anotar(st, 'redaccion', 'A3', 'escalado_humano', 'v' + st.version_propuesta, st.motivo, { llamada_id: reg.llamada_id });
  }
  return [{ json: st }];
}
st.redaccion = { resumen: o.resumen, supuestos: o.supuestos.map(String), riesgos: o.riesgos.map(String), advertencias: Array.isArray(o.advertencias) ? o.advertencias.map(String) : [] };
let nota = '';
if (st.demo === 'falla_v1' && st.version_propuesta === 1) {
  // Defecto DECLARADO para demostrar el loop V1→V2 (parámetro demo=falla_v1). Queda en la traza.
  st.redaccion.resumen = st.redaccion.resumen.replace(/resultado simulado[.:,]?\s*/ig, '') + ' Este portafolio tiene un rendimiento garantizado.';
  nota = ' · DEFECTO INYECTADO (demo=falla_v1): se quitó "Resultado simulado" y se agregó "garantizado"';
}
st.siguiente = 'A4';
anotar(st, 'redaccion', 'A3', 'ok', 'v' + st.version_propuesta + (st.correcciones && st.correcciones.length ? ' con ' + st.correcciones.length + ' correcciones' : ''),
  st.redaccion.resumen.slice(0, 220) + nota, { llamada_id: reg.llamada_id, skill: 'propuesta-portafolio', version_skill: st.skills.negocio.version });
return [{ json: st }];
