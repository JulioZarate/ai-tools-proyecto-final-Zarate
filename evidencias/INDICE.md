# Índice de enlaces y evidencias por criterio de la rúbrica

Estado: ✅ listo en el repo · 🟡 listo localmente, repetir en Cloud · ⬜ lo debe producir el autor con sus cuentas.

## Enlaces de entrega
| Elemento | Enlace |
|---|---|
| Repositorio (rama `main`, commit final) | ✅ https://github.com/JulioZarate/ai-tools-proyecto-final-Zarate · commit final `[anotar al entregar]` |
| Sitio GitHub Pages | ✅ https://juliozarate.github.io/ai-tools-proyecto-final-Zarate/ |
| Ejecución de Actions exitosa | ✅ https://github.com/JulioZarate/ai-tools-proyecto-final-Zarate/actions/runs/42107774901 · actualización de datos: https://github.com/JulioZarate/ai-tools-proyecto-final-Zarate/actions/runs/42107210567 |
| Ejecución de Actions bloqueada por falla deliberada (P12) | ✅ https://github.com/JulioZarate/ai-tools-proyecto-final-Zarate/actions/runs/42107492452 |
| Bot de Telegram | ✅ @IAtoolFJZbot (acceso por canal privado del curso; sin token) |
| Video de respaldo (5–8 min) | ⬜ [enlace] |

## Rúbrica → evidencia
| # | Criterio (pts) | Evidencia | Estado |
|---|---|---|---|
| 1 | Caso e integración (5) | `docs/caso.md`, `docs/arquitectura.md` (mapa + `caso_id` compartido) | ✅ |
| 2 | Ecosistema agéntico (15) | `agentes/*.md` (5 roles), contratos `agentes/*.schema.json`, traza de un caso con A1–A4 (`evidencias/local/export_local.json`) | ✅ traza real en `datos/export/export_sanitizado.json` (mismo `caso_id` en casos, costos y traza) |
| 3 | n8n y Telegram (12) | `n8n/WF*.json`, README §Instalación, P01/P04/P05/P10; ejecuciones exitosa y de error | ✅ capturas `cloud/capturas/01`, `02`, `16` |
| 4 | Pages y Actions (10) | `.github/workflows/validar-y-publicar.yml`, `scripts/construir_sitio.mjs`, P12, `scripts/exportar.sh` | ✅ runs 42107492452 (bloqueado), 42107774901 y 42108643600 (ok); captura `17` |
| 5 | Skills y loops (10) | `skills/*/SKILL.md` + ejemplos, `loops/*.md` (V1→V2, bitácora), carga con huella en `valoria_traza` | ✅ V1→V2 real (YQZY) y reutilización en 4 casos: `loops/loop_calidad_negocio.md` |
| 6 | ElevenLabs y VizData (14) | `docs/elevenlabs.md`, `web/`, P03, P13, capturas a 390/1366 en `evidencias/local/` | ✅ voz real conectada; capturas `03`–`09` |
| 7 | Guardrails (12) | `n8n/fuentes/normalizar_entrada.js`, `_util.js` (guardia), `validar_decision.js`, P04/P06/P07/P08/P09/P10 | ✅ capturas `01`, `02`, `06`, `24`, `26` |
| 8 | Tokenización y costos (10) | `costos/tarifas.csv`, `costos/costos.csv`, `costos/resumen.md`, `costos/proyecciones.md` | ✅ recalculado con export real + 6 conversaciones de voz |
| 9 | Pruebas y reproducibilidad (7) | `tests/pruebas.csv`, `tests/unit/`, `tests/n8n_local/`, README, `docs/declaracion_uso_ia.md` | ✅ P01–P14 aprobadas con evidencia |
| 10 | Defensa (5) | Guion en `docs/guion_defensa.md` | ⬜ video de respaldo pendiente |

## Evidencias en el entorno real (n8n Cloud + API de Anthropic)
- `cloud/resultados_cloud.json` — resultados P01, P02, P03, P04 (parcial), P06, P08, P11, P12, P13, P14 y hallazgos corregidos.
- `../datos/export/export_sanitizado.json` — exportación real: 6 casos (5 Telegram, 1 voz), 23 llamadas LLM, 60 pasos de traza.
- Casos clave: VAL-261105-YQZY (completo, V1→V2 natural), VAL-261105-AQJJ (rechazado), VAL-261105-F66J (vencimiento), VAL-261105-4DM3 (voz), VAL-261104-ZCGU y VAL-261105-MPWJ (fallas controladas y corregidas).
- Capturas en `cloud/capturas/` (reales, 5–6 nov 2026):
  - `01` P10: segundo clic sobre 4DM3 ya aprobado → "No se ejecutó nada".
  - `02` P04: vencimiento de F66J → expirado, sin acción.
  - `03`, `04` Andrea consulta YQZY (v2 aprobado) y 4DM3 (caso creado por voz, aprobado).
  - `05` widget en GitHub Pages; `06` guardrail: folio "BAL…" mal dictado → Andrea pide confirmar "VAL…" antes de consultar.
  - `07`–`09` configuración: widget, header secreto `x-valoria-key`, parámetros del cuerpo.
  - `10`–`13` hallazgos corregidos: `crear_caso` fallaba en 460 ms (método GET, parámetros en query, identificador con carácter oculto, descripción vacía).
  - `14` estado inicial de herramientas; `15` n8n Cloud (21/1,000 ejecuciones de prueba); `16` WF1 publicado; `17` Action "Actualizar datos" exitosa.
  - `18` lista de conversaciones de voz (duraciones para costos); `19` panel publicado con datos reales a 390 y 1366 px.
  - `20`–`24` Telegram (4 nov): `/ayuda` y `/nuevo` (P01), rechazo AQJJ y caso F66J (P02/P04), YQZY v2 aprobado (P11), `/estado` y folio inválido, inyección bloqueada (P06).
  - `25` ejecución exitosa en n8n Cloud; `26` rama de error del caso ZCGU (A2 sin texto por `max_tokens` → `error_api`, mensaje comprensible; el envío falló por formato y se corrigió con HTML); `27` Data tables; `28` Action "Validar y publicar".
  - Datos personales recortados (correo en `15`, ID de Telegram difuminado en `26`).

## Evidencias locales disponibles
- `local/resultado_integracion_local.json` — 12/12 escenarios (n8n 2.46.4 + simulador de API).
- `local/export_local.json` — exportación sanitizada de esa corrida (fuente de la muestra del panel).
- `local/panel_390.png`, `local/panel_1366.png` — panel en móvil y escritorio.
