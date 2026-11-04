// Nodo: "Decidir ruta" — deduplicación persistente por evento_id.
const ctx = Object.assign({}, $('Normalizar y validar entrada').first().json);
const filas = $input.all().map(function (i) { return i.json; }).filter(function (r) { return r && r.evento_id === ctx.evento_id; });
if (ctx.ruta === 'ignorar') return [];
if (filas.length > 0) {
  ctx.duplicado = true;
  ctx.ruta_original = ctx.ruta;
  ctx.caso_previo = filas[0].caso_id || '';
  ctx.ruta = 'duplicado';
} else {
  ctx.duplicado = false;
}
return [{ json: ctx }];
