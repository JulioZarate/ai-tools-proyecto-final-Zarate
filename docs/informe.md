# Informe técnico y empresarial · Valoria: propuestas informativas con orquestador y cuatro agentes

**Proyecto final individual · AI Tools · Dra. Elda C. Morales**
**Autor:** Julio Alejandro Zárate García · **Versión del repositorio:** v1.0 · **Fecha:** [AAAA-MM-DD de entrega]

> Borrador generado con apoyo de IA y revisado por el autor. Los resultados de la sección 7.2 y los costos de la sección 8 provienen del entorno real (n8n Cloud + API de Anthropic, 4–5 de noviembre de 2026); los de la sección 7.1, de la integración local con simulador, y se identifican como tales.

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
4. **HTTP directo a la API de Anthropic** para obtener `usage` exacto por llamada y controlar reintentos (3) y timeout (60 s).
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
| Presupuesto y límites | Guardia antes de cada llamada (reserva 20%), ≤10 llamadas, ≤3 iteraciones, ≤240 s | P09 |
| Fallas y duplicados | Reintentos acotados, `error_api` honesto, dedupe persistente | P08, P10 |
| Trazabilidad | `caso_id`, versión, `llamada_id`, skill y huella en cada paso | P14 |

## 6. Visualización (VizData)

El panel responde a la pregunta del asesor: *¿qué tan confiable y costoso es el proceso, y dónde se detienen los casos?* Tres KPI con fórmula, unidad y denominador visibles; la gráfica principal es de **barras horizontales ordenadas** (dato nominal + conteo; base en cero; etiquetas directas) con color que codifica el grupo de cierre (azul: llegó a propuesta/decisión; gris: control; naranja: falla — paleta segura para daltonismo y acompañada de texto). La segunda gráfica muestra el costo por agente. Ambas tienen alternativa en tabla. El historial sanitizado tiene filtros y botón de restablecer. Estados implementados: carga, error, vacío, sin resultados y datos desactualizados (> 7 días) o muestra. Probado a 390 y 1366 px sin desplazamiento horizontal y con foco visible.

## 7. Resultados medidos

### 7.1 Integración local (n8n 2.46.4 real + simulador de la API, sin costo)
12/12 escenarios aprobados (P01–P11 y S01), ver `evidencias/local/resultado_integracion_local.json`. Dos defectos reales se detectaron y corrigieron gracias a estas pruebas: (1) una autorización de guardia del paso anterior permitía llamar al modelo cuando el cálculo ya había escalado el caso; (2) tras una aclaración, la numeración de `llamada_id` se reiniciaba y duplicaba identificadores.

### 7.2 n8n Cloud con API real (4–5 de noviembre de 2026)
Muestra: 6 casos registrados (5 por Telegram, 1 por voz), 23 llamadas al modelo, 60 pasos de traza. Fuente: `datos/export/export_sanitizado.json` (exportación sanitizada publicada por GitHub Actions).

| Caso | Canal | Resultado | Iteraciones | Costo IA (USD) |
|---|---|---|---:|---:|
| VAL-261105-YQZY | Telegram | Aprobado (v1 devuelta por A4 → v2 aprobada) | 2 | 0.005321 |
| VAL-261105-AQJJ | Telegram | Rechazado por el asesor | 1 | 0.002582 |
| VAL-261105-F66J | Telegram | Expirado (Aprobar después del plazo de 30 min) | 1 | 0.003602 |
| VAL-261105-4DM3 | Voz (ElevenLabs) | Aprobado; consultado después por voz desde Pages | 1 | 0.002853 |
| VAL-261104-ZCGU | Telegram | Falla controlada (`error_api`): A2 sin texto por `max_tokens` | 0 | 0.000717 |
| VAL-261105-MPWJ | Telegram | Falla controlada (`error_validacion`): A2 omitió liquidez | 0 | 0.002854 |

| KPI | Valor medido | n | Lectura |
|---|---|---|---|
| Aprobación en primera revisión | **75%** | 3 de 4 que llegaron a A4 | Debajo de la meta de referencia (80%); con n = 4 la cifra es inestable (límite) |
| Ciclo hasta decisión humana (mediana) | **0.5 min** | 3 decisiones | El caso expirado no entra (no hubo decisión) |
| Costo variable por caso completado | **0.00359 USD** (≈ 0.063 MXN) | 4 completados | Fallidos aparte: 0.003571 USD en 2 casos |

Otras pruebas en el entorno real: inyección bloqueada antes del modelo (P06), segundo clic sobre un caso ya aprobado sin efecto (P10), publicación bloqueada por una regla incorrecta y recuperada (P12, ejecuciones 42107492452 y 42107774901), alternativa textual con micrófono denegado (P13). Los dos casos fallidos dieron dos correcciones al sistema: mensajes de Telegram en HTML escapado y `max_tokens` mayor (ZCGU), y liquidez completada por código con supuesto explícito (MPWJ; skill 1.1.1). Detalle: `evidencias/cloud/resultados_cloud.json` y `tests/pruebas.csv`.

## 8. Costos

Fórmula por llamada: Cᵢ = (T_entrada × P_entrada + T_salida × P_salida) / 1 000 000, con P = 0.10 y 0.50 USD por millón de tokens (Claude Haiku 5.5, prompts ≤ 100 k). Costo del caso = Σ llamadas LLM + voz + herramientas; los skills y loops no tienen filas propias (se refieren a las llamadas que los ejecutan, para no contar dos veces). Telegram, n8n, Pages y Actions se registran como cargos de plataforma con tokenización "no aplica". El desarrollo con IA se registra aparte (inversión, cubierta por suscripción).

Costo medido: 23 llamadas, **0.017929 USD** en total (conciliado: suma por llamada = suma por caso). Por agente: A2 0.007951 USD (44%), A3 0.004750, A4 0.003929, A1 0.001299. A2 domina porque recibe el catálogo filtrado y genera la salida más larga (13,631 tokens de salida en 7 llamadas, incluido el razonamiento interno del modelo). Costo por caso completado: 0.00359 USD; 4.5 llamadas promedio. La voz de ElevenLabs se cobra por minuto y se registra aparte (`costos/costos_manual.csv`): 6 conversaciones del 5-nov sumaron **33.3 min**, equivalentes a **2.67 USD** a precio de lista (0.08 USD/min), cubiertos por los minutos incluidos del plan. Dato: 3 de las 6 sesiones duraron entre 8.9 y 10 min con solo 5–6 mensajes. Inferencia: el widget quedó abierto sin actividad y ese tiempo se cobra igual. Acción: configurar en ElevenLabs una duración máxima y un corte por inactividad; indicador: minutos por conversación (mediana) en el siguiente export. Las proyecciones (`costos/proyecciones.md`) muestran que a 100, 1 000 y 10 000 casos/mes los tokens de los agentes son una fracción pequeña; dominan los **minutos de voz** y el **plan de n8n por ejecuciones** (a 10 000 casos/mes el plan Pro no alcanza). Optimización propuesta: regla determinista que sustituye a A1 cuando la solicitud ya viene estructurada (`perfil= monto= horizonte=`), comparando costo y KPI 1 antes y después; no se reduce ningún control.

## 9. Diagnóstico: tres hallazgos priorizados

| # | Hallazgo | Evidencia (campo/registro) | Impacto | Riesgo | Acción | Indicador |
|---|---|---|---|---|---|---|
| 1 | El costo variable está dominado por voz y plataforma, no por tokens | `costos/proyecciones.md`: a 1,000 casos/mes los agentes cuestan 3.59 USD frente a 47.52 USD de voz y 64.80 USD de n8n (escenario base) | Optimizar prompts ahorra poco; la decisión de plan y de duración de voz importa más | Mezcla de rutas y minutos de voz son supuestos; n = 6 casos | Medir minutos reales por conversación y ejecuciones por caso; decidir plan con ellos | USD/caso total por escenario, recalculado mensualmente |
| 2 | El loop corrige la redacción sin intervención humana | `VAL-261105-YQZY`: v1 devuelta por A4, v2 aprobada (dato real, sin demo); KPI 1 = 75% (3/4) | Ninguna propuesta con hallazgos llegó al asesor | n = 4 revisiones: la tasa es inestable; la causa de la devolución es inferencia hasta revisar la traza completa | Correr 10 casos más y revisar qué criterio R1–R10 o del LLM devuelve más | KPI 1 ≥ 80% y 0 casos `pendiente_aprobacion` con hallazgos |
| 3 | A2 concentra el 44% del costo de IA | `costos/resumen.md` por etapa: A2 0.007951 de 0.017929 USD; 13,631 tokens de salida | Es el primer lugar para optimizar sin tocar controles | El razonamiento interno del modelo no se ve: su peso exacto es inferencia | Reducir el contexto de A2 (solo id, riesgo, esg, extranjero, liquidez) y comparar costo y KPI 1 antes/después | USD por llamada de A2 y KPI 1 (no se acepta si baja) |

Se distingue **dato** (registros), **inferencia** (lectura de los datos), **supuesto** (tarifas, mezcla de rutas) y **límite** (muestra simulada). No se afirma causalidad.

## 10. Limitaciones

- La muestra real es pequeña (6 casos, 4 completados): los KPI son indicativos, no concluyentes. Las pruebas P05, P07, P09 y S01 tienen evidencia de la integración local con n8n y un simulador de la API, no de la nube.
- Rendimientos y volatilidades son ilustrativos; la volatilidad supone correlación cero (subestima el riesgo).
- La detección de inyección por patrones no es exhaustiva; el modelo también recibe el texto como dato no confiable.
- El vencimiento es perezoso: un caso vencido aparece como pendiente en la tabla cruda hasta que alguien lo consulta o pulsa el botón (el panel lo muestra como pendiente).
- La voz pública no autentica a la persona; por eso solo maneja datos ficticios y no aprueba.
- Tarifas consultadas en fuentes secundarias que citan las páginas oficiales; verificar el día de la entrega. El tipo de cambio debe actualizarse con el FIX vigente.

## 11. Reflexión individual

- **¿Qué decisión resuelve?** Si el asesor aprueba o rechaza una versión concreta de una propuesta informativa.
- **¿Qué aporte real tuvo cada agente?** Ver tabla de la sección 2 y la traza de cualquier caso (cuatro `llamada_id` distintos con entradas y salidas diferentes).
- **¿Qué control evitó una acción incorrecta?** El vencimiento: aprobar F66J después del plazo no ejecutó nada. También el revisor A4, que devolvió la v1 de YQZY, y la validación de versión y de estado (un segundo clic sobre un caso aprobado no hizo nada).
- **¿Qué parte fue más costosa y por qué?** El Agente 2 (44% del costo de IA): recibe la lista de instrumentos elegibles y produce la salida más larga. En dinero, a escala, pesan más los minutos de voz y el plan de n8n.
- **¿Qué cambia al multiplicar el volumen por diez?** El plan de n8n y los minutos de voz; el costo por caso de los agentes casi no cambia.
- **¿Qué validaría antes de usar datos reales?** Autorización y consentimiento, catálogo y rendimientos reales con fuente, revisión regulatoria del lenguaje, autenticación en voz y pruebas de inyección más amplias.

## 12. Referencias

Fuentes oficiales listadas en la guía del proyecto [1–13] (Telegram Bot API; n8n Telegram Trigger y Webhook; GitHub Pages y Actions; ElevenLabs widget, webhook tools, autenticación y precios; W3C WCAG; n8n pricing). Tarifas y fechas de consulta: `costos/tarifas.csv`. Declaración de uso de IA: `docs/declaracion_uso_ia.md`.
