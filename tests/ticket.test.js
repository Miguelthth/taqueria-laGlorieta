import test from 'node:test';
import assert from 'node:assert/strict';
import {
  crearCarrito, agregarProducto, agregarLibre, quitarUno, establecerCantidad,
  quitarLinea, cantidadDe, totalCentavos, cantidadTotalPiezas, estaVacio, resumenTexto,
} from '../js/ticket.js';

const adobada = { id: 'p1', nombre: 'adobada', precioCentavos: 1800 };
const mulita = { id: 'p2', nombre: 'mulita', precioCentavos: 3500 };

test('agregarProducto suma cantidad si ya estaba en el carrito', () => {
  let c = crearCarrito();
  c = agregarProducto(c, adobada, 1);
  c = agregarProducto(c, adobada, 1);
  c = agregarProducto(c, adobada, 1);
  assert.equal(c.length, 1);
  assert.equal(cantidadDe(c, 'p1'), 3);
});

test('el carrito nunca se muta -- cada función regresa uno nuevo', () => {
  const c1 = crearCarrito();
  const c2 = agregarProducto(c1, adobada, 1);
  assert.equal(c1.length, 0);
  assert.equal(c2.length, 1);
});

test('quitarUno baja de uno y elimina la línea al llegar a 0', () => {
  let c = agregarProducto(crearCarrito(), adobada, 2);
  c = quitarUno(c, 'p1');
  assert.equal(cantidadDe(c, 'p1'), 1);
  c = quitarUno(c, 'p1');
  assert.equal(c.length, 0); // ya no hay línea, no cantidad 0 colgada
});

test('establecerCantidad en 0 quita la línea', () => {
  let c = agregarProducto(crearCarrito(), adobada, 5);
  c = establecerCantidad(c, 'p1', 0);
  assert.equal(c.length, 0);
});

test('totalCentavos suma precio x cantidad de todas las líneas', () => {
  let c = crearCarrito();
  c = agregarProducto(c, adobada, 3); // 3 x $18 = $54
  c = agregarProducto(c, mulita, 1); // + $35 = $89
  assert.equal(totalCentavos(c), 8900);
});

test('agregarLibre crea una línea propia por cada toque, no se suma', () => {
  let c = crearCarrito();
  c = agregarLibre(c, 5000, 'orden especial');
  c = agregarLibre(c, 3000, 'otra cosa');
  assert.equal(c.length, 2);
  assert.equal(totalCentavos(c), 8000);
});

test('cantidadTotalPiezas cuenta piezas, no líneas distintas', () => {
  let c = crearCarrito();
  c = agregarProducto(c, adobada, 3);
  c = agregarProducto(c, mulita, 1);
  assert.equal(c.length, 2);
  assert.equal(cantidadTotalPiezas(c), 4);
});

test('estaVacio y resumenTexto', () => {
  assert.equal(estaVacio(crearCarrito()), true);
  let c = agregarProducto(crearCarrito(), adobada, 3);
  c = agregarProducto(c, mulita, 1);
  assert.equal(estaVacio(c), false);
  assert.equal(resumenTexto(c), '3 adobada · 1 mulita');
});

test('quitarLinea borra la línea completa sin importar la cantidad', () => {
  let c = agregarProducto(crearCarrito(), adobada, 10);
  c = quitarLinea(c, 'p1');
  assert.equal(c.length, 0);
});
