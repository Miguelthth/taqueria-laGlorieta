export function resumenCaja({ tickets = [], compras = [], gastos = [] }) {
  const sumar = (lista) => lista.reduce((total, item) => total + Number(item.totalCentavos || 0), 0);
  const ventasCentavos = sumar(tickets.filter((ticket) => !ticket.cancelado && !ticket.practica));
  const comprasCentavos = sumar(compras);
  const gastosCentavos = sumar(gastos);
  return { ventasCentavos, comprasCentavos, gastosCentavos, utilidadCentavos: ventasCentavos - comprasCentavos - gastosCentavos };
}

export function ventasPorProducto(tickets = []) {
  const porId = new Map();
  tickets.filter((ticket) => !ticket.cancelado && !ticket.practica).flatMap((ticket) => ticket.lineas || []).forEach((linea) => {
    const id = linea.productoId || linea.id || linea.nombre;
    const previo = porId.get(id) || { id, nombre: linea.nombre, cantidad: 0, totalCentavos: 0 };
    previo.cantidad += Number(linea.cantidad || 0);
    previo.totalCentavos += Number(linea.cantidad || 0) * Number(linea.precioCentavos || 0);
    porId.set(id, previo);
  });
  return [...porId.values()].sort((a, b) => b.totalCentavos - a.totalCentavos);
}
