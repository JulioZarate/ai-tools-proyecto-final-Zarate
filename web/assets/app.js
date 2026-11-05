// Valoria — lógica del panel. Sin dependencias externas (el widget de voz se carga solo tras consentimiento).
(function () {
  'use strict';
  const K = window.ValoriaKPI;
  const $ = (id) => document.getElementById(id);
  const DIAS_DESACTUALIZADO = 7;
  const GRUPO = {
    pendiente_aprobacion: 'ok', aprobado_simulado: 'ok', rechazado: 'ok', expirado: 'ok',
    requiere_aclaracion: 'control', fuera_de_politica: 'control', bloqueado_politica: 'control', escalado_humano: 'control', detenido_presupuesto: 'control', detenido_limite: 'control',
    error_api: 'falla', error_validacion: 'falla', error_skill: 'falla'
  };
  const COLOR = { ok: '#0072B2', control: '#9CA3AF', falla: '#D55E00' };
  const LEGIBLE = {
    pendiente_aprobacion: 'Pendiente de aprobación', aprobado_simulado: 'Aprobado (simulado)', rechazado: 'Rechazado por asesor', expirado: 'Expirado',
    requiere_aclaracion: 'Requiere aclaración', fuera_de_politica: 'Fuera de política', bloqueado_politica: 'Bloqueado por política', escalado_humano: 'Escalado a humano',
    detenido_presupuesto: 'Detenido por presupuesto', detenido_limite: 'Detenido por límite', error_api: 'Error del servicio de IA', error_validacion: 'Error de validación', error_skill: 'Error al cargar skills'
  };
  const AGENTE = { A1: 'A1 · Intake', A2: 'A2 · Datos', A3: 'A3 · Propuesta', A4: 'A4 · Revisión' };
  let datos = null;

  function aviso(tipo, texto) { const a = $('aviso-estado'); a.dataset.tipo = tipo; a.textContent = texto; }
  const esc = (s) => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fecha = (iso) => iso ? iso.slice(0, 16).replace('T', ' ') : '—';
  const usd = (x, d) => x === null || x === undefined ? '—' : '$' + Number(x).toFixed(d === undefined ? 4 : d);

  // ---------- Gráfica de barras horizontales (SVG accesible, base en 0, etiquetas directas) ----------
  function barras(cont, filas, opciones) {
    if (!filas.length) { cont.innerHTML = '<div class="vacio">Sin datos para los filtros actuales.</div>'; return; }
    const ancho = Math.max(300, Math.round(cont.clientWidth || 560)), izq = ancho < 460 ? 172 : 190, der = 74, alto = 30, sep = 8, arriba = 6;
    const h = arriba + filas.length * (alto + sep);
    const max = Math.max.apply(null, filas.map((f) => f.valor)) || 1;
    const x = (v) => izq + (ancho - izq - der) * v / max;
    let s = '<svg viewBox="0 0 ' + ancho + ' ' + h + '" role="img" aria-labelledby="t-' + cont.id + ' d-' + cont.id + '">' +
      '<title id="t-' + cont.id + '">' + esc(opciones.titulo) + '</title><desc id="d-' + cont.id + '">' + esc(filas.map((f) => f.etiqueta + ': ' + opciones.formato(f.valor)).join('; ')) + '</desc>';
    s += '<line x1="' + izq + '" x2="' + izq + '" y1="0" y2="' + h + '" stroke="#9CA3AF" stroke-width="1"/>';
    filas.forEach((f, i) => {
      const y = arriba + i * (alto + sep);
      s += '<text x="' + (izq - 8) + '" y="' + (y + alto / 2 + 4) + '" text-anchor="end" font-size="' + (ancho < 460 ? 12 : 13) + '" fill="#374151">' + esc(f.etiqueta) + '</text>';
      s += '<rect x="' + izq + '" y="' + y + '" width="' + Math.max(1, x(f.valor) - izq) + '" height="' + alto + '" fill="' + (f.color || '#9CA3AF') + '" rx="2"/>';
      s += '<text x="' + (x(f.valor) + 6) + '" y="' + (y + alto / 2 + 4) + '" font-size="13" font-weight="600" fill="#111827">' + esc(opciones.formato(f.valor)) + '</text>';
    });
    cont.innerHTML = s + '</svg>';
  }
  function tablaSimple(cont, cab, filas) {
    cont.innerHTML = '<table><thead><tr>' + cab.map((c) => '<th scope="col">' + esc(c) + '</th>').join('') + '</tr></thead><tbody>' +
      filas.map((f) => '<tr>' + f.map((v) => '<td>' + esc(v) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  }

  // ---------- Filtros ----------
  function filtrar() {
    const e = $('f-estado').value, c = $('f-canal').value, p = $('f-perfil').value, fo = $('f-folio').value.trim().toUpperCase();
    return datos.casos.filter((x) => (!e || x.estado === e) && (!c || x.canal === c) && (!p || x.perfil_riesgo === p) && (!fo || x.caso_id.indexOf(fo) >= 0));
  }

  function render() {
    const casos = filtrar();
    const n = casos.length, total = datos.casos.length;
    $('filtros-resumen').textContent = 'Mostrando ' + n + ' de ' + total + ' casos.';
    const k = K.calcularKPIs(casos);
    const k1 = k.aprobacion_primera_revision, k2 = k.ciclo_decision_mediana_min, k3 = k.costo_por_caso_completado;
    $('k1').textContent = k1.valor === null ? 'Sin datos' : k1.valor.toFixed(1) + '%';
    $('k1-ctx').textContent = k1.denominador ? k1.numerador + ' de ' + k1.denominador + ' casos revisados · ' + (k1.valor >= 80 ? '▲ en o sobre la meta de 80%' : '▼ debajo de la meta de 80%') : 'Ningún caso llegó al Agente 4.';
    $('k2').textContent = k2.valor === null ? 'Sin datos' : (k2.valor < 1 ? k2.valor.toFixed(2) : k2.valor.toFixed(1)) + ' min';
    $('k2-ctx').textContent = k2.n ? 'n = ' + k2.n + ' decisiones · plazo máximo 30 min' : 'Aún no hay decisiones del asesor.';
    $('k3').textContent = k3.valor === null ? 'Sin datos' : usd(k3.valor, 5);
    $('k3-ctx').textContent = k3.n ? 'n = ' + k3.n + ' completados · fallidos: ' + k3.n_fallidos + ' (' + usd(k3.costo_fallidos_usd, 5) + ')' : 'No hay casos completados.';

    if (k1.valor !== null && n === total) $('titulo-afirmativo').textContent = k1.numerador + ' de ' + k1.denominador + ' propuestas pasaron la revisión del Agente 4 a la primera';

    const est = K.contarEstados(casos);
    const filasE = est.map((x) => ({ etiqueta: LEGIBLE[x.estado] || x.estado, valor: x.n, color: COLOR[GRUPO[x.estado] || 'control'] }));
    barras($('graf-estados'), filasE, { titulo: 'Casos por estado final', formato: (v) => v + (v === 1 ? ' caso' : ' casos') });
    tablaSimple($('tabla-estados'), ['Estado', 'Grupo', 'Casos'], est.map((x) => [LEGIBLE[x.estado] || x.estado, GRUPO[x.estado] || 'control', x.n]));

    const ids = casos.map((x) => x.caso_id);
    const ag = K.costoPorAgente(datos.costos, ids).sort((a, b) => b.costo_usd - a.costo_usd);
    barras($('graf-agentes'), ag.map((a) => ({ etiqueta: AGENTE[a.agente] || a.agente, valor: a.costo_usd, color: '#9CA3AF' })), { titulo: 'Costo de IA por agente (USD)', formato: (v) => usd(v, 5) });
    tablaSimple($('tabla-agentes'), ['Agente', 'Llamadas', 'Tokens entrada', 'Tokens salida', 'Costo USD'], ag.map((a) => [AGENTE[a.agente] || a.agente, a.llamadas, a.tokens_entrada, a.tokens_salida, a.costo_usd.toFixed(6)]));

    const tb = document.querySelector('#tabla-casos tbody');
    if (!n) { tb.innerHTML = '<tr><td colspan="10">Sin resultados para estos filtros. Usa «Restablecer».</td></tr>'; aviso('vacio', 'Sin resultados para los filtros seleccionados.'); return; }
    tb.innerHTML = casos.map((c) => '<tr><td><code>' + esc(c.caso_id) + '</code></td><td>' + esc(c.canal) + '</td><td><span class="pill g-' + (GRUPO[c.estado] || 'control') + '">' + esc(LEGIBLE[c.estado] || c.estado) + '</span></td><td>' +
      esc(c.perfil_riesgo || '—') + '</td><td>' + esc(c.monto_rango) + '</td><td class="num">' + esc(c.version_propuesta) + '</td><td>' + esc(c.agentes || '—') + '</td><td class="num">' +
      (c.rend_esperado_pct === null ? '—' : esc(c.rend_esperado_pct) + '%') + '</td><td class="num">' + esc(Number(c.costo_usd).toFixed(6)) + '</td><td>' + esc(fecha(c.creado_en)) + '</td></tr>').join('');
    estadoGeneral();
  }

  function estadoGeneral() {
    const edadDias = (Date.now() - Date.parse(datos.exportado_en || datos.generado_en)) / 86400000;
    if (datos.origen !== 'export_n8n') aviso('alerta', 'Mostrando una MUESTRA de prueba local (costos simulados). Publica una exportación de n8n Cloud para ver datos de las pruebas reales.');
    else if (edadDias > DIAS_DESACTUALIZADO) aviso('alerta', '⚠ Datos desactualizados: la última exportación tiene ' + Math.floor(edadDias) + ' días. Ejecuta la exportación y publica de nuevo.');
    else aviso('ok', 'Datos cargados: ' + datos.casos.length + ' casos.');
  }

  async function cargar() {
    aviso('ok', 'Cargando datos…');
    try {
      const r = await fetch('data/panel.json', { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      datos = await r.json();
      if (datos.esquema !== 'valoria-panel/1') throw new Error('esquema inesperado');
    } catch (e) {
      aviso('error', 'No se pudieron cargar los datos del panel (' + e.message + '). Recarga la página o revisa la última ejecución de GitHub Actions.');
      return;
    }
    $('meta-periodo').textContent = datos.periodo.desde ? fecha(datos.periodo.desde).slice(0, 10) + ' a ' + fecha(datos.periodo.hasta).slice(0, 10) : 'Sin casos';
    $('meta-actualizado').textContent = fecha(datos.exportado_en || datos.generado_en) + ' UTC';
    $('meta-fuente').textContent = datos.fuente;
    $('pie-fuente').textContent = datos.fuente;
    $('pie-corte').textContent = fecha(datos.exportado_en || datos.generado_en) + ' UTC';
    const sel = $('f-estado');
    datos.estados.forEach((x) => { const o = document.createElement('option'); o.value = x.estado; o.textContent = LEGIBLE[x.estado] || x.estado; sel.appendChild(o); });
    if (!datos.casos.length) {
      aviso('vacio', 'Todavía no hay casos registrados. Crea uno con /nuevo en Telegram o por voz y vuelve a exportar.');
      ['graf-estados', 'graf-agentes'].forEach((id) => { $(id).innerHTML = '<div class="vacio">Sin casos todavía.</div>'; });
      document.querySelector('#tabla-casos tbody').innerHTML = '<tr><td colspan="10">Sin casos todavía.</td></tr>';
      return;
    }
    render();
  }

  // ---------- Voz (ElevenLabs) con consentimiento previo y alternativas ----------
  function vozFalla(motivo) {
    $('voz-alternativa').hidden = false;
    $('voz-motivo').textContent = motivo;
    const bot = document.body.dataset.telegramBot;
    if (bot && bot.indexOf('REEMPLAZAR') < 0) $('voz-bot').innerHTML = ' (<a href="https://t.me/' + encodeURIComponent(bot) + '">@' + esc(bot) + '</a>)';
  }
  async function activarVoz() {
    const agentId = document.body.dataset.agentId;
    $('btn-voz').disabled = true;
    if (!agentId || agentId.indexOf('REEMPLAZAR') >= 0) { vozFalla('El asistente no está configurado en esta publicación.'); return; }
    // Sin micrófono se informa la alternativa, pero el widget se carga igual: permite chat por texto.
    let micOk = true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) micOk = false;
    else {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
      } catch (e) { micOk = false; }
    }
    if (!micOk) vozFalla('Permiso de micrófono denegado o no disponible. Puedes escribirle a Andrea en el widget (modo texto).');
    const cont = $('voz-contenedor');
    cont.hidden = false;
    const w = document.createElement('elevenlabs-convai');
    w.setAttribute('agent-id', agentId);
    cont.appendChild(w);
    const sc = document.createElement('script');
    sc.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
    sc.async = true;
    sc.type = 'text/javascript';
    sc.onerror = () => vozFalla('El servicio de voz no respondió (no se pudo cargar el widget).');
    document.body.appendChild(sc);
    setTimeout(() => { if (!customElements.get('elevenlabs-convai')) vozFalla('El servicio de voz no respondió a tiempo.'); }, 12000);
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('form-filtros').addEventListener('input', () => datos && render());
    $('form-filtros').addEventListener('change', () => datos && render());
    $('form-filtros').addEventListener('submit', (e) => e.preventDefault());
    $('btn-reset').addEventListener('click', () => setTimeout(() => datos && render(), 0));
    $('voz-acepto').addEventListener('change', (e) => { $('btn-voz').disabled = !e.target.checked; });
    $('btn-voz').addEventListener('click', activarVoz);
    cargar();
    let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => datos && datos.casos.length && render(), 200); });
  });
})();
