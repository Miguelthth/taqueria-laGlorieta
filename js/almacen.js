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

export async function guardarTicket(ticket) {
  await conStore('readwrite', (store) => store.put(ticket));
  return ticket;
}

export async function borrarTicket(id) {
  await conStore('readwrite', (store) => store.delete(id));
}

export async function obtenerTicket(id) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ALMACEN_TICKETS, 'readonly');
    const req = tx.objectStore(ALMACEN_TICKETS).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function listarTicketsPorFecha(fechaISO) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ALMACEN_TICKETS, 'readonly');
    const idx = tx.objectStore(ALMACEN_TICKETS).index('porFecha');
    const req = idx.getAll(fechaISO);
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => b.ts - a.ts));
    req.onerror = () => reject(req.error);
  });
}

export async function listarTodos() {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ALMACEN_TICKETS, 'readonly');
    const req = tx.objectStore(ALMACEN_TICKETS).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function guardarOrden(orden) {
  const db = await abrirDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ALMACEN_ORDENES, 'readwrite');
    tx.objectStore(ALMACEN_ORDENES).put(orden);
    tx.oncomplete = () => resolve(orden);
    tx.onerror = () => reject(tx.error);
  });
}

export async function listarOrdenesActivas() {
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
export function guardarCompra(compra) { return guardarMovimiento(ALMACEN_COMPRAS, compra); }
export function guardarGasto(gasto) { return guardarMovimiento(ALMACEN_GASTOS, gasto); }
export function listarCompras(fecha) { return listarMovimientos(ALMACEN_COMPRAS, fecha); }
export function listarGastos(fecha) { return listarMovimientos(ALMACEN_GASTOS, fecha); }
