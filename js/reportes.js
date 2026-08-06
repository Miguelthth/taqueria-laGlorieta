export function resumenCaja({ tickets = [], compras = [], gastos = [] }) {
  const sumar = (lista) => lista.reduce((total, item) => total + Number(item.totalCentavos || 0), 0);
  const ventasCentavos = sumar(tickets.filter((ticket) => !ticket.cancelado && !ticket.practica));
  const comprasCentavos = sumar(compras);
  const gastosCentavos = sumar(gastos);
  return { ventasCentavos, comprasCentavos, gastosCentavos, utilidadCentavos: ventasCentavos - comprasCentavos - gastosCentavos };
}

// Las líneas de un ticket real guardan el precio como `precioUnitarioCentavos`
// (ticket.js::agregarProducto) -- `precioCentavos` es solo un alias por si
// llega de otra fuente (ej. un import viejo). Sin el primero, esto siempre
// sumaba $0 de dinero por producto aunque las piezas contaran bien.
function precioLinea(linea) { return Number(linea.precioUnitarioCentavos ?? linea.precioCentavos ?? 0); }

export function ventasPorProducto(tickets = []) {
  const porId = new Map();
  tickets.filter((ticket) => !ticket.cancelado && !ticket.practica).flatMap((ticket) => ticket.lineas || []).forEach((linea) => {
    const id = linea.productoId || linea.id || linea.nombre;
    const previo = porId.get(id) || { id, nombre: linea.nombre, cantidad: 0, totalCentavos: 0 };
    previo.cantidad += Number(linea.cantidad || 0);
    previo.totalCentavos += Number(linea.cantidad || 0) * precioLinea(linea);
    porId.set(id, previo);
  });
  return [...porId.values()].sort((a, b) => b.totalCentavos - a.totalCentavos);
}

function vigentes(tickets) { return tickets.filter((t) => !t.cancelado && !t.practica); }

// "Hora pico" -- de qué hora a qué hora se vende más. Miguel lo señaló como la
// gráfica que más iba a usar (PLAN.md §7.5): dice cuánta carne poner y a qué
// hora abrir.
export function ventasPorHora(tickets = []) {
  const porHora = new Map();
  vigentes(tickets).forEach((t) => {
    const hora = Number((t.hora || '00:00').slice(0, 2));
    const previo = porHora.get(hora) || { hora, cantidadTickets: 0, totalCentavos: 0 };
    previo.cantidadTickets += 1;
    previo.totalCentavos += Number(t.totalCentavos || 0);
    porHora.set(hora, previo);
  });
  return [...porHora.values()].sort((a, b) => a.hora - b.hora);
}

// Ventas por día (últimos N días con datos) -- para ver si sube, baja, o un
// día particular se cae.
export function ventasPorDia(tickets = []) {
  const porFecha = new Map();
  vigentes(tickets).forEach((t) => {
    const previo = porFecha.get(t.fecha) || { fecha: t.fecha, cantidadTickets: 0, totalCentavos: 0 };
    previo.cantidadTickets += 1;
    previo.totalCentavos += Number(t.totalCentavos || 0);
    porFecha.set(t.fecha, previo);
  });
  return [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// Ticket promedio y número de clientes: si un día vendió menos, ¿vinieron
// menos personas o gastaron menos cada una? Son dos problemas distintos.
export function ticketPromedio(tickets = []) {
  const lista = vigentes(tickets);
  const totalCentavos = lista.reduce((acc, t) => acc + Number(t.totalCentavos || 0), 0);
  return { cantidadTickets: lista.length, promedioCentavos: lista.length ? Math.round(totalCentavos / lista.length) : 0 };
}

// Cuánto cobró cada quien -- sale gratis porque cada ticket ya guarda quién
// lo capturó (operador). Sirve para el turno pesado y para rastrear un error.
export function cobradoPorUsuario(tickets = []) {
  const porUsuario = new Map();
  vigentes(tickets).forEach((t) => {
    const nombre = t.operador || t.cobradoPor || 'Sin nombre';
    const previo = porUsuario.get(nombre) || { nombre, cantidadTickets: 0, totalCentavos: 0 };
    previo.cantidadTickets += 1;
    previo.totalCentavos += Number(t.totalCentavos || 0);
    porUsuario.set(nombre, previo);
  });
  return [...porUsuario.values()].sort((a, b) => b.totalCentavos - a.totalCentavos);
}
