// Investigado sobre lo que compra/gasta una taquería típica en México
// (PLAN.md §5 y §6, más lo estándar del giro): insumos vs. gastos fijos --
// son dos cosas distintas y por eso van en categorías separadas.
export const CATEGORIAS_COMPRA = ['Carnes', 'Tortillas', 'Verduras y salsas', 'Abarrotes', 'Bebidas', 'Desechables', 'Gas', 'Hielo', 'Otro'];
export const CATEGORIAS_GASTO = ['Renta', 'Luz', 'Agua', 'Nómina', 'Permisos', 'Mantenimiento', 'Transporte', 'Publicidad', 'Limpieza', 'Otro'];

export function crearGasto({ id, fecha, categoria, concepto, totalCentavos, usuario, ahoraMs = Date.now() }) {
  return { id, fecha, categoria, concepto, totalCentavos, capturadaPor: usuario, modificado: ahoraMs };
}

export function crearCompra({ id, fecha, categoria, totalCentavos, usuario, detalle = [], ahoraMs = Date.now() }) {
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

export function categoriasCompra() { return [...CATEGORIAS_COMPRA, ...leerExtra(CLAVE_EXTRA_COMPRA)]; }
export function categoriasGasto() { return [...CATEGORIAS_GASTO, ...leerExtra(CLAVE_EXTRA_GASTO)]; }
export function esCategoriaDeFabrica(tipo, nombre) { return (tipo === 'compra' ? CATEGORIAS_COMPRA : CATEGORIAS_GASTO).includes(nombre); }

export function agregarCategoria(tipo, nombre) { agregarExtra(tipo === 'compra' ? CLAVE_EXTRA_COMPRA : CLAVE_EXTRA_GASTO, nombre); }
export function quitarCategoria(tipo, nombre) { quitarExtra(tipo === 'compra' ? CLAVE_EXTRA_COMPRA : CLAVE_EXTRA_GASTO, nombre); }
export function renombrarCategoria(tipo, anterior, nuevo) { renombrarExtra(tipo === 'compra' ? CLAVE_EXTRA_COMPRA : CLAVE_EXTRA_GASTO, anterior, nuevo); }
