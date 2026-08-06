const CLAVE_API = 'taq_api_url';
const CLAVE_DISPOSITIVO = 'taq_dispositivo';
const CLAVE_SESION = 'taq_sesion';

export function urlApi() { return localStorage.getItem(CLAVE_API) || ''; }
export function guardarUrlApi(url) { localStorage.setItem(CLAVE_API, url.trim()); }
export function sesionApi() { try { return JSON.parse(localStorage.getItem(CLAVE_SESION)); } catch { return null; } }
export function guardarSesion(datos) { localStorage.setItem(CLAVE_SESION, JSON.stringify(datos)); }
export function cerrarSesion() { localStorage.removeItem(CLAVE_SESION); }
export function dispositivo() { try { return JSON.parse(localStorage.getItem(CLAVE_DISPOSITIVO)); } catch { return null; } }
export function guardarDispositivo(nombre) { const dato = { id: crypto.randomUUID(), nombre: nombre.trim() }; localStorage.setItem(CLAVE_DISPOSITIVO, JSON.stringify(dato)); return dato; }
export async function llamarApi(datos) {
  const url = urlApi(); if (!url) throw new Error('Falta la URL del backend');
  const respuesta = await fetch(url, { method: 'POST', body: JSON.stringify(datos), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
  const cuerpo = await respuesta.json(); if (!cuerpo.ok) throw new Error(cuerpo.error || 'El servidor rechazó la solicitud'); return cuerpo;
}
