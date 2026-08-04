# La calculadora — diseño para velocidad

**2026-08-03.** Miguel: *"quiero que sea excesivamente rápida, es lo más
importante de todo, sin ella no me interesa nada"*.

Este documento reemplaza la sección 3 del `PLAN.md`. Es un análisis, no una
lista de deseos: cada decisión trae por qué, y las que estaban mal en el plan
original están marcadas.

---

## 1. Contra qué estamos compitiendo (esto cambia todo)

El que cobra **hoy ya es rápido**. Hace la cuenta de cabeza en 2 segundos:
"3 adobada y una mulita" → sabe el total antes de terminar de oírlo. Lleva años
haciéndolo.

La app **no le va a ganar a su cabeza en sumar**. Nunca. Esa competencia está
perdida antes de empezar y es un error plantearla así.

Lo que la app puede darle y su cabeza no:

1. **El registro** — el dato que después se vuelve la gráfica de qué se vende.
2. **El cambio difícil** — el "$403, me da $500" es justo donde la cabeza sí
   se traba y donde se pierden segundos y se dan cambios mal.

Entonces la meta real no es *"que la app sea rápida"*, es:

> **Que registrar el ticket cueste menos tiempo del que el cliente tarda en
> sacar la cartera.**

Ése es el listón. Si captura mientras el cliente busca el dinero, el registro
sale **gratis** — no le quita nada. Si tarda más que eso, el cliente espera,
y a la semana la app está desinstalada. No hay punto medio.

**Meta medible: 6 segundos de mediana por ticket, 12 en los peores.**
Y sí se puede medir (ver sección 8).

---

## 2. Dónde se va el tiempo de verdad

Instinto: "el tiempo se va en los toques, hay que reducir toques".
**Es falso.** Un toque en un botón grande cuesta ~0.5 s. Un ticket de 5
productos son 2.5 s de toques. Eso no es el problema.

El tiempo real se va en tres cosas, en este orden:

| Qué | Cuánto cuesta | Se arregla con |
|---|---|---|
| **Buscar el botón con la vista** | 1–3 s **por producto** si la cuadrícula es grande o cambia | Posiciones fijas y pocos botones |
| **Cambiar de pantalla** | 1–2 s cada vez (más el "¿en qué iba?") | Una sola pantalla, siempre |
| **Corregir un error** | 3–8 s, y el coraje | Ver el error antes de guardar + deshacer |

**Buscar con la vista es el enemigo número uno.** Contra eso solo hay una
defensa, y es la memoria muscular: que la mano vaya sola sin que los ojos
participen. Y la memoria muscular necesita **que nada se mueva, nunca**.

---

## 3. ⚠️ El error del plan original

En el `PLAN.md` propuse:

> *"los más vendidos arriba (auto-ordenados por frecuencia real)"*

**Está mal y hay que quitarlo.** Si los botones se reacomodan solos según lo
que más se vende, la memoria muscular **jamás se forma**: cada semana la
adobada está en otro lado y los ojos tienen que volver a buscar. Un acomodo
"inteligente" que se mueve es peor que un acomodo mediocre que se queda
quieto.

**Regla nueva, dura:** las posiciones las decide él una vez, arrastrando los
botones como los íconos del celular, y **después no se mueven jamás solas**.
En la semana 4 va a estar tocando "adobada" sin voltear a ver la pantalla. Eso
es lo que hace que un ticket baje de 12 segundos a 4.

Es la diferencia más grande entre una app que se usa y una que se abandona, y
la tenía al revés.

---

## 4. Una sola pantalla, sin excepciones

Nada de "captura" → "cobrar" → "confirmar". **Todo cabe y todo se ve siempre:**
el total, los productos, y los botones de pago. Cero cambios de pantalla en un
ticket normal.

```
┌──────────────────────────────────────┐
│                                      │
│  TOTAL              $403             │  ← enorme, se lee de lejos
│                                      │
├──────────────────────────────────────┤
│ 3 adobada · 1 mulita · 1 refresco  ✕ │  ← un renglón, no una lista
├──────────────────────────────────────┤
│  ┌────────┐ ┌────────┐ ┌────────┐    │
│  │ADOBADA③│ │ ASADA  │ │ TRIPA  │    │
│  ├────────┤ ├────────┤ ├────────┤    │
│  │ CABEZA │ │ LENGUA │ │CHORIZO │    │  ← posiciones CONGELADAS
│  ├────────┤ ├────────┤ ├────────┤    │
│  │MULITA ①│ │QUESADIL│ │VAMPIRO │    │
│  ├────────┤ ├────────┤ ├────────┤    │
│  │ TORTA  │ │  SOPE  │ │ VOLCÁN │    │
│  ├────────┤ ├────────┤ ├────────┤    │
│  │REFRES.①│ │  AGUA  │ │  MÁS…  │    │
│  └────────┘ └────────┘ └────────┘    │
├──────────────────────────────────────┤
│  EXACTO      $500        $1000   OTRO│  ← cobra Y guarda de un toque
│   $403     pide $3→$100   $597       │
├──────────────────────────────────────┤
│              ↺  DESHACER             │  ← 6 seg después de guardar
└──────────────────────────────────────┘
```

**El globito en cada botón (③ ①) es el ticket.** Por eso el renglón de arriba
puede ser un renglón y no una lista: para saber qué llevas, miras la
cuadrícula, que es donde ya estás viendo. Se le devuelve ese espacio a los
botones, que es donde sirve.

---

## 5. El truco que quita un toque entero: cobrar **es** guardar

Flujo del plan original: productos → **Cobrar** → billete → **Guardar** = 2
toques de trámite en cada ticket.

Flujo nuevo: productos → **billete** → listo. El ticket se guarda solo al
tocar el billete.

Son 2 toques menos × 200 tickets = **400 toques menos al día**, y sobre todo
dos decisiones menos por cliente.

**"¿Y si le pico mal y se guarda una venta equivocada?"** Para eso está la
barra de **DESHACER**, grande, 6 segundos.

Y aquí está el razonamiento que vale la pena dejar escrito, porque aplica a
toda la app:

> Un botón de "confirmar" cobra **un toque en los 200 tickets del día** para
> protegerte de los **5 errores** que vas a cometer.
> Un "deshacer" cobra **cero** en los 200 y solo se usa en los 5.
> **Siempre gana deshacer.** Confirmar es cómodo para el que programa, no para
> el que cobra.

---

## 6. Los botones de pago: la respuesta **antes** de tocarlos

Los billetes no son botones fijos $50/$100/$200/$500 — para un total de $403,
$50 y $100 son basura ocupando lugar. **La fila se arma según el total**, y
son máximo cuatro:

| | |
|---|---|
| **EXACTO $403** | por si paga justo o con tarjeta |
| **$500** | el billete que sigue |
| **$1000** | el siguiente |
| **OTRO** | teclado, para cualquier cosa |

Y **debajo de cada uno ya viene el cambio calculado**, antes de tocarlo. Con
eso el que cobra **lee la respuesta y luego toca** — no toca para preguntar.
Ahí es donde la app por fin le gana a la cabeza.

### La ayuda de cambio, que es el corazón

Debajo de `$500`, para un total de $403:

```
        $500
   pide $3 → $100
```

Un cliente con $500 y un total de $403 = $97 de puro menudo. La app dice sola
que le pida $3 y le regrese **$100 de un billete**. No hay nada que teclear,
nada que pensar, y es exactamente la cuenta que hoy hace de cabeza con el
cliente enfrente.

**Cómo la calcula:** busca la cantidad más chica (hasta ~$20) que el cliente
podría traer suelta con la que el cambio queda en billetes limpios. Un billete
gana sobre dos; $100 gana sobre $50+$50. Denominaciones mexicanas de verdad
(monedas $1 $2 $5 $10, billetes $20 $50 $100 $200 $500 $1000). **Si ya sale
limpio, no dice nada** — no estorba cuando no hace falta.

Esto **no cambia el total**: paga sus $403, nada más con otros billetes.
Ticket: total $403, recibió $503, cambio $100. Nada que cuadrar después.

Aparte, para cuando **de plano se perdona el cambio** (son $298, "déjalo en
$300"): el cambio es editable y la diferencia se guarda como **redondeo**, para
que el corte del día cuadre contra el dinero real y no contra la teoría.

---

## 7. Cantidades: por qué tocar tres veces está bien

Para 3 tacos, dos caminos posibles:

- **Tocar 3 veces** — 3 toques, cero que aprender, y ves el globito subir
  1→2→3, o sea que **el error se ve solo**.
- **Prefijo "3" y luego el producto** — 2 toques, pero mete un *modo*: "¿ya
  piqué el 3 o no?". Y los modos, con prisa, producen la peor clase de error:
  el que no notas.

**Se queda tocar repetido como camino principal.** Ahorra 1 toque (0.5 s)
contra el riesgo de una clase de error que cuesta 8 segundos. No compensa.

**Para las cantidades grandes** ("dame 10 de asada", que sí pasa): se toca el
producto una vez y luego **el número en el renglón del ticket**, que abre un
teclado. Son 3 acciones, pero solo en el caso raro. El caso común queda
intacto — que es la regla correcta.

---

## 8. Las cosas chicas que en realidad deciden si la usa

Ninguna suena importante. Todas matan la app si faltan.

- **La pantalla no se apaga** mientras la app está abierta (Wake Lock). Si se
  bloquea entre cliente y cliente, cada ticket empieza con desbloquear el
  celular. Esto solo, sin lo demás, hace que la app se abandone en tres días.
- **Vibración corta en cada toque.** Confirma sin tener que mirar — y los ojos
  están en el cliente y en el asador, no en la pantalla.
- **Respuesta en menos de 100 ms, siempre.** La pantalla se pinta primero y se
  guarda después. **Jamás** esperar al disco ni a internet para pintar un
  número.
- **Sin animaciones** que retrasen. Se ven bonitas la primera vez y estorban
  las otras 199.
- **El ticket a medias sobrevive** a que se bloquee el celular, entre una
  llamada o se cierre la app. Se guarda en cada toque.
- **Números altísimos de contraste.** Un puesto de tacos de noche tiene focos
  amarillos y reflejos; el total tiene que leerse de reojo, de lejos.
- **Dedos grasosos o mojados**: la pantalla táctil falla con humedad. No se
  arregla por software — se arregla con botones grandes y, si se pone
  necio, un mica barata o un lápiz de $50. Vale más decirlo que fingir que no
  pasa.

---

## 9. Cómo vamos a saber si de verdad es rápida

No de oídas ni "se siente rápido". **La app se cronometra sola**: mide los
milisegundos entre el primer toque y el guardado de cada ticket, sin mandarlo
a ningún lado.

En Ajustes hay una pantallita: *mediana, el peor 10%, y cuántos tickets se
deshicieron*. Con eso, después de una semana real, sabemos si está en 6
segundos o en 20 — y **qué botón** es el que se busca lento.

También hay un **modo de práctica** para que se acostumbre sin ensuciar los
números de verdad.

---

## 10. Lo que consideré y descarté (y por qué)

- **Dictado por voz** ("tres adobada, una mulita"). Es la única forma que
  vencería a la cuadrícula — manos libres, cero búsqueda visual. Pero: ruido de
  calle y de comal, el reconocimiento de Android necesita internet para ser
  bueno, y **un error de dictado cuesta más de lo que ahorran diez aciertos**.
  No como camino principal. Vale la pena probarlo algún día como atajo para
  pedidos grandes, cuando ya haya costumbre.
- **Códigos numéricos** (teclear "3 × 12" como caja registradora vieja). Es lo
  más rápido que existe... para quien lleva un año. Se abandona en el día dos.
- **Cuadrícula de 30 productos** para que "todo esté a la mano". Al revés:
  entre más botones, más se busca. **Ocho o diez botones bien puestos son más
  rápidos que treinta.** El resto va detrás de "Más…", que se usa poco por
  definición.
- **Sonido en cada toque.** En un puesto de tacos no se oye, y lo poco que se
  oye, molesta. Vibración sí, sonido no.

---

## 11. Decisiones cerradas (2026-08-03)

| Pregunta | Respuesta | Qué implica |
|---|---|---|
| ¿Cuándo cobra? | **Al entregar, mostrador** | **No hay cuentas abiertas ni mesas.** Un ticket a la vez, se abre y se cierra en segundos. El diseño de arriba queda completo tal cual. |
| ¿En qué aparato? | **Celular en la mano** | El caso más apretado. Ver 11.1 — cambia el acomodo. |
| ¿El menú? | **Catálogo típico** que él ajusta | Ver 11.2. |

### 11.1 Celular en la mano: lo que obliga

Es el escenario más difícil de los tres, así que se diseña para éste y de
pilón se ve bien en tableta si algún día compra una.

- **Caben ~12 botones** sin buscar y sin desplazar. Ni uno más. Todo lo demás
  va detrás de `Más…`, y **si algo termina en `Más…` y resulta que se usa
  seguido, se sube a la cuadrícula** — eso se sabe con los números de la
  sección 9, no adivinando.
- **Nada importante en las esquinas de arriba.** Si lo agarra con una mano, el
  pulgar no llega. El total va arriba porque **solo se lee, no se toca**; los
  botones de pago van hasta abajo, que es donde el pulgar cae solo.
- **Cero desplazamiento (scroll) en la pantalla de cobrar.** Si hay que
  deslizar para llegar a un producto, ese producto está mal puesto.
- **La pantalla no se apaga** (Wake Lock). Con el celular en la mano esto pasa
  de "estaría bueno" a obligatorio: si no, cada ticket empieza desbloqueando.
- **Se le va a caer.** Vale más un agarradera de $80 (popsocket o correa) que
  cualquier cosa que yo programe. Dicho aquí para que no se olvide.
- **Si el menú no cabe en 12**: entra la fila de carnes pegada — se toca
  `adobada` una vez y se queda puesta, luego `taco` `taco` `taco` `mulita`.
  Son 5 carnes + 6 formas = 11 botones en vez de 30. Se decide cuando llegue
  su menú de verdad; el motor de la cuadrícula soporta las dos formas.

### 11.2 Catálogo de arranque

Se precarga un catálogo típico de taquería de Tijuana, **con precios de
relleno claramente marcados** que él corrige en Ajustes en dos minutos. Nadie
quiere capturar 30 productos desde cero, y nadie quiere que la app le invente
sus precios sin avisar.

Los 12 de la cuadrícula (arrancan así, él los reacomoda arrastrando):

```
  Taco adobada    Taco asada      Taco tripa
  Taco cabeza     Taco lengua     Taco chorizo
  Mulita          Quesadilla      Vampiro
  Torta           Volcán          Más…
```

Y detrás de `Más…`: sope, burrito, costra, papas, consomé, orden de carne,
refresco, agua fresca, y `$ libre` para lo que no está.

**Al primer arranque, la app le pide los precios** — una lista corta, un
renglón por producto, y no lo deja cobrar hasta que estén. Es mejor gastar dos
minutos ahí que descubrir a la semana que todos los tickets salieron con el
precio equivocado.
