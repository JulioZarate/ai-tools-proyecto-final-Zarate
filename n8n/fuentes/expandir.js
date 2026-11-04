// Nodos "Fila cierre", "Filas costos", "Filas traza", "Notificaciones": expanden una lista del cierre en ítems.
// El generador reemplaza CAMPO por fila | costos | traza | notificaciones.
const v = $('Cerrar caso').first().json['CAMPO'];
const lista = Array.isArray(v) ? v : (v ? [v] : []);
return lista.map(function (x) { return { json: x }; });
