const NIVEL = { cola: 0, entregada: 1, cobrada: 2, cancelada: 2 };

export function crearPlato(id) { return { id, lineas: [], sin: [] }; }
export function agregarLineaAPlato(plato, producto) {
  const existe = plato.lineas.find((linea) => linea.productoId === producto.productoId);
  const lineas = existe ? plato.lineas.map((linea) => linea.productoId === producto.productoId ? { ...linea, cantidad: linea.cantidad + 1 } : linea) : [...plato.lineas, { ...producto, cantidad: 1 }];
  return { ...plato, lineas };
}
export function alternarSin(plato, modificador) { return { ...plato, sin: plato.sin.includes(modificador) ? plato.sin.filter((x) => x !== modificador) : [...plato.sin, modificador] }; }
export function separarTodo(platos) { return platos.flatMap((plato) => plato.lineas.flatMap((linea) => Array.from({ length: linea.cantidad }, (_, i) => ({ id: `${plato.id}-${i}`, lineas: [{ ...linea, cantidad: 1 }], sin: [...plato.sin] })))); }
export function resumenComal(platos) {
  const total = new Map();
  platos.flatMap((plato) => plato.lineas).forEach((linea) => { const previo = total.get(linea.productoId) || { productoId: linea.productoId, nombre: linea.nombre, cantidad: 0 }; previo.cantidad += linea.cantidad; total.set(linea.productoId, previo); });
  return [...total.values()];
}

export function crearOrden({ id, platos, ahoraMs = Date.now(), dispositivo = '' }) {
  return { id, platos, estado: 'cola', creada: ahoraMs, modificado: ahoraMs, dispositivo, entregada: null, cobrada: null };
}

export function avanzarOrden(orden, estado, ahoraMs = Date.now()) {
  if (!(estado in NIVEL) || NIVEL[estado] < NIVEL[orden.estado]) return orden;
  if (orden.estado === 'cobrada' || orden.estado === 'cancelada') return orden;
  return { ...orden, estado, modificado: ahoraMs, entregada: estado === 'entregada' ? ahoraMs : orden.entregada, cobrada: estado === 'cobrada' ? ahoraMs : orden.cobrada };
}

export function esCobrable(orden) { return orden.estado === 'entregada'; }
