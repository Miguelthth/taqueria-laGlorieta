// El catálogo de productos: qué aparece en la cuadrícula, en qué orden, y a
// qué precio. Vive en localStorage (es chico -- unas cuantas docenas de
// renglones), a diferencia de los tickets, que van a IndexedDB.
//
// Regla dura del diseño (ver docs/CALCULADORA.md): las posiciones de la
// cuadrícula NUNCA se reordenan solas por frecuencia de venta -- las mueve
// él, a mano, y se quedan quietas. Aquí solo se guarda/lee ese orden.

import { crearId } from './modelo.js';
import { aCentavos } from './dinero.js';

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

export function obtenerCatalogo() {
  const existente = leerJSON(CLAVE, null);
  if (existente) return existente;
  const inicial = catalogoDeFabrica();
  guardarCatalogo(inicial);
  return inicial;
}

export function guardarCatalogo(productos) {
  localStorage.setItem(CLAVE, JSON.stringify(productos));
}

export function productosVisibles(catalogo) {
  return catalogo
    .filter((p) => p.activo && p.posicion != null)
    .sort((a, b) => a.posicion - b.posicion);
}

export function productosOcultos(catalogo) {
  return catalogo
    .filter((p) => p.activo && p.posicion == null)
    .sort((a, b) => (a.ordenOculto ?? 0) - (b.ordenOculto ?? 0));
}

export function cupoLibreEnCuadricula(catalogo) {
  return CUPO_CUADRICULA - productosVisibles(catalogo).length;
}

// Hay que resolver esto ANTES de dejar cobrar -- ver la sección "al primer
// arranque" de docs/CALCULADORA.md.
export function tienePreciosPendientes(catalogo) {
  return catalogo.some((p) => p.activo && p.precioPlaceholder);
}

export function productosPendientes(catalogo) {
  return catalogo.filter((p) => p.activo && p.precioPlaceholder);
}

export function confirmarPrecio(catalogo, id, precioPesos) {
  return catalogo.map((p) =>
    p.id === id ? { ...p, precioCentavos: aCentavos(Number(precioPesos)), precioPlaceholder: false } : p
  );
}

// Nombre distinto al agregarProducto() de ticket.js a propósito -- build.py
// junta todo en globales sueltas por paquete y dos exports con el mismo
// nombre chocarían (build.py lo detecta y para en seco, pero mejor no
// arriesgarse a que alguien lo "arregle" renombrando el import).
export function agregarProductoCatalogo(catalogo, { nombre, categoria, precioPesos, aCuadricula }) {
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

export function editarProducto(catalogo, id, cambios) {
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

export function desactivarProducto(catalogo, id) {
  return catalogo.map((p) => (p.id === id ? { ...p, activo: false, posicion: null } : p));
}

// Recibe el nuevo orden completo de IDs visibles (lo que sea que haya
// quedado tras arrastrar) y reescribe `posicion` 0..n-1. No toca los ocultos.
export function reordenarCuadricula(catalogo, idsEnOrden) {
  const posicionPorId = new Map(idsEnOrden.map((id, i) => [id, i]));
  return catalogo.map((p) => (posicionPorId.has(p.id) ? { ...p, posicion: posicionPorId.get(p.id) } : p));
}

export function moverACuadricula(catalogo, id) {
  if (cupoLibreEnCuadricula(catalogo) <= 0) return catalogo;
  const posicion = productosVisibles(catalogo).length;
  return catalogo.map((p) => (p.id === id ? { ...p, posicion, ordenOculto: null } : p));
}

export function moverAOcultos(catalogo, id) {
  const ordenOculto = productosOcultos(catalogo).length;
  const sinEste = catalogo.map((p) => (p.id === id ? { ...p, posicion: null, ordenOculto } : p));
  // Recompacta las posiciones de lo que queda visible para no dejar huecos.
  const idsVisibles = productosVisibles(sinEste).map((p) => p.id);
  return reordenarCuadricula(sinEste, idsVisibles);
}
