# Caso en una página · Valoria Casa de Bolsa (ficticia)

**Sector:** intermediación bursátil y asesoría de inversiones (México). **Empresa:** ficticia; ningún dato corresponde a personas o productos reales.

**Usuario:** asesor de inversiones de Valoria (usuario autorizado en Telegram). Usuarios secundarios: analista (crea y consulta, no aprueba) y cliente de demostración por voz (crea y consulta con datos ficticios).

**Problema:** preparar una propuesta informativa de asignación de activos toma tiempo y es propensa a errores de cálculo, a usar productos fuera del catálogo o a lenguaje que suena a promesa de rendimiento. El asesor necesita una propuesta verificable y revisada antes de decidir si la envía.

**Decisión que habilita:** *¿apruebo el envío (simulado) de esta versión de la propuesta al cliente, o la rechazo?*

## Proceso delimitado (inicio → fin)
**Inicio:** llega una solicitud por `/nuevo` (Telegram) o por la herramienta `crear_caso` (voz). **Fin:** el caso queda `aprobado_simulado`, `rechazado`, `expirado`, o cerrado antes con un estado de control (`requiere_aclaracion`, `fuera_de_politica`, `escalado_humano`, `detenido_*`, `error_*`), y el solicitante recibe notificación.

| Elemento | Definición |
|---|---|
| Entradas | Perfil de riesgo, monto (MXN), horizonte (años), objetivo, restricciones; canal y usuario seudónimo |
| Fuentes permitidas | Catálogo ficticio `VALORIA-CAT v1.0.0` (16 instrumentos) y reglas de los skills |
| Reglas de negocio | Mezcla por perfil; tope de riesgo por perfil; prohibidos derivados y cripto; máx. 40% por instrumento; monto 50 mil–5 millones; horizonte 1–30 años; agresivo con horizonte < 3 años usa mezcla moderada; frases obligatorias y prohibidas |
| Salida útil | Propuesta versionada: líneas (ID, %, monto), rendimiento esperado y volatilidad ilustrativos, supuestos, riesgos, resumen para el asesor |
| Acción con aprobación humana | "Envío simulado de propuesta informativa" — botón ligado a `caso_id` + versión + usuario asesor + plazo de 30 min |

## KPI del proceso
| KPI | Fórmula | Unidad | Periodo | Fuente | Tipo |
|---|---|---|---|---|---|
| Aprobación en primera revisión | casos con 1.ª revisión de A4 = aprobado ÷ casos que llegaron a A4 | % | acumulado de pruebas (filtrable) | `valoria_casos.revision_json.historial[0]` | Medido. Meta esperada ≥ 80% (supuesto) |
| Ciclo hasta decisión humana | mediana(decidido_en − creado_en) de aprobados o rechazados | min | acumulado | `valoria_casos` | Medido. Límite operativo 30 min |
| Costo variable por caso completado | Σ costo_usd de completados ÷ n completados (fallidos aparte) | USD/caso | acumulado | `valoria_costos` | Medido (tokens reportados por la API) |

Beneficio *esperado* (no medido): menos tiempo del asesor por propuesta. No se afirma causalidad; solo se mide el tiempo de ciclo del flujo.

## Qué es real, qué es ficticio, qué es simulado
| Real (en vivo) | Ficticio | Simulado |
|---|---|---|
| Telegram, n8n Cloud, API de Anthropic, ElevenLabs, GitHub Pages/Actions (pueden generar cargos) | Empresa, catálogo, rendimientos, clientes, folios | La acción aprobada ("envío al cliente") solo cambia el estado del caso; no se contacta a nadie ni se opera nada |

## Ejemplo de solicitud con entrada y salida definidas
Entrada: `/nuevo perfil moderado, 250 mil pesos a 5 años, objetivo: retiro, solo ESG` → Salida: propuesta v1 con GOB-03 40%, CORP-02 20%, RV-02 17.5%, RV-04 17.5%, LIQ-01 2.5%, LIQ-02 2.5% (suma 100%), rendimiento ilustrativo 9.45%, volatilidad aprox. 4.03%, pendiente de aprobación del asesor.
