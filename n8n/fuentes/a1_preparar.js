/*@include _config*/
/*@include _util*/
// Nodo: "A1 preparar" — arma la llamada del Agente 1 y aplica la guardia de costo/límites.
const st = JSON.parse(JSON.stringify($input.first().json));
delete st._guardia; // nunca reutilizar la autorización de un paso anterior
const PROMPT = /*@prompt agente1_intake*/;
const r = st.skills.negocio.reglas;
const system = PROMPT.replace('{RESTRICCIONES}', r.restricciones_validas.join(', '));
const user = '<solicitud>' + st.texto + '</solicitud>\n' +
  'Rangos válidos: monto ' + r.monto_min_mxn + ' a ' + r.monto_max_mxn + ' MXN; horizonte ' + r.horizonte_min_anios + ' a ' + r.horizonte_max_anios + ' años.';
const g = guardia(st, 'A1', system, user);
st._guardia = g;
if (!g.ok) {
  st.estado = g.motivo === 'presupuesto' ? 'detenido_presupuesto' : 'detenido_limite';
  st.motivo = 'Guardia antes de A1: ' + g.motivo + ' (estimado ' + g.estimado_usd + ' USD, disponible ' + g.disponible_usd + ' USD).';
  st.siguiente = 'cerrar';
  anotar(st, 'guardia', 'ORQ', st.estado, 'agente=A1', st.motivo);
} else {
  st.request_body = cuerpoLLM(system, user, g.max_tokens);
  st.t0 = Date.now();
  st.est_tokens_entrada = estimarTokens(system) + estimarTokens(user);
}
return [{ json: st }];
