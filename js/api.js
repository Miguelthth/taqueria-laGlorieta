const CLAVE_API = 'taq_api_url';
const CLAVE_DISPOSITIVO = 'taq_dispositivo';
const URL_SERVIDOR = 'https://script.google.com/macros/s/AKfycbwR0aIV5Kkxf4HgThFlR0K8NASMC06ZtUP5N5D4eqapObQk3QCWnzAthTrhsbqb4g_8Yw/exec';

export function urlApi() { return URL_SERVIDOR; }
export function guardarUrlApi(url) { localStorage.setItem(CLAVE_API, url.trim()); }
export function dispositivo() { try { return JSON.parse(localStorage.getItem(CLAVE_DISPOSITIVO)); } catch { return null; } }
export function guardarDispositivo(nombre) { const dato = { id: crypto.randomUUID(), nombre: nombre.trim() }; localStorage.setItem(CLAVE_DISPOSITIVO, JSON.stringify(dato)); return dato; }
export async function llamarApi(datos) {
  const url = urlApi(); if (!url) throw new Error('Falta la URL del backend');
  const respuesta = await fetch(url, { method: 'POST', body: JSON.stringify(datos), headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
  const cuerpo = await respuesta.json(); if (!cuerpo.ok) throw new Error(cuerpo.error || 'El servidor rechazó la solicitud'); return cuerpo;
}
