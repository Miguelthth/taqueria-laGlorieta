import test from 'node:test';
import assert from 'node:assert/strict';
import { sugerenciaCambio, calcularCambio, calcularRedondeo } from '../js/cambio.js';
import { aCentavos } from '../js/dinero.js';

test('el caso real: total $403, paga con $500 -> pídele $3, das $100', () => {
  const s = sugerenciaCambio(aCentavos(403), aCentavos(500));
  assert.ok(s, 'debería sugerir algo, $97 de cambio es un cambio sucio');
  assert.equal(s.pedirCentavos, aCentavos(3));
  assert.equal(s.cambioCentavos, aCentavos(100));
  assert.equal(s.piezas, 1);
});

test('si el cambio ya es limpio (un solo billete), no sugiere nada', () => {
  assert.equal(sugerenciaCambio(aCentavos(400), aCentavos(500)), null); // cambio $100, 1 pieza
  assert.equal(sugerenciaCambio(aCentavos(500), aCentavos(500)), null); // cambio $0
});

test('sugerenciaCambio nunca sugiere si no encuentra nada mejor', () => {
  // Cambio de $1 -- ya es 1 pieza, no hay nada que mejorar.
  assert.equal(sugerenciaCambio(aCentavos(499), aCentavos(500)), null);
});

test('calcularCambio es la resta simple, nunca negativo', () => {
  assert.equal(calcularCambio(aCentavos(403), aCentavos(500)), aCentavos(97));
  assert.equal(calcularCambio(aCentavos(500), aCentavos(500)), 0);
  assert.equal(calcularCambio(aCentavos(500), aCentavos(300)), 0); // no debería pasar, pero no truena
});

test('calcularRedondeo: perdonar cambio (cobrar $300 por $298) da +$2 a favor', () => {
  // Total $298, el cliente da $300 exactos, pero se le regresa $0 (se redondeó).
  const redondeo = calcularRedondeo(aCentavos(298), aCentavos(300), 0);
  assert.equal(redondeo, aCentavos(2));
});

test('calcularRedondeo: dar de más registra negativo', () => {
  // Total $295, recibe $300 (cambio teórico $5), pero le regresa $10 por error/generosidad.
  const redondeo = calcularRedondeo(aCentavos(295), aCentavos(300), aCentavos(10));
  assert.equal(redondeo, -aCentavos(5));
});
