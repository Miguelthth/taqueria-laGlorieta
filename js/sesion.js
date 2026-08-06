const CLAVE_CARRITO = 'taq_carrito_en_curso';
const CLAVE_PRACTICA = 'taq_modo_practica';
const INACTIVIDAD_PRACTICA_MS = 30 * 60 * 1000;
const INACTIVIDAD_CARRITO_MS = 5 * 60 * 1000;

export function restaurarCarrito(estado) {
  if (!estado || !Array.isArray(estado.lineas)) return [];
  return estado.lineas.filter((l) => l && l.productoId && l.nombre && Number.isInteger(l.precioUnitarioCentavos) && Number.isInteger(l.cantidad) && l.cantidad > 0);
}

export function guardarCarritoEnCurso(lineas) {
  localStorage.setItem(CLAVE_CARRITO, JSON.stringify({ lineas, tocadoMs: Date.now() }));
}

export function cargarCarritoEnCurso() {
  try { return restaurarCarrito(JSON.parse(localStorage.getItem(CLAVE_CARRITO))); } catch { return []; }
}

export function borrarCarritoEnCurso() { localStorage.removeItem(CLAVE_CARRITO); }

export function modoPracticaActivo(estado, ahoraMs = Date.now()) {
  return Boolean(estado && estado.fecha === new Date(ahoraMs).toISOString().slice(0, 10) && ahoraMs - estado.tocadoMs < INACTIVIDAD_PRACTICA_MS);
}

export function carritoOlvidado(lineas, ultimoCambioMs, ahoraMs = Date.now()) {
  return Array.isArray(lineas) && lineas.length > 0 && ahoraMs - ultimoCambioMs >= INACTIVIDAD_CARRITO_MS;
}

export function cargarModoPractica() {
  try {
    const estado = JSON.parse(localStorage.getItem(CLAVE_PRACTICA));
    return modoPracticaActivo(estado);
  } catch { return false; }
}

export function guardarModoPractica(activo) {
  if (!activo) { localStorage.removeItem(CLAVE_PRACTICA); return; }
  localStorage.setItem(CLAVE_PRACTICA, JSON.stringify({ fecha: new Date().toISOString().slice(0, 10), tocadoMs: Date.now() }));
}

export function corregirTicket(ticket, { totalCentavos, lineas, motivo, autor, ahoraMs = Date.now() }) {
  const correcciones = ticket.correcciones || [];
  return { ...ticket, totalCentavos, lineas, modificado: ahoraMs, correcciones: [...correcciones, { totalAnteriorCentavos: ticket.totalCentavos, motivo, autor, ts: ahoraMs }] };
}

export function cancelarTicket(ticket, { motivo, autor, ahoraMs = Date.now() }) {
  return { ...ticket, cancelado: true, modificado: ahoraMs, cancelacion: { motivo, autor, ts: ahoraMs } };
}
