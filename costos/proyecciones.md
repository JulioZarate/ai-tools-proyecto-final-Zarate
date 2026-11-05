# Proyecciones mensuales (100 · 1 000 · 10 000 casos)

> C_mes = cargos fijos mensuales + cargos variables no incluidos en el plan. Costo LLM por caso tomado de `costos/resumen.md` (**muestra simulada: rehacer con datos reales**): 0.000574 USD/caso.
> Supuestos declarados: % de casos por voz, minutos por conversación, ejecuciones de n8n por caso (/nuevo + botón + /estado), factor de LLM por más iteraciones del loop y reintentos. Minutos de voz incluidos en el plan: 15/mes (ajustar a tu plan). No se extrapola la prueba gratuita de n8n como permanente.

| Escenario | Casos/mes | LLM agentes USD | Min voz | Voz USD (excedente + LLM voz) | Ejecuciones n8n | Plan n8n | n8n USD | GitHub + Telegram | **Total USD/mes** | Total MXN/mes | USD por caso |
|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|
| Base | 100 | 0.06 | 60 | 3.67 | 300 | Starter | 25.92 | 0.00 | **29.65** | 517 | 0.2965 |
| Base | 1,000 | 0.57 | 600 | 47.52 | 3,000 | Pro | 64.80 | 0.00 | **112.89** | 1969 | 0.1129 |
| Base | 10,000 | 5.74 | 6000 | 486.00 | 30,000 | Business (autohospedado) | 864.00 | 0.00 | **1355.74** | 23649 | 0.1356 |
| Mayor consumo | 100 | 0.09 | 240 | 18.29 | 400 | Starter | 25.92 | 0.00 | **44.30** | 773 | 0.4430 |
| Mayor consumo | 1,000 | 0.92 | 2400 | 193.68 | 4,000 | Pro | 64.80 | 0.00 | **259.40** | 4525 | 0.2594 |
| Mayor consumo | 10,000 | 9.18 | 24000 | 1947.60 | 40,000 | Business (autohospedado) | 864.00 | 0.00 | **2820.78** | 49206 | 0.2821 |

## Lectura para decidir

- El costo de tokens de los 4 agentes es pequeño frente a la **voz** y al **plan de n8n**: al multiplicar el volumen por 10, el salto de plan de n8n (por ejecuciones) y los minutos de voz dominan.
- A 10 000 casos/mes el Starter y el Pro no alcanzan por ejecuciones; hay que pasar a Business o autohospedar n8n.

## Optimización propuesta (sin reducir controles)

1. **Regla determinista en lugar del Agente 1 para solicitudes estructuradas.** Si el texto trae `perfil= monto= horizonte=`, el código extrae los campos y se omite la llamada A1. Ahorro estimado: la fracción de costo de A1 (ver «Por etapa») en esos casos. Calidad: igual o mejor (sin ambigüedad); el código sigue validando rangos. Riesgo: ninguno sobre seguridad, los guardrails de entrada no cambian.
2. **Reducir contexto del Agente 2:** enviar solo `id, riesgo, esg, extranjero, liquidez` (sin nombre ni rendimiento) baja los tokens de entrada de A2 ~30% (medir antes/después con la misma muestra).
3. **Prompt caching** del system prompt + instrucciones del skill (estables entre casos): lectura de caché a 0.01 USD/MTok frente a 0.10. Requiere medir el mínimo cacheable del modelo.

Comparación antes/después: correr los mismos 3 casos de prueba con la optimización 1 activada y registrar costo por caso y tasa de aprobación en primera revisión (KPI 1). No se acepta la optimización si el KPI 1 baja.
