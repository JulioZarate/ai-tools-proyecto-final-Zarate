// Nodo: "Traza rechazo" — deja evidencia del guardrail que bloqueó la entrada.
const t = $input.first().json.traza;
return t ? [{ json: t }] : [];
