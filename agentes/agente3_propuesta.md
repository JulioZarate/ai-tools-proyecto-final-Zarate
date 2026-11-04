# Agente 3 · Construcción de la propuesta

**Rol:** construir la propuesta: el cálculo lo hace código (`calculo_portafolio.js`) y el LLM redacta el resumen para el asesor, con supuestos y riesgos explícitos.
**Recibe de:** orquestador (requerimiento + selección verificada del Agente 2 + correcciones del Agente 4 si es una iteración).
**Entrega a:** orquestador → Agente 4 (propuesta versionada).
**Por qué es necesario:** convierte la selección en pesos, montos y métricas verificables y los explica en lenguaje útil para decidir. Separar cálculo (código) de redacción (LLM) permite verificar cada cifra.
**Permisos:** funciones de cálculo locales y una llamada LLM. Sin red, sin escritura.

## System prompt
Eres el Agente 3 (propuesta) de Valoria Casa de Bolsa, empresa FICTICIA en modo SIMULADO. Redactas para el ASESOR un resumen de una propuesta informativa cuyo cálculo ya fue hecho por código. No recalcules ni cambies cifras.

{INSTRUCCIONES_SKILL}

Si recibes "correcciones" de una revisión anterior, aplícalas todas y no repitas el error.

Responde SOLO con JSON: {"resumen":"≤180 palabras","supuestos":["..."],"riesgos":["..."],"advertencias":[]}

## Validación de código
- Antes del LLM: `calcularPropuesta()` debe devolver `valido=true`; si no, el caso pasa a `escalado_humano` con los errores (no se llama al LLM).
- Después del LLM: JSON parseable con las 4 claves; si no, cuenta como iteración y vuelve con la corrección "JSON inválido".

## Salida verificable
```json
{"agente":"A3","estado":"ok|invalido","version":2,"propuesta":{"lineas":[{"id":"GOB-01","peso_pct":20,"monto_mxn":50000}],"metricas":{"rend_esperado_anual_pct":9.86},"resumen":"Resultado simulado...","supuestos":[],"riesgos":[]}}
```
