// La "ayuda de cambio": el caso real que Miguel describió --
// total $403, el cliente saca $500 (cambio $97, puro menudo) -->
// la app sugiere "pídele $3 más, le regresas $100 de un billete".
//
// NO cambia el total ni lo que el cliente paga -- solo encuentra una
// combinación de billetes más cómoda para las dos partes.

import { contarPiezas } from './dinero.js';

// Cantidades chicas que un cliente podría plausiblemente traer sueltas,
// además de su billete -- en pesos completos, $1 a $20 ("pídele $3" es una
// combinación de monedas, un $2 y un $1, no billete/moneda único; probar
// solo denominaciones sueltas ($1/$2/$5/$10/$20) se le escapaba el caso real
// que Miguel describió). Arriba de $20 pedirle sueltos ya no tiene sentido
// -- si los trajera, habría pagado con eso desde el principio.
const CANDIDATOS_PEDIR_CENTAVOS = Array.from({ length: 20 }, (_, i) => (i + 1) * 100);

// Regresa null si el cambio de `recibido - total` ya es razonable (0 o 1
// pieza -- un solo billete o nada). Si no, regresa la cantidad más chica que
// pedirle de más para que el cambio salga en menos piezas, junto con el
// cambio resultante.
export function sugerenciaCambio(totalCentavos, recibidoCentavos) {
  const cambioBase = recibidoCentavos - totalCentavos;
  if (cambioBase <= 0) return null;

  const piezasBase = contarPiezas(cambioBase);
  if (piezasBase <= 1) return null; // ya sale limpio, no estorbar

  let mejor = null;
  for (const pedir of CANDIDATOS_PEDIR_CENTAVOS) {
    const cambioNuevo = cambioBase + pedir;
    const piezasNuevo = contarPiezas(cambioNuevo);
    const mejora = piezasNuevo < piezasBase;
    if (!mejora) continue;
    if (!mejor || piezasNuevo < mejor.piezas || (piezasNuevo === mejor.piezas && pedir < mejor.pedirCentavos)) {
      mejor = { pedirCentavos: pedir, cambioCentavos: cambioNuevo, piezas: piezasNuevo };
    }
  }
  return mejor;
}

// Cambio simple, sin sugerencia -- para cuando ya se decidió cuánto se
// recibió de verdad (ej. después de "pídele $3").
export function calcularCambio(totalCentavos, recibidoCentavos) {
  return Math.max(0, recibidoCentavos - totalCentavos);
}

// Redondeo real (perdonar o cobrar de más el cambio a propósito): la
// diferencia entre lo que "debería" regresarse y lo que de verdad se
// regresó. Positivo = le diste de menos (a tu favor); negativo = de más.
export function calcularRedondeo(totalCentavos, recibidoCentavos, cambioEntregadoCentavos) {
  const cambioTeorico = calcularCambio(totalCentavos, recibidoCentavos);
  return cambioTeorico - cambioEntregadoCentavos;
}
