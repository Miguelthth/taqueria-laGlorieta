import { encolarOperacion, confirmarOperaciones } from './sincronizacion.js';

const CLAVE = 'taq_cola_sincronizacion';

export function leerCola() { try { return JSON.parse(localStorage.getItem(CLAVE)) || []; } catch { return []; } }
export function guardarCola(cola) { localStorage.setItem(CLAVE, JSON.stringify(cola)); }
export function encolar(tipo, entidad) { const cola = encolarOperacion(leerCola(), { tipo, id: entidad.id, modificado: entidad.modificado || Date.now(), entidad }); guardarCola(cola); return cola; }
export function confirmar(ids) { const cola = confirmarOperaciones(leerCola(), ids); guardarCola(cola); return cola; }
