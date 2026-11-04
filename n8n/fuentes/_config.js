// ===== CONFIG (sin secretos). Reemplaza los valores REEMPLAZAR_* después de importar. =====
// Las API keys y el token del bot NO van aquí: viven en Credenciales de n8n.
const CONFIG = {
  modo: 'SIMULADO',
  empresa: 'Valoria Casa de Bolsa (ficticia)',
  pages_base_url: 'https://juliozarate.github.io/ai-tools-proyecto-final-Zarate',
  anthropic_url: 'https://api.anthropic.com/v1/messages',
  modelo: 'claude-haiku-5-5',
  tarifas: {
    proveedor: 'Anthropic',
    entrada_usd_mtok: 0.10,
    salida_usd_mtok: 0.50,
    cache_lectura_usd_mtok: 0.01,
    umbral_prompt_tokens: 100000,
    entrada_alta_usd_mtok: 0.50,
    salida_alta_usd_mtok: 2.50,
    fecha_consulta: '2026-11-03'
  },
  presupuesto_caso_usd_default: 0.01,
  presupuesto_caso_usd_max: 0.02,
  reserva_pct: 0.20,
  max_llamadas_caso: 10,
  max_iteraciones_calidad: 3,
  max_correcciones_a2: 1,
  tiempo_max_caso_ms: 120000,
  max_tokens: { A1: 500, A2: 700, A3: 900, A4: 500 },
  aprobacion_minutos: 30,
  usuarios: {
    'REEMPLAZAR_ID_TELEGRAM_ASESOR': 'asesor',
    'REEMPLAZAR_ID_TELEGRAM_ANALISTA': 'analista'
  },
  asesor_chat_id: 'REEMPLAZAR_CHAT_ID_ASESOR',
  sal_seudonimo: 'valoria-2026',
  max_len_texto: 600,
  patrones_bloqueo: [
    'ignor(a|e|ar|en)\\s+(las|tus|todas|sus|previous|all|the)',
    'instrucciones\\s+(anteriores|previas|del sistema|originales)',
    'system\\s*prompt', 'prompt del sistema', 'tu prompt',
    'revela(r)?\\s', 'api[ _-]?key', '\\btoken\\b', 'contrase(ñ|n)a', 'password', 'credencial',
    'desactiva(r)?\\s', 'modo\\s+(desarrollador|dios|admin|developer)', 'jailbreak',
    '<\\s*script', 'https?://', 'www\\.'
  ]
};
