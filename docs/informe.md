# Informe técnico y empresarial. Valoria: propuestas informativas con orquestador y cuatro agentes

**Proyecto final individual de AI Tools. Dra. Elda C. Morales**

**Autor:** Julio Alejandro Zárate García. **Versión del repositorio:** v1.0, rama main. **Fecha:** 24 de noviembre de 2026.

Nota de fuentes: los resultados de la sección 7.2 y los costos de la sección 8 provienen del entorno real (n8n Cloud y API de Anthropic, 4 y 5 de noviembre de 2026). Los de la sección 7.1 provienen de la integración local con simulador y se identifican como tales. El uso de IA en el desarrollo se declara en docs/declaracion_uso_ia.md.

## 1. Problema y decisión

Valoria Casa de Bolsa es una empresa **ficticia** que recibe solicitudes de propuestas informativas de portafolio. Sin un sistema de apoyo, el asesor arma cada propuesta a mano: busca instrumentos en el catálogo, calcula los pesos y redacta el resumen. En ese proceso se repiten tres riesgos: errores de cálculo (pesos que no suman 100% o montos por debajo del mínimo del instrumento), productos fuera del catálogo autorizado o del perfil del cliente, y lenguaje que suena a promesa, como "rendimiento garantizado".

El usuario del sistema es el asesor autorizado, que trabaja desde Telegram. Su decisión es si aprueba o rechaza el envío (simulado) de una versión concreta de la propuesta. La solución no toma esa decisión: prepara una propuesta verificable, la revisa y la presenta al asesor con un botón ligado a la versión exacta.

El alcance va desde la solicitud, hecha con el comando /nuevo o por voz, hasta la decisión del asesor y su notificación. Quedan fuera operar en el mercado, contactar clientes y dar asesoría regulada real. Por tratarse de un caso financiero, la función es **informativa** y la decisión profesional es humana.

## 2. Arquitectura

El diagrama completo está en docs/arquitectura.md. Una sola entrada de Telegram y un webhook de voz llegan al nodo **Normalizar y validar entrada** del workflow principal de n8n Cloud. Ahí se aplican los controles de acceso, longitud, inyección y modo antes de llamar a cualquier modelo. Después de eliminar eventos duplicados, el sistema envía cada evento a la acción que corresponde: crear un caso, pedir una aclaración, consultar un estado o registrar una decisión.

El **orquestador** está escrito en código. Crea el plan del caso, descarga los dos skills publicados en GitHub Pages y registra su versión y su huella. Luego ejecuta a los agentes en orden: primero el Agente 1, después el Agente 2, y finalmente el Agente 3 y el Agente 4, que pueden repetir su ciclo si la revisión encuentra fallas. Antes de cada llamada al modelo revisa el presupuesto, el número de llamadas y el tiempo; después registra los tokens que reporta la API y valida que la salida del agente cumpla su contrato. Un solo nodo de cierre escribe el estado final, los costos y la traza, y envía la solicitud de aprobación con botones ligados al caso y a la versión.

La exportación sanitizada de los registros alimenta un commit en GitHub. GitHub Actions corre 16 pruebas, regenera el panel, busca secretos y publica en GitHub Pages solo si todo pasa.

**Por qué cada especialista.** El Agente 1 (Intake) recibe el texto de la solicitud ya enmascarado y entrega un requerimiento estructurado o una pregunta de aclaración, además de señales de posible inyección. El Agente 2 (Datos) recibe ese requerimiento junto con la lista de instrumentos que las reglas permiten, y devuelve una selección justificada o una declaración de que la información es insuficiente. El Agente 3 (Propuesta) recibe la selección ya verificada; el código calcula pesos, montos, rendimiento y volatilidad ilustrativos, y el agente redacta el resumen, los supuestos y los riesgos. El Agente 4 (Revisor) recibe el requerimiento, el cálculo y la redacción, y emite un veredicto que combina diez reglas de código (R1 a R10) con su propia revisión. Si encuentra fallas, devuelve la propuesta al Agente 3 con correcciones concretas.

## 3. Datos

Todos los datos son ficticios. El catálogo VALORIA-CAT v1.0.0 tiene 16 instrumentos, entre ellos dos prohibidos (derivados y criptomonedas) que sirven para probar las políticas, con rendimientos y volatilidades ilustrativos. Las tablas privadas (valoria_casos, valoria_eventos, valoria_costos y valoria_traza) viven en n8n Data Tables, y el diccionario de datos está en datos/diccionario_datos.md.

Para minimizar datos, el texto de la solicitud se enmascara antes de guardarse o enviarse al modelo: se ocultan correos, teléfonos, CURP, RFC y números largos. Los usuarios se guardan con un seudónimo, y el panel público solo muestra rangos de monto y campos no personales.

## 4. Decisiones de diseño

**Orquestador determinista.** El orden del proceso es fijo. Un modelo de lenguaje que decidiera el siguiente paso agregaría costo e incertidumbre sin aportar información nueva; el juicio está en los agentes.

**El modelo extrae o explica; el código calcula y decide.** El Agente 1 extrae los datos y una función de código decide si están completos. El Agente 2 elige instrumentos y el código verifica que existan y estén permitidos. El Agente 3 explica cifras que calculó el código. El Agente 4 opina, pero las reglas R1 a R10 tienen la última palabra.

**Una sola fuente de código.** El cálculo y la revisión viven en la carpeta agentes. Un generador los copia a los nodos de n8n y una prueba verifica que la copia sea idéntica; así, lo que se prueba en GitHub Actions es lo mismo que corre en n8n.

**Conexión directa con la API de Anthropic.** Permite obtener el consumo exacto de tokens por llamada y controlar los reintentos (tres) y el tiempo máximo de espera (60 segundos).

**Skills cargados en cada ejecución.** Los skills se descargan desde GitHub Pages y su huella queda en la traza. Si el archivo cambia, la traza lo muestra; si no se puede descargar, el caso se detiene en lugar de usar en silencio una copia vieja.

**Aprobación ligada a la versión y al plazo.** El botón de aprobación vale solo para un caso, una versión y 30 minutos. El vencimiento se revisa cuando alguien presiona el botón o consulta el caso.

## 5. Seguridad y guardrails

Cada control está implementado en el flujo o en el servidor y tiene una prueba que lo demuestra.

**Acceso y alcance.** Solo los usuarios dados de alta en la configuración, con su rol, pueden operar. La voz tiene un rol público que solo permite crear y consultar casos ficticios. Lo demuestra la prueba P07.

**Datos y privacidad.** Se limita la longitud de los mensajes a 600 caracteres, se valida el formato del folio, se enmascaran datos personales, se usan seudónimos, la exportación es sanitizada y GitHub Actions busca datos prohibidos antes de publicar. Lo demuestran las pruebas P05 y P14.

**Inyección de instrucciones.** Los patrones de inyección se bloquean antes de llegar al modelo; los textos recuperados se pasan como datos no confiables y la regla R10 revisa la salida. Lo demuestra la prueba P06.

**Fuentes y veracidad.** Solo se usa el catálogo autorizado, se verifican los identificadores de los instrumentos y cada cifra del texto se compara con el cálculo (reglas R6 y R7). Lo demuestra la prueba P11.

**Herramientas y acciones.** No se aceptan direcciones web enviadas por el usuario ni se ejecuta código propuesto. La voz solo puede usar dos herramientas, protegidas con clave. Lo demuestra la prueba P06.

**Aprobación humana.** El botón combina caso, versión, asesor y plazo; el rechazo y el vencimiento no ejecutan la acción. Lo demuestra la prueba P04.

**Presupuesto y límites.** Antes de cada llamada se revisa el presupuesto, con una reserva del 20%. Hay un máximo de 10 llamadas, 3 iteraciones y 240 segundos por caso. Lo demuestra la prueba P09.

**Fallas y duplicados.** Los reintentos son limitados, los errores se registran con un estado claro y los eventos duplicados se detectan de forma persistente. Lo demuestran las pruebas P08 y P10.

**Trazabilidad.** Cada paso registra el folio del caso, la versión, el identificador de la llamada, el skill usado y su huella. Lo demuestra la prueba P14.

![Figura 1. Inyección bloqueada antes de llegar al modelo (P06) y aprobación con botones ligados a caso y versión.](../evidencias/cloud/capturas/24_telegram_P06_inyeccion_bloqueada.jpg){width=38%}

## 6. Visualización (VizData)

El panel responde a la pregunta del asesor: qué tan confiable y costoso es el proceso, y en qué punto se detienen los casos. Muestra tres KPI con su fórmula, unidad y denominador visibles. La gráfica principal es de **barras horizontales ordenadas**, con base en cero y etiquetas directas; el color indica cómo terminó cada grupo (azul cuando el caso llegó a propuesta o decisión, gris cuando lo detuvo un control y naranja cuando hubo una falla técnica), con una paleta apta para daltonismo y siempre acompañada de texto. La segunda gráfica muestra el costo por agente, y ambas tienen una alternativa en tabla.

El historial sanitizado incluye filtros y un botón para restablecerlos. El panel tiene estados de carga, error, vacío, sin resultados y datos desactualizados (más de 7 días). Se probó a 390 y 1366 píxeles de ancho, sin desplazamiento horizontal y con foco visible para navegar con teclado.

![Figura 2. Panel publicado en GitHub Pages con la exportación real (1366 píxeles).](../evidencias/cloud/capturas/19_panel_1366_datos_reales.png){width=88%}

## 7. Resultados medidos

### 7.1 Integración local (n8n 2.46.4 con simulador de la API, sin costo)

Se aprobaron 12 de 12 escenarios (pruebas P01 a P11 y S01); el detalle está en evidencias/local/resultado_integracion_local.json. Estas pruebas permitieron detectar y corregir dos defectos reales. El primero: una autorización del paso anterior permitía llamar al modelo cuando el cálculo ya había detenido el caso. El segundo: después de una aclaración, la numeración de las llamadas se reiniciaba y se duplicaban los identificadores.

### 7.2 n8n Cloud con API real (4 y 5 de noviembre de 2026)

La muestra tiene 6 casos (5 por Telegram y 1 por voz), 23 llamadas al modelo y 60 pasos de traza. La fuente es datos/export/export_sanitizado.json, la exportación sanitizada que publica GitHub Actions.

El caso VAL-261105-YQZY, creado por Telegram, fue devuelto por el Agente 4 en su primera versión y aprobado en la segunda; tuvo dos iteraciones y costó 0.005321 USD. El caso VAL-261105-AQJJ fue rechazado por el asesor, con una iteración y 0.002582 USD. El caso VAL-261105-F66J expiró porque se presionó Aprobar después del plazo de 30 minutos; costó 0.003602 USD. El caso VAL-261105-4DM3 se creó por voz con ElevenLabs, el asesor lo aprobó y después se consultó por voz desde GitHub Pages; costó 0.002853 USD.

Hubo además dos fallas controladas. En el caso VAL-261104-ZCGU el Agente 2 no devolvió texto porque se agotó su límite de tokens, y el caso terminó en estado de error de la API con un costo de 0.000717 USD. En el caso VAL-261105-MPWJ el Agente 2 omitió la clase de liquidez, y el caso terminó en error de validación con un costo de 0.002854 USD.

Los KPI medidos fueron los siguientes. La aprobación en primera revisión fue de **75%**: 3 de los 4 casos que llegaron al Agente 4 pasaron a la primera. Está por debajo de la meta de referencia de 80%, y con solo cuatro casos la cifra todavía es inestable. El ciclo hasta la decisión humana tuvo una mediana de **0.5 minutos** en 3 decisiones; el caso expirado no cuenta porque no hubo decisión. El costo variable por caso completado fue de **0.00359 USD**, alrededor de 0.063 pesos, en 4 casos; los casos fallidos se reportan aparte y sumaron 0.003571 USD.

En el entorno real también se probaron: el bloqueo de una inyección antes del modelo (P06); un segundo clic sobre un caso ya aprobado, que no tuvo efecto (P10); una publicación bloqueada por una regla incorrecta y luego recuperada (P12, ejecuciones 42107492452 y 42107774901), y la alternativa de texto cuando se niega el micrófono (P13). Los dos casos fallidos llevaron a dos correcciones: los mensajes de Telegram se enviaron en formato HTML y se aumentó el límite de tokens (caso ZCGU), y el código completa la liquidez con un supuesto explícito (caso MPWJ, skill 1.1.1). El detalle está en evidencias/cloud/resultados_cloud.json y en tests/pruebas.csv.

![Figura 3. Loop de calidad real: el asesor aprueba la versión 2 de YQZY (izquierda); Andrea consulta por voz el caso 4DM3, creado por voz (derecha).](../evidencias/cloud/capturas/22_telegram_P11_YQZY_v2_aprobado.jpg){width=30%} ![](../evidencias/cloud/capturas/04_eleven_consulta_4DM3_aprobado.png){width=62%}

## 8. Costos

El costo de una llamada se calcula así: costo = (tokens de entrada por precio de entrada + tokens de salida por precio de salida) / 1,000,000. Los precios son 0.10 USD por millón de tokens de entrada y 0.50 USD por millón de tokens de salida (Claude Haiku 5.5, para prompts de hasta 100 mil tokens). El costo de un caso es la suma de sus llamadas al modelo, la voz y las herramientas. Los skills y los loops no tienen filas propias, porque se refieren a las llamadas que los ejecutan y así no se cuentan dos veces. Telegram, n8n, GitHub Pages y GitHub Actions se registran como cargos de plataforma, sin tokenización. El desarrollo con IA se registra aparte como inversión, cubierta por una suscripción.

El costo medido fue de **0.017929 USD** en 23 llamadas, y la suma por llamada coincide con la suma por caso. Por agente: el Agente 2 costó 0.007951 USD (44%), el Agente 3 0.004750, el Agente 4 0.003929 y el Agente 1 0.001299. El Agente 2 es el más caro porque recibe el catálogo filtrado y genera la salida más larga: 13,631 tokens de salida en 7 llamadas, incluido el razonamiento interno del modelo. El costo por caso completado fue de 0.00359 USD, con 4.5 llamadas en promedio.

La voz de ElevenLabs se cobra por minuto y se registra aparte en costos/costos_manual.csv. Las 6 conversaciones del 5 de noviembre sumaron **33.3 minutos**, equivalentes a **2.67 USD** a precio de lista (0.08 USD por minuto). Ese importe quedó incluido en el plan, así que el cargo adicional fue de 0 USD. Tres de las seis sesiones duraron entre 8.9 y 10 minutos con solo 5 o 6 mensajes, lo que indica que el widget quedó abierto sin actividad; ese tiempo se cobra igual. La acción propuesta es configurar en ElevenLabs una duración máxima y un corte por inactividad, y medir la mediana de minutos por conversación en la siguiente exportación.

Las proyecciones de costos/proyecciones.md muestran que, a 100, 1,000 y 10,000 casos al mes, los tokens de los agentes son una parte pequeña del total. Lo que más pesa son los **minutos de voz** y el **plan de n8n**, que se cobra por ejecuciones; a 10,000 casos al mes, el plan Pro ya no alcanza. La optimización propuesta es una regla de código que sustituya al Agente 1 cuando la solicitud ya llega estructurada (con perfil, monto y horizonte), comparando el costo y el KPI de aprobación antes y después, sin reducir ningún control.

## 9. Diagnóstico: tres hallazgos priorizados

**Hallazgo 1. El costo variable lo dominan la voz y la plataforma, no los tokens.** En costos/proyecciones.md, con 1,000 casos al mes en el escenario base, los agentes cuestan 3.59 USD, frente a 47.52 USD de voz y 64.80 USD de n8n. El impacto es que optimizar prompts ahorra poco; importan más la elección del plan y la duración de la voz. El riesgo es que la mezcla de canales y los minutos de voz son supuestos, con una muestra de 6 casos. La acción es medir los minutos reales por conversación y las ejecuciones por caso, y decidir el plan con esos datos. El indicador de seguimiento es el costo total por caso en cada escenario, recalculado cada mes.

**Hallazgo 2. El loop corrige la redacción sin intervención humana.** En el caso VAL-261105-YQZY la versión 1 fue devuelta por el Agente 4 y la versión 2 se aprobó, con datos reales y sin demostración forzada; el KPI de aprobación en primera revisión fue de 75% (3 de 4). El impacto es que ninguna propuesta con fallas llegó al asesor. El riesgo es que con 4 revisiones la tasa es inestable, y la causa exacta de la devolución es una inferencia hasta revisar la traza completa. La acción es correr 10 casos más y revisar qué regla o qué observación del modelo provoca más devoluciones. El indicador es que la aprobación en primera revisión llegue al menos a 80% y que ningún caso pendiente de aprobación tenga fallas.

**Hallazgo 3. El Agente 2 concentra el 44% del costo de IA.** En costos/resumen.md, el Agente 2 suma 0.007951 de 0.017929 USD, con 13,631 tokens de salida. El impacto es que es el primer lugar donde optimizar sin tocar los controles. El riesgo es que el razonamiento interno del modelo no se ve, así que su peso exacto es una inferencia. La acción es reducir el contexto que recibe el Agente 2 a los campos necesarios (identificador, riesgo, ESG, extranjero y liquidez) y comparar costo y calidad antes y después. El indicador es el costo por llamada del Agente 2 junto con el KPI de aprobación, y el cambio no se acepta si la calidad baja.

En este diagnóstico se distinguen el dato (los registros), la inferencia (la lectura de esos datos), el supuesto (tarifas y mezcla de canales) y el límite (la muestra es pequeña y simulada). No se afirma causalidad.

## 10. Limitaciones

La muestra real es pequeña: 6 casos, de los cuales 4 se completaron. Por eso los KPI son indicativos, no concluyentes. Las pruebas P05, P07, P09 y S01 tienen evidencia de la integración local con n8n y un simulador de la API, no de la nube; P05 se repitió además en la nube.

Los rendimientos y las volatilidades son ilustrativos. El cálculo de volatilidad supone que no hay correlación entre instrumentos, lo que subestima el riesgo.

La detección de inyección por patrones no cubre todos los casos posibles; como protección adicional, el modelo recibe el texto como dato no confiable.

El vencimiento se revisa solo cuando alguien consulta el caso o presiona el botón, así que un caso vencido aparece como pendiente en los registros hasta ese momento.

La voz pública no comprueba la identidad de la persona; por eso solo maneja datos ficticios y no puede aprobar.

Las tarifas se consultaron en fuentes secundarias que citan las páginas oficiales y deben verificarse el día de la entrega, igual que el tipo de cambio, que debe actualizarse con el FIX vigente.

## 11. Reflexión individual

La solución resuelve una decisión concreta: si el asesor aprueba o rechaza el envío de una versión específica de una propuesta informativa. El sistema no decide por él; le entrega la propuesta ya armada, calculada y revisada, para que pueda decidir en menos de un minuto.

Cada agente tuvo un aporte distinto y verificable. El Agente 1 convirtió el texto libre del asesor en datos estructurados o pidió lo que faltaba; el Agente 2 eligió instrumentos solo del catálogo permitido; el Agente 3 explicó cifras que calculó el código, y el Agente 4 revisó que todo cumpliera las reglas antes de liberar la propuesta. En la traza de cualquier caso se ven cuatro llamadas distintas, cada una con su entrada y su salida.

Varios controles evitaron acciones incorrectas. El más claro fue el vencimiento: cuando se intentó aprobar el caso F66J después del plazo, el sistema no ejecutó nada. También el Agente 4, que devolvió la primera versión del caso YQZY, y la validación de versión y de estado, gracias a la cual un segundo clic sobre un caso ya aprobado no tuvo efecto.

La parte más costosa fue el Agente 2, con el 44% del costo de IA, porque recibe la lista de instrumentos elegibles y produce la salida más larga. Aun así, en dinero, lo que más pesa a escala son los minutos de voz y el plan de n8n.

Si el volumen se multiplicara por diez, el costo por caso de los agentes casi no cambiaría. Lo que cambiaría es el plan de n8n, que se cobra por número de ejecuciones, y el gasto en minutos de voz.

Antes de usar datos reales validaría la autorización y el consentimiento de los clientes, un catálogo y rendimientos reales con fuente oficial, una revisión regulatoria del lenguaje de las propuestas, la autenticación en el canal de voz y pruebas de inyección más amplias.

## 12. Referencias

Se usaron las fuentes oficiales listadas en la guía del proyecto (referencias 1 a 13): Telegram Bot API; n8n Telegram Trigger y Webhook; GitHub Pages y GitHub Actions; ElevenLabs widget, webhook tools, autenticación y precios; W3C WCAG, y precios de n8n. Las tarifas y sus fechas de consulta están en costos/tarifas.csv, y la declaración de uso de IA en docs/declaracion_uso_ia.md.

## 12. Enlaces del proyecto

**Repositorio:** https://github.com/JulioZarate/ai-tools-proyecto-final-Zarate

**Página publicada (panel y Andrea):** https://juliozarate.github.io/ai-tools-proyecto-final-Zarate/

**Bot de Telegram:** @IAtoolFJZbot

**Video de respaldo:** https://youtu.be/CxJklzo7ElI
