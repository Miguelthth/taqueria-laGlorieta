// El carrito en construcción -- lo que se va tocando antes de cobrar. Puro:
// recibe el carrito y regresa uno nuevo, nunca muta. Sin DOM, sin storage.

export function crearCarrito() {
  return [];
}

export function agregarProducto(carrito, producto, cantidad = 1) {
  const existente = carrito.find((l) => l.productoId === producto.id);
  if (existente) {
    return carrito.map((l) =>
      l.productoId === producto.id ? { ...l, cantidad: l.cantidad + cantidad } : l
    );
  }
  return [
    ...carrito,
    {
      productoId: producto.id,
      nombre: producto.nombre,
      precioUnitarioCentavos: producto.precioCentavos,
      cantidad,
      esLibre: false,
    },
  ];
}

// El botón "$ libre" para lo que no está en el catálogo -- cada uno es su
// propia línea (no se suman entre sí, cada orden especial puede ser distinta).
export function agregarLibre(carrito, montoCentavos, nota = '$ libre') {
  return [
    ...carrito,
    {
      productoId: `libre_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      nombre: nota,
      precioUnitarioCentavos: montoCentavos,
      cantidad: 1,
      esLibre: true,
    },
  ];
}

export function quitarUno(carrito, productoId) {
  return carrito
    .map((l) => (l.productoId === productoId ? { ...l, cantidad: l.cantidad - 1 } : l))
    .filter((l) => l.cantidad > 0);
}

export function establecerCantidad(carrito, productoId, cantidad) {
  const n = Math.max(0, Math.floor(cantidad));
  if (n === 0) return quitarLinea(carrito, productoId);
  return carrito.map((l) => (l.productoId === productoId ? { ...l, cantidad: n } : l));
}

export function quitarLinea(carrito, productoId) {
  return carrito.filter((l) => l.productoId !== productoId);
}

export function cantidadDe(carrito, productoId) {
  return carrito.find((l) => l.productoId === productoId)?.cantidad || 0;
}

export function totalCentavos(carrito) {
  return carrito.reduce((acc, l) => acc + l.precioUnitarioCentavos * l.cantidad, 0);
}

export function cantidadTotalPiezas(carrito) {
  return carrito.reduce((acc, l) => acc + l.cantidad, 0);
}

export function estaVacio(carrito) {
  return carrito.length === 0;
}

// Texto compacto para el renglón del ticket: "3 adobada · 1 mulita · 1 refresco".
export function resumenTexto(carrito) {
  return carrito.map((l) => `${l.cantidad} ${l.nombre}`).join(' · ');
}
