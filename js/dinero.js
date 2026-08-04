// Toda la aritmética de dinero vive aquí. Puro: recibe números, regresa
// números. Sin DOM, sin storage. Todo se suma en CENTAVOS ENTEROS para
// evitar errores de punto flotante (mismo criterio que MIS APPS).

export function aCentavos(pesos) {
  return Math.round(pesos * 100);
}

export function aPesos(centavos) {
  return centavos / 100;
}

export function formatoMoneda(centavos) {
  const negativo = centavos < 0;
  const abs = Math.abs(Math.round(centavos));
  const pesos = Math.floor(abs / 100);
  const c = abs % 100;
  const pesosTxto = pesos.toLocaleString('es-MX');
  const txt = c === 0 ? `$${pesosTxto}` : `$${pesosTxto}.${String(c).padStart(2, '0')}`;
  return negativo ? `-${txt}` : txt;
}

// Denominaciones de efectivo en México, de mayor a menor. El sistema
// 1-2-5-10-20-50-100-200-500-1000 es "canónico" -- un algoritmo goloso
// (tomar siempre la pieza más grande que quepa) da SIEMPRE el mínimo número
// de piezas posible, así que no hace falta programar nada más sofisticado.
export const DENOMINACIONES_CENTAVOS = [
  100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100,
]; // $1000, $500, $200, $100, $50, $20, $10, $5, $2, $1

// Billetes que un cliente normalmente trae para pagar (no monedas).
export const BILLETES_CENTAVOS = [100000, 50000, 20000, 10000, 5000, 2000];

// Cuenta cuántas piezas (billetes/monedas) hacen falta para dar `centavos`
// de cambio, con el desglose. Goloso -- ver nota arriba sobre por qué es
// óptimo con estas denominaciones.
export function desglosarPiezas(centavos) {
  let restante = Math.round(centavos);
  const piezas = [];
  for (const d of DENOMINACIONES_CENTAVOS) {
    const n = Math.floor(restante / d);
    if (n > 0) {
      piezas.push({ denominacion: d, cantidad: n });
      restante -= n * d;
    }
  }
  return piezas;
}

export function contarPiezas(centavos) {
  if (centavos <= 0) return 0;
  return desglosarPiezas(centavos).reduce((acc, p) => acc + p.cantidad, 0);
}

// El billete más chico que ya cubre el total (para armar la fila de pago:
// EXACTO, el siguiente billete "natural", y el que sigue después de ése).
export function siguienteBillete(totalCentavos) {
  return BILLETES_CENTAVOS.slice().reverse().find((b) => b >= totalCentavos) ?? null;
}

export function billeteDespuesDe(billete) {
  const idx = BILLETES_CENTAVOS.indexOf(billete);
  if (idx <= 0) return null; // ya es el más grande, o no se encontró
  return BILLETES_CENTAVOS[idx - 1];
}
