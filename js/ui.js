// Punto de entrada: pinta pantallas y cablea eventos. Nada se exporta (igual
// que peso/js/ui.js en MIS APPS) -- build.py lo mete tal cual, al final del
// paquete.

import {
  obtenerCatalogo, guardarCatalogo, productosVisibles, productosOcultos,
  cupoLibreEnCuadricula, tienePreciosPendientes, productosPendientes,
  confirmarPrecio, agregarProductoCatalogo, editarProducto, desactivarProducto,
  reordenarCuadricula, moverACuadricula, moverAOcultos,
} from './catalogo.js';
import {
  crearCarrito, agregarProducto, agregarLibre, quitarUno,
  establecerCantidad, quitarLinea, cantidadDe, totalCentavos, estaVacio, resumenTexto,
} from './ticket.js';
import { aCentavos, aPesos, formatoMoneda } from './dinero.js';
import { calcularCambio } from './cambio.js';
import { hoyISO, horaISO, crearId } from './modelo.js';
import { guardarTicket, borrarTicket, listarTicketsPorFecha, listarTodos, guardarOrden, listarOrdenesActivas, guardarCompra, guardarGasto, listarCompras, listarGastos } from './almacen.js';
import { ahora, registrarDuracion, estadisticas, reiniciarMedicion } from './cronometro.js';
import { cargarCarritoEnCurso, guardarCarritoEnCurso, borrarCarritoEnCurso, cargarModoPractica, guardarModoPractica, carritoOlvidado, corregirTicket, cancelarTicket } from './sesion.js';
import { crearSesion, sesionVigente } from './acceso.js';
import { urlApi, guardarUrlApi, dispositivo, guardarDispositivo, llamarApi, guardarSesion, cerrarSesion } from './api.js';
import { leerCola, encolar, confirmar } from './cola.js';
import { VERSION_DEPLOY } from './version.js';
import { crearOrden, avanzarOrden, esCobrable, crearPlato, separarTodo, resumenComal, alternarSin } from './ordenes.js';
import { crearCompra, crearGasto, categoriasCompra, categoriasGasto, esCategoriaDeFabrica, agregarCategoria, quitarCategoria, renombrarCategoria } from './gastos.js';
import { resumenCaja, ventasPorProducto, ventasPorHora, ventasPorDia, ventasPorDiaSemana, ticketPromedio, cobradoPorUsuario, porCategoria, resumenPorMes, puntoEquilibrio, variacionPorcentaje } from './reportes.js';

// ---------- estado en memoria ----------
let catalogoActual = obtenerCatalogo();
let carrito = cargarCarritoEnCurso();
let inicioTicketMs = null;
let ultimoGuardado = null;
let temporizadorDeshacer = null;
let productoCantidadActual = null;
let modoPractica = cargarModoPractica();
let productoEditando = null;
let ticketEditando = null;
let lineasTicketEditando = [];
let ultimoCambioCarritoMs = Date.now();
let sincronizando = false;
let ultimoErrorSync = '';
let cobroConfirmado = false;
let ordenCobrando = null;
let sesionDueno = null;
// Compositor de órdenes (+ Orden, arriba): { platos: [Plato...], platoActivo: Plato, para }.
// Independiente del carrito de venta directa -- nunca lo toca ni lo mezcla.
let ordenEnProgreso = null;

// ---------- helpers ----------
function $(id) { return document.getElementById(id); }
function mostrar(el) { el.classList.remove('oculto'); }
function ocultar(el) { el.classList.add('oculto'); }
function vibrar(patron) {
  if (navigator.vibrate) { try { navigator.vibrate(patron); } catch { /* iOS no lo soporta -- se ignora */ } }
}
function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
function marcarInicioSiHaceFalta() {
  if (estaVacio(carrito)) inicioTicketMs = ahora();
}

// Mientras se compone una orden (+ Orden), los toques de la cuadrícula van al
// plato activo, no al carrito de venta directa -- los dos caminos conviven
// sin pisarse (PLAN.md sección 4).
function componiendoOrden() { return ordenEnProgreso !== null; }
function obtenerLineasActivas() { return componiendoOrden() ? ordenEnProgreso.platoActivo.lineas : carrito; }
function fijarLineasActivas(lineas) {
  if (componiendoOrden()) ordenEnProgreso.platoActivo.lineas = lineas; else carrito = lineas;
}

// ---------- pantalla siempre encendida ----------
let wakeLock = null;
async function pedirWakeLock() {
  if (!('wakeLock' in navigator)) return; // Safari < 16.4 no lo soporta -- se degrada en silencio
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch { /* ignorar */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') pedirWakeLock();
});

// ---------- navegación ----------
function irA(vistaId) {
  document.querySelectorAll('.vista').forEach((v) => v.classList.remove('activa'));
  $(vistaId).classList.add('activa');
  if (vistaId === 'vista-ajustes') renderAjustes();
  if (vistaId === 'vista-tickets') renderTicketsHoy();
  if (vistaId === 'vista-compras') renderVistaCompras();
  if (vistaId === 'vista-dashboard') renderDashboard();
}

// ============================================================
// COBRAR
// ============================================================

function renderCobrar() {
  ultimoCambioCarritoMs = Date.now();
  ocultar($('aviso-carrito'));
  renderCuadricula();
  renderOverlayPrecios();
  if (componiendoOrden()) {
    ocultar($('fila-ticket'));
    ocultar($('fila-pago'));
    mostrar($('panel-orden'));
    mostrar($('orden-acciones'));
    $('total-grande').textContent = formatoMoneda(totalCentavos(ordenEnProgreso.platoActivo.lineas));
    renderPanelOrden();
  } else {
    if (estaVacio(carrito)) borrarCarritoEnCurso(); else guardarCarritoEnCurso(carrito);
    ocultar($('panel-orden'));
    ocultar($('orden-acciones'));
    mostrar($('fila-ticket'));
    const total = totalCentavos(carrito);
    $('total-grande').textContent = formatoMoneda(total);
    renderTicketLineas();
    renderPago();
  }
}

function renderPanelOrden() {
  const plato = ordenEnProgreso.platoActivo;
  $('orden-plato-num').textContent = String(ordenEnProgreso.platos.length + 1);
  $('orden-plato-lineas').innerHTML = plato.lineas.length
    ? plato.lineas.map((l) => `<span class="orden-linea">${l.cantidad} ${escapeHtml(l.nombre)}</span>`).join('')
    : '<p class="texto-suave">Toca productos en la cuadrícula de abajo…</p>';
  document.querySelectorAll('.chip-sin').forEach((chip) => chip.classList.toggle('activo', plato.sin.includes(chip.dataset.sin)));
  $('orden-platos-listos').innerHTML = ordenEnProgreso.platos.map((p, i) => `<div class="orden-plato-listo">Plato ${i + 1}: ${escapeHtml(resumenTexto(p.lineas))}${p.sin.length ? ` · ⚠ SIN ${p.sin.join(', ').toUpperCase()}` : ''}</div>`).join('');
  const hayAlgo = plato.lineas.length > 0 || ordenEnProgreso.platos.length > 0;
  $('btn-guardar-orden-nueva').disabled = !hayAlgo;
  $('btn-separar-todo').disabled = !hayAlgo;
}

function abrirComposerOrden() {
  if (tienePreciosPendientes(catalogoActual)) { irA('vista-ajustes'); return; }
  ordenEnProgreso = { platos: [], platoActivo: crearPlato(crearId('pla')), para: '' };
  $('orden-para').value = '';
  renderCobrar();
  setTimeout(() => $('orden-para').focus(), 50);
}

function cerrarComposerOrden() {
  ordenEnProgreso = null;
  renderCobrar();
}

function platosCompletos() {
  const platos = [...ordenEnProgreso.platos];
  if (ordenEnProgreso.platoActivo.lineas.length) platos.push(ordenEnProgreso.platoActivo);
  return platos;
}

async function guardarOrdenComoNueva(platos) {
  if (!platos.length) return;
  const orden = { ...crearOrden({ id: crearId('ord'), platos, dispositivo: dispositivo()?.nombre || '' }), para: ordenEnProgreso.para || '' };
  await guardarOrden(orden); encolar('orden', orden); sincronizarAhora();
  vibrar([20, 30, 20]);
  cerrarComposerOrden();
  renderBadgeOrdenes();
  abrirOrdenes();
}

function renderTicketLineas() {
  const cont = $('ticket-lineas');
  cont.innerHTML = '';
  for (const linea of carrito) {
    const chip = document.createElement('div');
    chip.className = 'chip-linea';
    const texto = document.createElement('span');
    texto.textContent = `${linea.cantidad} ${linea.nombre}`;
    texto.addEventListener('click', () => {
      carrito = quitarUno(carrito, linea.productoId);
      vibrar(10);
      renderCobrar();
    });
    const x = document.createElement('button');
    x.className = 'chip-x';
    x.textContent = '✕';
    x.addEventListener('click', (e) => {
      e.stopPropagation();
      carrito = quitarLinea(carrito, linea.productoId);
      vibrar(10);
      renderCobrar();
    });
    chip.appendChild(texto);
    chip.appendChild(x);
    cont.appendChild(chip);
  }
}

const RETRASO_TOQUE_LARGO = 480;

function cablearToqueLargo(btn, alSoltarCorto, alSostener) {
  let temporizador = null;
  let disparado = false;
  btn.addEventListener('pointerdown', () => {
    disparado = false;
    temporizador = setTimeout(() => { disparado = true; alSostener(); }, RETRASO_TOQUE_LARGO);
  });
  const cancelar = () => clearTimeout(temporizador);
  btn.addEventListener('pointerup', () => {
    clearTimeout(temporizador);
    if (!disparado) alSoltarCorto();
  });
  btn.addEventListener('pointercancel', cancelar);
  btn.addEventListener('pointerleave', cancelar);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
}

function crearBotonProducto(producto) {
  const btn = document.createElement('button');
  btn.className = 'btn-producto';
  const cant = cantidadDe(obtenerLineasActivas(), producto.id);
  btn.innerHTML = `
    <span class="nombre">${escapeHtml(producto.nombre)}</span>
    <span class="precio">${formatoMoneda(producto.precioCentavos)}</span>
    ${cant > 0 ? `<span class="badge">${cant}</span>` : ''}
  `;
  cablearToqueLargo(btn, () => tocarProducto(producto), () => abrirModalCantidad(producto));
  return btn;
}

function renderCuadricula() {
  const cont = $('cuadricula');
  cont.innerHTML = '';
  for (const producto of productosVisibles(catalogoActual)) {
    cont.appendChild(crearBotonProducto(producto));
  }
  const btnMas = document.createElement('button');
  btnMas.className = 'btn-producto btn-mas';
  btnMas.innerHTML = '<span class="nombre">Más…</span>';
  btnMas.addEventListener('click', abrirHojaMas);
  cont.appendChild(btnMas);
}

function tocarProducto(producto) {
  if (tienePreciosPendientes(catalogoActual)) { irA('vista-ajustes'); return; }
  if (!componiendoOrden()) marcarInicioSiHaceFalta();
  fijarLineasActivas(agregarProducto(obtenerLineasActivas(), producto, 1));
  vibrar(15);
  renderCobrar();
}

function renderOverlayPrecios() {
  const overlay = $('overlay-precios');
  if (tienePreciosPendientes(catalogoActual)) mostrar(overlay); else ocultar(overlay);
}

// Un solo campo, junto al total: "¿con cuánto paga?" -> el cambio se ve al
// instante. Nada de sugerir pedir sueltos -- eso se probó y no era lo que
// Miguel quería. Vacío = pagó exacto (no hay que teclear nada para el caso
// más común).
function renderPago() {
  const total = totalCentavos(carrito);
  const cont = $('fila-pago');
  if (total <= 0) { cont.innerHTML = ''; return; }
  cont.innerHTML = '<button id="btn-cobrar" class="btn-pago exacto">Cobrar</button>';
  $('btn-cobrar').addEventListener('click', abrirModalCobro);
}

function actualizarCambioCobro() {
  const total = totalCentavos(carrito);
  const recibido = aCentavos(Number($('cobro-recibido').value) || 0) || total;
  const cambio = calcularCambio(total, recibido);
  $('cobro-cambio').textContent = `Cambio: ${formatoMoneda(cambio)}`;
}

function abrirModalCobro() {
  const total = totalCentavos(carrito);
  cobroConfirmado = false;
  $('cobro-total').textContent = formatoMoneda(total);
  $('cobro-resumen').innerHTML = carrito.map((l) => `<div>${l.cantidad} × ${escapeHtml(l.nombre)} <span>${formatoMoneda(l.precioUnitarioCentavos * l.cantidad)}</span></div>`).join('');
  $('cobro-recibido').value = '';
  $('cobro-recibido').disabled = false;
  mostrar($('cobro-recibido'));
  mostrar($('cobro-recibido').previousElementSibling);
  ocultar($('cobro-cambio'));
  $('btn-confirmar-cobro').textContent = 'Confirmar cobro';
  mostrar($('modal-cobro'));
  setTimeout(() => $('cobro-recibido').focus(), 50);
}

async function cobrar() {
  const total = totalCentavos(carrito);
  const recibido = aCentavos(Number($('cobro-recibido').value) || 0) || total;
  const cambio = calcularCambio(total, recibido);
  await finalizarTicket({
    metodoPago: recibido === total ? 'exacto' : 'manual',
    recibidoCentavos: recibido,
    cambioCentavos: cambio,
  });
}

async function finalizarTicket(pago) {
  const duracionMs = inicioTicketMs != null ? ahora() - inicioTicketMs : null;
  const ticket = {
    id: crearId('tk'),
    ts: Date.now(),
    fecha: hoyISO(),
    hora: horaISO(),
    lineas: carrito,
    totalCentavos: totalCentavos(carrito),
    ...pago,
    practica: modoPractica,
    operador: dispositivo()?.nombre || '',
    duracionMs,
    modificado: Date.now(),
  };
  await guardarTicket(ticket);
  encolar('ticket', ticket);
  sincronizarAhora();
  if (duracionMs != null) registrarDuracion(duracionMs);
  if (ordenCobrando) {
    const cerrada = avanzarOrden(ordenCobrando, 'cobrada');
    await guardarOrden(cerrada); encolar('orden', cerrada); sincronizarAhora(); ordenCobrando = null;
  }

  mostrarDeshacer(ticket);
  vibrar([25, 40, 25]);
  carrito = crearCarrito();
  borrarCarritoEnCurso();
  inicioTicketMs = null;
  renderCobrar();
}

function mostrarDeshacer(ticket) {
  clearTimeout(temporizadorDeshacer);
  ultimoGuardado = ticket;
  $('deshacer-texto').textContent = `Guardado: ${formatoMoneda(ticket.totalCentavos)}`;
  mostrar($('barra-deshacer'));
  temporizadorDeshacer = setTimeout(() => {
    ocultar($('barra-deshacer'));
    ultimoGuardado = null;
  }, 6000);
}

// ---------- $ libre ----------
function abrirModalLibre() {
  $('libre-monto').value = '';
  $('libre-nota').value = '';
  mostrar($('modal-libre'));
  setTimeout(() => $('libre-monto').focus(), 50);
}

// ---------- cantidad grande (toque largo) ----------
function abrirModalCantidad(producto) {
  productoCantidadActual = producto;
  $('cantidad-nombre').textContent = producto.nombre;
  const actual = cantidadDe(obtenerLineasActivas(), producto.id);
  $('cantidad-input').value = actual > 0 ? actual : 1;
  mostrar($('modal-cantidad'));
  setTimeout(() => { $('cantidad-input').focus(); $('cantidad-input').select(); }, 50);
  vibrar(20);
}

// ============================================================
// AJUSTES
// ============================================================

function renderAjustes() {
  renderPreciosPendientes();
  renderListaProductos();
  renderVelocidad();
  $('chk-modo-practica').checked = modoPractica;
  renderConexion();
}

// ============================================================
// COMPRAS Y GASTOS (categorías, bajo modo dueño)
// ============================================================

let tabMovimientos = 'compra';
let movimientoActual = null; // { tipo: 'compra'|'gasto', id: existente o null, categoria }
let categoriaEditando = null; // null = agregando nueva; string = editando/borrando esa

function renderVistaCompras() {
  renderCategoriasMovimiento();
  renderListaMovimientos();
}

// Toque corto = capturar en esa categoría (lo de siempre). Toque largo, solo
// en las que él agregó (nunca en las de fábrica) = renombrar o borrar --
// mismo patrón de toque largo que ya usa la cuadrícula de productos.
function renderCategoriasMovimiento() {
  const categorias = tabMovimientos === 'compra' ? categoriasCompra() : categoriasGasto();
  const cont = $('cuadricula-categorias');
  cont.innerHTML = '';
  for (const categoria of categorias) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-categoria';
    btn.textContent = categoria;
    const esDeFabrica = esCategoriaDeFabrica(tabMovimientos, categoria);
    cablearToqueLargo(
      btn,
      () => abrirModalMovimiento({ tipo: tabMovimientos, categoria }),
      () => { if (!esDeFabrica) abrirModalCategoria(categoria); }
    );
    cont.appendChild(btn);
  }
  const agregar = document.createElement('button');
  agregar.type = 'button';
  agregar.className = 'btn-categoria btn-categoria-agregar';
  agregar.textContent = '+ Categoría';
  agregar.addEventListener('click', () => abrirModalCategoria(null));
  cont.appendChild(agregar);
}

function abrirModalCategoria(nombreExistente) {
  categoriaEditando = nombreExistente;
  $('categoria-titulo').textContent = nombreExistente ? 'Editar categoría' : 'Nueva categoría';
  $('categoria-nombre').value = nombreExistente || '';
  ocultar($('error-categoria'));
  $('btn-borrar-categoria').classList.toggle('oculto', !nombreExistente);
  mostrar($('modal-categoria'));
  setTimeout(() => $('categoria-nombre').select(), 50);
}

async function renderListaMovimientos() {
  const lista = tabMovimientos === 'compra' ? await listarCompras() : await listarGastos();
  $('titulo-lista-movs').textContent = tabMovimientos === 'compra' ? 'Compras registradas' : 'Gastos registrados';
  const cont = $('lista-movimientos');
  cont.innerHTML = '';
  if (!lista.length) { cont.innerHTML = '<p class="texto-suave">Todavía no hay nada aquí.</p>'; return; }
  for (const mov of lista.slice(0, 60)) {
    const fila = document.createElement('button');
    fila.type = 'button';
    fila.className = 'fila-item fila-mov';
    const detalle = mov.concepto ? ` · ${escapeHtml(mov.concepto)}` : '';
    fila.innerHTML = `<span class="item-nombre">${escapeHtml(mov.categoria)}${detalle} <span class="texto-suave">${mov.fecha}</span></span><span class="item-precio">${formatoMoneda(mov.totalCentavos)}</span>`;
    fila.addEventListener('click', () => abrirModalMovimiento({ tipo: tabMovimientos, id: mov.id, categoria: mov.categoria, concepto: mov.concepto, totalCentavos: mov.totalCentavos }));
    cont.appendChild(fila);
  }
}

function abrirModalMovimiento({ tipo, id = null, categoria, concepto = '', totalCentavos = 0 }) {
  movimientoActual = { tipo, id, categoria };
  $('movimiento-titulo').textContent = categoria;
  $('movimiento-total').value = totalCentavos ? aPesos(totalCentavos) : '';
  $('movimiento-concepto').value = concepto || '';
  ocultar($('error-movimiento'));
  mostrar($('modal-movimiento'));
  setTimeout(() => $('movimiento-total').focus(), 50);
}

// ============================================================
// DASHBOARD (bajo modo dueño)
// ============================================================

// ---------- selector de periodo: Mes / Año / Rango ----------
let modoPeriodo = 'mes';
let mesSeleccionado = hoyISO().slice(0, 7); // 'YYYY-MM'
let anioSeleccionado = Number(hoyISO().slice(0, 4));
let rangoDashboard = { desde: hoyISO(), hasta: hoyISO() };

const NOMBRES_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function etiquetaMes(mesStr) {
  const [anio, mes] = mesStr.split('-').map(Number);
  const nombre = NOMBRES_MES[mes - 1];
  return `${nombre[0].toUpperCase()}${nombre.slice(1)} ${anio}`;
}
function sumarMeses(mesStr, delta) {
  const [anio, mes] = mesStr.split('-').map(Number);
  const fecha = new Date(anio, mes - 1 + delta, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}
function ultimoDiaMes(mesStr) {
  const [anio, mes] = mesStr.split('-').map(Number);
  return new Date(anio, mes, 0).toISOString().slice(0, 10);
}

function rangoDashboardActual() {
  if (modoPeriodo === 'anio') return { desde: `${anioSeleccionado}-01-01`, hasta: `${anioSeleccionado}-12-31` };
  if (modoPeriodo === 'rango') return { desde: rangoDashboard.desde, hasta: rangoDashboard.hasta };
  return { desde: `${mesSeleccionado}-01`, hasta: ultimoDiaMes(mesSeleccionado) };
}

// El mismo tamaño de periodo, justo antes -- para decir "vas mejor o peor",
// no solo el número solo.
function rangoDashboardAnterior({ desde, hasta }) {
  if (modoPeriodo === 'anio') { const a = anioSeleccionado - 1; return { desde: `${a}-01-01`, hasta: `${a}-12-31` }; }
  if (modoPeriodo === 'mes') { const mesAnt = sumarMeses(mesSeleccionado, -1); return { desde: `${mesAnt}-01`, hasta: ultimoDiaMes(mesAnt) }; }
  const dias = Math.round((new Date(hasta) - new Date(desde)) / 86400000) + 1;
  const inicioMs = new Date(`${desde}T00:00:00`).getTime();
  return { desde: new Date(inicioMs - dias * 86400000).toISOString().slice(0, 10), hasta: new Date(inicioMs - 86400000).toISOString().slice(0, 10) };
}

function mostrarSelectorPeriodo() {
  $('selector-mes').classList.toggle('oculto', modoPeriodo !== 'mes');
  $('selector-anio').classList.toggle('oculto', modoPeriodo !== 'anio');
  $('selector-rango').classList.toggle('oculto', modoPeriodo !== 'rango');
}

async function renderDashboard() {
  $('mes-etiqueta').textContent = etiquetaMes(mesSeleccionado);
  $('anio-etiqueta').textContent = String(anioSeleccionado);
  if (!$('rango-desde').value) { $('rango-desde').value = rangoDashboard.desde; $('rango-hasta').value = rangoDashboard.hasta; }

  const { desde, hasta } = rangoDashboardActual();
  const enRango = (desdeR, hastaR) => (fecha) => fecha >= desdeR && fecha <= hastaR;
  const [todosTickets, todasCompras, todosGastos] = await Promise.all([listarTodos(), listarCompras(), listarGastos()]);
  const tickets = todosTickets.filter(enRango(desde, hasta));
  const compras = todasCompras.filter(enRango(desde, hasta));
  const gastos = todosGastos.filter(enRango(desde, hasta));

  // 1. Resumen del periodo
  const r = resumenCaja({ tickets, compras, gastos });
  const prom = ticketPromedio(tickets);

  $('ganancia-final').textContent = formatoMoneda(r.utilidadCentavos);
  $('ganancia-final').classList.toggle('negativo', r.utilidadCentavos < 0);
  $('ganancia-margen').textContent = `${r.margenPorcentaje}% de margen sobre ventas`;

  const anterior = rangoDashboardAnterior({ desde, hasta });
  const comprasAnt = todasCompras.filter(enRango(anterior.desde, anterior.hasta));
  const gastosAnt = todosGastos.filter(enRango(anterior.desde, anterior.hasta));
  const ticketsAnt = todosTickets.filter(enRango(anterior.desde, anterior.hasta));
  const cambio = variacionPorcentaje(r.ventasCentavos, resumenCaja({ tickets: ticketsAnt }).ventasCentavos);
  const comparacion = $('ganancia-comparacion');
  comparacion.textContent = `${cambio >= 0 ? '▲' : '▼'} ${Math.abs(cambio)}% en ventas vs el periodo anterior`;
  comparacion.classList.toggle('sube', cambio >= 0);
  comparacion.classList.toggle('baja', cambio < 0);

  $('kpis-dashboard').innerHTML = [
    ['Ventas', formatoMoneda(r.ventasCentavos)], ['Compras', formatoMoneda(r.comprasCentavos)],
    ['Gastos', formatoMoneda(r.gastosCentavos)], ['Tickets', String(prom.cantidadTickets)],
    ['Ticket prom.', formatoMoneda(prom.promedioCentavos)],
  ].map(([label, valor]) => `<div class="kpi"><div class="valor">${valor}</div><div class="label">${label}</div></div>`).join('');

  // 2. Comparación mensual histórica
  renderTiraMeses(todosTickets, todasCompras, todosGastos);

  // punto de equilibrio -- siempre sobre los últimos 30 días reales, sin
  // importar qué periodo se esté viendo arriba (es una vara del "ahora").
  const hoy = hoyISO();
  const hace30 = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const equilibrio = puntoEquilibrio(todasCompras.filter(enRango(hace30, hoy)), todosGastos.filter(enRango(hace30, hoy)), 30);
  $('equilibrio-diario').textContent = formatoMoneda(equilibrio.diarioCentavos);

  // 3. Ventas diarias del periodo, con línea de promedio
  const filasDias = ventasPorDia(tickets).map((d) => ({ etiqueta: d.fecha.slice(5), valor: d.totalCentavos }));
  const promedioDiario = filasDias.length ? filasDias.reduce((acc, f) => acc + f.valor, 0) / filasDias.length : 0;
  renderBarras('grafica-dias', filasDias, formatoMoneda, promedioDiario);
  renderBarras('grafica-dia-semana', ventasPorDiaSemana(tickets).map((d) => ({ etiqueta: d.etiqueta, valor: d.totalCentavos })));
  renderBarras('grafica-horas', ventasPorHora(tickets).map((h) => ({ etiqueta: `${String(h.hora).padStart(2, '0')}:00`, valor: h.totalCentavos })));

  // 4. Productos que dejan más -- solo los principales
  const vendidos = ventasPorProducto(tickets).slice(0, 8);
  renderBarras('grafica-producto-piezas', vendidos.map((p) => ({ etiqueta: p.nombre, valor: p.cantidad })), (n) => String(n));
  renderBarras('grafica-producto-dinero', vendidos.map((p) => ({ etiqueta: p.nombre, valor: p.totalCentavos })));

  // 5. En qué se va el dinero, comparado contra el periodo anterior
  renderBarrasComparadas('grafica-compras-categoria', porCategoria(compras), porCategoria(comprasAnt));
  renderBarrasComparadas('grafica-gastos-categoria', porCategoria(gastos), porCategoria(gastosAnt));

  // 7. Control operativo
  const ordenesActivas = await listarOrdenesActivas();
  $('kpis-operativo').innerHTML = [
    ['En cola', String(ordenesActivas.filter((o) => o.estado === 'cola').length)],
    ['Por cobrar', String(ordenesActivas.filter((o) => o.estado === 'entregada').length)],
  ].map(([label, valor]) => `<div class="kpi"><div class="valor">${valor}</div><div class="label">${label}</div></div>`).join('');

  const porUsuario = cobradoPorUsuario(tickets);
  $('lista-por-usuario').innerHTML = porUsuario.length
    ? porUsuario.map((u) => `<p>${escapeHtml(u.nombre)}: <strong>${u.cantidadTickets}</strong> tickets · ${formatoMoneda(u.totalCentavos)}</p>`).join('')
    : '<p class="texto-suave">Sin datos todavía.</p>';

  // Lo sin sincronizar de ESTE celular -- lo de otros celulares no se puede
  // ver desde aquí: mientras no suban su cola, sus datos solo viven en su
  // propio aparato. Es un límite real de cómo está armada la nube (Sheets +
  // Apps Script), no un pendiente por construir.
  const pendientes = leerCola().length;
  $('texto-sin-sincronizar').textContent = pendientes
    ? `⚠ Este celular tiene ${pendientes} registro(s) sin respaldar en Drive todavía.`
    : 'Este celular está al día con Drive. (Solo ve lo suyo -- otro celular con cola pendiente no se refleja aquí hasta que sincronice.)';
}

function renderTiraMeses(todosTickets, todasCompras, todosGastos) {
  const meses = resumenPorMes(todosTickets, todasCompras, todosGastos);
  const cont = $('tira-meses');
  cont.innerHTML = '';
  if (!meses.length) { cont.innerHTML = '<p class="texto-suave">Sin datos todavía.</p>'; $('comparacion-mes-texto').textContent = ''; return; }
  const maxVentas = Math.max(...meses.map((m) => m.ventasCentavos), 1);
  for (const m of meses) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mes-card' + (m.mes === mesSeleccionado ? ' seleccionado' : '');
    btn.innerHTML = `
      <div class="mes-card-titulo">${etiquetaMes(m.mes).slice(0, 3)} ${m.mes.slice(2, 4)}</div>
      <div class="barra-pista" style="height:6px;margin-bottom:6px;"><div class="barra-relleno" style="width:${Math.max(3, Math.round((m.ventasCentavos / maxVentas) * 100))}%"></div></div>
      <div class="mes-metric"><span>Ventas</span><strong>${formatoMoneda(m.ventasCentavos)}</strong></div>
      <div class="mes-metric"><span>Compras</span><strong>${formatoMoneda(m.comprasCentavos)}</strong></div>
      <div class="mes-metric"><span>Gastos</span><strong>${formatoMoneda(m.gastosCentavos)}</strong></div>
      <div class="mes-metric utilidad"><span>Utilidad</span><strong>${formatoMoneda(m.utilidadCentavos)}</strong></div>
    `;
    btn.addEventListener('click', () => {
      modoPeriodo = 'mes';
      mesSeleccionado = m.mes;
      document.querySelectorAll('#tabs-modo-periodo .tab-periodo').forEach((b) => b.classList.toggle('activo', b.dataset.modo === 'mes'));
      mostrarSelectorPeriodo();
      renderDashboard();
    });
    cont.appendChild(btn);
  }
  cont.querySelector('.mes-card.seleccionado')?.scrollIntoView({ inline: 'center', block: 'nearest' });

  const texto = $('comparacion-mes-texto');
  if (modoPeriodo !== 'mes') { texto.textContent = ''; return; }
  const actual = meses.find((m) => m.mes === mesSeleccionado);
  const anteriorMes = meses.find((m) => m.mes === sumarMeses(mesSeleccionado, -1));
  const [anioSel, mesSel] = mesSeleccionado.split('-');
  const mismoMesAnioPasado = meses.find((m) => m.mes === `${Number(anioSel) - 1}-${mesSel}`);
  const partes = [];
  if (actual && anteriorMes) partes.push(`${signoVariacion(actual.ventasCentavos, anteriorMes.ventasCentavos)} vs el mes anterior`);
  if (actual && mismoMesAnioPasado) partes.push(`${signoVariacion(actual.ventasCentavos, mismoMesAnioPasado.ventasCentavos)} vs ${etiquetaMes(`${Number(anioSel) - 1}-${mesSel}`)}`);
  texto.textContent = partes.length ? `Ventas: ${partes.join(' · ')}` : 'Sin datos del mes anterior o del mismo mes del año pasado para comparar.';
}

function signoVariacion(actual, antes) {
  const cambio = variacionPorcentaje(actual, antes);
  return `${cambio >= 0 ? '▲' : '▼'} ${Math.abs(cambio)}%`;
}

function renderBarras(contId, filas, formatear = formatoMoneda, lineaReferencia = null) {
  const cont = $(contId);
  if (!filas.length) { cont.innerHTML = '<p class="texto-suave">Sin datos todavía.</p>'; return; }
  const max = Math.max(...filas.map((f) => f.valor), lineaReferencia || 0, 1);
  cont.innerHTML = filas.map((f) => `
    <div class="barra-fila">
      <span class="barra-etiqueta">${escapeHtml(String(f.etiqueta))}</span>
      <div class="barra-pista">
        <div class="barra-relleno" style="width:${Math.max(3, Math.round((f.valor / max) * 100))}%"></div>
        ${lineaReferencia ? `<div class="barra-referencia" style="left:${Math.min(99, Math.round((lineaReferencia / max) * 100))}%"></div>` : ''}
      </div>
      <span class="barra-valor">${formatear(f.valor)}</span>
    </div>
  `).join('');
}

// Igual que renderBarras, pero con el % de cambio contra el mismo renglón
// del periodo anterior -- "en qué se fue el dinero" quiere decir tanto el
// total como si ese gasto está subiendo.
function renderBarrasComparadas(contId, filasActual, filasAnterior) {
  const cont = $(contId);
  if (!filasActual.length) { cont.innerHTML = '<p class="texto-suave">Sin datos todavía.</p>'; return; }
  const max = Math.max(...filasActual.map((f) => f.totalCentavos), 1);
  const anteriorPorCategoria = new Map(filasAnterior.map((f) => [f.categoria, f.totalCentavos]));
  cont.innerHTML = filasActual.map((f) => {
    const antes = anteriorPorCategoria.get(f.categoria) || 0;
    const cambio = variacionPorcentaje(f.totalCentavos, antes);
    return `
    <div class="barra-fila">
      <span class="barra-etiqueta">${escapeHtml(f.categoria)}</span>
      <div class="barra-pista"><div class="barra-relleno" style="width:${Math.max(3, Math.round((f.totalCentavos / max) * 100))}%"></div></div>
      <span class="barra-valor">${formatoMoneda(f.totalCentavos)}</span>
      <span class="barra-delta ${cambio >= 0 ? 'sube' : 'baja'}">${cambio >= 0 ? '▲' : '▼'}${Math.abs(cambio)}%</span>
    </div>`;
  }).join('');
}

function renderConexion() {
  const cola = leerCola();
  $('version-deploy').textContent = `Versión instalada: ${new Date(VERSION_DEPLOY).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}`;
  $('estado-sincronizacion').textContent = ultimoErrorSync || (cola.length ? `${cola.length} operación(es) esperando respaldo.` : 'Respaldo automático en Drive activo.');
  const ultima = Number(localStorage.getItem('taq_ultima_actualizacion') || 0);
  $('ultima-actualizacion').textContent = ultima ? `Última actualización: ${new Date(ultima).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Aún no hay una actualización correcta con Drive.';
}

async function sincronizarAhora() {
  if (sincronizando || !urlApi()) return;
  const d = dispositivo(); if (!d) { prepararAcceso(); return; }
  sincronizando = true;
  try {
    await llamarApi({ accion: 'registrarDispositivo', dispositivo: d });
    const respuesta = await llamarApi({ accion: 'sincronizar', dispositivo: d, desdeVersion: Number(localStorage.getItem('taq_version_datos') || 0), operaciones: leerCola() });
    confirmar(respuesta.confirmadas || []);
    localStorage.setItem('taq_version_datos', String(respuesta.version || 0));
    localStorage.setItem('taq_ultima_actualizacion', String(Date.now()));
    const cambios = respuesta.cambios || {};
    if (cambios.productos?.length) { catalogoActual = cambios.productos; guardarCatalogo(catalogoActual); renderCobrar(); }
    for (const ticket of cambios.tickets || []) await guardarTicket(ticket);
    for (const orden of cambios.ordenes || []) await guardarOrden(orden);
    for (const compra of cambios.compras || []) await guardarCompra(compra);
    for (const gasto of cambios.gastos || []) await guardarGasto(gasto);
    ultimoErrorSync = '';
  } catch (error) {
    ultimoErrorSync = `Sin respaldo: ${error.message || 'revisar conexión'}`;
  }
  finally { sincronizando = false; if ($('vista-ajustes').classList.contains('activa')) renderConexion(); }
}

async function prepararAcceso() {
  const url = urlApi();
  $('operador-url').classList.toggle('oculto', Boolean(url));
  $('operador-pin').classList.add('oculto');
  $('titulo-acceso').textContent = '¿Quién está usando la app?';
  $('texto-acceso').textContent = 'Escribe tu nombre. Quedará registrado en cada cobro y orden.';
  $('error-acceso').textContent = '';
  ocultar($('error-acceso'));
  mostrar($('modal-operador'));
}

async function entrar() {
  const url = $('operador-url').value.trim() || urlApi();
  const nombre = $('operador-nombre').value.trim();
  const error = $('error-acceso');
  if (!url || !nombre) { error.textContent = 'Falta la URL o el nombre.'; mostrar(error); return; }
  ocultar(error);
  const boton = $('btn-registrar-operador');
  const textoOriginal = boton.textContent;
  // Sin esto no se ve NADA mientras espera a Apps Script -- y la primera vez
  // (cuando instala la hoja en Drive) puede tardar varios segundos, no es un
  // toque que se haya perdido.
  boton.disabled = true;
  boton.textContent = 'Entrando…';
  try {
    guardarUrlApi(url);
    const estado = await llamarApi({ accion: 'estado' });
    if (!estado.ok) {
      boton.textContent = 'Preparando tu hoja en Drive…';
      await llamarApi({ accion: 'instalar', nombreDueno: nombre });
    }
    if (!dispositivo()) guardarDispositivo(nombre);
    ocultar($('modal-operador'));
    sincronizarAhora(); // sigue en segundo plano, no hace esperar más al que ya entró
  } catch (e) {
    error.textContent = e.message || 'No se pudo entrar. Revisa la URL o tu conexión.';
    mostrar(error);
  } finally {
    boton.disabled = false;
    boton.textContent = textoOriginal;
  }
}

// Modo dueño (PLAN.md 7.1): una sola llave protege precios, productos,
// compras, gastos y métricas -- nunca varias sueltas. La sesión vence sola a
// los 30 min (acceso.js::sesionVigente), así no hay que acordarse de
// "cerrar sesión" en el mostrador.
function duenoAutorizado() { return sesionVigente(sesionDueno); }
function exigirModoDueno() {
  if (duenoAutorizado()) return true;
  abrirModalPinDueno();
  return false;
}
function publicarCatalogo() {
  catalogoActual = catalogoActual.map((producto) => ({ ...producto, modificado: Date.now() }));
  guardarCatalogo(catalogoActual);
  catalogoActual.forEach((producto) => encolar('producto', producto));
  localStorage.setItem('taq_catalogo_publicado', '1');
  sincronizarAhora();
}

function renderPreciosPendientes() {
  const pendientes = productosPendientes(catalogoActual);
  const tarjeta = $('tarjeta-precios-pendientes');
  if (!pendientes.length) { ocultar(tarjeta); return; }
  mostrar(tarjeta);
  const cont = $('lista-precios-pendientes');
  cont.innerHTML = '';
  for (const p of pendientes) {
    const fila = document.createElement('div');
    fila.className = 'fila-precio-pendiente';
    const nombre = document.createElement('span');
    nombre.className = 'item-nombre';
    nombre.textContent = p.nombre;
    const input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'decimal';
    input.value = aPesos(p.precioCentavos);
    input.dataset.id = p.id;
    fila.appendChild(nombre);
    fila.appendChild(input);
    cont.appendChild(fila);
  }
}

// Un solo listado: los que están en la cuadrícula (checkbox marcado, con
// manija para arrastrar) primero, luego los que están detrás de "Más…"
// (checkbox vacío, sin manija). Marcar/desmarcar mueve entre los dos grupos;
// arrastrar solo reordena dentro de los marcados -- el orden de los
// desmarcados no importa (viven en un menú aparte, "Más…").
function renderListaProductos() {
  const cupoLibre = cupoLibreEnCuadricula(catalogoActual);
  const visibles = productosVisibles(catalogoActual);
  const contador = $('productos-contador');
  contador.textContent = `${visibles.length}/11 en la cuadrícula`;
  contador.classList.toggle('contador-lleno', cupoLibre <= 0);

  const cont = $('lista-productos');
  cont.innerHTML = '';
  const productos = [...visibles, ...productosOcultos(catalogoActual)];
  for (const p of productos) {
    const enCuadricula = p.posicion != null;
    const fila = document.createElement('div');
    fila.className = 'fila-arrastrable' + (enCuadricula ? '' : ' oculta-en-cuadricula');
    fila.dataset.id = p.id;

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = enCuadricula;
    check.addEventListener('change', () => {
      if (!exigirModoDueno()) { check.checked = enCuadricula; return; }
      if (check.checked) {
        if (cupoLibreEnCuadricula(catalogoActual) <= 0) { check.checked = false; return; }
        catalogoActual = moverACuadricula(catalogoActual, p.id);
      } else {
        catalogoActual = moverAOcultos(catalogoActual, p.id);
      }
      publicarCatalogo();
      renderListaProductos();
      renderCobrar();
    });

    const manija = document.createElement('span');
    manija.className = 'manija' + (enCuadricula ? '' : ' invisible');
    manija.textContent = '⠿';
    if (enCuadricula) { cablearArrastre(manija, fila, cont); cablearArrastre(fila, fila, cont); }

    const nombre = document.createElement('span');
    nombre.className = 'item-nombre';
    nombre.textContent = p.nombre;
    const precio = document.createElement('span');
    precio.className = 'item-precio';
    precio.textContent = formatoMoneda(p.precioCentavos);
    const btnEditar = document.createElement('button');
    btnEditar.className = 'mini-btn';
    btnEditar.textContent = '✎';
    btnEditar.addEventListener('click', () => abrirModalProducto(p));
    const btnBorrar = document.createElement('button');
    btnBorrar.className = 'mini-btn';
    btnBorrar.textContent = '✕';
    btnBorrar.addEventListener('click', () => {
      if (!exigirModoDueno()) return;
      if (!window.confirm(`¿Borrar "${p.nombre}" por completo?`)) return;
      catalogoActual = desactivarProducto(catalogoActual, p.id);
      publicarCatalogo();
      renderListaProductos();
      renderCobrar();
    });

    fila.append(check, manija, nombre, precio, btnEditar, btnBorrar);
    cont.appendChild(fila);
  }
  if (!productos.length) cont.innerHTML = '<p class="texto-suave">No hay productos todavía.</p>';
}

// Arrastre por puntero: mueve el nodo DOM real (nunca lo recrea) mientras
// dura el arrastre, para no perder el pointer capture a medias -- si se
// volviera a pintar la lista completa en cada paso, el arrastre se cortaría
// solo. Al soltar, sí se confirma el orden nuevo contra catalogoActual.
function cablearArrastre(manija, fila, contenedor) {
  let arrastrando = false;

  function filaMasCercana(y) {
    const filas = [...contenedor.querySelectorAll('.fila-arrastrable:not(.oculta-en-cuadricula)')].filter((f) => f !== fila);
    let mejor = { desplazamiento: -Infinity, elemento: null };
    for (const f of filas) {
      const caja = f.getBoundingClientRect();
      const offset = y - caja.top - caja.height / 2;
      if (offset < 0 && offset > mejor.desplazamiento) mejor = { desplazamiento: offset, elemento: f };
    }
    return mejor.elemento;
  }

  manija.addEventListener('pointerdown', (e) => {
    if (manija === fila && e.target.closest('input, button')) return;
    if (!exigirModoDueno()) return;
    e.preventDefault();
    arrastrando = true;
    fila.classList.add('arrastrando');
    manija.setPointerCapture(e.pointerId);
  });

  manija.addEventListener('pointermove', (e) => {
    if (!arrastrando) return;
    const destino = filaMasCercana(e.clientY);
    if (destino == null) contenedor.appendChild(fila);
    else contenedor.insertBefore(fila, destino);
  });

  function soltar() {
    if (!arrastrando) return;
    arrastrando = false;
    fila.classList.remove('arrastrando');
    const idsEnOrden = [...contenedor.querySelectorAll('.fila-arrastrable:not(.oculta-en-cuadricula)')].map((f) => f.dataset.id);
    catalogoActual = reordenarCuadricula(catalogoActual, idsEnOrden);
    publicarCatalogo();
    renderCobrar();
  }
  manija.addEventListener('pointerup', soltar);
  manija.addEventListener('pointercancel', soltar);
}

function abrirModalProducto(p) {
  productoEditando = p;
  $('editar-nombre').value = p.nombre;
  $('editar-precio').value = aPesos(p.precioCentavos);
  $('editar-categoria').value = p.categoria || '';
  $('editar-cuadricula').checked = p.posicion != null;
  mostrar($('modal-producto'));
  setTimeout(() => $('editar-nombre').focus(), 50);
}

function abrirModalTicket(ticket) {
  if (ticket.cancelado) return;
  ticketEditando = ticket;
  lineasTicketEditando = ticket.lineas.map((l) => ({ ...l }));
  $('ticket-resumen').textContent = ticket.lineas.map((l) => `${l.cantidad} ${l.nombre}`).join(', ');
  $('ticket-total').value = aPesos(ticket.totalCentavos);
  $('ticket-motivo').value = '';
  ocultar($('error-ticket'));
  renderLineasTicketEditando();
  mostrar($('modal-ticket'));
  setTimeout(() => $('ticket-total').select(), 50);
}

function renderLineasTicketEditando() {
  const cont = $('ticket-lineas-editar');
  cont.innerHTML = '';
  for (const linea of lineasTicketEditando) {
    const fila = document.createElement('div');
    fila.className = 'linea-editar';
    const menos = document.createElement('button'); menos.textContent = '−';
    const texto = document.createElement('span'); texto.textContent = `${linea.cantidad} × ${linea.nombre}`;
    const mas = document.createElement('button'); mas.textContent = '+';
    menos.addEventListener('click', () => { lineasTicketEditando = quitarUno(lineasTicketEditando, linea.productoId); renderLineasTicketEditando(); });
    mas.addEventListener('click', () => { lineasTicketEditando = lineasTicketEditando.map((l) => l.productoId === linea.productoId ? { ...l, cantidad: l.cantidad + 1 } : l); renderLineasTicketEditando(); });
    fila.append(menos, texto, mas); cont.appendChild(fila);
  }
  $('ticket-total').value = aPesos(totalCentavos(lineasTicketEditando));
}

function renderVelocidad() {
  const stats = estadisticas();
  const seg = (ms) => (ms ? `${(ms / 1000).toFixed(1)} s` : '—');
  $('kpis-velocidad').innerHTML = `
    <div class="kpi"><div class="valor">${stats.cantidad}</div><div class="label">tickets medidos</div></div>
    <div class="kpi"><div class="valor">${seg(stats.medianaMs)}</div><div class="label">mediana</div></div>
    <div class="kpi"><div class="valor">${seg(stats.peor10Ms)}</div><div class="label">peor 10%</div></div>
  `;
}

async function renderTicketsHoy() {
  const cont = $('lista-tickets-hoy');
  const tickets = await listarTicketsPorFecha(hoyISO());
  cont.innerHTML = '';
  if (!tickets.length) { cont.innerHTML = '<p class="texto-suave">Todavía no hay tickets hoy.</p>'; return; }
  for (const t of tickets) {
    const fila = document.createElement('div');
    fila.className = 'fila-item';
    const resumen = t.lineas.map((l) => `${l.cantidad} ${l.nombre}`).join(', ');
    const nombre = document.createElement('span');
    nombre.className = 'item-nombre';
    nombre.textContent = `${t.hora.slice(0, 5)} — ${resumen}${t.practica ? ' 🧪' : ''}`;
    const precio = document.createElement('span');
    precio.className = 'item-precio';
    precio.textContent = formatoMoneda(t.totalCentavos);
    if (t.cancelado) { nombre.textContent += ' — CANCELADO'; fila.classList.add('ticket-cancelado'); }
    const btnEditar = document.createElement('button');
    btnEditar.className = 'mini-btn';
    btnEditar.textContent = '✎';
    btnEditar.addEventListener('click', () => abrirModalTicket(t));
    const btnBorrar = document.createElement('button');
    btnBorrar.className = 'mini-btn btn-peligro';
    btnBorrar.textContent = '✕';
    btnBorrar.addEventListener('click', () => abrirModalTicket(t));
    fila.append(nombre, precio, btnEditar, btnBorrar);
    cont.appendChild(fila);
  }
}

function renderBannerPractica() {
  const banner = $('banner-practica');
  if (modoPractica) mostrar(banner); else ocultar(banner);
}

// Tiempo transcurrido corto ("hace 4 min") -- lo que delata una orden olvidada.
function tiempoTranscurrido(ms) {
  const min = Math.floor((Date.now() - ms) / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  return `hace ${Math.floor(min / 60)} h`;
}

async function abrirOrdenes() {
  const cont = $('lista-ordenes');
  const ordenes = await listarOrdenesActivas(); // ya viene ordenada por creada asc -- la más vieja primero
  cont.innerHTML = '';
  if (!ordenes.length) cont.innerHTML = '<p class="texto-suave">No hay órdenes pendientes.</p>';
  const idSiguiente = ordenes.find((o) => o.estado === 'cola')?.id;
  for (const orden of ordenes) {
    const fila = document.createElement('button');
    fila.type = 'button';
    fila.className = 'fila-orden' + (orden.id === idSiguiente ? ' siguiente' : '');
    const resumen = resumenComal(orden.platos).map((l) => `${l.cantidad} ${escapeHtml(l.nombre)}`).join(' · ');
    fila.innerHTML = `
      <div class="fila-orden-info">
        <span class="fila-orden-num">#${orden.id.slice(-4)}${orden.para ? ` · ${escapeHtml(orden.para)}` : ''}</span>
        <span class="fila-orden-suave">${resumen} — ${tiempoTranscurrido(orden.creada)}</span>
      </div>
      <span class="fila-orden-estado">${orden.estado === 'cola' ? 'En cola' : 'Falta cobrar'}</span>
    `;
    fila.addEventListener('click', () => abrirDetalleOrden(orden));
    cont.appendChild(fila);
  }
  renderBadgeOrdenes();
  mostrar($('modal-ordenes'));
}

async function renderBadgeOrdenes() {
  const ordenes = await listarOrdenesActivas();
  const enCola = ordenes.filter((o) => o.estado === 'cola').length;
  const burbuja = $('burbuja-ordenes');
  burbuja.textContent = String(enCola);
  burbuja.classList.toggle('oculto', enCola === 0);
}

function abrirDetalleOrden(orden) {
  $('detalle-orden-titulo').textContent = `Orden #${orden.id.slice(-4)}${orden.para ? ` · ${orden.para}` : ''}`;
  const comal = resumenComal(orden.platos).map((l) => `<div>${l.cantidad} ${escapeHtml(l.nombre)}</div>`).join('');
  const platos = orden.platos.map((p, i) => `
    <div class="comanda-plato">
      <div class="comanda-plato-titulo">PLATO ${i + 1}</div>
      ${p.sin.length ? `<span class="comanda-sin">⚠ SIN ${p.sin.join(', ').toUpperCase()}</span>` : ''}
      ${p.lineas.map((l) => `<div class="comanda-linea"><strong>${l.cantidad}</strong> ${escapeHtml(l.nombre.toUpperCase())}</div>`).join('')}
    </div>
  `).join('');
  $('detalle-orden-cuerpo').innerHTML = `<div class="comanda-comal"><span class="etiqueta">AL COMAL</span>${comal}</div>${platos}`;

  const acciones = $('detalle-orden-acciones');
  acciones.innerHTML = '';
  if (orden.estado === 'cola') {
    const entregar = document.createElement('button'); entregar.className = 'btn-primario'; entregar.textContent = 'Marcar entregada';
    entregar.addEventListener('click', async () => {
      const actualizada = avanzarOrden(orden, 'entregada');
      await guardarOrden(actualizada); encolar('orden', actualizada); sincronizarAhora();
      ocultar($('modal-orden-detalle')); abrirOrdenes();
    });
    acciones.appendChild(entregar);
  } else if (esCobrable(orden)) {
    const cobrarOrden = document.createElement('button'); cobrarOrden.className = 'btn-primario'; cobrarOrden.textContent = 'Cobrar';
    cobrarOrden.addEventListener('click', () => {
      carrito = orden.platos.flatMap((p) => p.lineas);
      ordenCobrando = orden;
      ocultar($('modal-orden-detalle')); ocultar($('modal-ordenes'));
      renderCobrar(); abrirModalCobro();
    });
    acciones.appendChild(cobrarOrden);
  }
  mostrar($('modal-orden-detalle'));
}

setInterval(() => {
  if (carritoOlvidado(carrito, ultimoCambioCarritoMs)) mostrar($('aviso-carrito'));
}, 30000);

// ============================================================
// eventos fijos (una sola vez)
// ============================================================

$('btn-ir-ajustes').addEventListener('click', () => { if (exigirModoDueno()) irA('vista-ajustes'); });
$('btn-ordenes').addEventListener('click', abrirOrdenes);
$('btn-cerrar-ordenes').addEventListener('click', () => ocultar($('modal-ordenes')));
$('btn-cerrar-orden-detalle').addEventListener('click', () => ocultar($('modal-orden-detalle')));
$('btn-volver-cobrar').addEventListener('click', () => irA('vista-cobrar'));

$('btn-nueva-orden').addEventListener('click', abrirComposerOrden);
$('btn-cancelar-orden').addEventListener('click', () => {
  const hayAlgo = ordenEnProgreso.platos.length > 0 || ordenEnProgreso.platoActivo.lineas.length > 0;
  if (hayAlgo && !window.confirm('¿Descartar esta orden? Se perderá lo capturado.')) return;
  cerrarComposerOrden();
});
$('orden-para').addEventListener('input', (e) => { if (componiendoOrden()) ordenEnProgreso.para = e.target.value; });
document.querySelectorAll('.chip-sin').forEach((chip) => {
  chip.addEventListener('click', () => {
    if (!componiendoOrden()) return;
    ordenEnProgreso.platoActivo = alternarSin(ordenEnProgreso.platoActivo, chip.dataset.sin);
    vibrar(10);
    renderPanelOrden();
  });
});
$('btn-otro-plato').addEventListener('click', () => {
  if (!componiendoOrden() || !ordenEnProgreso.platoActivo.lineas.length) return;
  ordenEnProgreso.platos.push(ordenEnProgreso.platoActivo);
  ordenEnProgreso.platoActivo = crearPlato(crearId('pla'));
  vibrar(10);
  renderPanelOrden();
});
$('btn-separar-todo').addEventListener('click', () => {
  if (!componiendoOrden()) return;
  guardarOrdenComoNueva(separarTodo(platosCompletos()));
});
$('btn-guardar-orden-nueva').addEventListener('click', () => {
  if (!componiendoOrden()) return;
  guardarOrdenComoNueva(platosCompletos());
});
$('btn-ir-precios').addEventListener('click', () => irA('vista-ajustes'));

$('btn-libre').addEventListener('click', abrirModalLibre);
$('btn-cerrar-libre').addEventListener('click', () => ocultar($('modal-libre')));
$('btn-libre-agregar').addEventListener('click', () => {
  const monto = Number($('libre-monto').value);
  if (!monto || monto <= 0) return;
  const nota = $('libre-nota').value.trim() || '$ libre';
  marcarInicioSiHaceFalta();
  carrito = agregarLibre(carrito, aCentavos(monto), nota);
  ocultar($('modal-libre'));
  vibrar(15);
  renderCobrar();
});

$('btn-cerrar-mas').addEventListener('click', () => ocultar($('hoja-mas')));

$('btn-cerrar-cobro').addEventListener('click', () => { cobroConfirmado = false; ocultar($('modal-cobro')); });
$('btn-confirmar-cobro').addEventListener('click', async () => {
  if (cobroConfirmado) { ocultar($('modal-cobro')); return; }
  const total = totalCentavos(carrito);
  const recibido = aCentavos(Number($('cobro-recibido').value) || 0) || total;
  if (recibido < total) return;
  const cambio = calcularCambio(total, recibido);
  await cobrar();
  cobroConfirmado = true;
  $('cobro-cambio').textContent = `Cambio a entregar: ${formatoMoneda(cambio)}`;
  mostrar($('cobro-cambio'));
  $('cobro-recibido').disabled = true;
  ocultar($('cobro-recibido').previousElementSibling);
  ocultar($('cobro-recibido'));
  $('btn-confirmar-cobro').textContent = 'Listo';
});
$('btn-cerrar-producto').addEventListener('click', () => ocultar($('modal-producto')));
$('btn-guardar-producto').addEventListener('click', () => {
  if (!exigirModoDueno()) return;
  if (!productoEditando) return;
  const nombre = $('editar-nombre').value.trim();
  const precioPesos = Number($('editar-precio').value);
  if (!nombre || precioPesos <= 0) return;
  catalogoActual = editarProducto(catalogoActual, productoEditando.id, { nombre, precioPesos, categoria: $('editar-categoria').value.trim() });
  const estaba = productoEditando.posicion != null;
  const quiere = $('editar-cuadricula').checked;
  if (quiere && !estaba) catalogoActual = moverACuadricula(catalogoActual, productoEditando.id);
  if (!quiere && estaba) catalogoActual = moverAOcultos(catalogoActual, productoEditando.id);
  publicarCatalogo(); ocultar($('modal-producto')); renderAjustes(); renderCobrar();
});
$('btn-cerrar-ticket').addEventListener('click', () => ocultar($('modal-ticket')));
$('btn-guardar-ticket').addEventListener('click', async () => {
  if (!ticketEditando) return;
  const totalCentavos = aCentavos(Number($('ticket-total').value));
  const motivo = $('ticket-motivo').value.trim();
  const error = $('error-ticket');
  if (!totalCentavos) { error.textContent = 'El total tiene que ser mayor a $0.'; mostrar(error); return; }
  if (!motivo) { error.textContent = 'Escribe el motivo de la corrección.'; mostrar(error); return; }
  ocultar(error);
  const corregido = corregirTicket(ticketEditando, { totalCentavos, lineas: lineasTicketEditando, motivo, autor: dispositivo()?.nombre || 'local' });
  await guardarTicket(corregido); encolar('ticket', corregido); sincronizarAhora();
  ocultar($('modal-ticket')); renderTicketsHoy();
});
$('btn-cancelar-ticket').addEventListener('click', async () => {
  if (!ticketEditando) return;
  const motivo = $('ticket-motivo').value.trim();
  const error = $('error-ticket');
  if (!motivo) { error.textContent = 'Escribe el motivo para cancelar el ticket.'; mostrar(error); return; }
  ocultar(error);
  const cancelado = cancelarTicket(ticketEditando, { motivo, autor: dispositivo()?.nombre || 'local' });
  await guardarTicket(cancelado); encolar('ticket', cancelado); sincronizarAhora();
  ocultar($('modal-ticket')); renderTicketsHoy();
});

$('btn-cerrar-cantidad').addEventListener('click', () => ocultar($('modal-cantidad')));
$('cantidad-menos').addEventListener('click', () => {
  $('cantidad-input').value = Math.max(0, Number($('cantidad-input').value) - 1);
});
$('cantidad-mas').addEventListener('click', () => {
  $('cantidad-input').value = Number($('cantidad-input').value) + 1;
});
$('btn-cantidad-quitar').addEventListener('click', () => {
  if (!productoCantidadActual) return;
  fijarLineasActivas(quitarLinea(obtenerLineasActivas(), productoCantidadActual.id));
  ocultar($('modal-cantidad'));
  vibrar(10);
  renderCobrar();
});
$('btn-cantidad-listo').addEventListener('click', () => {
  if (!productoCantidadActual) return;
  const n = Math.max(0, Math.floor(Number($('cantidad-input').value)) || 0);
  const lineas = obtenerLineasActivas();
  const yaExiste = lineas.some((l) => l.productoId === productoCantidadActual.id);
  if (n === 0) {
    fijarLineasActivas(quitarLinea(lineas, productoCantidadActual.id));
  } else if (!yaExiste) {
    if (!componiendoOrden()) marcarInicioSiHaceFalta();
    fijarLineasActivas(agregarProducto(lineas, productoCantidadActual, n));
  } else {
    fijarLineasActivas(establecerCantidad(lineas, productoCantidadActual.id, n));
  }
  ocultar($('modal-cantidad'));
  vibrar(15);
  renderCobrar();
});

$('btn-deshacer').addEventListener('click', async () => {
  if (!ultimoGuardado) return;
  clearTimeout(temporizadorDeshacer);
  await borrarTicket(ultimoGuardado.id);
  carrito = ultimoGuardado.lineas;
  inicioTicketMs = ahora();
  ultimoGuardado = null;
  ocultar($('barra-deshacer'));
  vibrar(20);
  renderCobrar();
});

$('btn-guardar-precios').addEventListener('click', () => {
  if (!exigirModoDueno()) return;
  document.querySelectorAll('#lista-precios-pendientes input').forEach((input) => {
    const valor = Number(input.value);
    if (valor > 0) catalogoActual = confirmarPrecio(catalogoActual, input.dataset.id, valor);
  });
  publicarCatalogo();
  renderAjustes();
  renderCobrar();
});

$('btn-agregar-producto').addEventListener('click', () => {
  if (!exigirModoDueno()) return;
  const nombre = $('nuevo-nombre').value.trim();
  const categoria = $('nuevo-categoria').value.trim();
  const precioPesos = Number($('nuevo-precio').value);
  if (!nombre || !precioPesos) return;
  catalogoActual = agregarProductoCatalogo(catalogoActual, { nombre, categoria, precioPesos, aCuadricula: $('nuevo-en-cuadricula').checked });
  publicarCatalogo();
  $('nuevo-nombre').value = '';
  $('nuevo-categoria').value = '';
  $('nuevo-precio').value = '';
  renderAjustes();
  renderCobrar();
});

$('chk-modo-practica').addEventListener('change', (e) => {
  modoPractica = e.target.checked;
  guardarModoPractica(modoPractica);
  renderBannerPractica();
});
$('btn-reiniciar-medicion').addEventListener('click', () => {
  if (window.confirm('¿Borrar la medición de velocidad guardada hasta ahora?')) {
    reiniciarMedicion();
    renderVelocidad();
  }
});

$('btn-tickets').addEventListener('click', () => { if (exigirModoDueno()) irA('vista-tickets'); });
$('btn-compras').addEventListener('click', () => { if (exigirModoDueno()) irA('vista-compras'); });
$('btn-dashboard').addEventListener('click', () => { if (exigirModoDueno()) irA('vista-dashboard'); });
$('btn-volver-tickets').addEventListener('click', () => irA('vista-cobrar'));
$('btn-volver-compras').addEventListener('click', () => irA('vista-cobrar'));
$('btn-volver-dashboard').addEventListener('click', () => irA('vista-cobrar'));

document.querySelectorAll('.tab-movimiento').forEach((btn) => {
  btn.addEventListener('click', () => {
    tabMovimientos = btn.dataset.tab;
    document.querySelectorAll('.tab-movimiento').forEach((b) => b.classList.toggle('activo', b === btn));
    renderVistaCompras();
  });
});
document.querySelectorAll('#tabs-modo-periodo .tab-periodo').forEach((btn) => {
  btn.addEventListener('click', () => {
    modoPeriodo = btn.dataset.modo;
    document.querySelectorAll('#tabs-modo-periodo .tab-periodo').forEach((b) => b.classList.toggle('activo', b === btn));
    mostrarSelectorPeriodo();
    renderDashboard();
  });
});
$('mes-anterior').addEventListener('click', () => { mesSeleccionado = sumarMeses(mesSeleccionado, -1); renderDashboard(); });
$('mes-siguiente').addEventListener('click', () => { mesSeleccionado = sumarMeses(mesSeleccionado, 1); renderDashboard(); });
$('anio-anterior').addEventListener('click', () => { anioSeleccionado -= 1; renderDashboard(); });
$('anio-siguiente').addEventListener('click', () => { anioSeleccionado += 1; renderDashboard(); });
$('rango-desde').addEventListener('change', () => { rangoDashboard.desde = $('rango-desde').value; renderDashboard(); });
$('rango-hasta').addEventListener('change', () => { rangoDashboard.hasta = $('rango-hasta').value; renderDashboard(); });

$('btn-cerrar-movimiento').addEventListener('click', () => ocultar($('modal-movimiento')));
$('btn-guardar-movimiento').addEventListener('click', async () => {
  if (!movimientoActual) return;
  const totalCentavos = aCentavos(Number($('movimiento-total').value));
  const errorMov = $('error-movimiento');
  if (!totalCentavos) { errorMov.textContent = 'Escribe un total mayor a $0.'; mostrar(errorMov); return; }
  ocultar(errorMov);
  const concepto = $('movimiento-concepto').value.trim();
  const { tipo, id, categoria } = movimientoActual;
  const usuario = dispositivo()?.nombre || '';
  if (tipo === 'compra') {
    const detalle = concepto ? [{ concepto, cantidad: 1, unidad: '', precioCentavos: totalCentavos }] : [];
    const compra = crearCompra({ id: id || crearId('comp'), fecha: hoyISO(), categoria, totalCentavos, usuario, detalle });
    await guardarCompra(compra); encolar('compra', compra); sincronizarAhora();
  } else {
    const gasto = crearGasto({ id: id || crearId('gas'), fecha: hoyISO(), categoria, concepto, totalCentavos, usuario });
    await guardarGasto(gasto); encolar('gasto', gasto); sincronizarAhora();
  }
  ocultar($('modal-movimiento'));
  renderListaMovimientos();
});

$('btn-cerrar-categoria').addEventListener('click', () => ocultar($('modal-categoria')));
$('btn-guardar-categoria').addEventListener('click', () => {
  const nombre = $('categoria-nombre').value.trim();
  const error = $('error-categoria');
  if (!nombre) { error.textContent = 'Escribe un nombre.'; mostrar(error); return; }
  const yaExiste = (tabMovimientos === 'compra' ? categoriasCompra() : categoriasGasto())
    .some((c) => c.toLowerCase() === nombre.toLowerCase() && c !== categoriaEditando);
  if (yaExiste) { error.textContent = 'Ya hay una categoría con ese nombre.'; mostrar(error); return; }
  if (categoriaEditando) renombrarCategoria(tabMovimientos, categoriaEditando, nombre);
  else agregarCategoria(tabMovimientos, nombre);
  ocultar($('modal-categoria'));
  renderCategoriasMovimiento();
});
$('btn-borrar-categoria').addEventListener('click', () => {
  if (!categoriaEditando) return;
  quitarCategoria(tabMovimientos, categoriaEditando);
  ocultar($('modal-categoria'));
  renderCategoriasMovimiento();
});

// Antes esto llamaba a Apps Script "estado" DOS veces por cada intento (una
// al abrir, otra al confirmar) y el modal ni se mostraba hasta que la
// primera terminaba -- con Apps Script (que a veces tarda varios segundos en
// "despertar"), eso se sentía como que no hacía nada. Ahora el modal se ve
// al instante y solo se pregunta "estado" una vez; el resultado se guarda
// aquí y el botón de confirmar lo reusa en vez de volver a preguntar.
let pinRequiereConfig = false;

async function abrirModalPinDueno() {
  $('pin-dueno').value = '';
  ocultar($('error-pin-dueno'));
  $('titulo-pin-dueno').textContent = 'Modo dueño';
  $('texto-pin-dueno').textContent = 'Comprobando…';
  $('pin-dueno').disabled = true;
  $('btn-confirmar-pin-dueno').disabled = true;
  mostrar($('modal-pin-dueno'));
  try {
    const estado = await llamarApi({ accion: 'estado' });
    pinRequiereConfig = Boolean(estado.requiereConfiguracion);
  } catch (e) {
    pinRequiereConfig = false;
  } finally {
    $('titulo-pin-dueno').textContent = pinRequiereConfig ? 'Crear PIN del dueño' : 'Modo dueño';
    $('texto-pin-dueno').textContent = pinRequiereConfig ? 'Este PIN protegerá precios, productos, compras, gastos y resultados.' : 'Escribe el PIN del dueño para continuar.';
    $('btn-confirmar-pin-dueno').textContent = pinRequiereConfig ? 'Crear PIN' : 'Entrar';
    $('pin-dueno').disabled = false;
    $('btn-confirmar-pin-dueno').disabled = false;
    $('pin-dueno').focus();
  }
}
$('btn-cerrar-pin-dueno').addEventListener('click', () => ocultar($('modal-pin-dueno')));
$('btn-confirmar-pin-dueno').addEventListener('click', async () => {
  const boton = $('btn-confirmar-pin-dueno');
  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.textContent = 'Verificando…';
  try {
    const respuesta = await llamarApi({ accion: pinRequiereConfig ? 'configurarPinDueno' : 'verificarPinDueno', pin: $('pin-dueno').value });
    if (!respuesta.ok) { $('error-pin-dueno').textContent = 'PIN incorrecto.'; mostrar($('error-pin-dueno')); return; }
    sesionDueno = crearSesion({ nombre: dispositivo()?.nombre || 'dueño', esDueno: true });
    ocultar($('modal-pin-dueno')); renderAjustes();
  } catch (e) {
    $('error-pin-dueno').textContent = e.message || 'No se pudo verificar. Revisa tu conexión.';
    mostrar($('error-pin-dueno'));
  } finally {
    boton.disabled = false;
    boton.textContent = textoOriginal;
  }
});
$('btn-sincronizar').addEventListener('click', sincronizarAhora);
$('btn-registrar-operador').addEventListener('click', entrar);

function abrirHojaMas() {
  const cont = $('lista-mas');
  cont.innerHTML = '';
  for (const producto of productosOcultos(catalogoActual)) {
    const btn = document.createElement('button');
    btn.className = 'btn-producto';
    btn.innerHTML = `<span class="nombre">${escapeHtml(producto.nombre)}</span><span class="precio">${formatoMoneda(producto.precioCentavos)}</span>`;
    const cant = cantidadDe(obtenerLineasActivas(), producto.id);
    btn.innerHTML = `<span class="nombre">${escapeHtml(producto.nombre)}</span><span class="precio">${formatoMoneda(producto.precioCentavos)}</span>${cant > 0 ? `<span class="badge">${cant}</span>` : ''}`;
    cablearToqueLargo(btn, () => { tocarProducto(producto); abrirHojaMas(); }, () => abrirModalCantidad(producto));
    cont.appendChild(btn);
  }
  mostrar($('hoja-mas'));
}

// ============================================================
// arranque
// ============================================================

pedirWakeLock();
renderBannerPractica();
renderCobrar();
renderBadgeOrdenes();
if (!dispositivo()) prepararAcceso(); else sincronizarAhora();
window.addEventListener('online', sincronizarAhora);
setInterval(sincronizarAhora, 10000);

if ('serviceWorker' in navigator) {
  // registration.update() fuerza a revisar si hay un sw.js más nuevo,
  // saltándose el retraso normal del navegador -- mismo patrón ya probado en
  // MIS APPS. build.py reescribe el número de versión de CACHE en sw.js en
  // cada build (hash del contenido), así que un service worker nuevo
  // siempre se ve como "distinto" y se activa -- nadie tiene que acordarse
  // de subir un número a mano.
  window.addEventListener('load', () => {
    // La versión va en la URL del worker: GitHub puede cachear sw.js hasta
    // diez minutos, pero una URL nueva obliga a bajar el worker del despliegue
    // actual de inmediato. updateViaCache none evita reutilizar ese HTTP cache.
    navigator.serviceWorker.register(`sw.js?v=${encodeURIComponent(VERSION_DEPLOY)}`, { updateViaCache: 'none' })
      .then((r) => r.update()).catch(() => { /* sin sw, sigue funcionando online */ });
  });
  // En cuanto el service worker NUEVO toma control, recarga la página sola
  // -- nadie tiene que cerrar y volver a abrir la app a mano. Pero si hay
  // algo escrito sin mandar (ej. a medio "$ libre" o "Otro"), espera a que
  // la app pase a segundo plano para no perder lo que iba a cobrar.
  let recargando = false;
  function intentarRecargar() {
    if (recargando) return;
    const activo = document.activeElement;
    const escribiendo = activo && (activo.tagName === 'INPUT' || activo.tagName === 'TEXTAREA') && activo.value;
    if (escribiendo) return;
    recargando = true;
    location.reload();
  }
  navigator.serviceWorker.addEventListener('controllerchange', intentarRecargar);
  document.addEventListener('visibilitychange', () => { if (document.hidden) intentarRecargar(); });
}
