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
import { guardarTicket, borrarTicket, listarTicketsPorFecha, guardarOrden, listarOrdenesActivas, guardarCompra, guardarGasto, listarCompras, listarGastos } from './almacen.js';
import { ahora, registrarDuracion, estadisticas, reiniciarMedicion } from './cronometro.js';
import { cargarCarritoEnCurso, guardarCarritoEnCurso, borrarCarritoEnCurso, cargarModoPractica, guardarModoPractica, carritoOlvidado, corregirTicket, cancelarTicket } from './sesion.js';
import { crearSesion, sesionVigente } from './acceso.js';
import { urlApi, guardarUrlApi, dispositivo, guardarDispositivo, llamarApi, sesionApi, guardarSesion, cerrarSesion } from './api.js';
import { leerCola, encolar, confirmar } from './cola.js';
import { VERSION_DEPLOY } from './version.js';
import { crearOrden, avanzarOrden, esCobrable, crearPlato, separarTodo, resumenComal, alternarSin } from './ordenes.js';
import { crearCompra, crearGasto } from './gastos.js';
import { resumenCaja, ventasPorProducto } from './reportes.js';

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
  renderTicketsHoy();
  $('chk-modo-practica').checked = modoPractica;
  renderConexion();
  $('tarjeta-administracion').classList.remove('oculto');
  $('panel-resultados').classList.toggle('oculto', !duenoAutorizado());
  if (duenoAutorizado()) renderResumenCaja();
}

async function renderResumenCaja() {
  const [tickets, compras, gastos] = await Promise.all([listarTicketsPorFecha(hoyISO()), listarCompras(hoyISO()), listarGastos(hoyISO())]);
  const r = resumenCaja({ tickets, compras, gastos });
  $('kpis-caja').innerHTML = `<div class="kpi"><span>Ventas</span><strong>${formatoMoneda(r.ventasCentavos)}</strong></div><div class="kpi"><span>Compras</span><strong>${formatoMoneda(r.comprasCentavos)}</strong></div><div class="kpi"><span>Gastos</span><strong>${formatoMoneda(r.gastosCentavos)}</strong></div><div class="kpi"><span>Utilidad</span><strong>${formatoMoneda(r.utilidadCentavos)}</strong></div>`;
  const vendidos = ventasPorProducto(tickets);
  $('lista-productos-vendidos').innerHTML = vendidos.length ? `<h3>Más vendido hoy</h3>${vendidos.map((p) => `<p>${escapeHtml(p.nombre)}: <strong>${p.cantidad}</strong> · ${formatoMoneda(p.totalCentavos)}</p>`).join('')}` : '<p class="texto-suave">Aún no hay ventas hoy.</p>';
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
  const pin = $('operador-pin').value;
  const error = $('error-acceso');
  if (!url || !nombre) { error.textContent = 'Falta la URL o el nombre.'; mostrar(error); return; }
  try {
    guardarUrlApi(url);
    const estado = await llamarApi({ accion: 'estado' });
    if (!estado.ok) await llamarApi({ accion: 'instalar', nombreDueno: nombre });
    if (!dispositivo()) guardarDispositivo(nombre);
    ocultar($('modal-operador'));
    await sincronizarAhora();
  } catch (e) { error.textContent = e.message || 'No se pudo entrar.'; mostrar(error); }
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
    const cobrarOrden = document.createElement('button'); cobrarOrden.className = 'btn-primario'; cobrarOrden.textContent = 'Cobrar esta orden';
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

$('btn-ir-ajustes').addEventListener('click', () => irA('vista-ajustes'));
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
  if (!totalCentavos || !motivo) return;
  const corregido = corregirTicket(ticketEditando, { totalCentavos, lineas: lineasTicketEditando, motivo, autor: dispositivo()?.nombre || 'local' });
  await guardarTicket(corregido); encolar('ticket', corregido); sincronizarAhora();
  ocultar($('modal-ticket')); renderTicketsHoy();
});
$('btn-cancelar-ticket').addEventListener('click', async () => {
  if (!ticketEditando) return;
  const motivo = $('ticket-motivo').value.trim();
  if (!motivo) return;
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

$('btn-guardar-compra').addEventListener('click', async () => {
  if (!exigirModoDueno()) return;
  const totalCentavos = aCentavos(Number($('compra-total').value));
  const categoria = $('compra-categoria').value.trim();
  if (!categoria || !totalCentavos) return;
  const compra = crearCompra({ id: crearId('comp'), fecha: hoyISO(), categoria, totalCentavos, usuario: sesionApi().usuario.nombre });
  await guardarCompra(compra); encolar('compra', compra); $('compra-categoria').value = ''; $('compra-total').value = ''; sincronizarAhora(); renderResumenCaja();
});
$('btn-guardar-gasto').addEventListener('click', async () => {
  if (!exigirModoDueno()) return;
  const totalCentavos = aCentavos(Number($('gasto-total').value));
  const categoria = $('gasto-categoria').value;
  const concepto = $('gasto-concepto').value.trim();
  if (!concepto || !totalCentavos) return;
  const gasto = crearGasto({ id: crearId('gas'), fecha: hoyISO(), categoria, concepto, totalCentavos, usuario: sesionApi().usuario.nombre });
  await guardarGasto(gasto); encolar('gasto', gasto); $('gasto-concepto').value = ''; $('gasto-total').value = ''; sincronizarAhora(); renderResumenCaja();
});
async function abrirModalPinDueno() {
  const estado = await llamarApi({ accion: 'estado' });
  const crear = Boolean(estado.requiereConfiguracion);
  $('titulo-pin-dueno').textContent = crear ? 'Crear PIN del dueño' : 'Modo dueño';
  $('texto-pin-dueno').textContent = crear ? 'Este PIN protegerá precios, productos, compras, gastos y resultados.' : 'Escribe el PIN del dueño para continuar.';
  $('btn-confirmar-pin-dueno').textContent = crear ? 'Crear PIN' : 'Entrar';
  $('pin-dueno').value = ''; ocultar($('error-pin-dueno')); mostrar($('modal-pin-dueno'));
  setTimeout(() => $('pin-dueno').focus(), 50);
}
$('btn-ver-resultados').addEventListener('click', abrirModalPinDueno);
$('btn-confirmar-pin-dueno').addEventListener('click', async () => {
  const estado = await llamarApi({ accion: 'estado' });
  const respuesta = await llamarApi({ accion: estado.requiereConfiguracion ? 'configurarPinDueno' : 'verificarPinDueno', pin: $('pin-dueno').value });
  if (!respuesta.ok) { $('error-pin-dueno').textContent = 'PIN incorrecto.'; mostrar($('error-pin-dueno')); return; }
  sesionDueno = crearSesion({ nombre: dispositivo()?.nombre || 'dueño', esDueno: true });
  ocultar($('modal-pin-dueno')); renderAjustes();
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
