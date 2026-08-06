// Mide qué tan rápido se captura cada ticket -- no de oídas, con números
// (ver docs/CALCULADORA.md, sección 9). Arranca en el primer toque sobre un
// carrito vacío y se detiene al cobrar. Nunca sale del dispositivo.

const CLAVE_DURACIONES = 'taq_duraciones_ms';
const MAX_GUARDADAS = 500;

export function ahora() {
  return performance.now();
}

function leer() {
  try {
    const crudo = localStorage.getItem(CLAVE_DURACIONES);
    return crudo ? JSON.parse(crudo) : [];
  } catch {
    return [];
  }
}

function guardar(lista) {
  localStorage.setItem(CLAVE_DURACIONES, JSON.stringify(lista.slice(-MAX_GUARDADAS)));
}

export function registrarDuracion(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return;
  const lista = leer();
  lista.push(Math.round(ms));
  guardar(lista);
}

function percentil(valoresOrdenados, p) {
  if (!valoresOrdenados.length) return 0;
  const idx = Math.min(valoresOrdenados.length - 1, Math.floor(p * valoresOrdenados.length));
  return valoresOrdenados[idx];
}

export function estadisticas() {
  const lista = leer().slice().sort((a, b) => a - b);
  if (!lista.length) return { cantidad: 0, medianaMs: 0, peor10Ms: 0 };
  return {
    cantidad: lista.length,
    medianaMs: percentil(lista, 0.5),
    peor10Ms: percentil(lista, 0.9),
  };
}

export function reiniciarMedicion() {
  localStorage.removeItem(CLAVE_DURACIONES);
}
