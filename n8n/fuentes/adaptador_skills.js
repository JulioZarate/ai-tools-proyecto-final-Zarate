/*@include _config*/
/*@include _util*/
// Nodo: "Adaptador de skills" — carga SKILL.md publicado en Pages y extrae versión, reglas e instrucciones.
const st = JSON.parse(JSON.stringify($('Inicio orquestación').first().json));
function parsear(nombre, resp) {
  const md = resp && typeof resp.data === 'string' ? resp.data : '';
  if (!md || resp.error) return { ok: false, error: 'No se pudo descargar ' + nombre };
  const ver = (md.match(/^version:\s*([0-9.]+)\s*$/m) || [])[1];
  const bloque = (md.match(/```json reglas\s*([\s\S]*?)```/) || [])[1];
  const instr = (md.match(/## Instrucciones para el agente\s*([\s\S]*?)\n## /) || [])[1];
  let reglas = null;
  try { reglas = JSON.parse(bloque); } catch (e) { reglas = null; }
  if (!ver || !reglas || !instr) return { ok: false, error: 'Formato inválido en ' + nombre };
  if (reglas.version !== ver) return { ok: false, error: 'Versión del bloque de reglas distinta a la del encabezado en ' + nombre };
  const instrucciones = instr.replace(/<!--[\s\S]*?-->/g, '').trim();
  return { ok: true, nombre: nombre, version: ver, reglas: reglas, instrucciones: instrucciones, huella: hashCorto(md) };
}
const negocio = parsear('propuesta-portafolio', $('Descargar skill negocio').first().json);
const revision = parsear('revision-cumplimiento', $('Descargar skill revisión').first().json);
if (!negocio.ok || !revision.ok) {
  st.estado = 'error_skill';
  st.motivo = (negocio.error || '') + ' ' + (revision.error || '');
  st.siguiente = 'cerrar';
  anotar(st, 'cargar_skills', 'ORQ', 'error_skill', 'pages=' + CONFIG.pages_base_url, st.motivo);
} else {
  st.skills = { negocio: negocio, revision: revision };
  st.siguiente = 'A1';
  anotar(st, 'cargar_skill', 'ORQ', 'ok', 'GET /skills/propuesta-portafolio/SKILL.md', 'reglas=' + Object.keys(negocio.reglas).length + ' claves', { skill: negocio.nombre, version_skill: negocio.version, huella_skill: negocio.huella });
  anotar(st, 'cargar_skill', 'ORQ', 'ok', 'GET /skills/revision-cumplimiento/SKILL.md', 'reglas=' + Object.keys(revision.reglas).length + ' claves', { skill: revision.nombre, version_skill: revision.version, huella_skill: revision.huella });
}
return [{ json: st }];
