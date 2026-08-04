// Prueba solo las funciones puras de catalogo.js (reciben el catálogo como
// arreglo y regresan uno nuevo). obtenerCatalogo/guardarCatalogo tocan
// localStorage -- eso se prueba a mano en el navegador, no aquí (mismo
// criterio que MIS APPS con almacen.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  productosVisibles, productosOcultos, cupoLibreEnCuadricula, tienePreciosPendientes,
  productosPendientes, confirmarPrecio, agregarProductoCatalogo, editarProducto,
  desactivarProducto, reordenarCuadricula, moverACuadricula, moverAOcultos,
} from '../js/catalogo.js';

function catalogoBase() {
  return [
    { id: 'a', nombre: 'Adobada', categoria: 'Tacos', precioCentavos: 1800, posicion: 1, activo: true, precioPlaceholder: false, ordenOculto: null },
    { id: 'b', nombre: 'Asada', categoria: 'Tacos', precioCentavos: 2000, posicion: 0, activo: true, precioPlaceholder: true, ordenOculto: null },
    { id: 'c', nombre: 'Sope', categoria: 'Extras', precioCentavos: 3000, posicion: null, activo: true, precioPlaceholder: false, ordenOculto: 0 },
    { id: 'd', nombre: 'Descontinuado', categoria: 'X', precioCentavos: 1000, posicion: null, activo: false, precioPlaceholder: false, ordenOculto: 1 },
  ];
}

test('productosVisibles ordena por posición y excluye inactivos/ocultos', () => {
  const vis = productosVisibles(catalogoBase());
  assert.deepEqual(vis.map((p) => p.id), ['b', 'a']); // posicion 0, luego 1
});

test('productosOcultos excluye inactivos y a los que están en la cuadrícula', () => {
  const oc = productosOcultos(catalogoBase());
  assert.deepEqual(oc.map((p) => p.id), ['c']);
});

test('cupoLibreEnCuadricula: 11 cupos menos los visibles activos', () => {
  assert.equal(cupoLibreEnCuadricula(catalogoBase()), 9);
});

test('tienePreciosPendientes detecta precios de relleno sin confirmar', () => {
  assert.equal(tienePreciosPendientes(catalogoBase()), true); // "Asada" trae placeholder
  const resueltos = confirmarPrecio(catalogoBase(), 'b', 22);
  assert.equal(tienePreciosPendientes(resueltos), false);
});

test('productosPendientes regresa solo los activos con placeholder', () => {
  const pend = productosPendientes(catalogoBase());
  assert.deepEqual(pend.map((p) => p.id), ['b']);
});

test('confirmarPrecio actualiza el precio y apaga el placeholder', () => {
  const res = confirmarPrecio(catalogoBase(), 'b', 25);
  const asada = res.find((p) => p.id === 'b');
  assert.equal(asada.precioCentavos, 2500);
  assert.equal(asada.precioPlaceholder, false);
});

test('agregarProductoCatalogo mete a la cuadrícula si hay cupo y se pide', () => {
  const res = agregarProductoCatalogo(catalogoBase(), { nombre: 'Vampiro', categoria: 'Extras', precioPesos: 35, aCuadricula: true });
  const nuevo = res.find((p) => p.nombre === 'Vampiro');
  assert.equal(nuevo.posicion, 2); // después de los 2 que ya había
  assert.equal(nuevo.precioCentavos, 3500);
});

test('agregarProductoCatalogo lo manda a ocultos si no se pide en cuadrícula', () => {
  const res = agregarProductoCatalogo(catalogoBase(), { nombre: 'Agua', categoria: 'Bebidas', precioPesos: 18, aCuadricula: false });
  const nuevo = res.find((p) => p.nombre === 'Agua');
  assert.equal(nuevo.posicion, null);
});

test('editarProducto actualiza precio y quita el placeholder si se manda precioPesos', () => {
  const res = editarProducto(catalogoBase(), 'b', { precioPesos: 21 });
  const asada = res.find((p) => p.id === 'b');
  assert.equal(asada.precioCentavos, 2100);
  assert.equal(asada.precioPlaceholder, false);
});

test('desactivarProducto lo saca de la cuadrícula y de ocultos', () => {
  const res = desactivarProducto(catalogoBase(), 'a');
  assert.equal(res.find((p) => p.id === 'a').activo, false);
  assert.equal(productosVisibles(res).some((p) => p.id === 'a'), false);
});

test('reordenarCuadricula reescribe posiciones según el orden de IDs dado', () => {
  const res = reordenarCuadricula(catalogoBase(), ['a', 'b']); // invierte el orden
  assert.equal(res.find((p) => p.id === 'a').posicion, 0);
  assert.equal(res.find((p) => p.id === 'b').posicion, 1);
});

test('moverACuadricula respeta el cupo y moverAOcultos recompacta posiciones', () => {
  const conSope = moverACuadricula(catalogoBase(), 'c');
  assert.equal(conSope.find((p) => p.id === 'c').posicion, 2); // al final de los 2 visibles

  const base = catalogoBase();
  const sinAdobada = moverAOcultos(base, 'a'); // 'a' estaba en posicion 1
  assert.equal(sinAdobada.find((p) => p.id === 'a').posicion, null);
  // 'b' (posicion 0) sigue siendo el único visible, recompactado a posicion 0
  assert.deepEqual(productosVisibles(sinAdobada).map((p) => p.id), ['b']);
});

test('moverACuadricula no hace nada si ya no hay cupo (11 llenos)', () => {
  let catalogo = [];
  for (let i = 0; i < 11; i++) {
    catalogo.push({ id: `v${i}`, nombre: `V${i}`, precioCentavos: 1000, posicion: i, activo: true, precioPlaceholder: false, ordenOculto: null });
  }
  catalogo.push({ id: 'oculto1', nombre: 'Oculto', precioCentavos: 1000, posicion: null, activo: true, precioPlaceholder: false, ordenOculto: 0 });
  const res = moverACuadricula(catalogo, 'oculto1');
  assert.equal(res.find((p) => p.id === 'oculto1').posicion, null); // no cupo, no cambia
});
