# Plan — App para la taquería

**Fecha:** 2026-08-03. **Para:** el familiar de Miguel (taquería en Tijuana).
**Estado:** Fase 0 + Fase 1 **construidas** — la calculadora funciona de
punta a punta (código en esta carpeta, ver [`CLAUDE.md`](CLAUDE.md) para la
arquitectura). Probada con `node --test` (26/26) y a mano en navegador
simulando el flujo completo. **Falta que Miguel la pruebe en su celular
real** antes de seguir con la Fase 2 — ver la recomendación en la sección 9.

Este documento es el acuerdo de qué se va a hacer y en qué orden. Para el
detalle de cómo quedó construida la calculadora, ver
[`docs/CALCULADORA.md`](docs/CALCULADORA.md) y `CLAUDE.md`; para el diseño de
las órdenes (todavía sin construir), [`docs/ORDENES.md`](docs/ORDENES.md).

> **Agregado al plan el 2026-08-03 (solo diseño, nada construido):**
> la **cola de órdenes** (sección 4), los **candados contra ventas perdidas**
> (sección 8), **actualizar precios en todos los aparatos** (2.2), el
> **popup de cobro** con el cambio al instante y el guardado por detrás
> (`docs/CALCULADORA.md` 6.b), y el **modo dueño** — contraseña sobre
> métricas, precios, compras y gastos (7.1).
>
> Las fases se recorrieron para acomodarlo todo, y salió a la luz una deuda
> de la Fase 1 que ahora es lo siguiente en la lista: el carrito en curso
> **no se está guardando** (Fase 1.5).

---

## 1. Decisiones ya tomadas (2026-08-03)

| Tema | Decisión |
|---|---|
| **Utilidad** | **De caja**: ventas − compras − gastos, por día/semana/mes. NO se capturan recetas ni gramajes por producto. |
| **Usuarios** | **Varios usuarios, todos viendo la misma información en tiempo real** (corregido 2026-08-03). Cada quien entra con su nombre y PIN; los tickets guardan quién los cobró. Ver la sección 2.1 — "tiempo real" con Google Sheets tiene un límite honesto. |
| **Corte de caja** | **No por ahora.** Sí hay resumen del día; contar el efectivo y cuadrar sobrante/faltante queda para después si lo pide. |
| **Dónde viven los datos** | **Google Sheets vía Apps Script**, por lo pronto en **la cuenta de Miguel** (la de siempre). Se construye desde el principio con **mudanza a la cuenta del familiar en un botón**, y con **respaldo automático diario en el Drive de Miguel**. |
| **Cómo cobra** | **Al entregar, de mostrador.** Sin cuentas abiertas ni mesas — un ticket a la vez. **Matiz agregado el 2026-08-03:** sí hay una **cola de órdenes** para lo que falta preparar (sección 4). Eso NO es una cuenta abierta — el cliente sigue pagando al recibir; lo que se modela es el rato entre que pide y que se le entrega. |
| **Órdenes** | **Sí, con cola** (sección 4 y `docs/ORDENES.md`). Una orden son *platos*, cada uno con sus "sin"; `con todo` es el default. El camino de cobro directo no se toca. |
| **Candados** | **Sí** (sección 8): la app no debe permitir que una venta se pierda — ni un ticket a medias, ni una orden entregada sin cobrar, ni algo capturado que nunca se respalda. |
| **Precios** | Se cambian desde **Ajustes → Precios**, suben a Drive y bajan solos a los demás aparatos (sección 2.2). Un precio nuevo **nunca** altera un ticket ya empezado ni los reportes viejos. |
| **Cobro** | Al tocar **Cobrar** sale un **popup**: total, con cuánto paga, Confirmar → **el cambio se ve al instante** y el guardado a Drive va por detrás, sin que nadie espere (`docs/CALCULADORA.md` 6.b). |
| **Quién ve el dinero** | **Solo el dueño** (sección 7.1). Una contraseña — el "modo dueño" — abre métricas, precios, compras y gastos. Los empleados cobran y levantan órdenes, nada más. |
| **Aparato** | **Celular en la mano.** Es el caso más apretado, se diseña para él (~12 botones sin desplazar). |
| **Catálogo** | Arranca con uno **típico de taquería**, con precios de relleno que él corrige en Ajustes antes del primer cobro. |

### Sobre la mudanza de cuenta (requisito de diseño, no un extra)

Que hoy viva en tu cuenta y mañana en la de él **no puede ser una migración
manual dolorosa**. Se resuelve así desde la Fase 2:

- La app **nunca guarda un ID de hoja quemado**: solo la URL del Apps Script.
  Cambiar de cuenta = pegar otra URL en Ajustes.
- El backend trae `exportarTodo()` / `importarTodo()` — un JSON completo de
  todo el histórico. Mudarse = desplegar el mismo `Codigo.gs` en la cuenta de
  él, exportar de una, importar en la otra, pegar la URL nueva.
- El **respaldo diario en tu Drive se queda igual aunque se mude**: el respaldo
  es una llamada del backend nuevo hacia una carpeta compartida contigo, o
  (más simple y sin permisos raros) la app manda una copia a las dos URLs.
  Se decide en la Fase 2 con el código enfrente; ambas caben.

**No hay nada del régimen fiscal de SUMETEC aquí.** Nada de IVA, RESICO, CFDI
ni "espejo de la remisión". Los precios de la taquería son al público, un
número y ya. Si algún día se necesita facturar, es otro proyecto.

---

### App aparte, carpeta aparte

No es una sub-app de `MIS APPS` ni un módulo de SUMETEC. Vive sola en
`Desktop\Mis cosas\taqueria\`, con su propio backend, su propia hoja de
Google, su propio ícono en el celular y sus propios colores. Lo único que se
comparte con MIS APPS son las **ideas y los patrones** de código, copiados y
adaptados — no archivos vivos.

---

## 2. Cómo se construye (reusar, no reinventar)

Se copia el patrón de **`Mis cosas\MIS APPS`** (Gastos + Peso), que ya está
probado en celular y con Apps Script:

- **Cero dependencias externas.** Nada de npm, React, Chart.js. HTML + CSS + JS
  a mano, gráficas en SVG escrito a mano (`peso/js/graficas.js` es el modelo).
- **Todo el dinero en centavos enteros.** Nunca flotantes. Regla de MIS APPS,
  aplica igual.
- **`build.py`** empaqueta los módulos ES en un solo `js/app.js` (porque
  abrir por `file://` bloquea `<script type="module">`). Los archivos fuente
  siguen siendo módulos de verdad para que `node --test` los importe.
  ⚠️ Lección cara de MIS APPS: **cada archivo nuevo se agrega a `PAQUETES` en
  `build.py`**, o desaparece del bundle sin ningún error. El `_validar_imports()`
  que ya existe allá se copia aquí desde el día uno.
- **PWA**: `manifest.json` + `sw.js`, se instala como ícono en el celular y
  abre sin internet.
- **Local-first**: la fuente de verdad en caliente es el celular. La nube es
  respaldo y puente entre dispositivos. Capturar una venta **nunca** espera al
  servidor.
- **`node --test tests/*.test.js`** sobre `calculos.js` — todo lo que toque
  dinero se prueba.

### Estructura de archivos

> **Actualizado 2026-08-03 — esto ya es lo que existe, no una propuesta.**
> `vender`/`compras`/`gastos`/`reportes`/`graficas`/`cola`/`api` de la lista
> original eran de cuando el plan cubría TODAS las fases de un jalón; se
> construyeron en su lugar exactamente los módulos que pedía la Fase 1
> (calculadora sola, sin nube). El detalle de cada uno está en `CLAUDE.md`
> — aquí solo el mapa:

```
Mis cosas/taqueria/
├─ index.html                la app: pantalla Cobrar + pantalla Ajustes
├─ js/
│  ├─ app.js                 GENERADO por build.py — nunca editar a mano
│  ├─ dinero.js               centavos enteros, formato $
│  ├─ cambio.js                calcularCambio (resta simple, sin sugerencias)
│  ├─ modelo.js                fechas ISO, crearId
│  ├─ catalogo.js              productos: cuadrícula + ocultos, en localStorage
│  ├─ ticket.js                el carrito en construcción (puro)
│  ├─ almacen.js               tickets guardados, en IndexedDB
│  ├─ cronometro.js            mide ms por ticket
│  └─ ui.js                    pinta y cablea — punto de entrada
├─ css/estilos.css            paleta propia: naranja salsa + verde cilantro
├─ build.py                   con 3 validaciones que ya atraparon bugs reales
├─ tests/*.test.js            26 pruebas, node --test
├─ manifest.json, sw.js       PWA instalable, offline
├─ icon-512.png               placeholder (taco genérico)
├─ docs/CALCULADORA.md        cómo quedó construida la calculadora
├─ docs/ORDENES.md            diseño de la cola (SIN construir, Fase 3)
└─ CLAUDE.md                  arquitectura, para que la IA no la redescubra

  Todavía NO existen (llegan en su fase): apps_script/Codigo.gs, cola.js,
  api.js (Fase 2 — nube); ordenes.js (Fase 3 — la cola); compras.js,
  gastos.js (Fase 4); reportes.js, graficas.js (Fase 5).
```

### Por qué IndexedDB y no localStorage para las ventas

Una taquería puede hacer 150–300 tickets al día. `localStorage` son ~5 MB y se
llenaría en unos meses. Los tickets van a **IndexedDB** (ya se usa en MIS APPS
para las fotos de fondo); la configuración y el catálogo, que son chicos, en
`localStorage`.

### 2.1 Varios usuarios en tiempo real — lo que sí y lo que no

Todos los usuarios comparten **un solo juego de datos**: las ventas que captura
uno aparecen en la pantalla del otro. No hay silos por persona.

- **Entrar**: nombre + PIN, igual que el launcher de MIS APPS. El PIN no es
  seguridad de verdad, solo evita capturar sin querer en el nombre de otro.
- Cada ticket, compra y gasto guarda **quién lo capturó**. Sirve para el
  reporte ("cuánto cobró cada quien") y para rastrear un error.
- **Actualización**: la app pregunta cada ~10 segundos si algo cambió, con una
  llamada baratísima que no toca las hojas (el truco de `leerVersion()` en
  MIS APPS). Si cambió, baja lo nuevo. Si no, no gasta nada.

**El límite, dicho claro:** con Google Sheets + Apps Script, "tiempo real"
significa **entre 5 y 15 segundos de retraso**, no instantáneo. Google no
ofrece aviso push; hay que preguntar. Para una taquería con 2 o 3 dispositivos
esto sobra — nadie necesita ver el taco del compañero en el mismo segundo.

Si algún día resulta que sí se necesita instantáneo de verdad, la salida es
cambiar el backend a Firebase o Supabase (sí dan push real y su plan gratis
alcanza de sobra). **No lo recomiendo de entrada**: agrega otra cuenta que
administrar, mete una dependencia externa, y pierde lo que a ti te sirve —
que los datos estén en una hoja de cálculo que puedes abrir en Excel. La app
se diseña con `api.js` aislado, así que ese cambio sería una pieza, no una
reescritura.

**Escribir al mismo tiempo desde dos celulares no rompe nada**: los tickets
solo se agregan, cada uno con ID único (dispositivo + momento), y el backend
usa `LockService` para no encimar escrituras.

### 2.2 Actualizar precios en todos los aparatos

**Pedido de Miguel el 2026-08-03:** una sección para actualizar precios que
los mande a Drive y **todos los dispositivos se actualicen al instante**.

Cómo queda:

- **Ajustes → Precios**: una lista corta, un renglón por producto, se
  teclean los nuevos y se guarda. Al guardar sube a Drive en una sola
  llamada, no una por producto.
- **En el aparato donde se cambian, el cambio es inmediato** — no espera a
  nada.
- **En los demás aparatos entran solos**, sin que nadie toque nada, por el
  sondeo barato de la sección 2.1. Además hay un **"actualizar ahora"** por
  si se quiere forzar.
- Cuando entran precios nuevos, la app lo dice: *"Precios actualizados"*.

**Lo instantáneo, dicho con honestidad:** en el aparato del dueño el cambio
es instantáneo de verdad; **en los otros tarda entre 5 y 15 segundos**,
porque Google Sheets no avisa solo, hay que preguntarle (mismo límite de la
sección 2.1, no hay forma de esquivarlo con Sheets). En la práctica esto no
se nota: los precios se cambian antes de abrir o entre clientes, no a media
fila. Si algún día hiciera falta instantáneo de verdad (menos de 1 segundo),
la salida sigue siendo Firebase/Supabase — ver 2.1.

**Un precio nuevo NUNCA cambia un ticket a medias.** Cada renglón del
carrito guarda el precio con el que se agregó (`precioUnitarioCentavos` en
`js/ticket.js` — ya funciona así hoy). Si el dueño sube el precio del taco
mientras el cobrador lleva 5 capturados, esos 5 se cobran al precio viejo y
el cambio entra en el siguiente ticket. Sin esto, el total cambiaría solo
frente al cliente — inaceptable.

Por lo mismo, **los reportes históricos no se mueven** cuando cambian los
precios: cada venta ya guardó a cuánto se vendió.

**Quién puede cambiarlos:** solo el dueño — ver la sección 7.1.

---

## 3. La calculadora rápida (el corazón del proyecto)

> ⚠️ **Esta sección quedó rebasada por [`docs/CALCULADORA.md`](docs/CALCULADORA.md)
> (2026-08-03)** — el análisis a fondo de velocidad. Lo importante que cambió:
> las posiciones de los botones **se congelan** (aquí decía que se
> auto-ordenaran por lo más vendido, y eso mata la memoria muscular), cobrar
> **es** guardar (un toque menos, con deshacer en vez de confirmar), y la fila
> de billetes se arma según el total con el cambio ya calculado antes de
> tocarlo. Lee ese documento; esto se queda solo como referencia de lo demás.

Esto es lo único que se va a usar **200 veces al día, con las manos ocupadas y
un cliente esperando**. Si esto no es rapidísimo, lo demás no importa.

### Cómo se captura

Botonera grande, un producto por botón, los más vendidos arriba. **Un toque =
+1**. Para tres tacos de adobada hay dos caminos, los dos válidos:

1. **Tres toques** en "Adobada". Cero que aprender, imposible equivocarse.
2. **Prefijo de cantidad** (como una caja registradora real): tocas `3` en la
   fila de números y luego "Adobada" → entra 3 de golpe. Para el que ya agarró
   el ritmo.

Ambos conviven. El botón muestra un globito con cuántos lleva. Abajo, el
ticket en renglones; tocar un renglón lo baja de uno, mantener presionado lo
borra.

**El total, gigante, siempre visible.** No escondido tras un botón.

### Cobrar y dar cambio

- Botones de billete: `$50` `$100` `$200` `$500` `Exacto`, más un campo para
  teclear cualquier cantidad.
- El **cambio sale en letras enormes**, del tamaño del total.
- Un botón **"$ libre"** para lo que no está en el catálogo (una orden rara,
  algo que le pidieron especial). Siempre tiene que haber salida.

#### "¿No tiene 3 pesos?" — la ayuda de cambio ⭐

Éste es el caso real, y es la función que más se va a usar:

> El total es **$403**. El cliente saca un billete de **$500**. El cambio
> serían $97 en puro cambio menudo. Entonces le dices:
> **"¿no tiene 3 pesos?"** — te da $503 y le regresas **$100 de un billete.**

La app hace esa cuenta sola. En cuanto marcas que el cliente da $500, aparece,
grande, arriba del cambio:

```
     Pídele  $3  más   →   le regresas  $100
                          (si te da los $500 nada más: $97)
```

Nada que teclear, nada que pensar, y es la cuenta que hoy hace de cabeza con
un cliente enfrente.

**Cómo decide qué pedir**: busca la cantidad **más chica** que el cliente
podría traer suelta (hasta ~$20) con la que el cambio queda en billetes
limpios — un solo billete gana sobre dos, y $100 gana sobre $50 + $50.
Denominaciones mexicanas de verdad (monedas $1 $2 $5 $10, billetes $20 $50
$100 $200 $500). Si con lo que dio ya sale limpio, no sugiere nada y no
estorba.

Los botones de billete también traen su pista abajo, antes de tocarlos:

```
  $200          $500
  cambio $97… no alcanza    →  pide $3, das $100
```

**Esto no cambia el total.** El cliente paga los $403 completos, solo con
otra combinación de billetes. El ticket queda: total $403, recibió $503,
cambio $100. Nada que cuadrar después.

#### El otro caso: cuando sí se perdona el cambio

A veces no es acomodar billetes, es que **de plano se redondea**: son $298,
"déjalo en $300", o al revés, "págame $295". Para eso el campo de **cambio es
editable**: escribes lo que de verdad vas a regresar y la app guarda la
diferencia como **redondeo (+$2 / −$3)**. Así el reporte del día cuadra contra
el dinero real de la caja y no contra la teoría. Nada de "sobró dinero y no sé
de dónde".

### Cosas que evitan enojos

- **Guardar = un toque**, y la calculadora se limpia sola lista para el
  siguiente cliente. No espera al servidor, no muestra "sincronizando".
- **Deshacer** el último ticket, grande y a la mano. Y la lista de tickets del
  día, para borrar o corregir uno de hace rato.
- **Fiado**: marcar el ticket como no pagado con un nombre. En una taquería
  pasa; si no está, se registra mal o no se registra.
- Funciona **sin internet**, siempre. Es un puesto de tacos, no una oficina.

---

## 4. Órdenes — la cola de lo que hay que preparar

**Agregado al plan el 2026-08-03, a petición de Miguel. Diseño completo en
[`docs/ORDENES.md`](docs/ORDENES.md) — aquí solo el resumen.**

Un botón **`+ Orden`** arriba en la pantalla de cobrar levanta el pedido de
la gente que llega y todavía no se atiende. Se forma en una **cola**, y el
taquero la abre para ver clarísimo qué preparar.

**No contradice la decisión de "sin cuentas abiertas ni mesas"** (sección 1):
el cliente sigue pagando cuando se le entrega. Lo que se agrega es el rato
entre *"deme cinco de asada"* y *"aquí tiene"* — que hoy la app ignora, y que
en un puesto con fila es donde se pierden pedidos.

Lo esencial:

- **Una orden son platos, no una lista plana.** *"En un plato 2 de asada y 3
  de adobada, y aparte otras cosas"* — cada plato lleva sus propios "sin"
  (`S/cebolla`, `S/cilantro`, `S/salsa`, `todo aparte`), porque así se habla
  y así se sirve. **`Con todo` es el default y cuesta cero toques.**
- **Se reusa la misma cuadrícula** de la calculadora, con las mismas
  posiciones congeladas. Inventar un segundo selector de productos tiraría a
  la basura la memoria muscular que se ganó en la Fase 1.
- **El camino directo no se toca.** Quien no use `+ Orden` tiene exactamente
  la app de hoy. Y cobrar *desde* una orden es **más rápido** que hoy: los
  productos ya están capturados, solo falta el pago.
- **La vista del taquero es lo que más importa** — número grande primero
  (`2 ASADA`), platos separados de verdad, y los "sin" en rojo arriba del
  plato (servir con cebolla lo que se pidió sin cebolla es *el* error clásico
  y significa rehacerlo).

**Dónde entra:** ver la Fase 3 en la sección 9 — va después de la nube,
porque una cola compartida entre el que toma la orden y el taquero solo
sirve de verdad si los dos aparatos ven lo mismo.

---

## 5. Compras (materia prima)

Dos modos, porque no siempre hay tiempo de capturar bonito:

- **Rápido** (10 segundos): categoría + total + foto del ticket. Ya sirve para
  la utilidad de caja. La foto se comprime y se manda como base64, igual que
  en `12.- GASTOS E INVENTARIO`.
- **Detallado**: renglones con producto, cantidad, unidad (kg / pza / lt /
  manojo) y precio. Cuesta más, pero desbloquea el **historial de precios**
  (ver Fase 6) — que es donde está el dinero escondido.

**Categorías propuestas** (editables): Carnes (res, adobada, tripa, buche,
cabeza, lengua, chorizo, cerdo), Tortillas, Verduras y salsas (tomate, chile,
cebolla, cilantro, rábano, limón, aguacate), Abarrotes (aceite, sal,
especias), Bebidas, Desechables (servilletas, platos, bolsas), Gas.

---

## 6. Gastos (lo que no es materia prima)

Renta, luz, agua, gas de tanque, sueldos, permisos y licencias, mantenimiento,
gasolina/transporte, publicidad.

**Propuesta mía, importante:** cada gasto lleva un **periodo** — único,
mensual o anual. El permiso de $6,000 al año **no debe hacer ver un día
pésimo**. En los reportes hay un interruptor: *"repartir los gastos grandes
entre los días que cubren"*. Prendido, ves la realidad del negocio; apagado,
ves el flujo de efectivo tal cual. Los dos sirven, para cosas distintas.

---

## 7. Reportes y gráficas

Todo en SVG a mano, dentro de la app, sin librerías.

**Lo que pediste:**

1. **Ventas por día** (barras, últimos 30 días) con línea de promedio.
2. **Ventas / compras / gastos / utilidad** por semana y por mes.
3. **Cuánto se vendió de cada producto** — barras horizontales, en dos vistas:
   por **cantidad** (cuántos tacos de adobada) y por **dinero** (cuánto
   dejaron). Casi nunca es el mismo orden, y esa diferencia es información.
4. Totales de día / semana / mes / año.

**Lo que propongo yo, que sale casi gratis porque el dato ya está:**

5. **Hora pico.** Cada ticket lleva su hora. Saber que el 60% se vende entre
   7 y 9 de la noche le dice cuánta carne poner, a qué hora abrir y si la
   primera hora vale la pena. Creo que ésta va a ser la gráfica que más use.
6. **Por día de la semana.** ¿El martes deja o solo cansa?
7. **Ticket promedio y número de clientes por día.** Si un día vendió menos:
   ¿vinieron menos personas, o gastaron menos cada una? Son dos problemas
   distintos con dos soluciones distintas.
8. **Mezcla de productos** (% de cada carne). Es la lista de compras del
   siguiente día, deducida sola.
9. **Cuánto cobró cada usuario** — sale gratis ahora que cada ticket guarda
   quién lo capturó, y sirve para rastrear un error tanto como para saber
   quién tiene el turno pesado.

### 7.1 Modo dueño — las métricas bajo contraseña

**Pedido de Miguel el 2026-08-03:** *"la parte de métricas quiero que tenga
una contraseña, que se respalde en Drive, para que nadie pueda leer las
métricas más que los dueños"*.

**Esto contesta una pregunta que quedó abierta** en la sección 12: ahí decía
que faltaba saber si los empleados debían ver el dinero del negocio, y que
se iba a construir un interruptor por usuario prendido por omisión. Ya no
hace falta el interruptor — la respuesta es **no**, y se resuelve con una
sola llave.

**Una sola contraseña, no varias sueltas.** En vez de ponerle candado a cada
pantalla por separado, hay un **modo dueño** que se desbloquea una vez y
abre lo que es del dueño:

| Bajo llave | Libre para todos |
|---|---|
| Métricas y gráficas (sección 7) | Cobrar |
| **Cambiar precios** (sección 2.2) | Levantar órdenes |
| Compras y gastos (secciones 5 y 6) | Ver la cola |
| Alta y baja de usuarios | Su propio resumen del día |

Poner los **precios** bajo la misma llave es la razón principal para tener
llave: quien puede cambiar precios puede cobrar de menos y quedarse con la
diferencia. Si las métricas se esconden pero los precios no, el candado no
sirve de mucho.

**Cómo se guarda, para que "respaldarla en Drive" no sea un problema:** en
Drive **nunca** va la contraseña, va su **huella** (hash con sal, PBKDF2 —
la misma técnica que ya usa `shared/cifrado.js` en MIS APPS). La app compara
huellas. Así, aunque alguien abra la hoja de cálculo, **no puede leer la
contraseña**, ni siquiera Miguel. Y como vive en Drive, sirve igual en todos
los aparatos y sobrevive a reinstalar la app.

**Hasta dónde protege, dicho claro.** La app es un sitio público en GitHub
Pages: el código lo puede leer cualquiera, y los datos viven en el propio
celular. Entonces:

- ✅ **Sí evita** que un empleado agarre el celular y se meta a ver las
  ventas, la utilidad o lo que se paga de renta. **Ése es el problema real**
  y lo resuelve bien.
- ❌ **No protege** contra alguien técnico con el celular desbloqueado en la
  mano: los datos están ahí y se pueden leer con las herramientas del
  navegador.

Es una **cerradura de puerta, no una caja fuerte** — el mismo criterio que
ya se escribió para el PIN de MIS APPS. Encriptar todo de verdad sí es
posible, pero rompería lo que a Miguel le sirve: poder abrir la hoja en
Excel y ver sus números.

**Detalles a resolver al construirlo:**
- ¿Se pide cada vez que se entra a Métricas, o se queda desbloqueado un
  rato? (Pedirla cada vez es más seguro; cada 30 min es más usable.)
- ¿Qué pasa si se le olvida? Sin manera de recuperarla, el dueño se queda
  fuera de sus propios números. Propuesta: se puede reponer desde Ajustes en
  un aparato **que ya esté desbloqueado**, y si no queda ninguno, borrando y
  volviendo a poner la huella directo en la hoja de Drive (Miguel tiene
  acceso).
- Face ID / huella del celular como atajo, igual que en MIS APPS
  (`shared/passkey.js`) — cómodo, y ahí ya está resuelto cómo se hace.

---

## 8. Candados — que ninguna venta se pierda

**Agregado al plan el 2026-08-03, a petición de Miguel:** *"candados para que
todas las ventas se guarden, para asegurar que el usuario sí envíe la venta"*.

### La regla que los rige

Un candado que molesta en cada venta se ignora, y a la semana se apaga o se
le pica "aceptar" sin leer. Entonces:

> **Los candados se callan cuando todo va bien y solo gritan cuando de
> verdad hay algo perdido.** Cero toques de más en la venta normal.

Es la misma lógica que ya se usó para preferir DESHACER sobre "confirmar"
(ver `docs/CALCULADORA.md`): no le cobres a los 200 tickets buenos el precio
de proteger a los 5 malos.

### Los riesgos reales, ordenados por cuánto dinero cuestan

**1. Orden entregada y nunca cobrada** — se entregó la comida y nadie cobró.
Es la pérdida más cara y **solo existe a partir de las órdenes** (sección 4).
*Candado:* una orden nunca desaparece sola. Al entregarla pasa a "por
cobrar", con un contador visible que no se puede ignorar (`⚠ 2 sin cobrar`),
y el tiempo que lleva así. Cobrarla la cierra; solo se puede descartar a
mano y dejando dicho por qué (cortesía, se fue sin pagar, error).

**2. El ticket a medias se pierde** — se llevan capturados 6 tacos, se
bloquea el celular o se cierra la app, y al volver está vacío.
⚠️ **Hoy esto NO está protegido.** `docs/CALCULADORA.md` lo promete en su
sección 8 ("el ticket a medias sobrevive... se guarda en cada toque") pero
el código actual tiene el carrito **solo en memoria** (`let carrito` en
`js/ui.js`) — se verificó el 2026-08-03. Es un hueco real entre lo diseñado
y lo construido.
*Candado:* guardar el carrito en curso en cada toque y recuperarlo al abrir.
Es barato y **debería hacerse en la próxima tanda de trabajo, antes que
cualquier cosa nueva** — es una promesa ya escrita que no se está
cumpliendo.

**3. El modo práctica se queda prendido** — se practica un rato, se olvida
apagarlo, y las ventas reales del día se guardan como práctica: no cuentan
en ningún reporte. Este riesgo **lo introdujo la app misma** al agregar el
modo práctica.
*Candado:* el modo práctica se apaga solo (al cambiar de día, o después de
X minutos sin uso), además del letrero que ya existe.

**4. Ticket olvidado que contamina al siguiente** — quedan 3 tacos
capturados de un cliente que ya se fue; llega el siguiente, se le suman sus
tacos encima y sale un ticket falso — y la venta anterior nunca existió.
*Candado:* si el carrito lleva más de N minutos sin tocarse, al volver
pregunta una sola vez: *"¿este ticket sigue vivo?"* → seguir / descartar.

**5. Capturado pero nunca respaldado** (a partir de la Fase 2) — todo vive
en el celular; si se pierde o se reinstala la app, se va con él.
*Candado:* contador visible de ventas sin respaldar, y **aviso fuerte si
crece o si lleva días sin subir** — no basta con reintentar en silencio,
porque un fallo silencioso se ve igual que todo bien.

**6. Cobrar dos veces la misma orden** — el error contrario, y también
cuesta (un cliente enojado). *Candado:* una orden cobrada queda bloqueada;
no se puede volver a cobrar. Ver `docs/ORDENES.md`.

**7. Precios de ejemplo** — cobrar todo el día con los precios de relleno.
*Candado:* **ya existe y ya funciona** — bloquea el cobro hasta confirmarlos.

### Cierre del día

Una pantalla al terminar que **no deja pendientes vivos**: órdenes sin
cobrar, tickets a medias, ventas sin respaldar. Resolver o descartar cada
una, y se cierra el día.

**Esto no es el corte de caja** que Miguel dejó fuera (sección 1) — aquí no
se cuenta efectivo ni se cuadra sobrante/faltante. Es solo la revisión de que
nada quedó a medias. El corte de caja de verdad sigue pendiente, en la
Fase 6.

---

## 9. Fases

Cada fase deja algo **usable**, no un pedazo a medias.

### Fase 0 — Esqueleto y catálogo ✅ CONSTRUIDA (2026-08-03)
Estructura de archivos, `build.py` con tres validaciones (imports fuera de
lista, alias, colisión de nombres — las tres atraparon bugs reales durante la
construcción), `almacen.js`, PWA instalable, y **Ajustes → "Tus productos"**:
un checkbox por producto (en la cuadrícula sí/no, tope 11) y arrastrar para
el orden — no flechas. Precargado un catálogo típico de taquería (11 en la
cuadrícula + 8 detrás de "Más…") con precios de relleno que bloquean el
cobro hasta confirmarse.

### Fase 1 — La calculadora ⭐ CONSTRUIDA (2026-08-03)
Todo lo de `docs/CALCULADORA.md`: cuadrícula de posiciones fijas, toque corto
= +1 / toque largo = cantidad grande, "cobrar es guardar" con DESHACER de 6s,
un campo junto al total ("Paga con…", vacío = pagó exacto) con el cambio
calculado al instante, `$ libre`, cronómetro propio (mediana / peor 10%),
modo práctica. 26 pruebas `node --test` en verde + flujo completo probado a
mano en navegador.

> Nota: la primera versión de esta fase incluía una "ayuda de cambio" que
> sugería pedir sueltos para dar cambio limpio -- se construyó, se probó, y
> Miguel pidió quitarla ("ya no vamos a pedir nada"). Ver CLAUDE.md.

Guarda todo en el celular (IndexedDB); la nube y los demás usuarios entran en
la Fase 2 — para la prueba de campo basta un dispositivo.

> **Recomendación fuerte, sigue en pie:** antes de tocar la Fase 2, **que
> Miguel se la dé a usar a su familiar una semana real**, con clientes de
> verdad. Es la única forma de saber si de verdad es tan rápida como se
> diseñó — un cronómetro corriendo en un navegador de escritorio no reemplaza
> manos grasosas y un cliente esperando. Todo lo que se construya después
> sobre una calculadora que no le acomoda es trabajo tirado. Ajustar aquí es
> barato; ajustar en la Fase 5 no.
>
> **Cómo probarla hoy:** abrir `index.html` en un navegador (o instalarla
> como PWA — "Añadir a pantalla de inicio") y usar el catálogo de ejemplo;
> confirmar precios en Ajustes antes de cobrar. Ver `CLAUDE.md` para el
> puerto de preview local si se prueba desde esta sesión.

### Fase 1.5 — Lo que se puede hacer sin nube ⏭️ LO SIGUIENTE
Chica y va primero, antes que cualquier cosa nueva. Lo primero son huecos de
la Fase 1, no features (ver sección 8); lo último es el popup, que Miguel
pidió y tampoco necesita servidor:

- **Guardar el carrito en curso en cada toque** y recuperarlo al abrir.
  `docs/CALCULADORA.md` ya lo promete y el código **no lo cumple** — el
  carrito vive solo en memoria. Es la deuda más clara que hay hoy.
- **Apagar solo el modo práctica** (al cambiar de día o tras X minutos).
- **Aviso de ticket olvidado** si el carrito lleva N minutos sin tocarse.
- **El popup de cobro** (`docs/CALCULADORA.md` 6.b) — total, con cuánto
  paga, Confirmar, y el cambio en grande al instante. Es **local puro**: no
  necesita nube, y la parte de "guardar por detrás sin que nadie espere" ya
  aplica hoy contra IndexedDB. Cuando llegue Drive (Fase 2) se le cuelga
  atrás sin cambiar la pantalla.

Se puede hacer aunque la prueba de campo siga corriendo — el popup sí lo va
a notar, así que conviene entregárselo junto y **mirar el cronómetro antes y
después** para saber si le costó tiempo.

### Fase 2 — Nube, usuarios y tiempo real
**Se adelantó** (antes era la 3): con varios usuarios compartiendo información
en vivo, el backend dejó de ser un respaldo y pasó a ser parte del producto.
Además conviene construirlo cuando el modelo de datos de ventas ya está
probado en campo pero todavía no cargamos compras y gastos encima — así el
backend se escribe una vez, no dos.

Incluye: `apps_script/Codigo.gs` standalone (se crea solo en Drive, sin que
nadie tenga que armar hojas a mano), alta de usuarios con PIN, cola offline con
**sincronización por lote** (no una llamada por ticket — se acaba la cuota de
Apps Script), el sondeo barato de ~10 segundos de la sección 2.1, respaldo
diario automático en carpeta hermana, y `exportarTodo`/`importarTodo` para la
mudanza de cuenta.

Aquí también entran:

- El **candado 5** (contador de ventas sin respaldar, con aviso fuerte si
  crece o si lleva días — sección 8).
- **Ajustes → Precios** y su bajada automática al resto de los aparatos
  (sección 2.2). Es lo primero que aprovecha la nube y lo más fácil de
  probar: se cambia un precio en un celular y se ve entrar en el otro.
- El **modo dueño** (sección 7.1): la contraseña, su huella guardada en
  Drive, y la llave puesta al menos sobre **precios** — que es lo que ya
  existe para proteger. Métricas, compras y gastos se le van sumando
  conforme se construyen.

### Fase 3 — Órdenes (la cola)
Todo lo de [`docs/ORDENES.md`](docs/ORDENES.md): `+ Orden`, platos con sus
modificadores, la cola numerada, la vista del taquero, y cobrar desde una
orden.

**Va después de la nube, a propósito.** Una cola compartida entre el que
levanta el pedido y el que cocina **solo sirve de verdad si los dos aparatos
ven lo mismo** — construirla local primero y volver a hacerla para
sincronizar sería el mismo trabajo dos veces. Es el mismo razonamiento que ya
adelantó la nube de la Fase 3 a la 2.

*Excepción:* si la prueba de campo de la Fase 1 grita que la cola es lo que
más urge (más que la nube), se puede adelantar la parte local sabiendo que
habrá que retocarla al sincronizar. Que sea una decisión, no un descuido.

Aquí entran los **candados 1 y 6** (ninguna orden se entrega sin cobrar,
ninguna se cobra dos veces) y el **cierre del día** — sección 8.

### Fase 4 — Compras y gastos
Secciones 5 y 6, con foto de ticket. Aquí ya se cierra la utilidad de caja:
cuánto entró, cuánto salió, cuánto quedó.

Estructura en Drive:

```
Mi unidad/
├── Taqueria/
│   └── Datos            ← Usuarios, Tickets, Ventas (un renglón por producto),
│                          Ordenes, OrdenesDetalle,
│                          Compras, ComprasDetalle, Gastos, Productos, Config
└── Taqueria-respaldo/   ← copia diaria, carpeta HERMANA a propósito:
                           si se borra Taqueria/, el respaldo no se va con ella
```

**Ventas con un renglón por producto vendido** (con `id_ticket` que los
agrupa), porque así "cuánto vendí de cada taco" se saca también directo en
Excel/Sheets, sin depender de la app.

**Conflictos entre dispositivos:** casi no existen. Tickets, compras y gastos
solo se agregan, cada uno con ID único (dispositivo + momento) — se juntan sin
pelearse. Lo único compartido de verdad es el catálogo de productos, y ahí
gana el último cambio, con número de versión (mismo truco que `leerVersion()`
en MIS APPS: preguntar barato si algo cambió antes de bajarlo todo).

⚠️ **Las órdenes son la excepción** y hay que tratarlas aparte: a diferencia
de un ticket, una orden **cambia de estado** (en cola → entregada → cobrada)
y la tocan dos aparatos distintos. No basta con "solo se agregan". La regla
propuesta: **el estado solo avanza, nunca retrocede** — si dos aparatos
mandan estados distintos de la misma orden, gana el más avanzado. Así, dos
personas marcando "entregada" a la vez no se pisan, y una orden cobrada
jamás vuelve a la cola. Se decide con el código enfrente en la Fase 3.

⚠️ Recordatorio permanente: **cada cambio a `Codigo.gs` necesita "Implementar
→ nueva versión"** en script.google.com. Guardar en el editor no despliega.

### Fase 5 — Reportes y gráficas
Sección 7 completa, **toda detrás del modo dueño** (sección 7.1) — es
justo lo que Miguel quiere que nadie más lea. Con las órdenes ya construidas
se suman gratis dos números que hoy no existirían: **cuánto tarda una orden**
de que se levanta a que se entrega, y **cuántas órdenes se atienden por
hora** en el pico.

### Fase 6 — Lo que se decide después de verlo funcionando
Ninguna es obligatoria; se toman las que él pida al usarlo:

- **Historial de precios de insumos** + aviso cuando algo sube más de X%
  ("la res te subió de $180 a $215 el kilo este mes"). Requiere captura
  detallada de compras.
- **Punto de equilibrio diario**: con los gastos fijos del mes, "necesitas
  vender $X al día para no perder". Es una resta, y cambia cómo se ve el día.
- **Cuánto preparar mañana**: promedio de los últimos 4 mismos días de la
  semana. "Los sábados vendes ~140 de adobada."
- **Combos frecuentes**: si el 30% de los tickets son lo mismo, un botón que
  los meta de un toque. Se detectan solos con el histórico.
- **Corte de caja con conteo de efectivo** (lo que quedó fuera hoy).
- **Costo por receta / escandallo** — margen real de cada taco. Es el salto
  grande: exige capturar recetas y rendimientos, y mantenerlos. Solo si él
  quiere, y solo cuando lo demás ya sea costumbre.

---

## 10. Cómo llega al celular

Igual que MIS APPS: GitHub Pages sirve el sitio (el código es público, los
datos nunca — viven en el celular; la nube privada llega en la Fase 2), y en
el teléfono se abre la liga y se hace *"Añadir a pantalla de inicio"*. Un
ícono, abre sin internet.

En iPhone tiene que ser desde **Safari**, no Chrome, o no se instala.

**Estado (2026-08-03):** `git init` local ya hecho, con el primer commit.
Falta el repo remoto — **Miguel lo crea vacío en github.com** (público, para
GitHub Pages gratis) y da la URL; desde ahí `git remote add origin <url> &&
git push`. GitHub Pages se activa en el repo: Settings → Pages → Deploy from
branch → `main` / raíz. No hace falta ninguna carpeta `deploy/github/` como
en COTIZADOR — aquí el repo completo ES la app.

**Actualizarse sin que el caché estorbe:** `build.py` calcula un hash del
shell (`index.html`+css+js+manifest) y lo escribe como versión del `CACHE` en
`sw.js` en cada build — a diferencia de MIS APPS (que requiere subir un
número a mano y alguna vez se le olvidó), aquí es automático: cualquier
cambio real dispara un service worker "distinto" y el navegador lo nota
solo. `ui.js` además llama `registration.update()` al cargar y se recarga
sola en cuanto el nuevo service worker toma control (salvo que haya algo
escrito sin mandar) — mismo patrón ya probado en MIS APPS.

---

## 11. Riesgos que veo

- **El de siempre: que no la use.** Un puesto de tacos es prisa, grasa y manos
  mojadas. Por eso la calculadora va primero y se prueba en campo antes de
  construir lo demás.
- **Que capture ventas pero no compras.** Sin compras no hay utilidad, y la
  app se vuelve una calculadora cara. De ahí el modo rápido de 10 segundos con
  foto: la meta es que capturar un gasto sea más fácil que guardar el ticket
  de papel.
- **Cuota de Apps Script** si se sincroniza ticket por ticket. Se resuelve con
  lotes desde el diseño, no después.
- **El respaldo que nunca se instaló.** En MIS APPS el respaldo automático
  lleva meses pendiente porque hay que correr una función a mano una vez.
  Aquí se construye en la Fase 2 **y se corre ese mismo día**, no se apunta
  como pendiente.

---

## 12. Lo que falta decidir (no bloquea empezar)

- **Nombre de la app** y color. Ahorita la carpeta se llama `TAQUERIA` y la
  paleta está sin definir — no van los azules de SUMETEC ni el índigo de MIS
  APPS, esto es un negocio distinto y merece verse distinto.
- **Su lista real de productos y precios.** Se arranca con un catálogo típico,
  pero mientras antes mande el suyo (aunque sea una foto del menú), mejor
  queda la Fase 0.
- **Si maneja fiados** y si vende cerveza (cambia si conviene separar bebidas
  con permiso aparte).
- ~~**Quiénes son los usuarios y qué ve cada quien.**~~ ✅ **RESUELTO el
  2026-08-03:** los empleados NO ven el dinero del negocio. En vez del
  interruptor por usuario que se iba a construir, hay una contraseña — el
  **modo dueño** — que abre métricas, precios, compras y gastos. Ver la
  sección 7.1.
- **Dónde va a vivir la carpeta.** Hoy quedó en `Mis cosas\taqueria`, fuera de
  SUMETEC a propósito — no es del negocio de Miguel y no debe mezclarse con
  sus reglas fiscales. Tampoco es sub-app de MIS APPS: es su propia app, con
  su propio backend, su propio ícono y sus propios colores.
