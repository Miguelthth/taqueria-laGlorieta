const NIVEL = { cola: 0, entregada: 1, cobrada: 2, cancelada: 2 };

export function crearOrden({ id, platos, ahoraMs = Date.now(), dispositivo = '' }) {
  return { id, platos, estado: 'cola', creada: ahoraMs, modificado: ahoraMs, dispositivo, entregada: null, cobrada: null };
}

export function avanzarOrden(orden, estado, ahoraMs = Date.now()) {
  if (!(estado in NIVEL) || NIVEL[estado] < NIVEL[orden.estado]) return orden;
  if (orden.estado === 'cobrada' || orden.estado === 'cancelada') return orden;
  return { ...orden, estado, modificado: ahoraMs, entregada: estado === 'entregada' ? ahoraMs : orden.entregada, cobrada: estado === 'cobrada' ? ahoraMs : orden.cobrada };
}

export function esCobrable(orden) { return orden.estado === 'entregada'; }
