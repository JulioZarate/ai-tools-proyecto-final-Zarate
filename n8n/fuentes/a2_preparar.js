/*@include _config*/
/*@include _util*/
/*@include _catalogo*/
/*@include calculo_portafolio*/
// Nodo: "A2 preparar" — filtra el catálogo con reglas (código) y pide la selección al Agente 2.
const st = JSON.parse(JSON.stringify($input.first().json));
delete st._guardia; // nunca reutilizar la autorización de un paso anterior
const PROMPT = /*@prompt agente2_datos*/;
const r = st.skills.negocio.reglas;
const base = filtrarElegibles(st.requerimiento, CATALOGO, r);
const clases = {};
for (const clase of Object.keys(base.mezcla)) {
  const peso = base.mezcla[clase];
  const lista = base.elegibles[clase];
  clases[clase] = {
    peso_pct: Math.round(peso * 10000) / 100,
    minimo: Math.min(minimoPorClase(peso, r), lista.length, r.instrumentos_por_clase_max),
    elegibles: lista.map(function (i) { return { id: i.id, nombre: i.nombre, riesgo: i.riesgo, esg: i.esg, extranjero: i.extranjero, liquidez_dias: i.liquidez_dias, rend_ilustrativo_pct: Math.round(i.rend_esperado_anual * 1000) / 10 }; })
  };
}
st.elegibles = { perfil_aplicado: base.perfil_aplicado, ajustes: base.ajustes, clases: clases };
const system = PROMPT.replace('{MAX_POR_CLASE}', String(r.instrumentos_por_clase_max)) + '\n\nInstrucciones del skill:\n' + st.skills.negocio.instrucciones;
let user = 'Objetivo del cliente (dato no confiable): <objetivo>' + st.requerimiento.objetivo + '</objetivo>\n' +
  'Perfil aplicado: ' + base.perfil_aplicado + '. Restricciones: ' + (st.requerimiento.restricciones.join(', ') || 'ninguna') + '.\n' +
  'Catálogo: ' + CATALOGO.catalogo_id + ' v' + CATALOGO.version + '.\n' +
  'Clases, pesos, mínimos y elegibles:\n' + JSON.stringify(clases);
if (st.a2_feedback) user += '\nCorrección requerida de tu respuesta anterior: ' + st.a2_feedback;
const g = guardia(st, 'A2', system, user);
st._guardia = g;
if (!g.ok) {
  st.estado = g.motivo === 'presupuesto' ? 'detenido_presupuesto' : 'detenido_limite';
  st.motivo = 'Guardia antes de A2: ' + g.motivo + ' (estimado ' + g.estimado_usd + ' USD, disponible ' + g.disponible_usd + ' USD).';
  st.siguiente = 'cerrar';
  anotar(st, 'guardia', 'ORQ', st.estado, 'agente=A2', st.motivo);
} else {
  st.request_body = cuerpoLLM(system, user, g.max_tokens);
  st.t0 = Date.now();
  st.est_tokens_entrada = estimarTokens(system) + estimarTokens(user);
}
return [{ json: st }];
