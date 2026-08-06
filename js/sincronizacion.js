export function encolarOperacion(cola, operacion) {
  const clave = `${operacion.tipo}:${operacion.id}`;
  return [...cola.filter((item) => `${item.tipo}:${item.id}` !== clave), operacion];
}

export function confirmarOperaciones(cola, idsConfirmados) {
  const confirmados = new Set(idsConfirmados);
  return cola.filter((item) => !confirmados.has(item.id));
}

export function fusionarPorModificado(local, remoto) {
  const porId = new Map();
  for (const item of [...remoto, ...local]) {
    const anterior = porId.get(item.id);
    if (!anterior || item.modificado >= anterior.modificado) porId.set(item.id, item);
  }
  return [...porId.values()];
}
