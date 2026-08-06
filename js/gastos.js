// Investigado sobre lo que compra/gasta una taquería típica en México
// (PLAN.md §5 y §6, más lo estándar del giro): insumos vs. gastos fijos --
// son dos cosas distintas y por eso van en categorías separadas.
export const CATEGORIAS_COMPRA = ['Carnes', 'Tortillas', 'Verduras y salsas', 'Abarrotes', 'Bebidas', 'Desechables', 'Gas', 'Hielo', 'Otro'];
export const CATEGORIAS_GASTO = ['Renta', 'Luz', 'Agua', 'Nómina', 'Permisos', 'Mantenimiento', 'Transporte', 'Publicidad', 'Limpieza', 'Otro'];

export function crearGasto({ id, fecha, categoria, concepto, totalCentavos, usuario, ahoraMs = Date.now() }) {
  return { id, fecha, categoria, concepto, totalCentavos, capturadaPor: usuario, modificado: ahoraMs };
}

export function crearCompra({ id, fecha, categoria, totalCentavos, usuario, detalle = [], ahoraMs = Date.now() }) {
  return { id, fecha, categoria, totalCentavos, capturadaPor: usuario, detalle, modificado: ahoraMs };
}
