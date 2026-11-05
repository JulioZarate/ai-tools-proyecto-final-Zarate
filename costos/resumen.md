# Resumen de costos por etapa y por caso

> Fuente de llamadas LLM: `datos/muestra/export_muestra.json` — **MUESTRA con simulador local: tokens simulados, no facturables.** Sustituir por la exportación real.
> Fórmula por llamada: Cᵢ = (T_entrada × P_entrada + T_salida × P_salida) / 1 000 000, con P = 0.1 / 0.5 USD por millón (Claude Haiku 5.5). Generado: 2026-11-05T02:19 UTC.

## Por etapa

| Etapa | Filas | Tokens entrada | Tokens salida | Costo USD | Tokenización |
|---|---:|---:|---:|---:|---|
| diseno_construccion | 1 | 0 | 0 | 0.000000 | no aplica |
| publicacion_operacion | 2 | 0 | 0 | 0.000000 | no aplica |
| telegram_n8n | 1 | 0 | 0 | 0.000000 | no aplica |
| agente_1_intake | 13 | 5663 | 987 | 0.001009 | sí |
| agente_2_datos | 10 | 10130 | 1250 | 0.001640 | sí |
| agente_3_propuesta | 11 | 8865 | 1678 | 0.001727 | sí |
| agente_4_revision | 11 | 9081 | 326 | 0.001073 | sí |
| **Total** | 49 | | | **0.005449** | |

## Por caso

| Caso | Canal | Estado | Llamadas | Costo USD | Costo MXN |
|---|---|---|---:|---:|---:|
| VAL-261105-HEQ7 | telegram | pendiente_aprobacion | 4 | 0.000478 | 0.0083 |
| VAL-261105-YNJ8 | telegram | pendiente_aprobacion | 4 | 0.000495 | 0.0086 |
| VAL-261105-YEWC | telegram | pendiente_aprobacion | 4 | 0.000506 | 0.0088 |
| VAL-261105-V8G2 | telegram | pendiente_aprobacion | 6 | 0.000794 | 0.0139 |
| VAL-261105-Z897 | telegram | pendiente_aprobacion | 5 | 0.000588 | 0.0103 |
| VAL-261105-LXWR | telegram | aprobado_simulado | 4 | 0.000488 | 0.0085 |
| VAL-261105-68XC | telegram | rechazado | 4 | 0.000493 | 0.0086 |
| VAL-261105-3DAQ | telegram | expirado | 4 | 0.000525 | 0.0092 |
| VAL-261105-EQLF | telegram | pendiente_aprobacion | 4 | 0.000493 | 0.0086 |
| VAL-261105-ZDS2 | telegram | detenido_presupuesto | 0 | 0.000000 | 0.0000 |
| VAL-261105-XHLL | telegram | error_api | 1 | 0.000000 | 0.0000 |
| VAL-261105-P7GM | voz | pendiente_aprobacion | 4 | 0.000506 | 0.0088 |
| VAL-261105-A9JY | telegram | fuera_de_politica | 1 | 0.000083 | 0.0014 |

## Indicadores

- **C_promedio (completados)** = 0.000537 USD/caso (n = 10) ≈ 0.0094 MXN/caso con TC = 17.444 MXN/USD (Banxico FIX; ver tarifas.csv).
- **Costo de casos fallidos** (reportado aparte) = 0.000000 USD (n = 2).
- **Otros cierres** (aclaración, fuera de política, escalados) = 0.000083 USD (n = 1).
- Llamadas LLM promedio por caso completado: 4.30.
- Conciliación: Σ filas LLM = 0.005449 USD = Σ por caso = 0.005449 USD. Los skills y loops NO tienen filas propias: se refieren a las llamadas A2–A4 que los ejecutan (evita doble conteo).
