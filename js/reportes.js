export function resumenCaja({ tickets = [], compras = [], gastos = [] }) {
  const sumar = (lista) => lista.reduce((total, item) => total + Number(item.totalCentavos || 0), 0);
  const ventasCentavos = sumar(tickets.filter((ticket) => !ticket.cancelado && !ticket.practica));
  const comprasCentavos = sumar(compras);
  const gastosCentavos = sumar(gastos);
  const utilidadCentavos = ventasCentavos - comprasCentavos - gastosCentavos;
  const margenPorcentaje = ventasCentavos ? Math.round((utilidadCentavos / ventasCentavos) * 1000) / 10 : 0;
  return { ventasCentavos, comprasCentavos, gastosCentavos, utilidadCentavos, margenPorcentaje };
}

// Compras y gastos por categoría -- para ver en qué se va el dinero, no solo
// cuánto en total. Misma forma para las dos porque son la misma cuenta.
export function porCategoria(movimientos = []) {
  const porCat = new Map();
  movimientos.forEach((m) => {
    const categoria = m.categoria || 'Otro';
    const previo = porCat.get(categoria) || { categoria, totalCentavos: 0 };
    previo.totalCentavos += Number(m.totalCentavos || 0);
    porCat.set(categoria, previo);
  });
  return [...porCat.values()].sort((a, b) => b.totalCentavos - a.totalCentavos);
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

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// ¿El martes deja o solo cansa? Los 7 días siempre en el mismo orden, aunque
// no haya ventas ese día -- así se puede comparar a simple vista.
export function ventasPorDiaSemana(tickets = []) {
  const porDia = new Map();
  vigentes(tickets).forEach((t) => {
    const dia = new Date(`${t.fecha}T00:00:00`).getDay();
    const previo = porDia.get(dia) || { dia, etiqueta: DIAS_SEMANA[dia], cantidadTickets: 0, totalCentavos: 0 };
    previo.cantidadTickets += 1;
    previo.totalCentavos += Number(t.totalCentavos || 0);
    porDia.set(dia, previo);
  });
  return [0, 1, 2, 3, 4, 5, 6].map((dia) => porDia.get(dia) || { dia, etiqueta: DIAS_SEMANA[dia], cantidadTickets: 0, totalCentavos: 0 });
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

// Histórico por mes (YYYY-MM) -- la tendencia de largo plazo, no solo el
// periodo que se esté viendo en el momento.
export function ventasPorMes(tickets = []) {
  const porMes = new Map();
  vigentes(tickets).forEach((t) => {
    const mes = (t.fecha || '').slice(0, 7);
    const previo = porMes.get(mes) || { mes, cantidadTickets: 0, totalCentavos: 0 };
    previo.cantidadTickets += 1;
    previo.totalCentavos += Number(t.totalCentavos || 0);
    porMes.set(mes, previo);
  });
  return [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

// Igual que arriba pero junta ventas+compras+gastos+utilidad por mes, para
// la comparación mensual histórica (no solo ventas).
export function resumenPorMes(tickets = [], compras = [], gastos = []) {
  const porMes = new Map();
  const acumular = (mes, campo, valor) => {
    const previo = porMes.get(mes) || { mes, ventasCentavos: 0, comprasCentavos: 0, gastosCentavos: 0, cantidadTickets: 0 };
    previo[campo] += valor;
    porMes.set(mes, previo);
  };
  vigentes(tickets).forEach((t) => {
    const mes = (t.fecha || '').slice(0, 7);
    acumular(mes, 'ventasCentavos', Number(t.totalCentavos || 0));
    acumular(mes, 'cantidadTickets', 1);
  });
  compras.forEach((c) => acumular((c.fecha || '').slice(0, 7), 'comprasCentavos', Number(c.totalCentavos || 0)));
  gastos.forEach((g) => acumular((g.fecha || '').slice(0, 7), 'gastosCentavos', Number(g.totalCentavos || 0)));
  return [...porMes.values()]
    .map((m) => ({ ...m, utilidadCentavos: m.ventasCentavos - m.comprasCentavos - m.gastosCentavos }))
    .sort((a, b) => a.mes.localeCompare(b.mes));
}

// Punto de equilibrio diario: el promedio de tus compras+gastos de los
// últimos N días, repartido por día -- "necesitas vender al menos $X hoy
// para no perder" (PLAN.md Fase 6). No es una ciencia exacta (los gastos no
// son idénticos cada día), es una vara para medirte contra, no una promesa.
export function puntoEquilibrio(compras = [], gastos = [], dias = 30) {
  const sumar = (lista) => lista.reduce((total, item) => total + Number(item.totalCentavos || 0), 0);
  const totalCentavos = sumar(compras) + sumar(gastos);
  return { diarioCentavos: dias ? Math.round(totalCentavos / dias) : 0, dias };
}

// Cuánto cambió contra el periodo anterior de igual tamaño -- "¿voy mejor o
// peor?", no solo el número solo.
export function variacionPorcentaje(actual, anterior) {
  if (!anterior) return actual > 0 ? 100 : 0;
  return Math.round(((actual - anterior) / anterior) * 1000) / 10;
}
