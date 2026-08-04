import test from 'node:test';
import assert from 'node:assert/strict';
import { aCentavos, aPesos, formatoMoneda } from '../js/dinero.js';

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
