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
