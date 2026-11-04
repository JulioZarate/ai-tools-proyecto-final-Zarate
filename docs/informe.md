# Informe técnico y empresarial · Valoria: propuestas informativas con orquestador y cuatro agentes

**Proyecto final individual · AI Tools · Dra. Elda C. Morales**
**Autor:** Julio Alejandro Zárate García · **Versión del repositorio:** v1.0 · **Fecha:** [AAAA-MM-DD de entrega]

> Borrador generado con apoyo de IA y revisado por el autor. Las secciones marcadas **[PENDIENTE CLOUD]** se completan con los resultados de las pruebas en n8n Cloud con la API real (los números actuales provienen de la integración local con simulador y se identifican como tales).

---

## 1. Problema y decisión

Valoria Casa de Bolsa (empresa **ficticia**) recibe solicitudes de propuestas informativas de portafolio. Hoy el asesor arma cada propuesta a mano: busca instrumentos, calcula pesos y redacta el resumen. Tres riesgos se repiten: (a) errores de cálculo (pesos que no suman 100%, montos por debajo del mínimo del instrumento), (b) productos fuera del catálogo autorizado o del perfil del cliente, y (c) lenguaje que suena a promesa ("rendimiento garantizado").

**Usuario:** el asesor autorizado (Telegram). **Decisión:** *¿apruebo el envío (simulado) de esta versión de la propuesta, o la rechazo?* La solución no toma la decisión: prepara una propuesta verificable, la revisa y la pone frente al asesor con un botón ligado a la versión exacta.

**Alcance:** de la solicitud (`/nuevo` o voz) a la decisión del asesor y su notificación. Fuera de alcance: operar en el mercado, contactar clientes, asesoría regulada real. Por ser un caso financiero, la función es **informativa** y la decisión profesional es humana.

## 2. Arquitectura

(Ver diagrama en `docs/arquitectura.md`.) Una sola entrada Telegram y un webhook de voz convergen en el nodo **Normalizar y validar entrada** del workflow principal de n8n Cloud. Ahí se aplican los guardrails de acceso, longitud, inyección y modo antes de cualquier modelo. Tras deduplicar por `evento_id`, el router envía el evento a crear caso, aclarar, consultar estado o registrar una decisión.

El **orquestador** es código: crea el plan, descarga los dos skills publicados en Pages (y registra su versión y huella), y ejecuta A1 → A2 → A3 ⇄ A4. Antes de cada llamada al modelo aplica la guardia de presupuesto, llamadas y tiempo; después registra los tokens reportados por la API y valida el contrato del agente. Un único nodo de cierre escribe el estado final, las filas de costo y la traza, y envía la aprobación con botones `ap|caso|versión`.

La exportación sanitizada (webhook GET con clave) alimenta un commit; GitHub Actions corre 15 pruebas, regenera el panel, escanea secretos y publica en Pages solo si todo pasa.

**Por qué cada especialista:**

| Agente | Aportación verificable | Qué recibe del anterior |
|---|---|---|
| A1 Intake | Requerimiento estructurado o pregunta de aclaración; señales de inyección | Texto enmascarado |
| A2 Datos | Selección de IDs elegibles con justificación; insuficiencias | Requerimiento + lista de elegibles filtrada por reglas |
| A3 Propuesta | Cálculo determinista (pesos, montos, rendimiento y volatilidad ilustrativos) + resumen, supuestos y riesgos | Selección verificada (+ correcciones de A4) |
| A4 Revisor | Veredicto combinado: R1–R10 en código **y** revisión LLM | Requerimiento, cálculo y redacción |

## 3. Datos

Todo es ficticio: catálogo `VALORIA-CAT v1.0.0` con 16 instrumentos (incluye dos prohibidos, derivados y cripto, para probar políticas), rendimientos y volatilidades ilustrativos. Las tablas privadas (`valoria_casos`, `valoria_eventos`, `valoria_costos`, `valoria_traza`) viven en n8n Data Tables; el diccionario está en `datos/diccionario_datos.md`. Minimización: el texto de la solicitud se enmascara (correos, teléfonos, CURP/RFC, números largos) antes de guardarse o enviarse al modelo; los usuarios se guardan como seudónimo `u_<hash>`; el panel solo publica rangos de monto y campos no personales.

## 4. Decisiones de diseño

1. **Orquestador determinista.** El orden del proceso es fijo; un LLM "decidiendo el siguiente paso" agregaría costo e incertidumbre sin información nueva. El juicio está en los agentes.
2. **El LLM extrae o explica; el código calcula y decide.** A1 extrae, `validarRequerimiento()` decide; A2 elige, el código verifica IDs; A3 explica cifras que calculó `calcularPropuesta()`; A4 opina, pero R1–R10 vencen.
3. **Fuente única de código.** El cálculo y la revisión viven en `agentes/*.js`; un generador los copia a los nodos Code y una prueba verifica que la copia sea idéntica. Así lo que se prueba en Actions es lo que corre en n8n.
4. **HTTP directo a la API de Anthropic** para obtener `usage` exacto por llamada y controlar reintentos (3) y timeout (30 s).
5. **Skills cargados en ejecución** desde Pages con huella en la traza: si el archivo cambia, la traza lo muestra; si no se puede descargar, el caso se detiene (`error_skill`) en lugar de usar una copia vieja en silencio.
6. **Aprobación ligada a versión y plazo** (30 min, vencimiento perezoso al pulsar o consultar).

## 5. Seguridad y guardrails

| Control | Implementación | Prueba |
|---|---|---|
| Acceso y alcance | Lista de usuarios por rol en CONFIG; voz con rol `voz_publica` (solo crear/consultar ficticios) | P07 |
| Datos y privacidad | Longitud ≤ 600, formato de folio, enmascaramiento, seudónimos, export sanitizado, escaneo en Actions | P05, P14 |
| Inyección | Patrones bloqueados antes del modelo; textos recuperados se pasan entre etiquetas como datos no confiables; R10 revisa la salida | P06 |
| Fuentes y veracidad | Solo catálogo autorizado; IDs verificados; cifras del texto contrastadas con el cálculo (R6/R7) | P11 |
| Herramientas | Sin URLs del usuario (bloqueadas), sin ejecución de código propuesto; solo dos endpoints de voz con clave | P06 |
| Aprobación humana | Botón = caso + versión + asesor + plazo; rechazo y vencimiento no ejecutan | P04 |
| Presupuesto y límites | Guardia antes de cada llamada (reserva 20%), ≤10 llamadas, ≤3 iteraciones, ≤120 s | P09 |
| Fallas y duplicados | Reintentos acotados, `error_api` honesto, dedupe persistente | P08, P10 |
| Trazabilidad | `caso_id`, versión, `llamada_id`, skill y huella en cada paso | P14 |

## 6. Visualización (VizData)

El panel responde a la pregunta del asesor: *¿qué tan confiable y costoso es el proceso, y dónde se detienen los casos?* Tres KPI con fórmula, unidad y denominador visibles; la gráfica principal es de **barras horizontales ordenadas** (dato nominal + conteo; base en cero; etiquetas directas) con color que codifica el grupo de cierre (azul: llegó a propuesta/decisión; gris: control; naranja: falla — paleta segura para daltonismo y acompañada de texto). La segunda gráfica muestra el costo por agente. Ambas tienen alternativa en tabla. El historial sanitizado tiene filtros y botón de restablecer. Estados implementados: carga, error, vacío, sin resultados y datos desactualizados (> 7 días) o muestra. Probado a 390 y 1366 px sin desplazamiento horizontal y con foco visible.

## 7. Resultados medidos

### 7.1 Integración local (n8n 2.46.4 real + simulador de la API, sin costo)
12/12 escenarios aprobados (P01–P11 y S01), ver `evidencias/local/resultado_integracion_local.json`. Dos defectos reales se detectaron y corrigieron gracias a estas pruebas: (1) una autorización de guardia del paso anterior permitía llamar al modelo cuando el cálculo ya había escalado el caso; (2) tras una aclaración, la numeración de `llamada_id` se reiniciaba y duplicaba identificadores.

### 7.2 n8n Cloud con API real **[PENDIENTE CLOUD]**
| Medida | Valor | Fuente |
|---|---|---|
| Casos completos (≥3) y caso de error | [ ] | `valoria_casos` export |
| KPI 1 aprobación en 1.ª revisión | [ ] % (n = [ ]) | panel |
| KPI 2 ciclo mediano | [ ] min (n = [ ]) | panel |
| KPI 3 costo por caso completado | [ ] USD/caso | `costos/resumen.md` |
| Conversación de voz conectada | folio [ ] | ElevenLabs + n8n |

## 8. Costos

Fórmula por llamada: Cᵢ = (T_entrada × P_entrada + T_salida × P_salida) / 1 000 000, con P = 0.10 y 0.50 USD por millón de tokens (Claude Haiku 5.5, prompts ≤ 100 k). Costo del caso = Σ llamadas LLM + voz + herramientas; los skills y loops no tienen filas propias (se refieren a las llamadas que los ejecutan, para no contar dos veces). Telegram, n8n, Pages y Actions se registran como cargos de plataforma con tokenización "no aplica". El desarrollo con IA se registra aparte (inversión, cubierta por suscripción).

Con la muestra simulada el costo LLM es del orden de 0.0006 USD por caso completado; **[PENDIENTE CLOUD]** reemplazar con el valor medido. Las proyecciones (`costos/proyecciones.md`) muestran que a 100, 1 000 y 10 000 casos/mes los tokens de los agentes son una fracción pequeña; dominan los **minutos de voz** y el **plan de n8n por ejecuciones** (a 10 000 casos/mes el plan Pro no alcanza). Optimización propuesta: regla determinista que sustituye a A1 cuando la solicitud ya viene estructurada (`perfil= monto= horizonte=`), comparando costo y KPI 1 antes y después; no se reduce ningún control.

## 9. Diagnóstico: tres hallazgos priorizados

| # | Hallazgo | Evidencia (campo/registro) | Impacto | Riesgo | Acción | Indicador |
|---|---|---|---|---|---|---|
| 1 | El costo variable está dominado por voz y plataforma, no por tokens | `costos/proyecciones.md` (escenarios base y alto) | Optimizar prompts ahorra poco; la decisión de plan importa más | Muestra simulada (dato) → la magnitud exacta es supuesto hasta medir en Cloud | Medir minutos reales por conversación y ejecuciones por caso; decidir plan con ellos | USD/caso total por escenario, recalculado con datos de Cloud |
| 2 | El loop corrige defectos de redacción en una iteración | Traza `VAL-261104-YL7V`: v1 devuelto (R4, R5) → v2 aprobado; costo extra 0.000282 USD (simulado) | Ninguna propuesta defectuosa llega al asesor | El defecto fue inyectado (demo); la tasa natural de error del modelo es desconocida (límite) | Correr 10 casos reales sin demo y medir KPI 1 | KPI 1 ≥ 80% y 0 casos `pendiente_aprobacion` con hallazgos |
| 3 | Los controles más baratos son los de entrada | P06/P07/P09: bloqueos con 0 llamadas LLM | Ahorro y seguridad: lo inválido nunca llega al modelo | Los patrones de inyección son una lista; puede haber evasiones (inferencia) | Agregar pruebas con variantes de inyección y revisar falsos positivos | % de entradas bloqueadas legítimas (falsos positivos) en `valoria_traza` |

Se distingue **dato** (registros), **inferencia** (lectura de los datos), **supuesto** (tarifas, mezcla de rutas) y **límite** (muestra simulada). No se afirma causalidad.

## 10. Limitaciones

- La evidencia actual es local con simulador; los tokens y costos de la muestra no son facturables. Debe repetirse en Cloud.
- Rendimientos y volatilidades son ilustrativos; la volatilidad supone correlación cero (subestima el riesgo).
- La detección de inyección por patrones no es exhaustiva; el modelo también recibe el texto como dato no confiable.
- El vencimiento es perezoso: un caso vencido aparece como pendiente en la tabla cruda hasta que alguien lo consulta o pulsa el botón (el panel lo muestra como pendiente).
- La voz pública no autentica a la persona; por eso solo maneja datos ficticios y no aprueba.
- Tarifas consultadas en fuentes secundarias que citan las páginas oficiales; verificar el día de la entrega. El tipo de cambio debe actualizarse con el FIX vigente.

## 11. Reflexión individual

- **¿Qué decisión resuelve?** Si el asesor aprueba o rechaza una versión concreta de una propuesta informativa.
- **¿Qué aporte real tuvo cada agente?** Ver tabla de la sección 2 y la traza de cualquier caso (cuatro `llamada_id` distintos con entradas y salidas diferentes).
- **¿Qué control evitó una acción incorrecta?** La validación de versión: el botón de la v1 no pudo aprobar después de que el loop generó la v2; y la guardia que impidió una llamada cuando el caso ya estaba escalado (defecto corregido).
- **¿Qué parte fue más costosa y por qué?** [PENDIENTE CLOUD; en la muestra, A2 por el contexto del catálogo].
- **¿Qué cambia al multiplicar el volumen por diez?** El plan de n8n y los minutos de voz; el costo por caso de los agentes casi no cambia.
- **¿Qué validaría antes de usar datos reales?** Autorización y consentimiento, catálogo y rendimientos reales con fuente, revisión regulatoria del lenguaje, autenticación en voz y pruebas de inyección más amplias.

## 12. Referencias

Fuentes oficiales listadas en la guía del proyecto [1–13] (Telegram Bot API; n8n Telegram Trigger y Webhook; GitHub Pages y Actions; ElevenLabs widget, webhook tools, autenticación y precios; W3C WCAG; n8n pricing). Tarifas y fechas de consulta: `costos/tarifas.csv`. Declaración de uso de IA: `docs/declaracion_uso_ia.md`.
