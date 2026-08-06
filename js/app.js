// ARCHIVO GENERADO por build.py (paquete "taqueria") -- no editar a mano.
// Edita los archivos fuente y vuelve a correr: python build.py

// ── js/dinero.js ──────────────────────────────────────────
const dinero = (function () {
// Toda la aritmética de dinero vive aquí. Puro: recibe números, regresa
// números. Sin DOM, sin storage. Todo se suma en CENTAVOS ENTEROS para
// evitar errores de punto flotante (mismo criterio que MIS APPS).

function aCentavos(pesos) {
  return Math.round(pesos * 100);
}

function aPesos(centavos) {
  return centavos / 100;
}

function formatoMoneda(centavos) {
  const negativo = centavos < 0;
  const abs = Math.abs(Math.round(centavos));
  const pesos = Math.floor(abs / 100);
  const c = abs % 100;
  const pesosTxto = pesos.toLocaleString('es-MX');
  const txt = c === 0 ? `$${pesosTxto}` : `$${pesosTxto}.${String(c).padStart(2, '0')}`;
  return negativo ? `-${txt}` : txt;
}

  return { aCentavos, aPesos, formatoMoneda };
})();
const aCentavos = dinero.aCentavos;
const aPesos = dinero.aPesos;
const formatoMoneda = dinero.formatoMoneda;

// ── js/cambio.js ──────────────────────────────────────────
const cambio = (function () {
// Cambio simple: lo que el cliente da, menos el total. Nada más -- se probó
// una versión que sugería "pídele $X más" para que el cambio saliera en
// billetes limpios, y no era lo que Miguel quería ("ya no vamos a pedir
// nada"). Se quitó a propósito; si hace falta, está en el historial de git.

function calcularCambio(totalCentavos, recibidoCentavos) {
  return Math.max(0, recibidoCentavos - totalCentavos);
}

  return { calcularCambio };
})();
const calcularCambio = cambio.calcularCambio;

// ── js/modelo.js ──────────────────────────────────────────
const modelo = (function () {
// Forma de los datos, IDs y fechas. Sin DOM, sin storage.

function hoyISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function horaISO(fecha = new Date()) {
  return fecha.toTimeString().slice(0, 8);
}

// ID único sin depender de red: fecha + azar. Suficiente para no chocar
// entre dispositivos distintos (se vuelve importante en la Fase 2, nube).
function crearId(prefijo) {
  const azar = Math.random().toString(36).slice(2, 8);
  return `${prefijo}_${Date.now().toString(36)}${azar}`;
}

  return { hoyISO, horaISO, crearId };
})();
const hoyISO = modelo.hoyISO;
const horaISO = modelo.horaISO;
const crearId = modelo.crearId;

// ── js/catalogo.js ──────────────────────────────────────────
const catalogo = (function () {
// El catálogo de productos: qué aparece en la cuadrícula, en qué orden, y a
// qué precio. Vive en localStorage (es chico -- unas cuantas docenas de
// renglones), a diferencia de los tickets, que van a IndexedDB.
//
// Regla dura del diseño (ver docs/CALCULADORA.md): las posiciones de la
// cuadrícula NUNCA se reordenan solas por frecuencia de venta -- las mueve
// él, a mano, y se quedan quietas. Aquí solo se guarda/lee ese orden.

const CLAVE = 'taq_catalogo';
const CUPO_CUADRICULA = 11; // + el botón "Más…", que no es un producto

// Precios de relleno, MARCADOS como tales (precioPlaceholder: true) -- la
// app no deja cobrar con ellos hasta que se confirmen en Ajustes. Números
// típicos de taquería de Tijuana, para que la cuadrícula no se vea vacía
// desde el primer arranque.
const CATALOGO_INICIAL = [
  { nombre: 'Taco adobada', categoria: 'Tacos', precio: 18, posicion: 0 },
  { nombre: 'Taco asada', categoria: 'Tacos', precio: 20, posicion: 1 },
  { nombre: 'Taco tripa', categoria: 'Tacos', precio: 20, posicion: 2 },
  { nombre: 'Taco cabeza', categoria: 'Tacos', precio: 20, posicion: 3 },
  { nombre: 'Taco lengua', categoria: 'Tacos', precio: 25, posicion: 4 },
  { nombre: 'Taco chorizo', categoria: 'Tacos', precio: 18, posicion: 5 },
  { nombre: 'Mulita', categoria: 'Especialidades', precio: 35, posicion: 6 },
  { nombre: 'Quesadilla', categoria: 'Especialidades', precio: 30, posicion: 7 },
  { nombre: 'Vampiro', categoria: 'Especialidades', precio: 35, posicion: 8 },
  { nombre: 'Torta', categoria: 'Especialidades', precio: 55, posicion: 9 },
  { nombre: 'Volcán', categoria: 'Especialidades', precio: 35, posicion: 10 },
  { nombre: 'Sope', categoria: 'Especialidades', precio: 30, posicion: null },
  { nombre: 'Burrito', categoria: 'Especialidades', precio: 45, posicion: null },
  { nombre: 'Costra', categoria: 'Especialidades', precio: 45, posicion: null },
  { nombre: 'Papas', categoria: 'Extras', precio: 30, posicion: null },
  { nombre: 'Consomé', categoria: 'Extras', precio: 20, posicion: null },
  { nombre: 'Orden de carne', categoria: 'Extras', precio: 60, posicion: null },
  { nombre: 'Refresco', categoria: 'Bebidas', precio: 20, posicion: null },
  { nombre: 'Agua fresca', categoria: 'Bebidas', precio: 18, posicion: null },
];

function catalogoDeFabrica() {
  return CATALOGO_INICIAL.map((p, i) => ({
    id: crearId('prod'),
    nombre: p.nombre,
    categoria: p.categoria,
    precioCentavos: aCentavos(p.precio),
    posicion: p.posicion,
    activo: true,
    precioPlaceholder: true,
    ordenOculto: p.posicion === null ? i : null,
  }));
}

function leerJSON(clave, porDefecto) {
  try {
    const crudo = localStorage.getItem(clave);
    return crudo ? JSON.parse(crudo) : porDefecto;
  } catch {
    return porDefecto;
  }
}

function obtenerCatalogo() {
  const existente = leerJSON(CLAVE, null);
  if (existente) return existente;
  const inicial = catalogoDeFabrica();
  guardarCatalogo(inicial);
  return inicial;
}

function guardarCatalogo(productos) {
  localStorage.setItem(CLAVE, JSON.stringify(productos));
}

function productosVisibles(catalogo) {
  return catalogo
    .filter((p) => p.activo && p.posicion != null)
    .sort((a, b) => a.posicion - b.posicion);
}

function productosOcultos(catalogo) {
  return catalogo
    .filter((p) => p.activo && p.posicion == null)
    .sort((a, b) => (a.ordenOculto ?? 0) - (b.ordenOculto ?? 0));
}

function cupoLibreEnCuadricula(catalogo) {
  return CUPO_CUADRICULA - productosVisibles(catalogo).length;
}

// Hay que resolver esto ANTES de dejar cobrar -- ver la sección "al primer
// arranque" de docs/CALCULADORA.md.
function tienePreciosPendientes(catalogo) {
  return catalogo.some((p) => p.activo && p.precioPlaceholder);
}

function productosPendientes(catalogo) {
  return catalogo.filter((p) => p.activo && p.precioPlaceholder);
}

function confirmarPrecio(catalogo, id, precioPesos) {
  return catalogo.map((p) =>
    p.id === id ? { ...p, precioCentavos: aCentavos(Number(precioPesos)), precioPlaceholder: false } : p
  );
}

// Nombre distinto al agregarProducto() de ticket.js a propósito -- build.py
// junta todo en globales sueltas por paquete y dos exports con el mismo
// nombre chocarían (build.py lo detecta y para en seco, pero mejor no
// arriesgarse a que alguien lo "arregle" renombrando el import).
function agregarProductoCatalogo(catalogo, { nombre, categoria, precioPesos, aCuadricula }) {
  const enCuadricula = aCuadricula && cupoLibreEnCuadricula(catalogo) > 0;
  const nuevo = {
    id: crearId('prod'),
    nombre: nombre.trim(),
    categoria: categoria || 'Otros',
    precioCentavos: aCentavos(Number(precioPesos) || 0),
    posicion: enCuadricula ? productosVisibles(catalogo).length : null,
    activo: true,
    precioPlaceholder: false,
    ordenOculto: enCuadricula ? null : productosOcultos(catalogo).length,
  };
  return [...catalogo, nuevo];
}

function editarProducto(catalogo, id, cambios) {
  return catalogo.map((p) => {
    if (p.id !== id) return p;
    const actualizado = { ...p, ...cambios };
    if (cambios.precioPesos != null) {
      actualizado.precioCentavos = aCentavos(Number(cambios.precioPesos));
      actualizado.precioPlaceholder = false;
    }
    return actualizado;
  });
}

function desactivarProducto(catalogo, id) {
  return catalogo.map((p) => (p.id === id ? { ...p, activo: false, posicion: null } : p));
}

// Recibe el nuevo orden completo de IDs visibles (lo que sea que haya
// quedado tras arrastrar) y reescribe `posicion` 0..n-1. No toca los ocultos.
function reordenarCuadricula(catalogo, idsEnOrden) {
  const posicionPorId = new Map(idsEnOrden.map((id, i) => [id, i]));
  return catalogo.map((p) => (posicionPorId.has(p.id) ? { ...p, posicion: posicionPorId.get(p.id) } : p));
}

function moverACuadricula(catalogo, id) {
  if (cupoLibreEnCuadricula(catalogo) <= 0) return catalogo;
  const posicion = productosVisibles(catalogo).length;
  return catalogo.map((p) => (p.id === id ? { ...p, posicion, ordenOculto: null } : p));
}

function moverAOcultos(catalogo, id) {
  const ordenOculto = productosOcultos(catalogo).length;
  const sinEste = catalogo.map((p) => (p.id === id ? { ...p, posicion: null, ordenOculto } : p));
  // Recompacta las posiciones de lo que queda visible para no dejar huecos.
  const idsVisibles = productosVisibles(sinEste).map((p) => p.id);
  return reordenarCuadricula(sinEste, idsVisibles);
}

  return { obtenerCatalogo, guardarCatalogo, productosVisibles, productosOcultos, cupoLibreEnCuadricula, tienePreciosPendientes, productosPendientes, confirmarPrecio, agregarProductoCatalogo, editarProducto, desactivarProducto, reordenarCuadricula, moverACuadricula, moverAOcultos };
})();
const obtenerCatalogo = catalogo.obtenerCatalogo;
const guardarCatalogo = catalogo.guardarCatalogo;
const productosVisibles = catalogo.productosVisibles;
const productosOcultos = catalogo.productosOcultos;
const cupoLibreEnCuadricula = catalogo.cupoLibreEnCuadricula;
const tienePreciosPendientes = catalogo.tienePreciosPendientes;
const productosPendientes = catalogo.productosPendientes;
const confirmarPrecio = catalogo.confirmarPrecio;
const agregarProductoCatalogo = catalogo.agregarProductoCatalogo;
const editarProducto = catalogo.editarProducto;
const desactivarProducto = catalogo.desactivarProducto;
const reordenarCuadricula = catalogo.reordenarCuadricula;
const moverACuadricula = catalogo.moverACuadricula;
const moverAOcultos = catalogo.moverAOcultos;

// ── js/ticket.js ──────────────────────────────────────────
const ticket = (function () {
// El carrito en construcción -- lo que se va tocando antes de cobrar. Puro:
// recibe el carrito y regresa uno nuevo, nunca muta. Sin DOM, sin storage.

function crearCarrito() {
  return [];
}

function agregarProducto(carrito, producto, cantidad = 1) {
  const existente = carrito.find((l) => l.productoId === producto.id);
  if (existente) {
    return carrito.map((l) =>
      l.productoId === producto.id ? { ...l, cantidad: l.cantidad + cantidad } : l
    );
  }
  return [
    ...carrito,
    {
      productoId: producto.id,
      nombre: producto.nombre,
      precioUnitarioCentavos: producto.precioCentavos,
      cantidad,
      esLibre: false,
    },
  ];
}

// El botón "$ libre" para lo que no está en el catálogo -- cada uno es su
// propia línea (no se suman entre sí, cada orden especial puede ser distinta).
function agregarLibre(carrito, montoCentavos, nota = '$ libre') {
  return [
    ...carrito,
    {
      productoId: `libre_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      nombre: nota,
      precioUnitarioCentavos: montoCentavos,
      cantidad: 1,
      esLibre: true,
    },
  ];
}

function quitarUno(carrito, productoId) {
  return carrito
    .map((l) => (l.productoId === productoId ? { ...l, cantidad: l.cantidad - 1 } : l))
    .filter((l) => l.cantidad > 0);
}

function establecerCantidad(carrito, productoId, cantidad) {
  const n = Math.max(0, Math.floor(cantidad));
  if (n === 0) return quitarLinea(carrito, productoId);
  return carrito.map((l) => (l.productoId === productoId ? { ...l, cantidad: n } : l));
}

function quitarLinea(carrito, productoId) {
  return carrito.filter((l) => l.productoId !== productoId);
}

function cantidadDe(carrito, productoId) {
  return carrito.find((l) => l.productoId === productoId)?.cantidad || 0;
}

function totalCentavos(carrito) {
  return carrito.reduce((acc, l) => acc + l.precioUnitarioCentavos * l.cantidad, 0);
}

function cantidadTotalPiezas(carrito) {
  return carrito.reduce((acc, l) => acc + l.cantidad, 0);
}

function estaVacio(carrito) {
  return carrito.length === 0;
}

// Texto compacto para el renglón del ticket: "3 adobada · 1 mulita · 1 refresco".
function resumenTexto(carrito) {
  return carrito.map((l) => `${l.cantidad} ${l.nombre}`).join(' · ');
}

  return { crearCarrito, agregarProducto, agregarLibre, quitarUno, establecerCantidad, quitarLinea, cantidadDe, totalCentavos, cantidadTotalPiezas, estaVacio, resumenTexto };
})();
const crearCarrito = ticket.crearCarrito;
const agregarProducto = ticket.agregarProducto;
const agregarLibre = ticket.agregarLibre;
const quitarUno = ticket.quitarUno;
const establecerCantidad = ticket.establecerCantidad;
const quitarLinea = ticket.quitarLinea;
const cantidadDe = ticket.cantidadDe;
const totalCentavos = ticket.totalCentavos;
const cantidadTotalPiezas = ticket.cantidadTotalPiezas;
const estaVacio = ticket.estaVacio;
const resumenTexto = ticket.resumenTexto;

// ── js/almacen.js ──────────────────────────────────────────
const almacen = (function () {
// Guarda los tickets en IndexedDB (no localStorage -- una taquería hace
// 150-300 tickets al día, y localStorage son ~5 MB, se llenaría en meses).
// La configuración chica (catálogo, ajustes) sigue en localStorage, en
// catalogo.js.

const NOMBRE_DB = 'taqueria';
const VERSION_DB = 2;
const ALMACEN_TICKETS = 'tickets';
const ALMACEN_ORDENES = 'ordenes';

let dbPromesa = null;

function abrirDB() {
  if (dbPromesa) return dbPromesa;
  dbPromesa = new Promise((resolve, reject) => {
    const req = indexedDB.open(NOMBRE_DB, VERSION_DB);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ALMACEN_TICKETS)) {
        const store = db.createObjectStore(ALMACEN_TICKETS, { keyPath: 'id' });
        store.createIndex('porFecha', 'fecha', { unique: false });
        store.createIndex('porTs', 'ts', { unique: false });
      }
      if (!db.objectStoreNames.contains(ALMACEN_ORDENES)) {
        const ordenes = db.createObjectStore(ALMACEN_ORDENES, { keyPath: 'id' });
        ordenes.createIndex('porEstado', 'estado', { unique: false });
        ordenes.createIndex('porTs', 'creada', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromesa;
}

async function conStore(modo, fn) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ALMACEN_TICKETS, modo);
    const store = tx.objectStore(ALMACEN_TICKETS);
    const resultado = fn(store);
    tx.oncomplete = () => resolve(resultado.result ?? resultado);
    tx.onerror = () => reject(tx.error);
  });
}

async function guardarTicket(ticket) {
  await conStore('readwrite', (store) => store.put(ticket));
  return ticket;
}

async function borrarTicket(id) {
  await conStore('readwrite', (store) => store.delete(id));
}

async function obtenerTicket(id) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ALMACEN_TICKETS, 'readonly');
    const req = tx.objectStore(ALMACEN_TICKETS).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function listarTicketsPorFecha(fechaISO) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ALMACEN_TICKETS, 'readonly');
    const idx = tx.objectStore(ALMACEN_TICKETS).index('porFecha');
    const req = idx.getAll(fechaISO);
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => b.ts - a.ts));
    req.onerror = () => reject(req.error);
  });
}

async function listarTodos() {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ALMACEN_TICKETS, 'readonly');
    const req = tx.objectStore(ALMACEN_TICKETS).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function guardarOrden(orden) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ALMACEN_ORDENES, 'readwrite');
    tx.objectStore(ALMACEN_ORDENES).put(orden);
    tx.oncomplete = () => resolve(orden);
    tx.onerror = () => reject(tx.error);
  });
}

async function listarOrdenesActivas() {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ALMACEN_ORDENES, 'readonly');
    const req = tx.objectStore(ALMACEN_ORDENES).getAll();
    req.onsuccess = () => resolve((req.result || []).filter((o) => o.estado !== 'cobrada' && o.estado !== 'cancelada').sort((a, b) => a.creada - b.creada));
    req.onerror = () => reject(req.error);
  });
}

  return { guardarTicket, borrarTicket, obtenerTicket, listarTicketsPorFecha, listarTodos, guardarOrden, listarOrdenesActivas };
})();
const guardarTicket = almacen.guardarTicket;
const borrarTicket = almacen.borrarTicket;
const obtenerTicket = almacen.obtenerTicket;
const listarTicketsPorFecha = almacen.listarTicketsPorFecha;
const listarTodos = almacen.listarTodos;
const guardarOrden = almacen.guardarOrden;
const listarOrdenesActivas = almacen.listarOrdenesActivas;

// ── js/cronometro.js ──────────────────────────────────────────
const cronometro = (function () {
// Mide qué tan rápido se captura cada ticket -- no de oídas, con números
// (ver docs/CALCULADORA.md, sección 9). Arranca en el primer toque sobre un
// carrito vacío y se detiene al cobrar. Nunca sale del dispositivo.

const CLAVE_DURACIONES = 'taq_duraciones_ms';
const MAX_GUARDADAS = 500;

function ahora() {
  return performance.now();
}

function leer() {
  try {
    const crudo = localStorage.getItem(CLAVE_DURACIONES);
    return crudo ? JSON.parse(crudo) : [];
  } catch {
    return [];
  }
}

function guardar(lista) {
  localStorage.setItem(CLAVE_DURACIONES, JSON.stringify(lista.slice(-MAX_GUARDADAS)));
}

function registrarDuracion(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return;
  const lista = leer();
  lista.push(Math.round(ms));
  guardar(lista);
}

function percentil(valoresOrdenados, p) {
  if (!valoresOrdenados.length) return 0;
  const idx = Math.min(valoresOrdenados.length - 1, Math.floor(p * valoresOrdenados.length));
  return valoresOrdenados[idx];
}

function estadisticas() {
  const lista = leer().slice().sort((a, b) => a - b);
  if (!lista.length) return { cantidad: 0, medianaMs: 0, peor10Ms: 0 };
  return {
    cantidad: lista.length,
    medianaMs: percentil(lista, 0.5),
    peor10Ms: percentil(lista, 0.9),
  };
}

function reiniciarMedicion() {
  localStorage.removeItem(CLAVE_DURACIONES);
}

  return { ahora, registrarDuracion, estadisticas, reiniciarMedicion };
})();
const ahora = cronometro.ahora;
const registrarDuracion = cronometro.registrarDuracion;
const estadisticas = cronometro.estadisticas;
const reiniciarMedicion = cronometro.reiniciarMedicion;

// ── js/sesion.js ──────────────────────────────────────────
const sesion = (function () {
const CLAVE_CARRITO = 'taq_carrito_en_curso';
const CLAVE_PRACTICA = 'taq_modo_practica';
const INACTIVIDAD_PRACTICA_MS = 30 * 60 * 1000;
const INACTIVIDAD_CARRITO_MS = 5 * 60 * 1000;

function restaurarCarrito(estado) {
  if (!estado || !Array.isArray(estado.lineas)) return [];
  return estado.lineas.filter((l) => l && l.productoId && l.nombre && Number.isInteger(l.precioUnitarioCentavos) && Number.isInteger(l.cantidad) && l.cantidad > 0);
}

function guardarCarritoEnCurso(lineas) {
  localStorage.setItem(CLAVE_CARRITO, JSON.stringify({ lineas, tocadoMs: Date.now() }));
}

function cargarCarritoEnCurso() {
  try { return restaurarCarrito(JSON.parse(localStorage.getItem(CLAVE_CARRITO))); } catch { return []; }
}

function borrarCarritoEnCurso() { localStorage.removeItem(CLAVE_CARRITO); }

function modoPracticaActivo(estado, ahoraMs = Date.now()) {
  return Boolean(estado && estado.fecha === new Date(ahoraMs).toISOString().slice(0, 10) && ahoraMs - estado.tocadoMs < INACTIVIDAD_PRACTICA_MS);
}

function carritoOlvidado(lineas, ultimoCambioMs, ahoraMs = Date.now()) {
  return Array.isArray(lineas) && lineas.length > 0 && ahoraMs - ultimoCambioMs >= INACTIVIDAD_CARRITO_MS;
}

function cargarModoPractica() {
  try {
    const estado = JSON.parse(localStorage.getItem(CLAVE_PRACTICA));
    return modoPracticaActivo(estado);
  } catch { return false; }
}

function guardarModoPractica(activo) {
  if (!activo) { localStorage.removeItem(CLAVE_PRACTICA); return; }
  localStorage.setItem(CLAVE_PRACTICA, JSON.stringify({ fecha: new Date().toISOString().slice(0, 10), tocadoMs: Date.now() }));
}

function corregirTicket(ticket, { totalCentavos, lineas, motivo, autor, ahoraMs = Date.now() }) {
  const correcciones = ticket.correcciones || [];
  return { ...ticket, totalCentavos, lineas, modificado: ahoraMs, correcciones: [...correcciones, { totalAnteriorCentavos: ticket.totalCentavos, motivo, autor, ts: ahoraMs }] };
}

function cancelarTicket(ticket, { motivo, autor, ahoraMs = Date.now() }) {
  return { ...ticket, cancelado: true, modificado: ahoraMs, cancelacion: { motivo, autor, ts: ahoraMs } };
}

  return { restaurarCarrito, guardarCarritoEnCurso, cargarCarritoEnCurso, borrarCarritoEnCurso, modoPracticaActivo, carritoOlvidado, cargarModoPractica, guardarModoPractica, corregirTicket, cancelarTicket };
})();
const restaurarCarrito = sesion.restaurarCarrito;
const guardarCarritoEnCurso = sesion.guardarCarritoEnCurso;
const cargarCarritoEnCurso = sesion.cargarCarritoEnCurso;
const borrarCarritoEnCurso = sesion.borrarCarritoEnCurso;
const modoPracticaActivo = sesion.modoPracticaActivo;
const carritoOlvidado = sesion.carritoOlvidado;
const cargarModoPractica = sesion.cargarModoPractica;
const guardarModoPractica = sesion.guardarModoPractica;
const corregirTicket = sesion.corregirTicket;
const cancelarTicket = sesion.cancelarTicket;

// ── js/sincronizacion.js ──────────────────────────────────────────
const sincronizacion = (function () {
function encolarOperacion(cola, operacion) {
  const clave = `${operacion.tipo}:${operacion.id}`;
  return [...cola.filter((item) => `${item.tipo}:${item.id}` !== clave), operacion];
}

function confirmarOperaciones(cola, idsConfirmados) {
  const confirmados = new Set(idsConfirmados);
  return cola.filter((item) => !confirmados.has(item.id));
}

function fusionarPorModificado(local, remoto) {
  const porId = new Map();
  for (const item of [...remoto, ...local]) {
    const anterior = porId.get(item.id);
    if (!anterior || item.modificado >= anterior.modificado) porId.set(item.id, item);
  }
  return [...porId.values()];
}

  return { encolarOperacion, confirmarOperaciones, fusionarPorModificado };
})();
const encolarOperacion = sincronizacion.encolarOperacion;
const confirmarOperaciones = sincronizacion.confirmarOperaciones;
const fusionarPorModificado = sincronizacion.fusionarPorModificado;

// ── js/cola.js ──────────────────────────────────────────
const cola = (function () {
const CLAVE = 'taq_cola_sincronizacion';

function leerCola() { try { return JSON.parse(localStorage.getItem(CLAVE)) || []; } catch { return []; } }
function guardarCola(cola) { localStorage.setItem(CLAVE, JSON.stringify(cola)); }
function encolar(tipo, entidad) { const cola = encolarOperacion(leerCola(), { tipo, id: entidad.id, modificado: entidad.modificado || Date.now(), entidad }); guardarCola(cola); return cola; }
function confirmar(ids) { const cola = confirmarOperaciones(leerCola(), ids); guardarCola(cola); return cola; }

  return { leerCola, guardarCola, encolar, confirmar };
})();
const leerCola = cola.leerCola;
const guardarCola = cola.guardarCola;
const encolar = cola.encolar;
const confirmar = cola.confirmar;

// ── js/api.js ──────────────────────────────────────────
const api = (function () {
const CLAVE_API = 'taq_api_url';
const CLAVE_DISPOSITIVO = 'taq_dispositivo';
const URL_SERVIDOR = 'https://script.google.com/macros/s/AKfycbwR0aIV5Kkxf4HgThFlR0K8NASMC06ZtUP5N5D4eqapObQk3QCWnzAthTrhsbqb4g_8Yw/exec';

function urlApi() { return URL_SERVIDOR; }
function guardarUrlApi(url) { localStorage.setItem(CLAVE_API, url.trim()); }
function dispositivo() { try { return JSON.parse(localStorage.getItem(CLAVE_DISPOSITIVO)); } catch { return null; } }
function guardarDispositivo(nombre) { const dato = { id: crypto.randomUUID(), nombre: nombre.trim() }; localStorage.setItem(CLAVE_DISPOSITIVO, JSON.stringify(dato)); return dato; }
async function llamarApi(datos) {
  const url = urlApi(); if (!url) throw new Error('Falta la URL del backend');
  const respuesta = await fetch(url, { method: 'POST', body: JSON.stringify(datos), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
  const cuerpo = await respuesta.json(); if (!cuerpo.ok) throw new Error(cuerpo.error || 'El servidor rechazó la solicitud'); return cuerpo;
}

  return { urlApi, guardarUrlApi, dispositivo, guardarDispositivo, llamarApi };
})();
const urlApi = api.urlApi;
const guardarUrlApi = api.guardarUrlApi;
const dispositivo = api.dispositivo;
const guardarDispositivo = api.guardarDispositivo;
const llamarApi = api.llamarApi;

// ── js/ordenes.js ──────────────────────────────────────────
const ordenes = (function () {
const NIVEL = { cola: 0, entregada: 1, cobrada: 2, cancelada: 2 };

function crearOrden({ id, platos, ahoraMs = Date.now(), dispositivo = '' }) {
  return { id, platos, estado: 'cola', creada: ahoraMs, modificado: ahoraMs, dispositivo, entregada: null, cobrada: null };
}

function avanzarOrden(orden, estado, ahoraMs = Date.now()) {
  if (!(estado in NIVEL) || NIVEL[estado] < NIVEL[orden.estado]) return orden;
  if (orden.estado === 'cobrada' || orden.estado === 'cancelada') return orden;
  return { ...orden, estado, modificado: ahoraMs, entregada: estado === 'entregada' ? ahoraMs : orden.entregada, cobrada: estado === 'cobrada' ? ahoraMs : orden.cobrada };
}

function esCobrable(orden) { return orden.estado === 'entregada'; }

  return { crearOrden, avanzarOrden, esCobrable };
})();
const crearOrden = ordenes.crearOrden;
const avanzarOrden = ordenes.avanzarOrden;
const esCobrable = ordenes.esCobrable;

// ── js/version.js ──────────────────────────────────────────
const version = (function () {
// Generado por build.py — no editar.
const VERSION_DEPLOY = '2026-08-06T04:32:18Z';

  return { VERSION_DEPLOY };
})();
const VERSION_DEPLOY = version.VERSION_DEPLOY;

// ── js/ui.js ──────────────────────────────────────────
// Punto de entrada: pinta pantallas y cablea eventos. Nada se exporta (igual
// que peso/js/ui.js en MIS APPS) -- build.py lo mete tal cual, al final del
// paquete.

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
let cobroConfirmado = false;
let ordenCobrando = null;

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
  if (estaVacio(carrito)) borrarCarritoEnCurso(); else guardarCarritoEnCurso(carrito);
  const total = totalCentavos(carrito);
  $('total-grande').textContent = formatoMoneda(total);
  if (total > 0) mostrar($('btn-guardar-orden')); else ocultar($('btn-guardar-orden'));
  renderTicketLineas();
  renderCuadricula();
  renderPago();
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
  const actual = cantidadDe(carrito, producto.id);
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
}

function renderConexion() {
  const cola = leerCola();
  $('version-deploy').textContent = `Versión instalada: ${new Date(VERSION_DEPLOY).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}`;
  $('estado-sincronizacion').textContent = cola.length ? `${cola.length} operación(es) esperando respaldo.` : 'Respaldo automático en Drive activo.';
  const ultima = Number(localStorage.getItem('taq_ultima_actualizacion') || 0);
  $('ultima-actualizacion').textContent = ultima ? `Última actualización: ${new Date(ultima).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Aún no hay una actualización correcta con Drive.';
}

async function sincronizarAhora() {
  if (sincronizando || !urlApi()) return;
  const d = dispositivo(); if (!d) { mostrar($('modal-operador')); return; }
  sincronizando = true;
  try {
    await llamarApi({ accion: 'registrarDispositivo', ...d });
    const respuesta = await llamarApi({ accion: 'sincronizar', dispositivo: d, operaciones: leerCola() });
    confirmar(respuesta.confirmadas || []);
    localStorage.setItem('taq_ultima_actualizacion', String(Date.now()));
    if (respuesta.productos?.length) { catalogoActual = respuesta.productos; guardarCatalogo(catalogoActual); renderCobrar(); }
  } catch { /* La cola local queda intacta y se reintenta al recuperar señal. */ }
  finally { sincronizando = false; if ($('vista-ajustes').classList.contains('activa')) renderConexion(); }
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
    if (manija === fila && e.target.closest('input, button')) return;
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
    guardarCatalogo(catalogoActual);
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

async function guardarComoOrden() {
  if (estaVacio(carrito)) return;
  const orden = crearOrden({ id: crearId('ord'), platos: [{ lineas: carrito, sin: [] }], dispositivo: dispositivo()?.nombre || '' });
  await guardarOrden(orden); encolar('orden', orden); sincronizarAhora();
  carrito = crearCarrito(); borrarCarritoEnCurso(); inicioTicketMs = null; renderCobrar(); abrirOrdenes();
}

async function abrirOrdenes() {
  const cont = $('lista-ordenes'); const ordenes = await listarOrdenesActivas(); cont.innerHTML = '';
  if (!ordenes.length) cont.innerHTML = '<p class="texto-suave">No hay órdenes pendientes.</p>';
  for (const orden of ordenes) {
    const tarjeta = document.createElement('div'); tarjeta.className = 'tarjeta-orden';
    const detalle = orden.platos.flatMap((p) => p.lineas).map((l) => `${l.cantidad} × ${l.nombre}`).join(' · ');
    tarjeta.innerHTML = `<strong>Orden ${orden.id.slice(-4)}</strong><p>${detalle}</p><p class="texto-suave">${orden.estado === 'cola' ? 'En preparación' : 'Entregada — falta cobrar'}</p>`;
    if (orden.estado === 'cola') {
      const entregar = document.createElement('button'); entregar.className = 'btn-secundario'; entregar.textContent = 'Marcar entregada';
      entregar.addEventListener('click', async () => { const actualizada = avanzarOrden(orden, 'entregada'); await guardarOrden(actualizada); encolar('orden', actualizada); sincronizarAhora(); abrirOrdenes(); }); tarjeta.appendChild(entregar);
    } else if (esCobrable(orden)) {
      const cobrarOrden = document.createElement('button'); cobrarOrden.className = 'btn-primario'; cobrarOrden.textContent = 'Cobrar esta orden';
      cobrarOrden.addEventListener('click', () => { carrito = orden.platos.flatMap((p) => p.lineas); ordenCobrando = orden; ocultar($('modal-ordenes')); renderCobrar(); abrirModalCobro(); }); tarjeta.appendChild(cobrarOrden);
    }
    cont.appendChild(tarjeta);
  }
  mostrar($('modal-ordenes'));
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
$('btn-guardar-orden').addEventListener('click', guardarComoOrden);
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
  if (!productoEditando) return;
  const nombre = $('editar-nombre').value.trim();
  const precioPesos = Number($('editar-precio').value);
  if (!nombre || precioPesos <= 0) return;
  catalogoActual = editarProducto(catalogoActual, productoEditando.id, { nombre, precioPesos, categoria: $('editar-categoria').value.trim() });
  const estaba = productoEditando.posicion != null;
  const quiere = $('editar-cuadricula').checked;
  if (quiere && !estaba) catalogoActual = moverACuadricula(catalogoActual, productoEditando.id);
  if (!quiere && estaba) catalogoActual = moverAOcultos(catalogoActual, productoEditando.id);
  guardarCatalogo(catalogoActual); ocultar($('modal-producto')); renderAjustes(); renderCobrar();
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
  guardarModoPractica(modoPractica);
  renderBannerPractica();
});
$('btn-reiniciar-medicion').addEventListener('click', () => {
  if (window.confirm('¿Borrar la medición de velocidad guardada hasta ahora?')) {
    reiniciarMedicion();
    renderVelocidad();
  }
});
$('btn-sincronizar').addEventListener('click', sincronizarAhora);
$('btn-registrar-operador').addEventListener('click', async () => {
  const nombre = $('operador-nombre').value.trim(); if (!nombre) return;
  guardarDispositivo(nombre); ocultar($('modal-operador')); await sincronizarAhora();
});

function abrirHojaMas() {
  const cont = $('lista-mas');
  cont.innerHTML = '';
  for (const producto of productosOcultos(catalogoActual)) {
    const btn = document.createElement('button');
    btn.className = 'btn-producto';
    btn.innerHTML = `<span class="nombre">${escapeHtml(producto.nombre)}</span><span class="precio">${formatoMoneda(producto.precioCentavos)}</span>`;
    const cant = cantidadDe(carrito, producto.id);
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
if (!dispositivo()) mostrar($('modal-operador')); else sincronizarAhora();
window.addEventListener('online', sincronizarAhora);
setInterval(sincronizarAhora, 30000);

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
