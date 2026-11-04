# Valoria · Propuestas informativas de portafolio con orquestador y 4 agentes

Proyecto final individual de **AI Tools** (Dra. Elda C. Morales) · Julio Alejandro Zárate García · Tec de Monterrey.

**Empresa ficticia:** Valoria Casa de Bolsa. **Proceso:** un asesor (o un cliente por voz) pide una propuesta informativa de portafolio → 4 agentes la interpretan, recuperan datos del catálogo autorizado, calculan y revisan → el asesor **aprueba o rechaza en Telegram** el envío **simulado** → el panel público en GitHub Pages muestra indicadores sanitizados. Todo opera en **modo SIMULADO** con datos ficticios.

```
Telegram ─┐                                                        ┌→ aprobación en Telegram (botones caso|versión)
          ├→ n8n: entrada única → guardrails → dedupe → orquestador → A1 → A2 → A3 ⇄ A4 ┤
Voz (Pages + ElevenLabs) ─┘     (Data Tables: casos, eventos, costos, traza)             └→ registro + notificación
n8n export sanitizado → commit → GitHub Actions (pruebas + escaneo) → GitHub Pages (panel + voz)
```

## Dónde corre cada componente

| Componente | Dónde | Archivo |
|---|---|---|
| Bot, orquestador, 4 agentes, guardrails, registro | **n8n Cloud** (workflow "Valoria — Entrada y orquestación") | `n8n/WF1_valoria_principal.json` |
| Tablas privadas (casos, eventos, costos, traza) | **n8n Data Tables** | creadas por `n8n/WF0_crear_tablas.json` |
| Exportación sanitizada | n8n Cloud (webhook GET con clave) | `n8n/WF2_export_sanitizado.json` |
| Modelo | API de Anthropic, `claude-haiku-5-5` | credencial en n8n |
| Voz | ElevenLabs (agente público + herramientas webhook) | `docs/elevenlabs.md` |
| Panel y skills públicos | GitHub Pages | `web/`, `skills/` |
| Validación y despliegue | GitHub Actions | `.github/workflows/validar-y-publicar.yml` |

## Requisitos y versiones verificadas

| Herramienta | Versión probada | Nota |
|---|---|---|
| n8n | 2.46.4 (local) · n8n Cloud vigente | nodos: Code v2, Data table v1, HTTP Request v4.2, Telegram v1.2, Telegram Trigger v1.2, Webhook v2, Switch v3.2, If v2.2 |
| Node.js | 24.x (Actions y pruebas locales) | `node --test` sin dependencias npm |
| Modelo | Claude Haiku 5.5 (`claude-haiku-5-5`) | sin `temperature` ni prefill (la API los rechaza) |
| Navegador | Chromium (Playwright) a 390 y 1366 px | |

## Estructura

```
README.md · .env.example · .github/workflows/        validación y despliegue
agentes/      prompts de los 5 roles, contratos JSON, cálculo y revisión deterministas (fuente única)
n8n/          workflows importables + fuentes/*.js (código de cada nodo) + build_workflows.mjs
skills/       propuesta-portafolio/ y revision-cumplimiento/ (SKILL.md + ejemplos)
loops/        loop de calidad de negocio y loop de seguridad y costo (con evidencia V1→V2)
web/          index.html, assets/, data/panel.json (público)
datos/        catálogo ficticio, diccionario, muestra/, export/ (exportación sanitizada)
costos/       tarifas.csv, costos_manual.csv, costos.csv, resumen.md, proyecciones.md
tests/        unit/ (Actions), n8n_local/ (integración local), pruebas.csv (matriz P01–P14)
evidencias/   INDICE.md (rúbrica → evidencia), local/
docs/         caso, arquitectura, informe, elevenlabs, declaración de uso de IA
scripts/      build_panel, costos, exportar, construir_sitio, falla_deliberada, sanitizar_n8n
```

## Credenciales (por nombre; ningún valor va al repo)

| Nombre en n8n | Tipo | Uso |
|---|---|---|
| `Valoria Telegram Bot` | Telegram API | Token del bot de **proyecto** (crearlo con @BotFather; distinto de tu bot de pendientes) |
| `Anthropic API (x-api-key)` | Header Auth: nombre `x-api-key`, valor = tu API key | Nodos `LLM A1`…`LLM A4` |
| `Valoria clave webhooks (x-valoria-key)` | Header Auth: nombre `x-valoria-key`, valor = cadena aleatoria larga | Webhook de voz y de exportación; el mismo valor va como *secret* en ElevenLabs |

`.env.example` lista las variables que usa `scripts/exportar.sh` en tu computadora.

## Instalación paso a paso (≈ 45 min)

1. **Repositorio.** Crea en GitHub `JulioZarate/ai-tools-proyecto-final-Zarate` (público), sube este contenido y en *Settings → Pages* elige **Source: GitHub Actions**. Haz el primer push para que los SKILL.md queden publicados (el workflow los descarga de Pages). Si usas otro nombre de repo, ponlo en `pages_base_url` del paso 5.
2. **Bot.** En Telegram, @BotFather → `/newbot` → guarda el token. Obtén tu ID numérico (p. ej. con @userinfobot) y, si quieres probar P07, el de una segunda cuenta.
3. **n8n Cloud → credenciales.** Crea las tres credenciales de la tabla anterior con esos nombres exactos.
4. **Tablas.** Importa `n8n/WF0_crear_tablas.json` (*Workflows → Import from file*), pulsa **Execute workflow** una vez. Verifica en *Data tables* que existen `valoria_casos`, `valoria_eventos`, `valoria_costos`, `valoria_traza`.
5. **Tu configuración (sin subirla al repo).** Copia `n8n/config.local.ejemplo.json` a `n8n/config.local.json`, pon tu ID de Telegram como `asesor`, el de tu segunda cuenta como `analista`, tu chat ID en `asesor_chat_id` y la URL de Pages. Ejecuta `node n8n/build_workflows.mjs --local`: genera `n8n/local/WF*.json` con tus valores en **todos** los nodos (ambos están en `.gitignore`).
   **Workflow principal.** Importa `n8n/local/WF1_valoria_principal.json`. En cada nodo con aviso de credencial, selecciónala (Telegram Trigger, Webhook voz, LLM A1–A4, Enviar mensaje/aprobación/notificación, Responder botón).
6. **Exportación.** Importa `n8n/local/WF2_export_sanitizado.json` y asigna la credencial de webhook.
7. **Activar.** Activa (Publish) WF1 y WF2. Copia la **URL de producción** del Webhook voz y del Webhook exportación. Verifica que sean `https://`.
8. **ElevenLabs.** Sigue `docs/elevenlabs.md` (herramientas, encabezado secreto, dominio permitido). Pon el agent ID público en `web/index.html`.
9. **Publicar.** `git push` a `main` → Actions ejecuta pruebas, construye el panel y despliega. URL: `https://juliozarate.github.io/ai-tools-proyecto-final-Zarate/`.

## Caso de prueba y resultado esperado

En Telegram (como asesor):
```
/nuevo perfil moderado, 250 mil pesos a 5 años, objetivo: retiro, solo ESG
```
Esperado en < 30 s: acuse con folio `VAL-AAMMDD-XXXX` → mensaje "🟡 Aprobación requerida" con 6 líneas (GOB-03, CORP-02, RV-02, RV-04, LIQ-01, LIQ-02 o similares según A2), suma 100%, botones **Aprobar / Rechazar**. Al aprobar: "✅ … APROBADO … Resultado simulado". `/estado FOLIO` → "aprobado (envío simulado)". En *Data tables*: 1 fila en casos, ≥ 4 filas en costos (A1–A4) y ~10 en traza con el mismo `caso_id`.

Otros comandos: `/ayuda`, `/estado FOLIO`, `/aclarar FOLIO <dato>`. Parámetros de prueba dentro de `/nuevo`: `demo=falla_v1` (fuerza el loop V1→V2, declarado en la traza) y `presupuesto=0.0002` (fuerza el corte por presupuesto).

## Validación

```bash
node --test tests/unit/*.test.mjs        # 15 pruebas: reglas, skills, KPIs, costos, sincronía n8n, secretos
node n8n/build_workflows.mjs --check     # los JSON coinciden con n8n/fuentes y agentes/
node scripts/construir_sitio.mjs         # empaqueta _site y escanea secretos
# Integración local opcional (n8n real + simulador de Anthropic, sin costo):
N8N_BIN=/ruta/a/n8n bash tests/n8n_local/correr.sh   # 12 escenarios P01–P11 + S01
```

## Actualizar el panel con datos reales

```bash
export VALORIA_EXPORT_URL="https://<instancia>.app.n8n.cloud/webhook/valoria-export"
export VALORIA_KEY="<valor de x-valoria-key>"
bash scripts/exportar.sh && git add datos/export web/data costos && git commit -m "Datos sanitizados" && git push
```
Mecanismo: exportación manual reproducible + commit + Actions. Frecuencia: tras cada sesión de pruebas y antes de entregar. Retraso esperado: el de la última ejecución del script (el panel muestra la fecha y avisa si tiene más de 7 días).

## Parada

Desactiva (Unpublish) WF1 y WF2 en n8n; en ElevenLabs desactiva el agente o elimina el dominio permitido. El sitio de Pages queda estático. Para mantenerlo disponible durante la evaluación: deja WF1 y WF2 activos (n8n Cloud no requiere tu computadora encendida).

## Solución de problemas

| Síntoma | Revisión |
|---|---|
| El bot no responde | ¿WF1 activo? ¿Solo un Telegram Trigger para ese bot (sin otro workflow escuchándolo)? ¿Tu ID está en CONFIG? Un usuario no listado recibe "uso restringido". |
| Funciona solo al probar | Estabas usando la URL de *test*; activa el workflow y usa la de producción. |
| `error_skill` | Pages no está publicado o cambió la URL de los SKILL.md. Abre `…/skills/propuesta-portafolio/SKILL.md` en el navegador. |
| `error_api` | Credencial de Anthropic, saldo o modelo. La ejecución del nodo `LLM Ax` muestra el error (sin la clave). |
| El widget no aparece | agent ID, dominio permitido en ElevenLabs, permiso de micrófono, consola del navegador. |
| La voz dice un estado inventado | Revisa que el prompt obligue a usar `consultar_caso` y que la herramienta apunte a la URL de producción. |
| Actions falla | Lee el paso que falló: (1) reglas/pruebas, (2) JSON de n8n desactualizado → `node n8n/build_workflows.mjs`, (3) export con campos personales, (4) secreto detectado. |

## Limitaciones y uso de IA

Ver `docs/informe.md` §Limitaciones y `docs/declaracion_uso_ia.md`. La evidencia actual de `evidencias/local/` proviene de **n8n local con un simulador de la API** (sin costo, tokens simulados); debe repetirse en n8n Cloud con la API real antes de entregar (`evidencias/INDICE.md` marca qué falta).
