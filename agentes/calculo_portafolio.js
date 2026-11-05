// Valoria — cálculo determinista de la propuesta (Agente 3, parte verificable).
// Este archivo es la ÚNICA fuente del cálculo. El generador n8n/build_workflows.mjs lo
// copia dentro de los nodos Code; GitHub Actions comprueba que la copia sea idéntica.
// Sin dependencias ni require(): debe correr en el nodo Code de n8n y en Node.js.

function redondear(x, d) {
  const f = Math.pow(10, d);
  return Math.round(x * f) / f;
}

/**
 * Filtra el catálogo según perfil, restricciones y reglas del skill.
 * Devuelve { elegibles: {clase: [instrumentos]}, mezcla, ajustes }.
 */
function filtrarElegibles(req, catalogo, reglas) {
  const ajustes = [];
  let perfil = req.perfil_riesgo;
  if (perfil === 'agresivo' && req.horizonte_anios < reglas.horizonte_corto_anios) {
    perfil = 'moderado';
    ajustes.push('Horizonte menor a ' + reglas.horizonte_corto_anios + ' años con perfil agresivo: se aplica la mezcla del perfil moderado (regla del skill).');
  }
  const conf = reglas.perfiles[perfil];
  const restr = req.restricciones || [];
  const elegibles = {};
  for (const clase of Object.keys(conf.mezcla)) elegibles[clase] = [];
  for (const ins of catalogo.instrumentos) {
    if (reglas.clases_prohibidas.indexOf(ins.clase) >= 0) continue;
    if (ins.riesgo >= reglas.riesgo_prohibido_min) continue;
    if (ins.riesgo > conf.riesgo_max) continue;
    if (!(ins.clase in elegibles)) continue;
    // El monto mínimo del instrumento debe caber en la asignación más pequeña posible dentro de su clase.
    if (ins.monto_min_mxn > req.monto_mxn * conf.mezcla[ins.clase] / reglas.instrumentos_por_clase_max) continue;
    const exentoEsg = reglas.clases_exentas_esg.indexOf(ins.clase) >= 0;
    if (restr.indexOf('solo_esg') >= 0 && !ins.esg && !exentoEsg) continue;
    if (restr.indexOf('sin_extranjero') >= 0 && ins.extranjero) continue;
    if (restr.indexOf('liquidez_alta') >= 0 && ins.liquidez_dias > 1) continue;
    if (restr.indexOf('sin_renta_variable') >= 0 && ins.clase === 'renta_variable') continue;
    elegibles[ins.clase].push(ins);
  }
  return { perfil_aplicado: perfil, mezcla: conf.mezcla, elegibles: elegibles, ajustes: ajustes };
}

/** Número mínimo de instrumentos que necesita una clase para no rebasar la concentración. */
function minimoPorClase(peso, reglas) {
  if (peso <= 0) return 0;
  return Math.ceil(peso / reglas.concentracion_max_instrumento - 1e-9);
}

/**
 * Calcula pesos, montos y métricas a partir de la selección del Agente 2.
 * seleccion: { clase: [ids] }. Toda regla viene de `reglas` (bloque JSON del skill).
 */
function calcularPropuesta(req, catalogo, reglas, seleccion) {
  const base = filtrarElegibles(req, catalogo, reglas);
  const porId = {};
  for (const ins of catalogo.instrumentos) porId[ins.id] = ins;
  const supuestos = base.ajustes.slice();
  const errores = [];
  const cap = reglas.concentracion_max_instrumento;
  const pesos = {};
  let sobrante = 0;

  for (const clase of Object.keys(base.mezcla)) {
    const pesoClase = base.mezcla[clase];
    const idsElegibles = base.elegibles[clase].map(function (i) { return i.id; });
    let ids = (seleccion[clase] || []).filter(function (id, k, arr) { return arr.indexOf(id) === k; });
    const invalidos = ids.filter(function (id) { return idsElegibles.indexOf(id) < 0; });
    if (invalidos.length) errores.push('Instrumentos no elegibles en ' + clase + ': ' + invalidos.join(', '));
    ids = ids.filter(function (id) { return idsElegibles.indexOf(id) >= 0; }).slice(0, reglas.instrumentos_por_clase_max);
    if (clase === reglas.clase_destino_sobrante) continue; // se asigna al final
    if (ids.length === 0) {
      sobrante += pesoClase;
      if (pesoClase > 0) supuestos.push('Sin instrumentos elegibles en ' + clase + ': su ' + redondear(pesoClase * 100, 2) + '% pasa a ' + reglas.clase_destino_sobrante + '.');
      continue;
    }
    const cada = pesoClase / ids.length;
    for (const id of ids) {
      const asignado = Math.min(cada, cap);
      pesos[id] = (pesos[id] || 0) + asignado;
      if (cada > cap + 1e-12) sobrante += cada - cap;
    }
    if (cada > cap + 1e-12) supuestos.push('Concentración máxima ' + cap * 100 + '% en ' + clase + ': el excedente pasa a ' + reglas.clase_destino_sobrante + '.');
  }

  // Clase destino del sobrante (liquidez): su peso propio + sobrantes.
  const dest = reglas.clase_destino_sobrante;
  const idsDestElegibles = base.elegibles[dest].map(function (i) { return i.id; });
  let idsDest = (seleccion[dest] || []).filter(function (id) { return idsDestElegibles.indexOf(id) >= 0; }).slice(0, reglas.instrumentos_por_clase_max);
  if (idsDest.length === 0 && idsDestElegibles.length) {
    idsDest = idsDestElegibles.slice(0, reglas.instrumentos_por_clase_max);
    supuestos.push('La selección no incluyó ' + dest + ': el código asignó ' + idsDest.join(', ') + ' del catálogo autorizado.');
  }
  const pesoDest = (base.mezcla[dest] || 0) + sobrante;
  if (pesoDest > 0) {
    if (idsDest.length === 0) errores.push('No hay instrumentos de ' + dest + ' para asignar ' + redondear(pesoDest * 100, 2) + '%.');
    else {
      const cadaDest = pesoDest / idsDest.length;
      if (cadaDest > cap + 1e-12) errores.push('Concentración: ' + dest + ' necesitaría ' + redondear(cadaDest * 100, 2) + '% por instrumento (máximo ' + cap * 100 + '%). Caso para revisión humana.');
      for (const id of idsDest) pesos[id] = (pesos[id] || 0) + cadaDest;
    }
  }

  const lineas = [];
  let suma = 0, rend = 0, varianza = 0, riesgoPond = 0;
  for (const id of Object.keys(pesos)) {
    const ins = porId[id];
    const w = pesos[id];
    const monto = redondear(req.monto_mxn * w, 2);
    if (monto < ins.monto_min_mxn) errores.push('Monto asignado a ' + id + ' (' + monto + ' MXN) es menor al mínimo del instrumento (' + ins.monto_min_mxn + ' MXN).');
    suma += w;
    rend += w * ins.rend_esperado_anual;
    varianza += Math.pow(w * ins.volatilidad_anual, 2);
    riesgoPond += w * ins.riesgo;
    lineas.push({ id: id, nombre: ins.nombre, clase: ins.clase, peso_pct: redondear(w * 100, 2), monto_mxn: monto, riesgo: ins.riesgo });
  }
  lineas.sort(function (a, b) { return b.peso_pct - a.peso_pct || (a.id < b.id ? -1 : 1); });
  if (Math.abs(suma - 1) > reglas.suma_pesos_tolerancia) errores.push('La suma de pesos es ' + redondear(suma * 100, 4) + '% (debe ser 100%).');

  supuestos.push('Rendimientos y volatilidades son supuestos ilustrativos del catálogo ficticio ' + catalogo.catalogo_id + ' v' + catalogo.version + '.');
  supuestos.push('La volatilidad aproximada supone correlación cero entre instrumentos; subestima el riesgo real.');
  const r = rend;
  return {
    perfil_solicitado: req.perfil_riesgo,
    perfil_aplicado: base.perfil_aplicado,
    lineas: lineas,
    metricas: {
      suma_pesos_pct: redondear(suma * 100, 2),
      rend_esperado_anual_pct: redondear(r * 100, 2),
      volatilidad_aprox_pct: redondear(Math.sqrt(varianza) * 100, 2),
      riesgo_ponderado: redondear(riesgoPond, 2),
      valor_ilustrativo_final_mxn: redondear(req.monto_mxn * Math.pow(1 + r, req.horizonte_anios), 2)
    },
    supuestos: supuestos,
    errores: errores,
    valido: errores.length === 0
  };
}

/**
 * Valida tipos, rangos y enums del requerimiento extraído por el Agente 1 (el LLM extrae; el código decide).
 * Devuelve { req, faltantes, notas }.
 */
function validarRequerimiento(o, reglas) {
  const faltantes = [], notas = [];
  const perfiles = Object.keys(reglas.perfiles);
  const req = {
    perfil_riesgo: perfiles.indexOf(o.perfil_riesgo) >= 0 ? o.perfil_riesgo : null,
    monto_mxn: typeof o.monto_mxn === 'number' ? o.monto_mxn : (o.monto_mxn ? Number(o.monto_mxn) : null),
    horizonte_anios: o.horizonte_anios !== null && o.horizonte_anios !== undefined ? Math.round(Number(o.horizonte_anios)) : null,
    objetivo: String(o.objetivo || '').slice(0, 120),
    restricciones: (Array.isArray(o.restricciones) ? o.restricciones : []).filter(function (x) { return reglas.restricciones_validas.indexOf(x) >= 0; })
  };
  if (!req.perfil_riesgo) faltantes.push('perfil_riesgo');
  if (req.monto_mxn === null || isNaN(req.monto_mxn)) faltantes.push('monto_mxn');
  else if (req.monto_mxn < reglas.monto_min_mxn || req.monto_mxn > reglas.monto_max_mxn) { faltantes.push('monto_mxn'); notas.push('monto fuera de rango (' + reglas.monto_min_mxn + '–' + reglas.monto_max_mxn + ' MXN)'); }
  if (req.horizonte_anios === null || isNaN(req.horizonte_anios)) faltantes.push('horizonte_anios');
  else if (req.horizonte_anios < reglas.horizonte_min_anios || req.horizonte_anios > reglas.horizonte_max_anios) { faltantes.push('horizonte_anios'); notas.push('horizonte fuera de rango (' + reglas.horizonte_min_anios + '–' + reglas.horizonte_max_anios + ' años)'); }
  return { req: req, faltantes: faltantes, notas: notas };
}

// <export>
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { filtrarElegibles: filtrarElegibles, minimoPorClase: minimoPorClase, calcularPropuesta: calcularPropuesta, validarRequerimiento: validarRequerimiento, redondear: redondear };
}
// </export>
