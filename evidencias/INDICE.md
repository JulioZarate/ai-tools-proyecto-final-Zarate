# Índice de enlaces y evidencias por criterio de la rúbrica

Estado: ✅ listo en el repo · 🟡 listo localmente, repetir en Cloud · ⬜ lo debe producir el autor con sus cuentas.

## Enlaces de entrega
| Elemento | Enlace |
|---|---|
| Repositorio (rama `main`, commit final) | ⬜ https://github.com/JulioZarate/ai-tools-proyecto-final-Zarate · commit `[hash]` |
| Sitio GitHub Pages | ⬜ https://juliozarate.github.io/ai-tools-proyecto-final-Zarate/ |
| Ejecución de Actions exitosa | ⬜ [enlace a la ejecución] |
| Ejecución de Actions bloqueada por falla deliberada (P12) | ⬜ [enlace] — generar con `bash scripts/falla_deliberada.sh romper` y luego `reparar` |
| Bot de Telegram | ⬜ @[usuario_bot] (acceso por canal privado del curso; sin token) |
| Video de respaldo (5–8 min) | ⬜ [enlace] |

## Rúbrica → evidencia
| # | Criterio (pts) | Evidencia | Estado |
|---|---|---|---|
| 1 | Caso e integración (5) | `docs/caso.md`, `docs/arquitectura.md` (mapa + `caso_id` compartido) | ✅ |
| 2 | Ecosistema agéntico (15) | `agentes/*.md` (5 roles), contratos `agentes/*.schema.json`, traza de un caso con A1–A4 (`evidencias/local/export_local.json`) | 🟡 exportar traza de Cloud a `evidencias/cloud/` |
| 3 | n8n y Telegram (12) | `n8n/WF*.json`, README §Instalación, P01/P04/P05/P10; ejecuciones exitosa y de error | 🟡 capturas de ejecución en Cloud |
| 4 | Pages y Actions (10) | `.github/workflows/validar-y-publicar.yml`, `scripts/construir_sitio.mjs`, P12, `scripts/exportar.sh` | ⬜ enlaces de ejecuciones |
| 5 | Skills y loops (10) | `skills/*/SKILL.md` + ejemplos, `loops/*.md` (V1→V2, bitácora), carga con huella en `valoria_traza` | 🟡 repetir P11 en Cloud y reutilización con 2.º caso |
| 6 | ElevenLabs y VizData (14) | `docs/elevenlabs.md`, `web/`, P03, P13, capturas a 390/1366 en `evidencias/local/` | ⬜ voz real conectada |
| 7 | Guardrails (12) | `n8n/fuentes/normalizar_entrada.js`, `_util.js` (guardia), `validar_decision.js`, P04/P06/P07/P08/P09/P10 | 🟡 |
| 8 | Tokenización y costos (10) | `costos/tarifas.csv`, `costos/costos.csv`, `costos/resumen.md`, `costos/proyecciones.md` | 🟡 recalcular con export real |
| 9 | Pruebas y reproducibilidad (7) | `tests/pruebas.csv`, `tests/unit/`, `tests/n8n_local/`, README, `docs/declaracion_uso_ia.md` | 🟡 |
| 10 | Defensa (5) | Guion en `docs/guion_defensa.md` | ⬜ |

## Evidencias locales disponibles
- `local/resultado_integracion_local.json` — 12/12 escenarios (n8n 2.46.4 + simulador de API).
- `local/export_local.json` — exportación sanitizada de esa corrida (fuente de la muestra del panel).
- `local/panel_390.png`, `local/panel_1366.png` — panel en móvil y escritorio.

## Qué capturar en Cloud (carpeta `evidencias/cloud/`)
1. Ejecución completa de P01 en n8n (vista de ejecución con los 4 nodos LLM en verde) + mensajes de Telegram.
2. Una ejecución con rama de error (P08: credencial de Anthropic inválida temporalmente, o P09).
3. Data tables con el mismo `caso_id` en casos, costos y traza.
4. Conversación de voz: panel de ElevenLabs con la llamada a `consultar_caso` / `crear_caso` y la ejecución de n8n correspondiente.
5. P11 en Cloud (`demo=falla_v1`) y un segundo caso que reutilice los skills.
