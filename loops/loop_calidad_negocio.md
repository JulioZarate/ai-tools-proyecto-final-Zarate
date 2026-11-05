# Loop 1 · Calidad de negocio (A3 ⇄ A4)

**Secuencia de la guía:** Generar → medir campos, cálculos y fuentes → diagnosticar → corregir → validar. Liberar solo si supera los criterios.
**Dónde se ejecuta:** workflow principal, nodos `A3 preparar` → `LLM A3` → `A3 validar` → `A4 preparar` (R1–R10) → `LLM A4` → `A4 validar` → `Ruta tras A4` (regresa a `A3 preparar` o cierra).

## Ficha de control

| Campo | Valor |
|---|---|
| Entrada | Requerimiento validado (A1) + selección verificada (A2) + reglas de los skills `propuesta-portafolio` v1.1.1 y `revision-cumplimiento` v1.0.0 |
| Responsable | Orquestador (decide iterar/cerrar); A3 genera; A4 + código R1–R10 evalúan |
| Criterio de salida exitosa | `hallazgos_codigo = []` **y** veredicto LLM de A4 = `aprobado` para la versión vigente |
| Máximo de iteraciones | **3 totales** (una iteración = una versión de propuesta generada y revisada). Se mantiene el punto de partida de la guía: con el simulador y con datos reales la corrección suele bastar en la 2.ª |
| Tiempo límite | 120 s por caso (guardia antes de cada llamada) |
| Presupuesto | `limite_costo_usd` del caso (0.02 USD por defecto, 0.05 máximo) con 20% de reserva |
| Acción de retorno | Las correcciones de A4 (hallazgos de código + correcciones LLM) se envían a A3 como "correcciones obligatorias" |
| Estado al agotar el límite | `escalado_humano` con la última versión y sus hallazgos; nunca `pendiente_aprobacion` |
| Salida inválida de A3 (JSON) | Cuenta como iteración y regresa con la corrección "responde solo JSON" |
| Salida inválida de A4 | Se trata como `devuelto` (falla segura) |

## Pasos con preguntas de control

| # | Paso | Pregunta de control | Evidencia (campo / registro) |
|---|---|---|---|
| 1 | Interpretar la decisión esperada | ¿La propuesta permite al asesor decidir aprobar o rechazar un envío simulado? | `valoria_casos.estado = pendiente_aprobacion` solo con revisión aprobada |
| 2 | Inventariar campos y calidad | ¿Están perfil, monto, horizonte y selección validados por código? | traza `A1 intake completo`, `A2 seleccion ok` |
| 3 | Generar (A3) | ¿El cálculo es de código y la redacción solo lo explica? | traza `A3 calculo ok` (suma, rend, vol) + `A3 redaccion` con `llamada_id` |
| 4 | Medir y diagnosticar (R1–R10) | ¿Qué criterio falló, en qué campo y con qué valor? | traza `A4 chequeos_codigo` → `hallazgos` |
| 5 | Auditar evidencia y sesgos | ¿El revisor LLM puede aprobar algo que el código rechazó? No: el código vence | `revision_json.ultima.veredicto_final` vs `veredicto_llm` |
| 6 | Corregir (retorno a A3) | ¿Las correcciones son concretas y se aplicaron todas? | `correcciones` en la entrada de A3 de la iteración siguiente |
| 7 | Validar y comunicar | ¿La versión vigente es la aprobada y el botón apunta a esa versión? | `callback_data = ap|caso|versión`; botón de versión vieja → `version_no_vigente` |

## Evidencia V1 → V2 (caso `VAL-261104-YL7V`, entorno local con simulador)

Se activó `demo=falla_v1`, que inyecta un defecto declarado en la redacción V1 (quita "Resultado simulado" y agrega "rendimiento garantizado"). La traza lo registra como **DEFECTO INYECTADO**.

| Iteración | Versión | Llamadas | Hallazgos de código | Veredicto final | Costo adicional (USD, simulado) |
|---|---|---|---|---|---|
| 1 | V1 | L03 (A3), L04 (A4) | R4 falta "Resultado simulado"; R5 contiene "garantiza"/"garantizado" | **devuelto** | 0.000301 |
| 2 | V2 | L05 (A3), L06 (A4) | ninguno | **aprobado** | **0.000282** (costo de la corrección) |

Después, el botón de aprobación de V1 fue rechazado por el servidor (`HUMANO decision_ap → version_no_vigente`).
Fuente: `evidencias/local/export_local.json` (traza y costos). **Repetir en n8n Cloud** con `/nuevo perfil moderado, 500 mil pesos a 10 años, objetivo: patrimonio demo=falla_v1` y pegar el nuevo `caso_id` aquí.

## Bitácora antes / después (prompt libre vs. skill + loop)

| Aspecto | Prompt libre inicial ("arma un portafolio para este cliente") | Con skill + loop |
|---|---|---|
| Cifras | El modelo inventaba porcentajes y rendimientos | Cálculo determinista; R6/R7 verifican cada % del texto |
| Instrumentos | Podía sugerir productos fuera de catálogo o cripto | Solo IDs elegibles; código rechaza cualquier otro |
| Lenguaje | "Rendimiento seguro", sin aviso de simulación | Frases obligatorias y prohibidas verificadas (R4/R5) |
| Control | Un solo intento, sin criterio de salida | ≤ 3 iteraciones, criterio explícito, escalado humano |
| Trazabilidad | Ninguna | `caso_id`, versión, `llamada_id`, huella de skill en cada paso |

## Autoevaluación (0–4)

| Claridad | Secuencia | Evidencia | Control/retorno | Utilidad | Total |
|---|---|---|---|---|---|
| 4 | 4 | 4 | 4 | 3 | **19/20** |

**¿Qué se hará, con qué evidencia y cómo sabremos si funcionó?** Se liberará a aprobación humana solo la versión que pase R1–R10 y la revisión de A4; la evidencia es la traza por versión y `llamada_id`; sabremos que funcionó si el KPI "aprobadas en 1.ª revisión" se mantiene ≥ 80% y **ningún** caso llega a `pendiente_aprobacion` con hallazgos de código (verificable en `valoria_traza`).
