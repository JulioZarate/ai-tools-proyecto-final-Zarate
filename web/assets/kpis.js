// Valoria — fórmulas de KPI. Única fuente: la usan el panel (navegador) y scripts/build_panel.mjs (Node).
(function (raiz) {
  const COMPLETADOS = ['pendiente_aprobacion', 'aprobado_simulado', 'rechazado', 'expirado'];
  const FALLIDOS = ['error_api', 'error_validacion', 'error_skill', 'detenido_presupuesto', 'detenido_limite'];

  function mediana(xs) {
    const v = xs.filter(function (x) { return typeof x === 'number' && isFinite(x); }).sort(function (a, b) { return a - b; });
    if (!v.length) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }
  const r = function (x, d) { const f = Math.pow(10, d); return Math.round(x * f) / f; };

  /**
   * KPI 1 · Aprobación en primera revisión (%) = casos cuya primera revisión del Agente 4 fue "aprobado"
   *         ÷ casos que llegaron al Agente 4. Fuente: valoria_casos.revision_json (historial[0]).
   * KPI 2 · Ciclo hasta decisión humana (min, mediana) = mediana(decidido_en − creado_en) en casos aprobados o rechazados.
   * KPI 3 · Costo variable por caso completado (USD/caso) = Σ costo_usd de completados ÷ n completados.
   *         Los fallidos se reportan aparte para no ocultarlos.
   */
  function calcularKPIs(casos) {
    const revisados = casos.filter(function (c) { return c.aprobado_primera_revision === true || c.aprobado_primera_revision === false; });
    const primera = revisados.filter(function (c) { return c.aprobado_primera_revision === true; });
    const decididos = casos.filter(function (c) { return (c.decision === 'aprobado' || c.decision === 'rechazado') && typeof c.ciclo_decision_min === 'number'; });
    const completos = casos.filter(function (c) { return COMPLETADOS.indexOf(c.estado) >= 0; });
    const fallidos = casos.filter(function (c) { return FALLIDOS.indexOf(c.estado) >= 0; });
    const suma = function (xs) { return xs.reduce(function (a, c) { return a + (Number(c.costo_usd) || 0); }, 0); };
    return {
      aprobacion_primera_revision: { valor: revisados.length ? r(100 * primera.length / revisados.length, 1) : null, numerador: primera.length, denominador: revisados.length, unidad: '%' },
      ciclo_decision_mediana_min: { valor: mediana(decididos.map(function (c) { return c.ciclo_decision_min; })), n: decididos.length, unidad: 'min' },
      costo_por_caso_completado: { valor: completos.length ? r(suma(completos) / completos.length, 6) : null, n: completos.length, unidad: 'USD/caso',
        costo_fallidos_usd: r(suma(fallidos), 6), n_fallidos: fallidos.length }
    };
  }

  function contarEstados(casos) {
    const m = {};
    casos.forEach(function (c) { m[c.estado] = (m[c.estado] || 0) + 1; });
    return Object.keys(m).map(function (k) { return { estado: k, n: m[k] }; }).sort(function (a, b) { return b.n - a.n || (a.estado < b.estado ? -1 : 1); });
  }

  function costoPorAgente(costos, ids) {
    const m = {};
    costos.forEach(function (k) {
      if (ids && ids.indexOf(k.caso_id) < 0) return;
      const a = m[k.agente] || (m[k.agente] = { agente: k.agente, llamadas: 0, tokens_entrada: 0, tokens_salida: 0, costo_usd: 0 });
      a.llamadas += 1; a.tokens_entrada += Number(k.tokens_entrada) || 0; a.tokens_salida += Number(k.tokens_salida) || 0; a.costo_usd += Number(k.costo_usd) || 0;
    });
    return Object.keys(m).sort().map(function (k) { m[k].costo_usd = r(m[k].costo_usd, 6); return m[k]; });
  }

  const api = { calcularKPIs: calcularKPIs, contarEstados: contarEstados, costoPorAgente: costoPorAgente, mediana: mediana, COMPLETADOS: COMPLETADOS, FALLIDOS: FALLIDOS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else raiz.ValoriaKPI = api;
})(typeof window !== 'undefined' ? window : globalThis);
