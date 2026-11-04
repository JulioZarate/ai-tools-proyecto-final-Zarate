// Nodo: "Fila evento" — registra el evento (solo si no es duplicado). Columnas = tabla valoria_eventos.
const ctx = $input.first().json;
if (ctx.duplicado) return [];
return [{ json: {
  evento_id: ctx.evento_id,
  caso_id: ctx.caso_id || '',
  canal: ctx.canal,
  tipo: ctx.tipo,
  ruta: ctx.ruta,
  usuario_ps: ctx.usuario_ps || '',
  recibido_en: ctx.recibido_en
} }];
