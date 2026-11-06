# Resumen de costos por etapa y por caso

> Fuente de llamadas LLM: `datos/export/export_sanitizado.json` (medido por la API de Anthropic en n8n Cloud).
> Fórmula por llamada: Cᵢ = (T_entrada × P_entrada + T_salida × P_salida) / 1 000 000, con P = 0.1 / 0.5 USD por millón (Claude Haiku 5.5). Generado: 2026-11-06T18:21 UTC.

## Por etapa

| Etapa | Filas | Tokens entrada | Tokens salida | Costo USD | Tokenización |
|---|---:|---:|---:|---:|---|
| diseno_construccion | 1 | 0 | 0 | 0.000000 | no aplica |
| publicacion_operacion | 2 | 0 | 0 | 0.000000 | no aplica |
| telegram_n8n | 1 | 0 | 0 | 0.000000 | no aplica |
| voz_elevenlabs | 6 | 0 | 0 | 2.666667 | no aplica |
| agente_1_intake | 6 | 4264 | 1742 | 0.001299 | sí |
| agente_2_datos | 7 | 11361 | 13631 | 0.007951 | sí |
| agente_3_propuesta | 5 | 8275 | 7843 | 0.004750 | sí |
| agente_4_revision | 5 | 10144 | 5828 | 0.003929 | sí |
| **Total** | 33 | | | **2.684596** | |

## Por caso

| Caso | Canal | Estado | Llamadas | Costo USD | Costo MXN |
|---|---|---|---:|---:|---:|
| VAL-261104-ZCGU | telegram | error_api | 2 | 0.000717 | 0.0125 |
| VAL-261105-MPWJ | telegram | error_validacion | 3 | 0.002854 | 0.0498 |
| VAL-261105-YQZY | telegram | aprobado_simulado | 6 | 0.005321 | 0.0928 |
| VAL-261105-AQJJ | telegram | rechazado | 4 | 0.002582 | 0.0450 |
| VAL-261105-F66J | telegram | expirado | 4 | 0.003602 | 0.0628 |
| VAL-261105-4DM3 | voz | aprobado_simulado | 4 | 0.002853 | 0.0498 |

## Indicadores

- **C_promedio (completados)** = 0.003590 USD/caso (n = 4) ≈ 0.0626 MXN/caso con TC = 17.444 MXN/USD (Banxico FIX; ver tarifas.csv).
- **Costo de casos fallidos** (reportado aparte) = 0.003571 USD (n = 2).
- **Otros cierres** (aclaración, fuera de política, escalados) = 0.000000 USD (n = 0).
- Llamadas LLM promedio por caso completado: 4.50.
- Conciliación: Σ filas LLM = 0.017929 USD = Σ por caso = 0.017929 USD. Los skills y loops NO tienen filas propias: se refieren a las llamadas A2–A4 que los ejecutan (evita doble conteo).
