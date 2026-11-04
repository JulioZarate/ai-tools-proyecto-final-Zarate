# Resumen de costos por etapa y por caso

> Fuente de llamadas LLM: `datos/muestra/export_muestra.json` — **MUESTRA con simulador local: tokens simulados, no facturables.** Sustituir por la exportación real.
> Fórmula por llamada: Cᵢ = (T_entrada × P_entrada + T_salida × P_salida) / 1 000 000, con P = 0.1 / 0.5 USD por millón (Claude Haiku 5.5). Generado: 2026-11-04T05:18 UTC.

## Por etapa

| Etapa | Filas | Tokens entrada | Tokens salida | Costo USD | Tokenización |
|---|---:|---:|---:|---:|---|
| diseno_construccion | 1 | 0 | 0 | 0.000000 | no aplica |
| publicacion_operacion | 2 | 0 | 0 | 0.000000 | no aplica |
| telegram_n8n | 1 | 0 | 0 | 0.000000 | no aplica |
| agente_1_intake | 13 | 5663 | 733 | 0.000884 | sí |
| agente_2_datos | 10 | 9582 | 1963 | 0.001941 | sí |
| agente_3_propuesta | 11 | 9883 | 1700 | 0.001840 | sí |
| agente_4_revision | 11 | 9260 | 327 | 0.001090 | sí |
| **Total** | 49 | | | **0.005755** | |

## Por caso

| Caso | Canal | Estado | Llamadas | Costo USD | Costo MXN |
|---|---|---|---:|---:|---:|
| VAL-261104-QYJ2 | telegram | pendiente_aprobacion | 4 | 0.000478 | 0.0083 |
| VAL-261104-8C8Q | telegram | pendiente_aprobacion | 4 | 0.000515 | 0.0090 |
| VAL-261104-ELUN | telegram | pendiente_aprobacion | 4 | 0.000553 | 0.0096 |
| VAL-261104-YL7V | telegram | pendiente_aprobacion | 6 | 0.000863 | 0.0151 |
| VAL-261104-NSLU | telegram | pendiente_aprobacion | 5 | 0.000610 | 0.0106 |
| VAL-261104-4A5X | telegram | aprobado_simulado | 4 | 0.000523 | 0.0091 |
| VAL-261104-W3D7 | telegram | rechazado | 4 | 0.000513 | 0.0089 |
| VAL-261104-Y84L | telegram | expirado | 4 | 0.000561 | 0.0098 |
| VAL-261104-9P3K | telegram | pendiente_aprobacion | 4 | 0.000513 | 0.0089 |
| VAL-261104-PCFC | telegram | detenido_presupuesto | 0 | 0.000000 | 0.0000 |
| VAL-261104-BQWN | telegram | error_api | 1 | 0.000000 | 0.0000 |
| VAL-261104-KBSA | voz | pendiente_aprobacion | 4 | 0.000554 | 0.0097 |
| VAL-261104-6PZZ | telegram | fuera_de_politica | 1 | 0.000072 | 0.0013 |

## Indicadores

- **C_promedio (completados)** = 0.000568 USD/caso (n = 10) ≈ 0.0099 MXN/caso con TC = 17.444 MXN/USD (Banxico FIX; ver tarifas.csv).
- **Costo de casos fallidos** (reportado aparte) = 0.000000 USD (n = 2).
- **Otros cierres** (aclaración, fuera de política, escalados) = 0.000072 USD (n = 1).
- Llamadas LLM promedio por caso completado: 4.30.
- Conciliación: Σ filas LLM = 0.005755 USD = Σ por caso = 0.005755 USD. Los skills y loops NO tienen filas propias: se refieren a las llamadas A2–A4 que los ejecutan (evita doble conteo).
