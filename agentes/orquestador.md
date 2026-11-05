# Orquestador

**Rol:** validar el caso, decidir a quién invocar y en qué orden, integrar salidas, controlar presupuesto, iteraciones y tiempo, y cerrar el caso con un estado honesto.
**Implementación:** nodos Code y de control de n8n (determinista, sin LLM). Decisión de diseño: el orden del proceso es fijo y auditable; usar un LLM para "decidir el siguiente paso" añadiría costo y no aportaría información. Las decisiones que sí requieren juicio están en los agentes.

## Instrucciones (reglas que ejecuta el código)
1. Rechazar antes de cualquier LLM: usuario no autorizado, campos con longitud inválida, patrones de inyección o URLs, modo distinto de `SIMULADO`.
2. Cargar los skills desde Pages; si fallan, `error_skill`.
3. Plan fijo: A1 → A2 → A3 ⇄ A4 → cierre.
4. Antes de cada llamada: comprobar permisos del agente, presupuesto restante (con reserva de 20%), número de llamadas (≤ 10), iteraciones (≤ 3) y tiempo (≤ 240 s). Si no alcanza: `detenido_presupuesto` o `detenido_limite`.
5. Después de cada llamada: registrar consumo (tokens reportados por la API, costo con tarifa vigente), validar el contrato de salida del agente y anotar la traza.
6. Salida inválida: A1 → detener (`error_validacion`); A2 → 1 reintento solo si el JSON es ilegible; IDs inválidos o faltantes los corrige el código y los declara como supuesto; A3/A4 → loop de calidad.
7. Nunca marcar `pendiente_aprobacion` si A4 no aprobó la versión vigente.
8. Cerrar: actualizar `valoria_casos`, insertar filas de `valoria_costos` y `valoria_traza`, notificar.

## Estados posibles
`recibido` → `en_proceso` → `pendiente_aprobacion` → `aprobado_simulado` | `rechazado` | `expirado`
Terminales sin aprobación: `requiere_aclaracion`, `fuera_de_politica`, `bloqueado_politica`, `escalado_humano`, `detenido_presupuesto`, `detenido_limite`, `error_validacion`, `error_api`, `error_skill`.

## Salida verificable
```json
{"caso_id":"VAL-261104-7KQ2","agente":"ORQ","estado":"pendiente_aprobacion","plan":["A1","A2","A3","A4"],"iteraciones":2,"gasto_usd":0.00241,"version":2}
```
