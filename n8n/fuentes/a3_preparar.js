/*@include _config*/
/*@include _util*/
/*@include _catalogo*/
/*@include calculo_portafolio*/
// Nodo: "A3 preparar" — cálculo determinista + redacción (LLM). Cada paso por aquí = nueva versión e iteración.
const st = JSON.parse(JSON.stringify($input.first().json));
delete st._guardia; // nunca reutilizar la autorización de un paso anterior
const PROMPT = /*@prompt agente3_propuesta*/;
const r = st.skills.negocio.reglas;
st.iteracion += 1;
st.version_propuesta += 1;
const calc = calcularPropuesta(st.requerimiento, CATALOGO, r, st.seleccion);
st.calculo = calc;
if (!calc.valido) {
  st.estado = 'escalado_humano';
  st.motivo = 'El cálculo no cumple reglas: ' + calc.errores.join(' | ');
  st.siguiente = 'cerrar';
  anotar(st, 'calculo', 'A3', 'escalado_humano', JSON.stringify(st.seleccion), st.motivo, { skill: 'propuesta-portafolio', version_skill: st.skills.negocio.version });
  return [{ json: st }];
}
anotar(st, 'calculo', 'A3', 'ok', JSON.stringify(st.seleccion),
  'v' + st.version_propuesta + ' · suma=' + calc.metricas.suma_pesos_pct + '% · rend=' + calc.metricas.rend_esperado_anual_pct + '% · vol=' + calc.metricas.volatilidad_aprox_pct + '%',
  { skill: 'propuesta-portafolio', version_skill: st.skills.negocio.version, huella_skill: st.skills.negocio.huella });
const system = PROMPT.replace('{INSTRUCCIONES_SKILL}', st.skills.negocio.instrucciones);
let user = 'Caso ' + st.caso_id + ' · versión ' + st.version_propuesta + '\n' +
  'Requerimiento: ' + JSON.stringify(st.requerimiento) + '\n' +
  'Cálculo (no lo cambies): ' + JSON.stringify({ perfil_aplicado: calc.perfil_aplicado, lineas: calc.lineas, metricas: calc.metricas }) + '\n' +
  'Supuestos del cálculo: ' + JSON.stringify(calc.supuestos) + '\n' +
  'Justificaciones del Agente 2: ' + JSON.stringify(st.justificaciones || {});
if (st.correcciones && st.correcciones.length) user += '\nCorrecciones obligatorias de la revisión anterior: ' + JSON.stringify(st.correcciones);
const g = guardia(st, 'A3', system, user);
st._guardia = g;
if (!g.ok) {
  st.estado = g.motivo === 'presupuesto' ? 'detenido_presupuesto' : 'detenido_limite';
  st.motivo = 'Guardia antes de A3 (iteración ' + st.iteracion + '): ' + g.motivo + ' (estimado ' + g.estimado_usd + ' USD, disponible ' + g.disponible_usd + ' USD).';
  st.siguiente = 'cerrar';
  anotar(st, 'guardia', 'ORQ', st.estado, 'agente=A3', st.motivo);
} else {
  st.request_body = cuerpoLLM(system, user, g.max_tokens);
  st.t0 = Date.now();
  st.est_tokens_entrada = estimarTokens(system) + estimarTokens(user);
}
return [{ json: st }];
