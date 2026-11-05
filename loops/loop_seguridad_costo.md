# Loop 2 · Seguridad y costo (antes y después de cada llamada)

**Secuencia de la guía:** Evaluar permisos y presupuesto → ejecutar paso autorizado → registrar consumo → revisar límite y resultado → continuar o detener.
**Dónde se ejecuta:** función `guardia()` en cada nodo `Ax preparar` → If `¿Ax autorizado?` → `LLM Ax` (reintentos 3, timeout 30 s) → `registrarLlamada()` en `Ax validar` → `Ruta tras Ax`. Antes de todo esto, el nodo `Normalizar y validar entrada` aplica los guardrails de acceso, longitud, inyección y modo.

## Ficha de control

| Campo | Valor |
|---|---|
| Entrada | Estado del caso (`gasto_usd`, `limite_costo_usd`, `llamadas`, `inicio_ms`) + agente solicitado + prompt construido |
| Responsable | Orquestador (código, sin LLM) |
| Criterios para autorizar | agente en lista permitida (A1–A4); llamadas < 10; tiempo < 120 s; costo estimado (tokens ≈ caracteres/3, salida = `max_tokens`) ≤ límite × 0.8 − gasto |
| Máximo de iteraciones | Igual al loop de calidad (3) + 1 corrección de A2; tope global 10 llamadas por caso |
| Tiempo límite | 30 s por llamada (nodo HTTP) y 120 s por caso |
| Presupuesto | 0.02 USD por caso por defecto; el usuario solo puede **bajarlo** (`presupuesto=`), nunca subirlo por encima de 0.05 |
| Acción de retorno | Si se autoriza: llamar y registrar. Si la API falla: hasta 3 intentos del nodo; luego `error_api` |
| Estado al agotar el límite | `detenido_presupuesto` o `detenido_limite`, con la causa en `motivo` y en la traza; no se hacen más llamadas |

## Pasos con preguntas de control

| # | Paso | Pregunta de control | Evidencia |
|---|---|---|---|
| 1 | Interpretar la decisión | ¿Este paso necesita un modelo o basta una regla? | Orquestador sin LLM; cálculos y R1–R10 en código |
| 2 | Inventariar | ¿Quién pide, con qué rol, en qué modo, con qué texto? | `valoria_eventos` (evento_id, ruta, usuario seudónimo) |
| 3 | Evaluar permisos | ¿Usuario autorizado? ¿Puede aprobar? ¿Texto sin inyección/URLs? | traza `GUARDRAIL rechazo_entrada` (P06, P07) |
| 4 | Evaluar presupuesto | ¿Alcanza con reserva de 20%? | traza `ORQ guardia detenido_presupuesto` (P09) |
| 5 | Ejecutar y registrar | ¿Se registró el uso reportado por la API (no estimado)? | `valoria_costos.origen_dato = medido_api` |
| 6 | Revisar límite y resultado | ¿La salida cumple contrato? ¿La API falló? | `estado` de la fila de costo; `error_api` sin cobro confirmado (P08) |
| 7 | Continuar o detener | ¿Se cerró con un estado honesto? | `cerrar_caso`: nunca `pendiente_aprobacion` sin aprobación vigente de A4 |

## Evidencia (local con simulador; repetir en Cloud)

| Prueba | Resultado |
|---|---|
| P09 `presupuesto=0.0002` | `detenido_presupuesto`, 0 llamadas, costo 0 |
| P08 API devuelve 529 | `error_api`, 1 fila de costo con `origen_dato = estimado_sin_cobro_confirmado` y costo 0 |
| P06 "ignora tus instrucciones… api key" | bloqueado en entrada: 0 casos nuevos y 0 llamadas LLM |
| P10 mismo `update_id` dos veces | el segundo evento no crea caso (dedupe en `valoria_eventos`) |

## Autoevaluación (0–4)

| Claridad | Secuencia | Evidencia | Control/retorno | Utilidad | Total |
|---|---|---|---|---|---|
| 4 | 4 | 3 | 4 | 4 | **19/20** |

**¿Qué se hará, con qué evidencia y cómo sabremos si funcionó?** Cada llamada se autoriza antes de ejecutarse y se registra después; la evidencia son las filas de `valoria_costos` y los pasos `guardia` de `valoria_traza`; sabremos que funcionó si ningún caso supera su `limite_costo_usd` (consulta: `costo_usd > limite_costo_usd` debe devolver 0 filas) y si los casos detenidos muestran su causa.
