const DURACION_DUENO_MS = 30 * 60 * 1000;

export function crearSesion({ nombre, esDueno, ahoraMs = Date.now() }) {
  return { nombre: nombre.trim(), esDueno: Boolean(esDueno), iniciadaMs: ahoraMs };
}

export function sesionVigente(sesion, ahoraMs = Date.now()) {
  return Boolean(sesion?.esDueno && ahoraMs - sesion.iniciadaMs < DURACION_DUENO_MS);
}

export function puedeModificarCatalogo(sesion, ahoraMs = Date.now()) {
  return sesionVigente(sesion, ahoraMs);
}
