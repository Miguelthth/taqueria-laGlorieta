import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularCambio } from '../js/cambio.js';
import { aCentavos } from '../js/dinero.js';

test('calcularCambio es la resta simple', () => {
  assert.equal(calcularCambio(aCentavos(403), aCentavos(500)), aCentavos(97));
  assert.equal(calcularCambio(aCentavos(500), aCentavos(500)), 0);
});

test('calcularCambio nunca da negativo aunque paguen de menos', () => {
  assert.equal(calcularCambio(aCentavos(500), aCentavos(300)), 0);
});
