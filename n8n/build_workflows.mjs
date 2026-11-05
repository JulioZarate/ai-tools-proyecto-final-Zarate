#!/usr/bin/env node
// Genera los workflows importables de n8n a partir de n8n/fuentes/*.js, agentes/*.js y agentes/*.md.
// Uso: node n8n/build_workflows.mjs            → escribe n8n/WF*.json
//      node n8n/build_workflows.mjs --check    → falla si los JSON del repo no coinciden con las fuentes
//      node n8n/build_workflows.mjs --test DIR → variante de prueba local (mock de Anthropic y de Telegram)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FUENTES = path.join(RAIZ, 'n8n', 'fuentes');
const args = process.argv.slice(2);
const MODO_TEST = args.includes('--test');
const MODO_LOCAL = args.includes('--local');
const CONFIG_LOCAL = MODO_LOCAL ? JSON.parse(fs.readFileSync(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url))), 'config.local.json'), 'utf8')) : null;
const DIR_TEST = MODO_TEST ? args[args.indexOf('--test') + 1] : null;

const leer = (p) => fs.readFileSync(p, 'utf8');
const sinExport = (s) => s.replace(/\/\/ <export>[\s\S]*?\/\/ <\/export>\n?/, '');

function promptDe(nombre) {
  const md = leer(path.join(RAIZ, 'agentes', nombre + '.md'));
  const m = md.match(/## System prompt\n([\s\S]*?)\n## /);
  if (!m) throw new Error('Sin "## System prompt" en ' + nombre);
  return m[1].trim();
}

function incluir(nombre) {
  if (nombre === '_catalogo') {
    const cat = JSON.parse(leer(path.join(RAIZ, 'datos', 'catalogo_instrumentos.json')));
    return '// ===== Catálogo autorizado (copiado de datos/catalogo_instrumentos.json) =====\nconst CATALOGO = ' + JSON.stringify(cat) + ';\n';
  }
  const enAgentes = path.join(RAIZ, 'agentes', nombre + '.js');
  if (fs.existsSync(enAgentes)) return '// ===== agentes/' + nombre + '.js =====\n' + sinExport(leer(enAgentes));
  return leer(path.join(FUENTES, nombre + '.js'));
}

function codigo(archivo, reemplazos = {}) {
  let src = leer(path.join(FUENTES, archivo + '.js'));
  src = src.replace(/\/\*@include ([\w_]+)\*\//g, (_, n) => incluir(n));
  src = src.replace(/\/\*@prompt ([\w_]+)\*\//g, (_, n) => JSON.stringify(promptDe(n)));
  for (const [k, v] of Object.entries(reemplazos)) src = src.split(k).join(v);
  const sobre = MODO_TEST ? TEST_CONFIG : CONFIG_LOCAL;
  if (sobre && /const CONFIG = \{/.test(src)) {
    // Sobrescribe valores después de la declaración (prueba local o configuración personal no versionada).
    src = src.replace(/(const CONFIG = \{[\s\S]*?\n\};\n)/, (m) => m + 'Object.assign(CONFIG, ' + JSON.stringify(sobre) + ');\n');
  }
  return src;
}

const TEST_CONFIG = {
  pages_base_url: 'http://127.0.0.1:8788',
  anthropic_url: 'http://127.0.0.1:8787/v1/messages',
  usuarios: { '1001': 'asesor', '1002': 'analista' },
  asesor_chat_id: '1001',
  aprobacion_minutos: 0.75
};

// ---------- Fábrica de nodos ----------
let contador = 0;
const uid = (n) => 'valoria-' + n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-') ;
const nodos = [];
const conexiones = {};
function nodo(name, type, typeVersion, position, parameters, extra = {}) {
  contador++;
  const n = { parameters, id: uid(name), name, type, typeVersion, position, ...extra };
  nodos.push(n);
  return name;
}
function con(desde, hacia, salida = 0) {
  conexiones[desde] = conexiones[desde] || { main: [] };
  while (conexiones[desde].main.length <= salida) conexiones[desde].main.push([]);
  conexiones[desde].main[salida].push({ node: hacia, type: 'main', index: 0 });
}
function reiniciar() { nodos.length = 0; for (const k of Object.keys(conexiones)) delete conexiones[k]; }

const CRED_DT = undefined; // Data tables no usan credenciales.
const credTelegram = { telegramApi: { id: 'REEMPLAZAR', name: 'Valoria Telegram Bot' } };
const credAnthropic = { httpHeaderAuth: { id: 'REEMPLAZAR', name: 'Anthropic API (x-api-key)' } };
const credWebhook = { httpHeaderAuth: { id: 'REEMPLAZAR', name: 'Valoria clave webhooks (x-valoria-key)' } };

const code = (name, pos, archivo, reemplazos) => nodo(name, 'n8n-nodes-base.code', 2, pos, { jsCode: codigo(archivo, reemplazos) });
const tabla = (t) => ({ __rl: true, mode: 'name', value: t });
function dtInsertar(name, pos, t) {
  return nodo(name, 'n8n-nodes-base.dataTable', 1, pos, { resource: 'row', operation: 'insert', dataTableId: tabla(t), columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [] }, options: {} });
}
function dtActualizar(name, pos, t, expr) {
  return nodo(name, 'n8n-nodes-base.dataTable', 1, pos, { resource: 'row', operation: 'update', dataTableId: tabla(t), matchType: 'allConditions',
    filters: { conditions: [{ keyName: 'caso_id', condition: 'eq', keyValue: expr }] },
    columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [] }, options: {} });
}
function dtBuscar(name, pos, t, columna, expr) {
  return nodo(name, 'n8n-nodes-base.dataTable', 1, pos, { resource: 'row', operation: 'get', dataTableId: tabla(t), matchType: 'allConditions',
    filters: { conditions: [{ keyName: columna, condition: 'eq', keyValue: expr }] }, limit: 1 }, { alwaysOutputData: true });
}
function dtLeerTodo(name, pos, t) {
  return nodo(name, 'n8n-nodes-base.dataTable', 1, pos, { resource: 'row', operation: 'get', dataTableId: tabla(t), returnAll: true }, { alwaysOutputData: true, executeOnce: true });
}
function si(name, pos, leftExpr, operador = { type: 'boolean', operation: 'true', singleValue: true }, right = '') {
  return nodo(name, 'n8n-nodes-base.if', 2.2, pos, {
    conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [{ id: uid(name) + '-c', leftValue: leftExpr, rightValue: right, operator: operador }], combinator: 'and' },
    looseTypeValidation: true, options: {} });
}
function ruta(name, pos, expr, valores) {
  return nodo(name, 'n8n-nodes-base.switch', 3.2, pos, {
    rules: { values: valores.map((v) => ({
      conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
        conditions: [{ id: uid(name + v), leftValue: expr, rightValue: v, operator: { type: 'string', operation: 'equals' } }], combinator: 'and' },
      renameOutput: true, outputKey: v })) },
    options: { fallbackOutput: 'extra', renameFallbackOutput: 'otro' } });
}
function llm(name, pos) {
  if (MODO_TEST) {
    return nodo(name, 'n8n-nodes-base.httpRequest', 4.2, pos, { method: 'POST', url: '={{ $json.__url }}', sendBody: true, specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.request_body) }}', options: { timeout: 30000 } },
      { retryOnFail: true, maxTries: 3, waitBetweenTries: 1000, onError: 'continueRegularOutput' });
  }
  return nodo(name, 'n8n-nodes-base.httpRequest', 4.2, pos, {
    method: 'POST', url: 'https://api.anthropic.com/v1/messages', authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
    sendHeaders: true, headerParameters: { parameters: [{ name: 'anthropic-version', value: '2023-06-01' }, { name: 'content-type', value: 'application/json' }] },
    sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.request_body) }}', options: { timeout: 60000 }
  }, { credentials: credAnthropic, retryOnFail: true, maxTries: 3, waitBetweenTries: 3000, onError: 'continueRegularOutput' });
}
function descargarSkill(name, pos, ruta_) {
  const url = MODO_TEST ? TEST_CONFIG.pages_base_url + ruta_ : '=' + '{{ "' + ((CONFIG_LOCAL && CONFIG_LOCAL.pages_base_url) || 'https://juliozarate.github.io/ai-tools-proyecto-final-Zarate') + ruta_ + '?v=" + Date.now() }}';
  return nodo(name, 'n8n-nodes-base.httpRequest', 4.2, pos, { url, options: { response: { response: { responseFormat: 'text' } }, timeout: 10000 } },
    { retryOnFail: true, maxTries: 3, waitBetweenTries: 2000, onError: 'continueRegularOutput', executeOnce: true });
}
function telegramEnviar(name, pos, conBotones = false) {
  if (MODO_TEST) return code(name, pos, 'campo_item', { "$input.first().json['CAMPO']": '({ enviado_simulado: true, ...$input.first().json })' });
  // Telegram interpreta Markdown por defecto y falla con "_" (p. ej. max_tokens): se envía como HTML escapado.
  const p = { chatId: '={{ $json.chat_id }}', text: "={{ String($json.texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }}", additionalFields: { appendAttribution: false, parse_mode: 'HTML' } };
  if (conBotones) {
    p.replyMarkup = 'inlineKeyboard';
    p.inlineKeyboard = { rows: [{ row: { buttons: [
      { text: '✅ Aprobar (simulado)', additionalFields: { callback_data: '={{ $json.cb_aprobar }}' } },
      { text: '❌ Rechazar', additionalFields: { callback_data: '={{ $json.cb_rechazar }}' } }
    ] } }] };
  }
  return nodo(name, 'n8n-nodes-base.telegram', 1.2, pos, p, { credentials: credTelegram, onError: 'continueRegularOutput' });
}
function responderVoz(name, pos) {
  if (MODO_TEST) return code(name, pos, 'campo_item', { CAMPO: 'voz' });
  return nodo(name, 'n8n-nodes-base.respondToWebhook', 1.1, pos, { respondWith: 'json', responseBody: '={{ JSON.stringify($json.voz) }}', options: { responseCode: 200 } });
}

// ======================= WF1: principal =======================
function wfPrincipal() {
  reiniciar();
  const X = (c) => c * 240, Y = (f) => f * 160;
  // Entradas
  if (MODO_TEST) {
    nodo('Webhook prueba', 'n8n-nodes-base.webhook', 2, [X(0), Y(0)], { httpMethod: 'POST', path: 'valoria-prueba', responseMode: 'onReceived', options: {} }, { webhookId: 'valoria-prueba' });
    code('Evento de prueba', [X(0.5), Y(0)], 'campo_item', { "$input.first().json['CAMPO']": "($input.first().json.body.update_id !== undefined ? $input.first().json.body : $input.first().json)" });
    con('Webhook prueba', 'Evento de prueba');
    con('Evento de prueba', 'Normalizar y validar entrada');
  } else {
    nodo('Telegram Trigger', 'n8n-nodes-base.telegramTrigger', 1.2, [X(0), Y(0)], { updates: ['message', 'callback_query'], additionalFields: {} },
      { credentials: credTelegram, webhookId: 'valoria-telegram' });
    nodo('Webhook voz (ElevenLabs)', 'n8n-nodes-base.webhook', 2, [X(0), Y(2)], { httpMethod: 'POST', path: 'valoria-voz', authentication: 'headerAuth', responseMode: 'responseNode', options: {} },
      { credentials: credWebhook, webhookId: 'valoria-voz' });
    con('Telegram Trigger', 'Normalizar y validar entrada');
    con('Webhook voz (ElevenLabs)', 'Normalizar y validar entrada');
  }
  code('Normalizar y validar entrada', [X(1), Y(1)], 'normalizar_entrada');
  dtBuscar('Buscar evento', [X(2), Y(1)], 'valoria_eventos', 'evento_id', '={{ $json.evento_id }}');
  code('Decidir ruta', [X(3), Y(1)], 'decidir_ruta');
  con('Normalizar y validar entrada', 'Buscar evento');
  con('Buscar evento', 'Decidir ruta');
  // Registro del evento (rama superior: se ejecuta primero)
  code('Fila evento', [X(4), Y(-1)], 'fila_evento');
  dtInsertar('Registrar evento', [X(5), Y(-1)], 'valoria_eventos');
  con('Decidir ruta', 'Fila evento');
  con('Fila evento', 'Registrar evento');
  // Router
  ruta('Ruta', [X(4), Y(2)], '={{ $json.ruta }}', ['nuevo', 'aclarar', 'estado', 'decision']);
  con('Decidir ruta', 'Ruta');

  // Salida unificada
  si('¿Canal Telegram?', [X(12), Y(9)], '={{ $json.canal }}', { type: 'string', operation: 'equals' }, 'telegram');
  telegramEnviar('Enviar mensaje', [X(13), Y(8.5)]);
  responderVoz('Responder voz', [X(13), Y(9.5)]);
  con('¿Canal Telegram?', 'Enviar mensaje', 0);
  con('¿Canal Telegram?', 'Responder voz', 1);

  // --- nuevo ---
  code('Crear caso', [X(5), Y(0.5)], 'crear_caso');
  dtInsertar('Insertar caso', [X(6), Y(0.5)], 'valoria_casos');
  code('Acuse de recibo', [X(7), Y(0)], 'acuse');
  con('Ruta', 'Crear caso', 0);
  con('Crear caso', 'Insertar caso');
  con('Insertar caso', 'Acuse de recibo');
  con('Acuse de recibo', '¿Canal Telegram?');
  con('Insertar caso', 'Inicio orquestación');

  // --- aclarar ---
  dtBuscar('Buscar caso (aclarar)', [X(5), Y(2)], 'valoria_casos', 'caso_id', "={{ $('Decidir ruta').first().json.folio }}");
  code('Preparar aclaración', [X(6), Y(2)], 'preparar_aclaracion');
  si('¿Aclaración válida?', [X(7), Y(2)], '={{ $json.valida }}');
  code('Fila aclaración', [X(8), Y(1.5)], 'campo_item', { CAMPO: 'fila' });
  dtActualizar('Actualizar caso (aclarar)', [X(9), Y(1.5)], 'valoria_casos', '={{ $json.caso_id }}');
  con('Ruta', 'Buscar caso (aclarar)', 1);
  con('Buscar caso (aclarar)', 'Preparar aclaración');
  con('Preparar aclaración', '¿Aclaración válida?');
  con('¿Aclaración válida?', 'Fila aclaración', 0);
  con('¿Aclaración válida?', '¿Canal Telegram?', 1);
  con('Fila aclaración', 'Actualizar caso (aclarar)');
  con('Actualizar caso (aclarar)', 'Acuse de recibo');
  con('Actualizar caso (aclarar)', 'Inicio orquestación');

  // --- estado ---
  dtBuscar('Buscar caso (estado)', [X(5), Y(3.5)], 'valoria_casos', 'caso_id', "={{ $('Decidir ruta').first().json.folio }}");
  code('Formatear estado', [X(6), Y(3.5)], 'formatear_estado');
  code('Fila expiración', [X(7), Y(3)], 'fila_expiracion');
  dtActualizar('Marcar expirado', [X(8), Y(3)], 'valoria_casos', '={{ $json.caso_id }}');
  con('Ruta', 'Buscar caso (estado)', 2);
  con('Buscar caso (estado)', 'Formatear estado');
  con('Formatear estado', 'Fila expiración');
  con('Fila expiración', 'Marcar expirado');
  con('Formatear estado', '¿Canal Telegram?');

  // --- decisión humana ---
  dtBuscar('Buscar caso (decisión)', [X(5), Y(5)], 'valoria_casos', 'caso_id', "={{ $('Decidir ruta').first().json.folio }}");
  code('Validar decisión', [X(6), Y(5)], 'validar_decision');
  code('Fila decisión', [X(7), Y(4.5)], 'campo_item', { CAMPO: 'actualizar' });
  dtActualizar('Actualizar caso (decisión)', [X(8), Y(4.5)], 'valoria_casos', '={{ $json.caso_id }}');
  code('Traza decisión', [X(7), Y(5)], 'campo_item', { CAMPO: 'traza' });
  dtInsertar('Guardar traza (decisión)', [X(8), Y(5)], 'valoria_traza');
  if (!MODO_TEST) {
    nodo('Responder botón', 'n8n-nodes-base.telegram', 1.2, [X(7), Y(5.5)], { resource: 'callback', operation: 'answerQuery', queryId: '={{ $json.callback_id }}', additionalFields: { text: '={{ $json.aviso }}' } },
      { credentials: credTelegram, onError: 'continueRegularOutput' });
  }
  con('Ruta', 'Buscar caso (decisión)', 3);
  con('Buscar caso (decisión)', 'Validar decisión');
  con('Validar decisión', 'Fila decisión');
  con('Fila decisión', 'Actualizar caso (decisión)');
  con('Validar decisión', 'Traza decisión');
  con('Traza decisión', 'Guardar traza (decisión)');
  if (!MODO_TEST) con('Validar decisión', 'Responder botón');
  con('Validar decisión', '¿Canal Telegram?');

  // --- respuestas directas (ayuda, inválido, bloqueado, rechazos, duplicado) ---
  code('Respuesta directa', [X(5), Y(6.5)], 'respuesta_directa');
  code('Traza rechazo', [X(6), Y(6)], 'traza_rechazo');
  dtInsertar('Guardar traza (rechazo)', [X(7), Y(6)], 'valoria_traza');
  con('Ruta', 'Respuesta directa', 4);
  con('Respuesta directa', 'Traza rechazo');
  con('Traza rechazo', 'Guardar traza (rechazo)');
  con('Respuesta directa', '¿Canal Telegram?');

  // ===== Orquestador y agentes =====
  const OY = 12;
  code('Inicio orquestación', [X(1), Y(OY)], 'inicio_orquestacion');
  descargarSkill('Descargar skill negocio', [X(2), Y(OY)], '/skills/propuesta-portafolio/SKILL.md');
  descargarSkill('Descargar skill revisión', [X(3), Y(OY)], '/skills/revision-cumplimiento/SKILL.md');
  code('Adaptador de skills', [X(4), Y(OY)], 'adaptador_skills');
  si('¿Skills cargados?', [X(5), Y(OY)], "={{ $json.siguiente === 'A1' }}");
  con('Inicio orquestación', 'Descargar skill negocio');
  con('Descargar skill negocio', 'Descargar skill revisión');
  con('Descargar skill revisión', 'Adaptador de skills');
  con('Adaptador de skills', '¿Skills cargados?');

  const agentes = [
    { id: 'A1', y: OY + 2, sig: ['A2'] },
    { id: 'A2', y: OY + 4, sig: ['A3', 'A2'] },
    { id: 'A3', y: OY + 6, sig: ['A4', 'A3'] },
    { id: 'A4', y: OY + 8, sig: ['A3'] }
  ];
  for (const a of agentes) {
    const n = a.id.toLowerCase();
    code(a.id + ' preparar', [X(1), Y(a.y)], n + '_preparar');
    si('¿' + a.id + ' autorizado?', [X(2), Y(a.y)], "={{ $json.siguiente !== 'cerrar' && !!$json._guardia && $json._guardia.ok === true }}");
    if (MODO_TEST) code('URL ' + a.id, [X(2.5), Y(a.y - 0.5)], 'campo_item', { "$input.first().json['CAMPO']": "({ ...$input.first().json, __url: 'http://127.0.0.1:8787/v1/messages?agente=" + a.id + "' })" });
    llm('LLM ' + a.id, [X(3), Y(a.y)]);
    code(a.id + ' validar', [X(4), Y(a.y)], n + '_validar');
    ruta('Ruta tras ' + a.id, [X(5), Y(a.y)], '={{ $json.siguiente }}', a.sig);
    con(a.id + ' preparar', '¿' + a.id + ' autorizado?');
    if (MODO_TEST) { con('¿' + a.id + ' autorizado?', 'URL ' + a.id, 0); con('URL ' + a.id, 'LLM ' + a.id); }
    else con('¿' + a.id + ' autorizado?', 'LLM ' + a.id, 0);
    con('¿' + a.id + ' autorizado?', 'Cerrar caso', 1);
    con('LLM ' + a.id, a.id + ' validar');
    con(a.id + ' validar', 'Ruta tras ' + a.id);
    a.sig.forEach((s, i) => con('Ruta tras ' + a.id, s + ' preparar', i));
    con('Ruta tras ' + a.id, 'Cerrar caso', a.sig.length);
  }
  con('¿Skills cargados?', 'A1 preparar', 0);
  con('¿Skills cargados?', 'Cerrar caso', 1);

  // ===== Cierre =====
  const CY = OY + 10;
  code('Cerrar caso', [X(6), Y(CY)], 'cerrar_caso');
  code('Fila cierre', [X(7), Y(CY - 1.5)], 'expandir', { CAMPO: 'fila' });
  dtActualizar('Actualizar caso (cierre)', [X(8), Y(CY - 1.5)], 'valoria_casos', '={{ $json.caso_id }}');
  code('Filas costos', [X(7), Y(CY - 0.5)], 'expandir', { CAMPO: 'costos' });
  dtInsertar('Guardar costos', [X(8), Y(CY - 0.5)], 'valoria_costos');
  code('Filas traza', [X(7), Y(CY + 0.5)], 'expandir', { CAMPO: 'traza' });
  dtInsertar('Guardar traza', [X(8), Y(CY + 0.5)], 'valoria_traza');
  code('Notificaciones', [X(7), Y(CY + 1.5)], 'expandir', { CAMPO: 'notificaciones' });
  si('¿Con botones?', [X(8), Y(CY + 1.5)], '={{ $json.botones }}');
  telegramEnviar('Enviar a aprobación', [X(9), Y(CY + 1)], true);
  telegramEnviar('Enviar notificación', [X(9), Y(CY + 2)]);
  for (const d of ['Fila cierre', 'Filas costos', 'Filas traza', 'Notificaciones']) con('Cerrar caso', d);
  con('Fila cierre', 'Actualizar caso (cierre)');
  con('Filas costos', 'Guardar costos');
  con('Filas traza', 'Guardar traza');
  con('Notificaciones', '¿Con botones?');
  con('¿Con botones?', 'Enviar a aprobación', 0);
  con('¿Con botones?', 'Enviar notificación', 1);

  // Notas adhesivas
  nodo('Nota entrada', 'n8n-nodes-base.stickyNote', 1, [X(0) - 40, Y(-2)], { content: '## Entrada única\nTelegram (un solo Telegram Trigger) y la herramienta de voz de ElevenLabs entran al MISMO nodo de normalización. Guardrails antes de cualquier LLM. Dedupe persistente por evento_id.', height: 220, width: 420 });
  nodo('Nota orquestador', 'n8n-nodes-base.stickyNote', 1, [X(0) - 40, Y(OY) - 120], { content: '## Orquestador + 4 agentes\nSkills descargados de Pages → A1 intake → A2 datos → A3 propuesta ⇄ A4 revisión (loop de calidad ≤3). Guardia de costo/límites antes de cada LLM.', height: 200, width: 420 });
  nodo('Nota cierre', 'n8n-nodes-base.stickyNote', 1, [X(6) - 40, Y(CY) - 420], { content: '## Cierre\nActualiza valoria_casos, inserta valoria_costos y valoria_traza, envía a aprobación con botones (caso|versión).', height: 160, width: 360 });

  return {
    name: 'Valoria — Entrada y orquestación' + (MODO_TEST ? ' (PRUEBA LOCAL)' : ''),
    nodes: JSON.parse(JSON.stringify(nodos)), connections: JSON.parse(JSON.stringify(conexiones)),
    settings: { executionOrder: 'v1', saveManualExecutions: true, saveDataErrorExecution: 'all', saveDataSuccessExecution: 'all', callerPolicy: 'workflowsFromSameOwner' },
    pinData: {}, meta: { templateCredsSetupCompleted: false }, tags: []
  };
}

// ======================= WF2: exportación sanitizada =======================
function wfExport() {
  reiniciar();
  if (MODO_TEST) nodo('Webhook exportación', 'n8n-nodes-base.webhook', 2, [0, 0], { httpMethod: 'GET', path: 'valoria-export-prueba', responseMode: 'lastNode', options: {} }, { webhookId: 'valoria-export-prueba' });
  else nodo('Webhook exportación', 'n8n-nodes-base.webhook', 2, [0, 0], { httpMethod: 'GET', path: 'valoria-export', authentication: 'headerAuth', responseMode: 'responseNode', options: {} }, { credentials: credWebhook, webhookId: 'valoria-export' });
  const ini = 'Webhook exportación';
  dtLeerTodo('Leer casos', [240, 0], 'valoria_casos');
  dtLeerTodo('Leer costos', [480, 0], 'valoria_costos');
  dtLeerTodo('Leer traza', [720, 0], 'valoria_traza');
  code('Sanitizar exportación', [960, 0], 'sanitizar_export');
  nodo('Nota', 'n8n-nodes-base.stickyNote', 1, [0, -260], { content: '## Exportación sanitizada\nGET con encabezado x-valoria-key. Devuelve solo campos no personales para el panel público. Úsalo con scripts/exportar.sh y después scripts/build_panel.mjs.', height: 200, width: 420 });
  con(ini, 'Leer casos'); con('Leer casos', 'Leer costos'); con('Leer costos', 'Leer traza'); con('Leer traza', 'Sanitizar exportación');
  if (!MODO_TEST) {
    nodo('Responder exportación', 'n8n-nodes-base.respondToWebhook', 1.1, [1200, 0], { respondWith: 'firstIncomingItem', options: {} });
    con('Sanitizar exportación', 'Responder exportación');
  }
  return { name: 'Valoria — Exportación sanitizada' + (MODO_TEST ? ' (PRUEBA LOCAL)' : ''), nodes: JSON.parse(JSON.stringify(nodos)), connections: JSON.parse(JSON.stringify(conexiones)),
    settings: { executionOrder: 'v1' }, pinData: {}, meta: { templateCredsSetupCompleted: false }, tags: [] };
}

// ======================= WF0: creación de tablas =======================
export const TABLAS = {
  valoria_casos: [['caso_id', 'string'], ['canal', 'string'], ['usuario_ps', 'string'], ['estado', 'string'], ['version_propuesta', 'number'], ['texto_solicitud', 'string'],
    ['perfil_riesgo', 'string'], ['monto_mxn', 'number'], ['horizonte_anios', 'number'], ['restricciones', 'string'], ['requerimiento_json', 'string'], ['propuesta_json', 'string'],
    ['revision_json', 'string'], ['resumen', 'string'], ['iteraciones', 'number'], ['llamadas', 'number'], ['costo_usd', 'number'], ['limite_costo_usd', 'number'],
    ['creado_en', 'string'], ['actualizado_en', 'string'], ['aprobacion_expira_en', 'string'], ['decision', 'string'], ['decidido_por', 'string'], ['decidido_en', 'string'],
    ['motivo', 'string'], ['demo', 'string']],
  valoria_eventos: [['evento_id', 'string'], ['caso_id', 'string'], ['canal', 'string'], ['tipo', 'string'], ['ruta', 'string'], ['usuario_ps', 'string'], ['recibido_en', 'string']],
  valoria_costos: [['fecha_hora', 'string'], ['caso_id', 'string'], ['llamada_id', 'string'], ['etapa', 'string'], ['agente', 'string'], ['proveedor', 'string'], ['modelo', 'string'],
    ['tokens_entrada', 'number'], ['tokens_salida', 'number'], ['tokens_cache', 'number'], ['duracion_voz_seg', 'number'], ['unidad_cobro', 'string'], ['tarifa_entrada', 'number'],
    ['tarifa_salida', 'number'], ['costo_usd', 'number'], ['moneda', 'string'], ['estado', 'string'], ['reintento', 'number'], ['origen_dato', 'string'], ['iteracion', 'number'], ['duracion_ms', 'number']],
  valoria_traza: [['caso_id', 'string'], ['paso', 'number'], ['agente', 'string'], ['accion', 'string'], ['estado', 'string'], ['entrada_resumen', 'string'], ['salida_resumen', 'string'],
    ['skill', 'string'], ['version_skill', 'string'], ['huella_skill', 'string'], ['llamada_id', 'string'], ['version_propuesta', 'number'], ['iteracion', 'number'], ['timestamp', 'string']]
};
function wfSetup() {
  reiniciar();
  nodo('Ejecutar una vez', 'n8n-nodes-base.manualTrigger', 1, [0, 0], {});
  let prev = 'Ejecutar una vez', x = 240;
  for (const [t, cols] of Object.entries(TABLAS)) {
    const n = 'Crear ' + t;
    nodo(n, 'n8n-nodes-base.dataTable', 1, [x, 0], { resource: 'table', operation: 'create', tableName: t,
      columns: { column: cols.map(([name, type]) => ({ name, type })) }, options: { createIfNotExists: true } }, { executeOnce: true });
    con(prev, n); prev = n; x += 240;
  }
  nodo('Nota', 'n8n-nodes-base.stickyNote', 1, [0, -240], { content: '## Paso 0 · Crear tablas\nEjecuta este workflow UNA vez (botón Execute). Crea las 4 Data Tables con sus columnas. Si ya existen, las reutiliza.', height: 180, width: 420 });
  return { name: 'Valoria — 0 · Crear tablas', nodes: JSON.parse(JSON.stringify(nodos)), connections: JSON.parse(JSON.stringify(conexiones)), settings: { executionOrder: 'v1' }, pinData: {}, meta: {}, tags: [] };
}

// ---------- Salida ----------
const salida = {
  'WF0_crear_tablas.json': wfSetup(),
  'WF1_valoria_principal.json': wfPrincipal(),
  'WF2_export_sanitizado.json': wfExport()
};
const dirSalida = MODO_TEST ? path.resolve(DIR_TEST) : MODO_LOCAL ? path.join(RAIZ, 'n8n', 'local') : path.join(RAIZ, 'n8n');
fs.mkdirSync(dirSalida, { recursive: true });
let distintos = [];
for (const [archivo, wf] of Object.entries(salida)) {
  const txt = JSON.stringify(wf, null, 2) + '\n';
  const destino = path.join(dirSalida, archivo);
  if (args.includes('--check')) {
    const actual = fs.existsSync(destino) ? leer(destino) : '';
    if (actual !== txt) distintos.push(archivo);
  } else {
    fs.writeFileSync(destino, txt);
    console.log('✓', path.relative(RAIZ, destino), '(' + wf.nodes.length + ' nodos)');
  }
}
if (args.includes('--check')) {
  if (distintos.length) { console.error('✗ Workflows desactualizados respecto a las fuentes: ' + distintos.join(', ') + '. Ejecuta: node n8n/build_workflows.mjs'); process.exit(1); }
  console.log('✓ Los workflows de n8n coinciden con n8n/fuentes y agentes/');
}
