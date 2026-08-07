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
const VERSION_DB = 3;
const ALMACEN_TICKETS = 'tickets';
const ALMACEN_ORDENES = 'ordenes';
const ALMACEN_COMPRAS = 'compras';
const ALMACEN_GASTOS = 'gastos';

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
      [ALMACEN_COMPRAS, ALMACEN_GASTOS].forEach((nombre) => {
        if (!db.objectStoreNames.contains(nombre)) {
          const store = db.createObjectStore(nombre, { keyPath: 'id' });
          store.createIndex('porFecha', 'fecha', { unique: false });
        }
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromesa;
}

async function conStore(modo, fn, nombre = ALMACEN_TICKETS) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(nombre, modo);
    const store = tx.objectStore(nombre);
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

async function guardarMovimiento(nombre, movimiento) { await conStore('readwrite', (store) => store.put(movimiento), nombre); return movimiento; }
async function listarMovimientos(nombre, fecha) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(nombre, 'readonly');
    const req = fecha ? tx.objectStore(nombre).index('porFecha').getAll(fecha) : tx.objectStore(nombre).getAll();
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => Number(b.modificado) - Number(a.modificado)));
    req.onerror = () => reject(req.error);
  });
}
function guardarCompra(compra) { return guardarMovimiento(ALMACEN_COMPRAS, compra); }
function guardarGasto(gasto) { return guardarMovimiento(ALMACEN_GASTOS, gasto); }
function listarCompras(fecha) { return listarMovimientos(ALMACEN_COMPRAS, fecha); }
function listarGastos(fecha) { return listarMovimientos(ALMACEN_GASTOS, fecha); }

  return { guardarTicket, borrarTicket, obtenerTicket, listarTicketsPorFecha, listarTodos, guardarOrden, listarOrdenesActivas, guardarCompra, guardarGasto, listarCompras, listarGastos };
})();
const guardarTicket = almacen.guardarTicket;
const borrarTicket = almacen.borrarTicket;
const obtenerTicket = almacen.obtenerTicket;
const listarTicketsPorFecha = almacen.listarTicketsPorFecha;
const listarTodos = almacen.listarTodos;
const guardarOrden = almacen.guardarOrden;
const listarOrdenesActivas = almacen.listarOrdenesActivas;
const guardarCompra = almacen.guardarCompra;
const guardarGasto = almacen.guardarGasto;
const listarCompras = almacen.listarCompras;
const listarGastos = almacen.listarGastos;

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
const CLAVE_SESION = 'taq_sesion';
const URL_PREDETERMINADA = 'https://script.google.com/macros/s/AKfycbwR0aIV5Kkxf4HgThFlR0K8NASMC06ZtUP5N5D4eqapObQk3QCWnzAthTrhsbqb4g_8Yw/exec';

function urlApi() { return localStorage.getItem(CLAVE_API) || URL_PREDETERMINADA; }
function guardarUrlApi(url) { localStorage.setItem(CLAVE_API, url.trim()); }
function sesionApi() { try { return JSON.parse(localStorage.getItem(CLAVE_SESION)); } catch { return null; } }
function guardarSesion(datos) { localStorage.setItem(CLAVE_SESION, JSON.stringify(datos)); }
function cerrarSesion() { localStorage.removeItem(CLAVE_SESION); }
function dispositivo() { try { return JSON.parse(localStorage.getItem(CLAVE_DISPOSITIVO)); } catch { return null; } }
function guardarDispositivo(nombre) { const dato = { id: crypto.randomUUID(), nombre: nombre.trim() }; localStorage.setItem(CLAVE_DISPOSITIVO, JSON.stringify(dato)); return dato; }
async function llamarApi(datos) {
  const url = urlApi(); if (!url) throw new Error('Falta la URL del backend');
  const respuesta = await fetch(url, { method: 'POST', body: JSON.stringify(datos), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
  const cuerpo = await respuesta.json(); if (!cuerpo.ok) throw new Error(cuerpo.error || 'El servidor rechazó la solicitud'); return cuerpo;
}

  return { urlApi, guardarUrlApi, sesionApi, guardarSesion, cerrarSesion, dispositivo, guardarDispositivo, llamarApi };
})();
const urlApi = api.urlApi;
const guardarUrlApi = api.guardarUrlApi;
const sesionApi = api.sesionApi;
const guardarSesion = api.guardarSesion;
const cerrarSesion = api.cerrarSesion;
const dispositivo = api.dispositivo;
const guardarDispositivo = api.guardarDispositivo;
const llamarApi = api.llamarApi;

// ── js/acceso.js ──────────────────────────────────────────
const acceso = (function () {
const DURACION_DUENO_MS = 30 * 60 * 1000;

function crearSesion({ nombre, esDueno, ahoraMs = Date.now() }) {
  return { nombre: nombre.trim(), esDueno: Boolean(esDueno), iniciadaMs: ahoraMs };
}

function sesionVigente(sesion, ahoraMs = Date.now()) {
  return Boolean(sesion?.esDueno && ahoraMs - sesion.iniciadaMs < DURACION_DUENO_MS);
}

function puedeModificarCatalogo(sesion, ahoraMs = Date.now()) {
  return sesionVigente(sesion, ahoraMs);
}

  return { crearSesion, sesionVigente, puedeModificarCatalogo };
})();
const crearSesion = acceso.crearSesion;
const sesionVigente = acceso.sesionVigente;
const puedeModificarCatalogo = acceso.puedeModificarCatalogo;

// ── js/ordenes.js ──────────────────────────────────────────
const ordenes = (function () {
const NIVEL = { cola: 0, entregada: 1, cobrada: 2, cancelada: 2 };

function crearPlato(id) { return { id, lineas: [], sin: [] }; }
function agregarLineaAPlato(plato, producto) {
  const existe = plato.lineas.find((linea) => linea.productoId === producto.productoId);
  const lineas = existe ? plato.lineas.map((linea) => linea.productoId === producto.productoId ? { ...linea, cantidad: linea.cantidad + 1 } : linea) : [...plato.lineas, { ...producto, cantidad: 1 }];
  return { ...plato, lineas };
}
function alternarSin(plato, modificador) { return { ...plato, sin: plato.sin.includes(modificador) ? plato.sin.filter((x) => x !== modificador) : [...plato.sin, modificador] }; }
function separarTodo(platos) { return platos.flatMap((plato) => plato.lineas.flatMap((linea) => Array.from({ length: linea.cantidad }, (_, i) => ({ id: `${plato.id}-${i}`, lineas: [{ ...linea, cantidad: 1 }], sin: [...plato.sin] })))); }
function resumenComal(platos) {
  const total = new Map();
  platos.flatMap((plato) => plato.lineas).forEach((linea) => { const previo = total.get(linea.productoId) || { productoId: linea.productoId, nombre: linea.nombre, cantidad: 0 }; previo.cantidad += linea.cantidad; total.set(linea.productoId, previo); });
  return [...total.values()];
}

function crearOrden({ id, platos, ahoraMs = Date.now(), dispositivo = '' }) {
  return { id, platos, estado: 'cola', creada: ahoraMs, modificado: ahoraMs, dispositivo, entregada: null, cobrada: null };
}

function avanzarOrden(orden, estado, ahoraMs = Date.now()) {
  if (!(estado in NIVEL) || NIVEL[estado] < NIVEL[orden.estado]) return orden;
  if (orden.estado === 'cobrada' || orden.estado === 'cancelada') return orden;
  return { ...orden, estado, modificado: ahoraMs, entregada: estado === 'entregada' ? ahoraMs : orden.entregada, cobrada: estado === 'cobrada' ? ahoraMs : orden.cobrada };
}

function esCobrable(orden) { return orden.estado === 'entregada'; }

  return { crearPlato, agregarLineaAPlato, alternarSin, separarTodo, resumenComal, crearOrden, avanzarOrden, esCobrable };
})();
const crearPlato = ordenes.crearPlato;
const agregarLineaAPlato = ordenes.agregarLineaAPlato;
const alternarSin = ordenes.alternarSin;
const separarTodo = ordenes.separarTodo;
const resumenComal = ordenes.resumenComal;
const crearOrden = ordenes.crearOrden;
const avanzarOrden = ordenes.avanzarOrden;
const esCobrable = ordenes.esCobrable;

// ── js/gastos.js ──────────────────────────────────────────
const gastos = (function () {
// Investigado sobre lo que compra/gasta una taquería típica en México
// (PLAN.md §5 y §6, más lo estándar del giro): insumos vs. gastos fijos --
// son dos cosas distintas y por eso van en categorías separadas.
const CATEGORIAS_COMPRA = ['Carnes', 'Tortillas', 'Verduras y salsas', 'Abarrotes', 'Bebidas', 'Desechables', 'Gas', 'Hielo', 'Otro'];
const CATEGORIAS_GASTO = ['Renta', 'Luz', 'Agua', 'Nómina', 'Permisos', 'Mantenimiento', 'Transporte', 'Publicidad', 'Limpieza', 'Otro'];

function crearGasto({ id, fecha, categoria, concepto, totalCentavos, usuario, ahoraMs = Date.now() }) {
  return { id, fecha, categoria, concepto, totalCentavos, capturadaPor: usuario, modificado: ahoraMs };
}

function crearCompra({ id, fecha, categoria, totalCentavos, usuario, detalle = [], ahoraMs = Date.now() }) {
  return { id, fecha, categoria, totalCentavos, capturadaPor: usuario, detalle, modificado: ahoraMs };
}

// Agregar/renombrar/borrar categorías -- las de arriba son el punto de
// partida, no una lista cerrada. Solo se guardan las que él agregue (las de
// fábrica viven en el código, no en el storage) para no duplicar datos.
// Mismo patrón que catalogo.js/sesion.js: localStorage porque es chico.
const CLAVE_EXTRA_COMPRA = 'taq_categorias_compra_extra';
const CLAVE_EXTRA_GASTO = 'taq_categorias_gasto_extra';

function leerExtra(clave) {
  try { const lista = JSON.parse(localStorage.getItem(clave)); return Array.isArray(lista) ? lista : []; }
  catch { return []; }
}
function agregarExtra(clave, nombre) {
  const lista = leerExtra(clave);
  if (!lista.includes(nombre)) localStorage.setItem(clave, JSON.stringify([...lista, nombre]));
}
function quitarExtra(clave, nombre) {
  localStorage.setItem(clave, JSON.stringify(leerExtra(clave).filter((c) => c !== nombre)));
}
function renombrarExtra(clave, anterior, nuevo) {
  localStorage.setItem(clave, JSON.stringify(leerExtra(clave).map((c) => (c === anterior ? nuevo : c))));
}

function categoriasCompra() { return [...CATEGORIAS_COMPRA, ...leerExtra(CLAVE_EXTRA_COMPRA)]; }
function categoriasGasto() { return [...CATEGORIAS_GASTO, ...leerExtra(CLAVE_EXTRA_GASTO)]; }
function esCategoriaDeFabrica(tipo, nombre) { return (tipo === 'compra' ? CATEGORIAS_COMPRA : CATEGORIAS_GASTO).includes(nombre); }

function agregarCategoria(tipo, nombre) { agregarExtra(tipo === 'compra' ? CLAVE_EXTRA_COMPRA : CLAVE_EXTRA_GASTO, nombre); }
function quitarCategoria(tipo, nombre) { quitarExtra(tipo === 'compra' ? CLAVE_EXTRA_COMPRA : CLAVE_EXTRA_GASTO, nombre); }
function renombrarCategoria(tipo, anterior, nuevo) { renombrarExtra(tipo === 'compra' ? CLAVE_EXTRA_COMPRA : CLAVE_EXTRA_GASTO, anterior, nuevo); }

  return { CATEGORIAS_COMPRA, CATEGORIAS_GASTO, crearGasto, crearCompra, categoriasCompra, categoriasGasto, esCategoriaDeFabrica, agregarCategoria, quitarCategoria, renombrarCategoria };
})();
const CATEGORIAS_COMPRA = gastos.CATEGORIAS_COMPRA;
const CATEGORIAS_GASTO = gastos.CATEGORIAS_GASTO;
const crearGasto = gastos.crearGasto;
const crearCompra = gastos.crearCompra;
const categoriasCompra = gastos.categoriasCompra;
const categoriasGasto = gastos.categoriasGasto;
const esCategoriaDeFabrica = gastos.esCategoriaDeFabrica;
const agregarCategoria = gastos.agregarCategoria;
const quitarCategoria = gastos.quitarCategoria;
const renombrarCategoria = gastos.renombrarCategoria;

// ── js/reportes.js ──────────────────────────────────────────
const reportes = (function () {
function resumenCaja({ tickets = [], compras = [], gastos = [] }) {
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
function porCategoria(movimientos = []) {
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

function ventasPorProducto(tickets = []) {
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
function ventasPorHora(tickets = []) {
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
function ventasPorDia(tickets = []) {
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
function ticketPromedio(tickets = []) {
  const lista = vigentes(tickets);
  const totalCentavos = lista.reduce((acc, t) => acc + Number(t.totalCentavos || 0), 0);
  return { cantidadTickets: lista.length, promedioCentavos: lista.length ? Math.round(totalCentavos / lista.length) : 0 };
}

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// ¿El martes deja o solo cansa? Los 7 días siempre en el mismo orden, aunque
// no haya ventas ese día -- así se puede comparar a simple vista.
function ventasPorDiaSemana(tickets = []) {
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
function cobradoPorUsuario(tickets = []) {
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
function ventasPorMes(tickets = []) {
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
function resumenPorMes(tickets = [], compras = [], gastos = []) {
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
function puntoEquilibrio(compras = [], gastos = [], dias = 30) {
  const sumar = (lista) => lista.reduce((total, item) => total + Number(item.totalCentavos || 0), 0);
  const totalCentavos = sumar(compras) + sumar(gastos);
  return { diarioCentavos: dias ? Math.round(totalCentavos / dias) : 0, dias };
}

// Cuánto cambió contra el periodo anterior de igual tamaño -- "¿voy mejor o
// peor?", no solo el número solo.
function variacionPorcentaje(actual, anterior) {
  if (!anterior) return actual > 0 ? 100 : 0;
  return Math.round(((actual - anterior) / anterior) * 1000) / 10;
}

  return { resumenCaja, porCategoria, ventasPorProducto, ventasPorHora, ventasPorDia, ticketPromedio, ventasPorDiaSemana, cobradoPorUsuario, ventasPorMes, resumenPorMes, puntoEquilibrio, variacionPorcentaje };
})();
const resumenCaja = reportes.resumenCaja;
const porCategoria = reportes.porCategoria;
const ventasPorProducto = reportes.ventasPorProducto;
const ventasPorHora = reportes.ventasPorHora;
const ventasPorDia = reportes.ventasPorDia;
const ticketPromedio = reportes.ticketPromedio;
const ventasPorDiaSemana = reportes.ventasPorDiaSemana;
const cobradoPorUsuario = reportes.cobradoPorUsuario;
const ventasPorMes = reportes.ventasPorMes;
const resumenPorMes = reportes.resumenPorMes;
const puntoEquilibrio = reportes.puntoEquilibrio;
const variacionPorcentaje = reportes.variacionPorcentaje;

// ── js/version.js ──────────────────────────────────────────
const version = (function () {
// Generado por build.py — no editar.
const VERSION_DEPLOY = '2026-08-07T00:54:09Z';

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
