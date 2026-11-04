/*@include _config*/
/*@include _util*/
// Nodo: "A4 validar" — decisión combinada (código AND LLM) y control del loop de calidad.
const st = JSON.parse(JSON.stringify($('A4 preparar').first().json));
delete st.request_body;
const resp = $input.first().json;
const reg = registrarLlamada(st, 'A4', 'agente_4_revision', resp, st);
if (reg.error) {
  st.estado = 'error_api'; st.motivo = 'A4: ' + reg.error + '. No se libera sin revisión.'; st.siguiente = 'cerrar';
  anotar(st, 'revision', 'A4', 'error_api', 'v' + st.version_propuesta, reg.error, { llamada_id: reg.llamada_id });
  return [{ json: st }];
}
const o = extraerJSON(reg.texto);
const veredictoLLM = o && (o.veredicto === 'aprobado' || o.veredicto === 'devuelto') ? o.veredicto : 'devuelto';
const correccionesLLM = o && Array.isArray(o.correcciones) ? o.correcciones.map(String).slice(0, 8) : ['La revisión no devolvió JSON válido; revisar formato.'];
const aprobado = st.hallazgos_codigo.length === 0 && veredictoLLM === 'aprobado';
const revision = {
  version_revisada: st.version_propuesta, veredicto_final: aprobado ? 'aprobado' : 'devuelto', veredicto_llm: veredictoLLM,
  hallazgos_codigo: st.hallazgos_codigo, correcciones: st.hallazgos_codigo.concat(correccionesLLM).slice(0, 10),
  comentario: o && o.comentario ? String(o.comentario).slice(0, 300) : ''
};
st.revision = revision;
st.historial_revisiones.push({ version: st.version_propuesta, veredicto: revision.veredicto_final, hallazgos: st.hallazgos_codigo.length, llamada_id: reg.llamada_id });
if (aprobado) {
  st.estado = 'pendiente_aprobacion';
  st.motivo = '';
  st.aprobacion_expira_en = new Date(Date.now() + CONFIG.aprobacion_minutos * 60000).toISOString();
  st.siguiente = 'cerrar';
} else if (st.iteracion < CONFIG.max_iteraciones_calidad) {
  st.correcciones = revision.correcciones;
  st.siguiente = 'A3';
} else {
  st.estado = 'escalado_humano';
  st.motivo = 'Se agotaron ' + CONFIG.max_iteraciones_calidad + ' iteraciones de calidad; última versión v' + st.version_propuesta + ' con hallazgos: ' + revision.correcciones.slice(0, 3).join(' | ');
  st.siguiente = 'cerrar';
}
anotar(st, 'revision', 'A4', revision.veredicto_final, 'v' + st.version_propuesta + ' · hallazgos_codigo=' + st.hallazgos_codigo.length,
  'LLM=' + veredictoLLM + ' · final=' + revision.veredicto_final + (aprobado ? '' : ' · correcciones: ' + revision.correcciones.slice(0, 3).join(' | ')),
  { llamada_id: reg.llamada_id, skill: 'revision-cumplimiento', version_skill: st.skills.revision.version });
return [{ json: st }];
