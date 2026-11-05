# Resumen de costos por etapa y por caso

> Fuente de llamadas LLM: `datos/muestra/export_muestra.json` — **MUESTRA con simulador local: tokens simulados, no facturables.** Sustituir por la exportación real.
> Fórmula por llamada: Cᵢ = (T_entrada × P_entrada + T_salida × P_salida) / 1 000 000, con P = 0.1 / 0.5 USD por millón (Claude Haiku 5.5). Generado: 2026-11-05T02:14 UTC.

## Por etapa

| Etapa | Filas | Tokens entrada | Tokens salida | Costo USD | Tokenización |
|---|---:|---:|---:|---:|---|
| diseno_construccion | 1 | 0 | 0 | 0.000000 | no aplica |
| publicacion_operacion | 2 | 0 | 0 | 0.000000 | no aplica |
| telegram_n8n | 1 | 0 | 0 | 0.000000 | no aplica |
| agente_1_intake | 13 | 5663 | 733 | 0.000884 | sí |
| agente_2_datos | 10 | 10130 | 1963 | 0.001994 | sí |
| agente_3_propuesta | 11 | 9883 | 1700 | 0.001840 | sí |
| agente_4_revision | 11 | 9260 | 327 | 0.001090 | sí |
| **Total** | 49 | | | **0.005808** | |

## Por caso

| Caso | Canal | Estado | Llamadas | Costo USD | Costo MXN |
|---|---|---|---:|---:|---:|
| VAL-261105-BGP5 | telegram | pendiente_aprobacion | 4 | 0.000484 | 0.0084 |
| VAL-261105-URAT | telegram | pendiente_aprobacion | 4 | 0.000520 | 0.0091 |
| VAL-261105-CVS8 | telegram | pendiente_aprobacion | 4 | 0.000559 | 0.0098 |
| VAL-261105-EPZY | telegram | pendiente_aprobacion | 6 | 0.000869 | 0.0152 |
| VAL-261105-USKR | telegram | pendiente_aprobacion | 5 | 0.000615 | 0.0107 |
| VAL-261105-HNLT | telegram | aprobado_simulado | 4 | 0.000528 | 0.0092 |
| VAL-261105-JT7R | telegram | rechazado | 4 | 0.000518 | 0.0090 |
| VAL-261105-GRF5 | telegram | expirado | 4 | 0.000566 | 0.0099 |
| VAL-261105-DV3Q | telegram | pendiente_aprobacion | 4 | 0.000518 | 0.0090 |
| VAL-261105-ND3P | telegram | detenido_presupuesto | 0 | 0.000000 | 0.0000 |
| VAL-261105-YJXD | telegram | error_api | 1 | 0.000000 | 0.0000 |
| VAL-261105-CP9N | voz | pendiente_aprobacion | 4 | 0.000559 | 0.0098 |
| VAL-261105-E7TQ | telegram | fuera_de_politica | 1 | 0.000072 | 0.0013 |

## Indicadores

- **C_promedio (completados)** = 0.000574 USD/caso (n = 10) ≈ 0.0100 MXN/caso con TC = 17.444 MXN/USD (Banxico FIX; ver tarifas.csv).
- **Costo de casos fallidos** (reportado aparte) = 0.000000 USD (n = 2).
- **Otros cierres** (aclaración, fuera de política, escalados) = 0.000072 USD (n = 1).
- Llamadas LLM promedio por caso completado: 4.30.
- Conciliación: Σ filas LLM = 0.005808 USD = Σ por caso = 0.005808 USD. Los skills y loops NO tienen filas propias: se refieren a las llamadas A2–A4 que los ejecutan (evita doble conteo).
