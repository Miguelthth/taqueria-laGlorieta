export const CATEGORIAS_GASTO = ['Gas', 'Renta', 'Luz', 'Agua', 'Nómina', 'Limpieza', 'Transporte', 'Otro'];

export function crearGasto({ id, fecha, categoria, concepto, totalCentavos, usuario, ahoraMs = Date.now() }) {
  return { id, fecha, categoria, concepto, totalCentavos, capturadaPor: usuario, modificado: ahoraMs };
}

export function crearCompra({ id, fecha, categoria, totalCentavos, usuario, detalle = [], ahoraMs = Date.now() }) {
  return { id, fecha, categoria, totalCentavos, capturadaPor: usuario, detalle, modificado: ahoraMs };
}
