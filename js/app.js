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

// Denominaciones de efectivo en México, de mayor a menor. El sistema
// 1-2-5-10-20-50-100-200-500-1000 es "canónico" -- un algoritmo goloso
// (tomar siempre la pieza más grande que quepa) da SIEMPRE el mínimo número
// de piezas posible, así que no hace falta programar nada más sofisticado.
const DENOMINACIONES_CENTAVOS = [
  100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100,
]; // $1000, $500, $200, $100, $50, $20, $10, $5, $2, $1

// Billetes que un cliente normalmente trae para pagar (no monedas).
const BILLETES_CENTAVOS = [100000, 50000, 20000, 10000, 5000, 2000];

// Cuenta cuántas piezas (billetes/monedas) hacen falta para dar `centavos`
// de cambio, con el desglose. Goloso -- ver nota arriba sobre por qué es
// óptimo con estas denominaciones.
function desglosarPiezas(centavos) {
  let restante = Math.round(centavos);
  const piezas = [];
  for (const d of DENOMINACIONES_CENTAVOS) {
    const n = Math.floor(restante / d);
    if (n > 0) {
      piezas.push({ denominacion: d, cantidad: n });
      restante -= n * d;
    }
  }
  return piezas;
}

function contarPiezas(centavos) {
  if (centavos <= 0) return 0;
  return desglosarPiezas(centavos).reduce((acc, p) => acc + p.cantidad, 0);
}

// El billete más chico que ya cubre el total (para armar la fila de pago:
// EXACTO, el siguiente billete "natural", y el que sigue después de ése).
function siguienteBillete(totalCentavos) {
  return BILLETES_CENTAVOS.slice().reverse().find((b) => b >= totalCentavos) ?? null;
}

function billeteDespuesDe(billete) {
  const idx = BILLETES_CENTAVOS.indexOf(billete);
  if (idx <= 0) return null; // ya es el más grande, o no se encontró
  return BILLETES_CENTAVOS[idx - 1];
}

  return { aCentavos, aPesos, formatoMoneda, DENOMINACIONES_CENTAVOS, BILLETES_CENTAVOS, desglosarPiezas, contarPiezas, siguienteBillete, billeteDespuesDe };
})();
const aCentavos = dinero.aCentavos;
const aPesos = dinero.aPesos;
const formatoMoneda = dinero.formatoMoneda;
const DENOMINACIONES_CENTAVOS = dinero.DENOMINACIONES_CENTAVOS;
const BILLETES_CENTAVOS = dinero.BILLETES_CENTAVOS;
const desglosarPiezas = dinero.desglosarPiezas;
const contarPiezas = dinero.contarPiezas;
const siguienteBillete = dinero.siguienteBillete;
const billeteDespuesDe = dinero.billeteDespuesDe;

// ── js/cambio.js ──────────────────────────────────────────
const cambio = (function () {
// La "ayuda de cambio": el caso real que Miguel describió --
// total $403, el cliente saca $500 (cambio $97, puro menudo) -->
// la app sugiere "pídele $3 más, le regresas $100 de un billete".
//
// NO cambia el total ni lo que el cliente paga -- solo encuentra una
// combinación de billetes más cómoda para las dos partes.

// Cantidades chicas que un cliente podría plausiblemente traer sueltas,
// además de su billete -- en pesos completos, $1 a $20 ("pídele $3" es una
// combinación de monedas, un $2 y un $1, no billete/moneda único; probar
// solo denominaciones sueltas ($1/$2/$5/$10/$20) se le escapaba el caso real
// que Miguel describió). Arriba de $20 pedirle sueltos ya no tiene sentido
// -- si los trajera, habría pagado con eso desde el principio.
const CANDIDATOS_PEDIR_CENTAVOS = Array.from({ length: 20 }, (_, i) => (i + 1) * 100);

// Regresa null si el cambio de `recibido - total` ya es razonable (0 o 1
// pieza -- un solo billete o nada). Si no, regresa la cantidad más chica que
// pedirle de más para que el cambio salga en menos piezas, junto con el
// cambio resultante.
function sugerenciaCambio(totalCentavos, recibidoCentavos) {
  const cambioBase = recibidoCentavos - totalCentavos;
  if (cambioBase <= 0) return null;

  const piezasBase = contarPiezas(cambioBase);
  if (piezasBase <= 1) return null; // ya sale limpio, no estorbar

  let mejor = null;
  for (const pedir of CANDIDATOS_PEDIR_CENTAVOS) {
    const cambioNuevo = cambioBase + pedir;
    const piezasNuevo = contarPiezas(cambioNuevo);
    const mejora = piezasNuevo < piezasBase;
    if (!mejora) continue;
    if (!mejor || piezasNuevo < mejor.piezas || (piezasNuevo === mejor.piezas && pedir < mejor.pedirCentavos)) {
      mejor = { pedirCentavos: pedir, cambioCentavos: cambioNuevo, piezas: piezasNuevo };
    }
  }
  return mejor;
}

// Cambio simple, sin sugerencia -- para cuando ya se decidió cuánto se
// recibió de verdad (ej. después de "pídele $3").
function calcularCambio(totalCentavos, recibidoCentavos) {
  return Math.max(0, recibidoCentavos - totalCentavos);
}

// Redondeo real (perdonar o cobrar de más el cambio a propósito): la
// diferencia entre lo que "debería" regresarse y lo que de verdad se
// regresó. Positivo = le diste de menos (a tu favor); negativo = de más.
function calcularRedondeo(totalCentavos, recibidoCentavos, cambioEntregadoCentavos) {
  const cambioTeorico = calcularCambio(totalCentavos, recibidoCentavos);
  return cambioTeorico - cambioEntregadoCentavos;
}

  return { sugerenciaCambio, calcularCambio, calcularRedondeo };
})();
const sugerenciaCambio = cambio.sugerenciaCambio;
const calcularCambio = cambio.calcularCambio;
const calcularRedondeo = cambio.calcularRedondeo;

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
const VERSION_DB = 1;
const ALMACEN_TICKETS = 'tickets';

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

  return { guardarTicket, borrarTicket, obtenerTicket, listarTicketsPorFecha, listarTodos };
})();
const guardarTicket = almacen.guardarTicket;
const borrarTicket = almacen.borrarTicket;
const obtenerTicket = almacen.obtenerTicket;
const listarTicketsPorFecha = almacen.listarTicketsPorFecha;
const listarTodos = almacen.listarTodos;

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

// ── js/ui.js ──────────────────────────────────────────
// Punto de entrada: pinta pantallas y cablea eventos. Nada se exporta (igual
// que peso/js/ui.js en MIS APPS) -- build.py lo mete tal cual, al final del
// paquete.

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
  $('otro-cambio').value = pesosParaInput(ultimaSugerenciaOtro.cambioCentavos);
  cambioEditadoManualmente = true;
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
