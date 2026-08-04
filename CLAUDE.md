# Taquería

App de cobro/compras/gastos para la taquería de un familiar de Miguel
(Tijuana). **No es de SUMETEC ni sub-app de MIS APPS** — backend, ícono y
colores propios. Ver el porqué del negocio y las decisiones de fondo en
[`PLAN.md`](PLAN.md); el diseño detallado de la calculadora (la parte que
importa de verdad) en [`docs/CALCULADORA.md`](docs/CALCULADORA.md).

**Estado (2026-08-03): Fase 0 + Fase 1 construidas — la calculadora funciona
de punta a punta, probada a mano en navegador y con `node --test` en verde.
Sin nube todavía (Fase 2). `git init` local hecho, dos commits; falta que
Miguel dé la URL del repo remoto para el primer `git push` (ver PLAN.md
sección 8). Pendiente: que Miguel la pruebe en su celular real una semana
antes de seguir.**

**Cambios de esta misma sesión, después de la primera versión:**
- Ajustes se rediseñó: checkbox "en la cuadrícula" + arrastrar para el orden,
  en vez de flechas ↑↓ (`renderListaProductos`/`cablearArrastre` en `js/ui.js`).
- Service worker auto-versionado (ver abajo).
- **El cobro se simplificó de raíz — dos vueltas.** Primero se construyó (y
  probó, y funcionaba) una "ayuda de cambio": botones de billete que
  sugerían *"pídele $3 más → dale $100"*. **Miguel pidió quitarla por
  completo** ("ya no vamos a pedir nada") y la reemplazó por un campo único,
  junto al total, para teclear cuánto paga el cliente — el cambio se ve al
  instante, sin sugerencias. Se quitó `cambio.js::sugerenciaCambio` y
  `dinero.js::siguienteBillete/billeteDespuesDe/desglosarPiezas/contarPiezas`
  por completo (no quedaron ni como código muerto -- si hace falta
  recuperarlos, están en el historial de git, commits antes del
  2026-08-03 tarde). **Lección para no repetir:** cuando una explicación no
  se traduce limpio a pantalla dos veces seguidas, la señal es simplificar
  el diseño, no explicarlo mejor.

## Arquitectura

Mismo patrón que `Mis cosas/MIS APPS` (Gastos + Peso), copiado y adaptado:

```
taqueria/
├─ index.html              una sola pantalla de cobro + Ajustes, sin router
├─ js/
│  ├─ app.js                GENERADO por build.py -- NUNCA editar a mano
│  ├─ dinero.js             centavos enteros, formato $
│  ├─ cambio.js             calcularCambio (resta simple)
│  ├─ modelo.js             fechas/horas ISO, crearId
│  ├─ catalogo.js           productos: cuadrícula (posiciones fijas) + ocultos, en localStorage
│  ├─ ticket.js             el carrito en construcción (puro, sin storage)
│  ├─ almacen.js            tickets guardados, en IndexedDB (no localStorage -- 150-300/día)
│  ├─ cronometro.js         mide ms por ticket (mediana, peor 10%)
│  └─ ui.js                 pinta pantallas y cablea eventos -- punto de entrada, nada exportado
├─ css/estilos.css          paleta propia: naranja salsa + verde cilantro sobre crema
├─ build.py                 empaquetador (ver abajo)
├─ tests/*.test.js          node --test, 26 pruebas sobre dinero/cambio/ticket/catalogo
├─ manifest.json, sw.js     PWA instalable, offline-first
└─ icon-512.png             PLACEHOLDER (taco genérico) -- falta el ícono real
```

## build.py — 3 formas de romperse en silencio, las 3 con guardarraíl

`index.html` carga `js/app.js` con un `<script>` normal (sin `type="module"`)
porque `file://` bloquea los ES modules por CORS. `build.py` concatena los
módulos fuente en ese único archivo. Los fuente siguen siendo ES modules de
verdad para que `node --test` los importe tal cual.

Esto ya mordió tres veces durante la construcción (2026-08-03), las tres
veces sin ningún error visible hasta abrir la consola del navegador —
`build.py` ahora para en seco ANTES de escribir el bundle si detecta:

1. **Import a un archivo fuera de la lista** (`_validar_imports`, ya existía
   en MIS APPS) -- el import se borra en silencio y el nombre queda
   indefinido.
2. **Import con alias** (`import { x as y }`, `_validar_sin_alias`, NUEVO) --
   el bundle solo expone el nombre ORIGINAL como global, nunca crea `y`.
   Pasó de verdad: `agregarProducto as agregarAlCarrito` dejó toda la
   calculadora sin poder agregar productos, sin ningún error hasta
   inspeccionar. **Regla: nunca uses `as` en un import dentro de `js/`.**
3. **Una variable de nivel superior con el mismo nombre que otro archivo del
   paquete** (`_validar_colision_con_nombres_de_archivo`, NUEVO) -- cada
   archivo CON exports se envuelve en `const <nombre_archivo> = (...)`; si
   `ui.js` declara `let catalogo` a nivel superior, choca con el
   `const catalogo` que ya generó `catalogo.js` -- SyntaxError, el bundle
   completo no corre. Pasó de verdad, por eso `ui.js` usa `catalogoActual`
   como nombre de la variable en memoria, no `catalogo`.

```
python build.py
```

Corre después de tocar cualquier archivo en `js/`. Si algo de lo de arriba
se cuela, `build.py` para con un mensaje explicando exactamente qué
renombrar -- no ignores esos errores ni los seas creativo con `--force`,
no existe.

**También reescribe `sw.js` en cada corrida** (`_actualizar_version_cache_sw`):
el nombre del `CACHE` es un hash del shell (`index.html`+css+js+manifest), no
un número que alguien tenga que subir a mano -- cualquier cambio real lo
cambia solo, así el navegador siempre nota que hay un service worker nuevo.
`js/ui.js` completa el combo con `registration.update()` al cargar y
auto-recarga en `controllerchange` (salvo que haya algo escrito sin mandar) --
mismo patrón que MIS APPS, ya probado ahí.

## Reglas de dinero

- **Todo en centavos enteros** (`dinero.js::aCentavos/aPesos`), nunca
  flotantes -- mismo criterio que MIS APPS.
- `cambio.js` es a propósito minúsculo: solo `calcularCambio` (resta simple,
  nunca negativo). Tuvo una versión con sugerencia de billetes limpios
  ("pídele $3 más") que se construyó, se probó, y Miguel pidió quitarla --
  ver la nota de arriba. No la reintroduzcas sin que él lo pida de nuevo.

## Reglas de la calculadora (no negociables, ver docs/CALCULADORA.md)

- **Las posiciones de la cuadrícula se congelan.** Las mueve él a mano
  (arrastrando en Ajustes → "Tus productos", `cablearArrastre` en `js/ui.js`)
  y no se reordenan solas nunca, ni por frecuencia de venta. Reordenar solo
  mata la memoria muscular. Qué producto está en la cuadrícula o detrás de
  "Más…" se decide con un checkbox por producto (tope 11) -- no hay listas
  separadas ni botones "subir/bajar".
- **Cobrar ES guardar.** Un campo junto al total ("Paga con…", vacío = pagó
  exacto) + un botón "Cobrar" que guarda al instante, sin paso de
  "confirmar". El error se corrige con DESHACER (6 segundos), no se previene
  con una pantalla de más.
- Toque corto = +1. Toque largo (480ms, `RETRASO_TOQUE_LARGO`) = teclado de
  cantidad, para pedidos grandes ("10 de asada").
- La app se cronometra sola (`cronometro.js`) -- meta: 6s de mediana por
  ticket. Ver los KPIs en Ajustes → "Qué tan rápido cobras".

## Pruebas

```
python build.py && node --test tests/*.test.js
```

26/26 en verde. `obtenerCatalogo`/`guardarCatalogo` (tocan `localStorage`) y
todo `almacen.js` (IndexedDB) NO tienen prueba de `node --test` -- Node no
trae esas APIs del navegador. Se probaron a mano en el navegador
(`.claude/launch.json` → configuración `taqueria`, puerto 8203) simulando el
flujo completo con `PointerEvent` (los botones escuchan `pointerdown`/
`pointerup`, no `click`, por el toque largo). Ese flujo de prueba manual
confirmó el caso real de Miguel: 7 tortas + 1 adobada = $403, escribes $500
en "Paga con…", se ve "Cambio: $97" al instante -- exacto.

## Pendiente

- **Que Miguel la use en su celular real una semana** antes de tocar nada
  más (recomendación explícita del plan, no una formalidad).
- Ícono real (`icon-512.png` es un taco placeholder generado con Pillow).
- Su menú y precios reales -- hoy son precios de relleno que él confirma en
  el primer arranque (pantalla que bloquea cobrar hasta hacerlo).
- Fase 2 en adelante: nube/multi-usuario en tiempo real, compras y gastos,
  gráficas. Ver `PLAN.md`.
