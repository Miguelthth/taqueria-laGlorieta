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
  establecerCantidad, quitarLinea, cantidadDe, totalCentavos, estaVacio,
} from './ticket.js';
import { aCentavos, aPesos, formatoMoneda, siguienteBillete, billeteDespuesDe } from './dinero.js';
import { sugerenciaCambio, calcularCambio, calcularRedondeo } from './cambio.js';
import { hoyISO, horaISO, crearId } from './modelo.js';
import { guardarTicket, borrarTicket, listarTicketsPorFecha } from './almacen.js';
import { ahora, registrarDuracion, estadisticas, reiniciarMedicion } from './cronometro.js';

// ---------- estado en memoria ----------
let catalogoActual = obtenerCatalogo();
let carrito = crearCarrito();
let inicioTicketMs = null;
let ultimoGuardado = null;
let temporizadorDeshacer = null;
let productoCantidadActual = null;
let cambioEditadoManualmente = false;
let ultimaSugerenciaOtro = null;
let modoPractica = localStorage.getItem('taq_modo_practica') === '1';

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
function pesosParaInput(centavos) {
  const p = aPesos(centavos);
  if (p === 0) return '';
  return Number.isInteger(p) ? String(p) : p.toFixed(2);
}
function marcarInicioSiHaceFalta() {
  if (estaVacio(carrito)) inicioTicketMs = ahora();
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
  $('total-grande').textContent = formatoMoneda(totalCentavos(carrito));
  renderTicketLineas();
  renderCuadricula();
  renderFilaPago();
  renderOverlayPrecios();
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
  const cant = cantidadDe(carrito, producto.id);
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
  marcarInicioSiHaceFalta();
  carrito = agregarProducto(carrito, producto, 1);
  vibrar(15);
  renderCobrar();
}

function renderOverlayPrecios() {
  const overlay = $('overlay-precios');
  if (tienePreciosPendientes(catalogoActual)) mostrar(overlay); else ocultar(overlay);
}

function armarBotonesPago(total) {
  const botones = [{ tipo: 'exacto', montoCentavos: total }];
  let b = siguienteBillete(total);
  while (botones.length < 3 && b) {
    if (b !== total) botones.push({ tipo: 'billete', montoCentavos: b });
    b = billeteDespuesDe(b);
  }
  botones.push({ tipo: 'otro' });
  return botones;
}

function renderFilaPago() {
  const cont = $('fila-pago');
  cont.innerHTML = '';
  const total = totalCentavos(carrito);
  if (total <= 0) return;
  for (const b of armarBotonesPago(total)) {
    const btn = document.createElement('button');
    if (b.tipo === 'exacto') {
      btn.className = 'btn-pago exacto';
      btn.innerHTML = `<span class="monto">Exacto</span><span class="detalle">${formatoMoneda(total)}</span>`;
      btn.addEventListener('click', () => cobrarInstantaneo(total, 'exacto'));
    } else if (b.tipo === 'billete') {
      btn.className = 'btn-pago billete';
      const cambio = b.montoCentavos - total;
      const sugerencia = sugerenciaCambio(total, b.montoCentavos);
      let detalle;
      if (sugerencia) detalle = `Pide ${formatoMoneda(sugerencia.pedirCentavos)} → das ${formatoMoneda(sugerencia.cambioCentavos)}`;
      else if (cambio > 0) detalle = `cambio ${formatoMoneda(cambio)}`;
      else detalle = 'sin cambio';
      btn.innerHTML = `<span class="monto">${formatoMoneda(b.montoCentavos)}</span><span class="detalle">${detalle}</span>`;
      btn.addEventListener('click', () => cobrarInstantaneo(b.montoCentavos, 'billete'));
    } else {
      btn.className = 'btn-pago otro';
      btn.innerHTML = '<span class="monto">Otro</span><span class="detalle">monto / redondeo</span>';
      btn.addEventListener('click', abrirModalOtro);
    }
    cont.appendChild(btn);
  }
}

async function cobrarInstantaneo(recibidoCentavos, metodoPago) {
  const total = totalCentavos(carrito);
  const cambio = calcularCambio(total, recibidoCentavos);
  await finalizarTicket({
    metodoPago,
    billeteCentavos: metodoPago === 'billete' ? recibidoCentavos : null,
    recibidoCentavos,
    cambioCentavos: cambio,
    redondeoCentavos: 0,
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
    duracionMs,
  };
  await guardarTicket(ticket);
  if (duracionMs != null) registrarDuracion(duracionMs);

  mostrarDeshacer(ticket);
  vibrar([25, 40, 25]);
  carrito = crearCarrito();
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
  const actual = cantidadDe(carrito, producto.id);
  $('cantidad-input').value = actual > 0 ? actual : 1;
  mostrar($('modal-cantidad'));
  vibrar(20);
}

// ---------- cobro manual "Otro", con redondeo editable ----------
// Igual que los botones de billete rápidos, pero para CUALQUIER cantidad que
// el cliente dé (no solo las 2-3 que caben en la fila de pago) -- por eso
// también calcula la sugerencia de cambio aquí, no solo en armarBotonesPago.
function abrirModalOtro() {
  const total = totalCentavos(carrito);
  $('otro-total').textContent = `Total: ${formatoMoneda(total)}`;
  $('otro-recibido').value = '';
  $('otro-cambio').value = '';
  $('otro-redondeo').textContent = '';
  ocultar($('otro-sugerencia'));
  ultimaSugerenciaOtro = null;
  cambioEditadoManualmente = false;
  mostrar($('modal-otro'));
  setTimeout(() => $('otro-recibido').focus(), 50);
}

function actualizarSugerenciaOtro(total, recibido) {
  const el = $('otro-sugerencia');
  const sugerencia = recibido > total ? sugerenciaCambio(total, recibido) : null;
  if (!sugerencia) { ocultar(el); return null; }
  el.textContent = `Pídele ${formatoMoneda(sugerencia.pedirCentavos)} más → dale ${formatoMoneda(sugerencia.cambioCentavos)}`;
  mostrar(el);
  return sugerencia;
}

function actualizarRedondeoOtro() {
  const total = totalCentavos(carrito);
  const recibido = aCentavos(Number($('otro-recibido').value) || 0);
  const cambioEntregado = aCentavos(Number($('otro-cambio').value) || 0);
  const redondeo = calcularRedondeo(total, recibido, cambioEntregado);
  if (redondeo === 0) $('otro-redondeo').textContent = '';
  else if (redondeo > 0) $('otro-redondeo').textContent = `Redondeo a tu favor: ${formatoMoneda(redondeo)}`;
  else $('otro-redondeo').textContent = `Le diste ${formatoMoneda(-redondeo)} de más`;
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
      if (check.checked) {
        if (cupoLibreEnCuadricula(catalogoActual) <= 0) { check.checked = false; return; }
        catalogoActual = moverACuadricula(catalogoActual, p.id);
      } else {
        catalogoActual = moverAOcultos(catalogoActual, p.id);
      }
      guardarCatalogo(catalogoActual);
      renderListaProductos();
      renderCobrar();
    });

    const manija = document.createElement('span');
    manija.className = 'manija' + (enCuadricula ? '' : ' invisible');
    manija.textContent = '⠿';
    if (enCuadricula) cablearArrastre(manija, fila, cont);

    const nombre = document.createElement('span');
    nombre.className = 'item-nombre';
    nombre.textContent = p.nombre;
    const precio = document.createElement('span');
    precio.className = 'item-precio';
    precio.textContent = formatoMoneda(p.precioCentavos);
    const btnEditar = document.createElement('button');
    btnEditar.className = 'mini-btn';
    btnEditar.textContent = '✎';
    btnEditar.addEventListener('click', () => editarProductoPrompt(p));
    const btnBorrar = document.createElement('button');
    btnBorrar.className = 'mini-btn';
    btnBorrar.textContent = '✕';
    btnBorrar.addEventListener('click', () => {
      if (!window.confirm(`¿Borrar "${p.nombre}" por completo?`)) return;
      catalogoActual = desactivarProducto(catalogoActual, p.id);
      guardarCatalogo(catalogoActual);
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
    guardarCatalogo(catalogoActual);
    renderCobrar();
  }
  manija.addEventListener('pointerup', soltar);
  manija.addEventListener('pointercancel', soltar);
}

function editarProductoPrompt(p) {
  const nombre = window.prompt('Nombre:', p.nombre);
  if (nombre === null || !nombre.trim()) return;
  const precio = window.prompt('Precio:', String(aPesos(p.precioCentavos)));
  if (precio === null || !Number(precio)) return;
  catalogoActual = editarProducto(catalogoActual, p.id, { nombre: nombre.trim(), precioPesos: Number(precio) });
  guardarCatalogo(catalogoActual);
  renderAjustes();
  renderCobrar();
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
    const btnBorrar = document.createElement('button');
    btnBorrar.className = 'mini-btn btn-peligro';
    btnBorrar.textContent = '✕';
    btnBorrar.addEventListener('click', async () => {
      if (!window.confirm('¿Borrar este ticket?')) return;
      await borrarTicket(t.id);
      renderTicketsHoy();
    });
    fila.append(nombre, precio, btnBorrar);
    cont.appendChild(fila);
  }
}

function renderBannerPractica() {
  const banner = $('banner-practica');
  if (modoPractica) mostrar(banner); else ocultar(banner);
}

// ============================================================
// eventos fijos (una sola vez)
// ============================================================

$('btn-ir-ajustes').addEventListener('click', () => irA('vista-ajustes'));
$('btn-volver-cobrar').addEventListener('click', () => irA('vista-cobrar'));
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

$('btn-cerrar-cantidad').addEventListener('click', () => ocultar($('modal-cantidad')));
$('cantidad-menos').addEventListener('click', () => {
  $('cantidad-input').value = Math.max(0, Number($('cantidad-input').value) - 1);
});
$('cantidad-mas').addEventListener('click', () => {
  $('cantidad-input').value = Number($('cantidad-input').value) + 1;
});
$('btn-cantidad-quitar').addEventListener('click', () => {
  if (!productoCantidadActual) return;
  carrito = quitarLinea(carrito, productoCantidadActual.id);
  ocultar($('modal-cantidad'));
  vibrar(10);
  renderCobrar();
});
$('btn-cantidad-listo').addEventListener('click', () => {
  if (!productoCantidadActual) return;
  const n = Math.max(0, Math.floor(Number($('cantidad-input').value)) || 0);
  const yaExiste = carrito.some((l) => l.productoId === productoCantidadActual.id);
  if (n === 0) {
    carrito = quitarLinea(carrito, productoCantidadActual.id);
  } else if (!yaExiste) {
    marcarInicioSiHaceFalta();
    carrito = agregarProducto(carrito, productoCantidadActual, n);
  } else {
    carrito = establecerCantidad(carrito, productoCantidadActual.id, n);
  }
  ocultar($('modal-cantidad'));
  vibrar(15);
  renderCobrar();
});

$('btn-cerrar-otro').addEventListener('click', () => ocultar($('modal-otro')));
$('otro-sugerencia').addEventListener('click', () => {
  if (!ultimaSugerenciaOtro) return;
  // Tocar la sugerencia significa "sí le pedí el sobrante y ya me lo dio" --
  // por eso también sube "Recibí" con lo que se pidió de más. Si solo se
  // subiera "cambio" sin tocar "recibido", el redondeo saldría mal: se
  // vería como "diste $5 de más" cuando en realidad, si de verdad pidió los
  // $5, la cuenta ya quedó exacta.
  const total = totalCentavos(carrito);
  const recibidoNuevo = aCentavos(Number($('otro-recibido').value) || 0) + ultimaSugerenciaOtro.pedirCentavos;
  $('otro-recibido').value = pesosParaInput(recibidoNuevo);
  $('otro-cambio').value = pesosParaInput(ultimaSugerenciaOtro.cambioCentavos);
  cambioEditadoManualmente = true;
  actualizarSugerenciaOtro(total, recibidoNuevo);
  actualizarRedondeoOtro();
  vibrar(15);
});
$('otro-recibido').addEventListener('input', () => {
  const total = totalCentavos(carrito);
  const recibido = aCentavos(Number($('otro-recibido').value) || 0);
  ultimaSugerenciaOtro = actualizarSugerenciaOtro(total, recibido);
  // El cambio se precarga con el crudo (lo que "sobra" de verdad) -- la
  // sugerencia es un atajo aparte (tocarla la aplica), nunca cambia sola lo
  // que ya se iba a dar, para no dar una sorpresa si no se lee el aviso.
  if (!cambioEditadoManualmente) $('otro-cambio').value = pesosParaInput(calcularCambio(total, recibido));
  actualizarRedondeoOtro();
});
$('otro-cambio').addEventListener('input', () => {
  cambioEditadoManualmente = true;
  actualizarRedondeoOtro();
});
$('btn-otro-cobrar').addEventListener('click', async () => {
  const total = totalCentavos(carrito);
  const recibido = aCentavos(Number($('otro-recibido').value) || 0);
  const cambioEntregado = aCentavos(Number($('otro-cambio').value) || 0);
  const redondeo = calcularRedondeo(total, recibido, cambioEntregado);
  ocultar($('modal-otro'));
  await finalizarTicket({
    metodoPago: 'otro',
    billeteCentavos: null,
    recibidoCentavos: recibido,
    cambioCentavos: cambioEntregado,
    redondeoCentavos: redondeo,
  });
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
  document.querySelectorAll('#lista-precios-pendientes input').forEach((input) => {
    const valor = Number(input.value);
    if (valor > 0) catalogoActual = confirmarPrecio(catalogoActual, input.dataset.id, valor);
  });
  guardarCatalogo(catalogoActual);
  renderAjustes();
  renderCobrar();
});

$('btn-agregar-producto').addEventListener('click', () => {
  const nombre = $('nuevo-nombre').value.trim();
  const categoria = $('nuevo-categoria').value.trim();
  const precioPesos = Number($('nuevo-precio').value);
  if (!nombre || !precioPesos) return;
  catalogoActual = agregarProductoCatalogo(catalogoActual, { nombre, categoria, precioPesos, aCuadricula: $('nuevo-en-cuadricula').checked });
  guardarCatalogo(catalogoActual);
  $('nuevo-nombre').value = '';
  $('nuevo-categoria').value = '';
  $('nuevo-precio').value = '';
  renderAjustes();
  renderCobrar();
});

$('chk-modo-practica').addEventListener('change', (e) => {
  modoPractica = e.target.checked;
  localStorage.setItem('taq_modo_practica', modoPractica ? '1' : '0');
  renderBannerPractica();
});
$('btn-reiniciar-medicion').addEventListener('click', () => {
  if (window.confirm('¿Borrar la medición de velocidad guardada hasta ahora?')) {
    reiniciarMedicion();
    renderVelocidad();
  }
});

function abrirHojaMas() {
  const cont = $('lista-mas');
  cont.innerHTML = '';
  for (const producto of productosOcultos(catalogoActual)) {
    const btn = document.createElement('button');
    btn.className = 'btn-producto';
    btn.innerHTML = `<span class="nombre">${escapeHtml(producto.nombre)}</span><span class="precio">${formatoMoneda(producto.precioCentavos)}</span>`;
    btn.addEventListener('click', () => {
      if (tienePreciosPendientes(catalogoActual)) { ocultar($('hoja-mas')); irA('vista-ajustes'); return; }
      marcarInicioSiHaceFalta();
      carrito = agregarProducto(carrito, producto, 1);
      vibrar(15);
      ocultar($('hoja-mas'));
      renderCobrar();
    });
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

if ('serviceWorker' in navigator) {
  // registration.update() fuerza a revisar si hay un sw.js más nuevo,
  // saltándose el retraso normal del navegador -- mismo patrón ya probado en
  // MIS APPS. build.py reescribe el número de versión de CACHE en sw.js en
  // cada build (hash del contenido), así que un service worker nuevo
  // siempre se ve como "distinto" y se activa -- nadie tiene que acordarse
  // de subir un número a mano.
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((r) => r.update()).catch(() => { /* sin sw, sigue funcionando online */ });
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
