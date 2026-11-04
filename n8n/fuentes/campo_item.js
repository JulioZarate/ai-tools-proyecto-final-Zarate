// Nodos auxiliares: devuelven un subcampo del ítem de entrada como ítem (o nada si está vacío).
// El generador reemplaza CAMPO.
const v = $input.first().json['CAMPO'];
return v ? [{ json: v }] : [];
