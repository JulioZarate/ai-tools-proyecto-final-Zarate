# Declaración de uso de IA y licencias

## Herramientas de IA usadas en el desarrollo
| Herramienta | Uso | Revisión del autor |
|---|---|---|
| Claude (claude.ai) | Diseño de la arquitectura, código de los nodos de n8n y del generador, skills, loops, panel HTML, pruebas, scripts y borradores de documentación | El autor debe leer, ejecutar y poder modificar cada parte; ver lista de verificación abajo |
| Claude Haiku 5.5 (API) | Modelo de los 4 agentes en operación | Salidas validadas por código (contratos, R1–R10) |
| ElevenLabs | Agente de voz "Andrea" | Configuración propia |

El costo del desarrollo con IA se registra aparte de la operación en `costos/costos_manual.csv` (`etapa=diseno_construccion`).

## Lista de verificación de comprensión (completar antes de la defensa)
- [ ] Sé explicar por qué el orquestador es código y no un LLM.
- [ ] Sé dónde cambiar una regla (bloque `json reglas` del SKILL.md) y qué prueba la vigila.
- [ ] Sé regenerar los workflows (`node n8n/build_workflows.mjs`) y por qué la prueba de sincronía existe.
- [ ] Puedo modificar en vivo: el tope de concentración, el plazo de aprobación o agregar una palabra prohibida, y mostrar el efecto.
- [ ] Sé leer la traza de un caso y conciliar sus `llamada_id` con `costos.csv`.

## Licencias y recursos
- Paleta de colores: basada en Okabe–Ito (uso libre) a través del sistema Vizdata del curso.
- Widget de ElevenLabs: script oficial `@elevenlabs/convai-widget-embed`, cargado solo tras consentimiento.
- n8n: Sustainable Use License (uso en n8n Cloud). Sin dependencias npm en el repositorio.
- Todo el catálogo, los rendimientos y los casos son ficticios y creados para este proyecto.
