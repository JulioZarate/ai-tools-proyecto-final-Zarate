# Diccionario de datos

Todas las fechas son texto ISO 8601 en UTC. Tablas privadas en n8n Data Tables (creadas por `WF0`). Datos ficticios.

## valoria_casos (una fila por caso)
| Campo | Tipo | Descripción | ¿Público? |
|---|---|---|---|
| caso_id | texto | `VAL-AAMMDD-XXXX` | sí |
| canal | texto | telegram / voz | sí |
| usuario_ps | texto | seudónimo `u_<hash>` o `voz_publica` | **no** |
| estado | texto | ver `agentes/orquestador.md` | sí |
| version_propuesta | número | versión vigente (0 = sin propuesta) | sí |
| texto_solicitud | texto | solicitud **enmascarada** (correos, teléfonos, CURP/RFC, tarjetas → marcadores), ≤600 | **no** |
| perfil_riesgo, horizonte_anios, restricciones | texto/número | requerimiento validado | sí |
| monto_mxn | número | monto solicitado | solo como rango |
| requerimiento_json, propuesta_json, revision_json | texto JSON | salidas de A1, A3 (+cálculo), A4 (historial) | derivados agregados |
| resumen | texto | redacción de A3 | **no** |
| iteraciones, llamadas, costo_usd, limite_costo_usd | número | control del loop y costo acumulado | sí (excepto límite) |
| creado_en, actualizado_en, aprobacion_expira_en, decidido_en | texto | tiempos | sí |
| decision, decidido_por, motivo, demo | texto | decisión humana, seudónimo del asesor, causa, bandera de demo | decisión y demo sí |

## valoria_eventos (deduplicación)
evento_id (`tg:<update_id>` o `voz:<hash>`), caso_id, canal, tipo, ruta, usuario_ps, recibido_en.

## valoria_costos (una fila por llamada LLM)
fecha_hora, caso_id, llamada_id, etapa, agente, proveedor, modelo, tokens_entrada, tokens_salida, tokens_cache, duracion_voz_seg, unidad_cobro, tarifa_entrada, tarifa_salida, costo_usd, moneda, estado, reintento, origen_dato (`medido_api` | `estimado_sin_cobro_confirmado`), iteracion, duracion_ms.

## valoria_traza (decisiones observables, sin razonamiento interno)
caso_id, paso, agente (ORQ, A1–A4, GUARDRAIL, HUMANO), accion, estado, entrada_resumen, salida_resumen, skill, version_skill, huella_skill, llamada_id, version_propuesta, iteracion, timestamp.

## Exportación sanitizada (`valoria-export/1`) y panel (`valoria-panel/1`)
Solo campos marcados como públicos; monto en rangos (`<100k`, `100k-500k`, `500k-1M`, `>=1M`); costos sin usuario; traza sin textos. `scripts/build_panel.mjs` y `scripts/construir_sitio.mjs` rechazan la publicación si aparece un campo personal.

## Catálogo `datos/catalogo_instrumentos.json`
id, nombre, clase (liquidez, deuda_gubernamental, deuda_corporativa, renta_variable, derivados, cripto), riesgo (1–5), rend_esperado_anual y volatilidad_anual (supuestos ilustrativos), liquidez_dias, monto_min_mxn, esg, extranjero.
