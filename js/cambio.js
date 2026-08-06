// Cambio simple: lo que el cliente da, menos el total. Nada más -- se probó
// una versión que sugería "pídele $X más" para que el cambio saliera en
// billetes limpios, y no era lo que Miguel quería ("ya no vamos a pedir
// nada"). Se quitó a propósito; si hace falta, está en el historial de git.

export function calcularCambio(totalCentavos, recibidoCentavos) {
  return Math.max(0, recibidoCentavos - totalCentavos);
}
