// Forma de los datos, IDs y fechas. Sin DOM, sin storage.

export function hoyISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

export function horaISO(fecha = new Date()) {
  return fecha.toTimeString().slice(0, 8);
}

// ID único sin depender de red: fecha + azar. Suficiente para no chocar
// entre dispositivos distintos (se vuelve importante en la Fase 2, nube).
export function crearId(prefijo) {
  const azar = Math.random().toString(36).slice(2, 8);
  return `${prefijo}_${Date.now().toString(36)}${azar}`;
}
