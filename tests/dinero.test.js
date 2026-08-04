import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aCentavos, aPesos, formatoMoneda, desglosarPiezas, contarPiezas,
  siguienteBillete, billeteDespuesDe,
} from '../js/dinero.js';

test('aCentavos/aPesos son inversas y evitan flotantes raros', () => {
  assert.equal(aCentavos(403), 40300);
  assert.equal(aCentavos(18.5), 1850);
  assert.equal(aPesos(40300), 403);
});

test('formatoMoneda pone $ y quita los .00 sobrantes', () => {
  assert.equal(formatoMoneda(40300), '$403');
  assert.equal(formatoMoneda(1850), '$18.50');
  assert.equal(formatoMoneda(0), '$0');
  assert.equal(formatoMoneda(-500), '-$5');
});

test('desglosarPiezas usa el billete/moneda más grande primero (goloso): $97 = $50+$20+$20+$5+$2', () => {
  assert.deepEqual(desglosarPiezas(aCentavos(97)), [
    { denominacion: 5000, cantidad: 1 },
    { denominacion: 2000, cantidad: 2 },
    { denominacion: 500, cantidad: 1 },
    { denominacion: 200, cantidad: 1 },
  ]);
});

test('contarPiezas: $97 son 5 piezas, $100 es 1 sola', () => {
  assert.equal(contarPiezas(aCentavos(97)), 5); // 50+20+20+5+2
  assert.equal(contarPiezas(aCentavos(100)), 1);
  assert.equal(contarPiezas(0), 0);
});

test('siguienteBillete regresa el más chico que ya cubre el total', () => {
  assert.equal(siguienteBillete(aCentavos(403)), aCentavos(500));
  assert.equal(siguienteBillete(aCentavos(500)), aCentavos(500));
  assert.equal(siguienteBillete(aCentavos(1500)), null); // no hay billete de más de $1000
});

test('billeteDespuesDe encadena hacia el siguiente billete más grande', () => {
  assert.equal(billeteDespuesDe(aCentavos(500)), aCentavos(1000));
  assert.equal(billeteDespuesDe(aCentavos(1000)), null); // ya es el más grande
});
