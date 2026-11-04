// Nodo: "Fila expiración" — si el plazo venció, persiste el estado expirado (vencimiento perezoso).
const e = $input.first().json.expirar;
return e ? [{ json: e }] : [];
