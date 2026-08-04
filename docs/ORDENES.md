# Órdenes — la cola de lo que hay que preparar

**2026-08-03.** Miguel pidió agregar al plan un sistema de órdenes: un botón
**"+ Orden"** arriba de la pantalla para levantar el pedido de la gente que
llega y todavía no se atiende, que se forma en una cola, y que el taquero
pueda abrir y **leer clarísimo** mientras cocina.

**Estado: diseño, nada construido.** Ver la fase donde entra en `PLAN.md`.

---

## 1. Qué es esto, y qué NO es

Es una **comanda**: lo que hay que preparar, en el orden en que llegó.
No es una cuenta abierta.

Vale la pena decirlo porque parece que contradice una decisión ya tomada.
En `PLAN.md` está escrito: *"cobro al entregar, de mostrador, sin cuentas
abiertas ni mesas"*. **Eso sigue igual.** El cliente no se sienta a comer y
paga al final; paga cuando se le entrega. Lo que se agrega es el rato que
pasa entre *"deme cinco de asada"* y *"aquí tiene"* — que hoy la app ignora
por completo, y que en un puesto con fila es justo donde se pierden pedidos
y se confunden órdenes.

Dicho de otro modo: la app ya sabía **cobrar**. Ahora también va a saber
**qué falta preparar**.

---

## 2. Los dos caminos, y por qué el rápido no se toca

Después de esto hay dos formas de vender, y **conviven**:

| | Cuándo | Cómo |
|---|---|---|
| **Directo** | El cliente pide, se le da y paga ahí mismo | La calculadora de hoy, **sin un solo cambio** |
| **Con orden** | Hay fila / se lleva un rato / son varios platos | `+ Orden` → cola → el taquero la prepara → se cobra |

**Regla dura: el camino directo no se hace ni un toque más lento.** El botón
`+ Orden` es un botón más en la pantalla de cobrar, nada más. Si el que cobra
nunca lo toca, la app se comporta exactamente como hoy. Todo lo de
`CALCULADORA.md` (posiciones congeladas, cobrar es guardar, deshacer en vez
de confirmar) sigue mandando.

**Y el camino con orden hace el cobro MÁS rápido, no más lento**: cuando se
cobra una orden, los productos ya están capturados — no hay que volver a
tocarlos. Cobrar una orden es: abrirla → *(si acaso)* escribir con cuánto
paga → **Cobrar**. Cero toques de producto.

---

## 3. Cómo está armada una orden (lo que dijo Miguel, en estructura)

Esta es la parte que no es obvia. Miguel lo describió así:

> *"dentro de la orden te dice que pongas en un plato 2 de asada y 3 de
> adobada y luego separado pongas otras cosas"*

O sea: **una orden no es una lista plana de tacos. Es un conjunto de
paquetes**, y cada paquete se prepara junto. Le llamamos **plato**:

```
ORDEN #7
├── Plato 1        (con todo)
│     2  asada
│     3  adobada
└── Plato 2        (sin cebolla · todo aparte)
      4  tripa
      1  quesadilla
```

### Por qué los "sin" van en el plato y no en cada taco

Porque así se habla. Nadie dice *"un taco de asada sin cebolla, otro taco de
asada sin cebolla, otro taco de asada sin cebolla"* — dice **"tres de asada
sin cebolla"**. El modificador aplica al paquete completo.

Y si un mismo cliente quiere *"dos con todo y tres sin cebolla"*, eso **ya
es otro plato** — que es exactamente como lo va a preparar el taquero (dos
tortillas de un lado, tres del otro). El modelo coincide con la realidad
física, no la pelea.

Esto también resuelve el *"todo separado"* que mencionó Miguel: es el caso
extremo donde cada cosa va en su propio plato. Por eso se propone un botón
**"Separar todo"** que parte cada renglón en su propio plato de un toque, en
vez de obligarlo a crear los platos uno por uno.

### Los modificadores

Los que Miguel nombró, más el "con todo" que es la base:

| | |
|---|---|
| **Con todo** | El **default**. No se toca nada, no se teclea nada. |
| **S/cebolla** | |
| **S/cilantro** | |
| **S/salsa** | |
| **Todo aparte** | Las salsas y lo demás en recipiente separado |

**"Con todo" siendo el default es la decisión de velocidad clave**, y es la
misma idea que ya se usó en el cobro (dejar el campo vacío = pagó exacto):
el caso más común cuesta **cero**, y solo las excepciones se tocan.

Los modificadores van a ser **editables en Ajustes**, igual que los
productos — cada taquería tiene los suyos ("con queso", "doble tortilla",
"s/aguacate", "para llevar"). Arrancan con esos cinco y él los ajusta.

---

## 4. Levantar la orden

`+ Orden` arriba en la pantalla de cobrar abre el compositor:

```
┌──────────────────────────────────────┐
│  ORDEN NUEVA          [ ✕ ]          │
│  Para: [ (opcional) ]                │  ← nombre/seña, se puede saltar
├──────────────────────────────────────┤
│  PLATO 1                             │
│    2 asada · 3 adobada        [ ✕ ]  │
│  [con todo ✓][S/ceb][S/cil][S/salsa] │  ← chips del plato ACTIVO
│  [todo aparte]                       │
├──────────────────────────────────────┤
│   ( la MISMA cuadrícula de siempre ) │  ← posiciones congeladas, igual
│   ADOBADA③  ASADA②   TRIPA           │
│   CABEZA    LENGUA   CHORIZO         │
│   ...                                │
├──────────────────────────────────────┤
│  [ + Otro plato ]  [ Separar todo ]  │
│  [        GUARDAR ORDEN         ]    │
└──────────────────────────────────────┘
```

**Se reusa la cuadrícula tal cual** — mismos productos, mismas posiciones,
misma memoria muscular. Sería un error grave inventar un segundo selector de
productos: se perdería todo lo que se ganó congelando posiciones.

Los toques van al **plato activo**. `+ Otro plato` cierra el actual y abre
uno nuevo.

**Cuánto cuesta en toques:** una orden simple de 5 tacos con todo son 5
toques + Guardar = **6**. La orden complicada del ejemplo (2 asada + 3
adobada, y aparte 4 tripa sin cebolla) son 11. Suena mucho comparado con los
6 segundos del cobro, pero **aquí el límite no es la app: es lo que tarda el
cliente en decirlo**. Mientras habla, se captura. Ese es el listón correcto
para esta pantalla, no el del cobro.

---

## 5. La cola

Arriba en la pantalla de cobrar, junto a `+ Orden`, un contador tocable:

```
[ + Orden ]   [ 🔔 3 en cola ]
```

- **Número automático** (#1, #2, #3…, reinicia cada día) — para cantar
  "¡siete!" sin depender de que alguien haya dado su nombre.
- **Nombre o seña opcional** — "Juan", "la de la gorra". Un toque para
  saltarlo.
- **En orden de llegada**, siempre. La que lleva más tiempo, arriba.
- **Tiempo transcurrido** visible por orden ("hace 4 min") — es lo que
  delata una orden olvidada.

Estados, a propósito pocos:

```
   EN COLA  ──►  ENTREGADA  ──►  COBRADA
   (falta        (ya se le      (ya pagó,
   prepararla)    dio)           es un ticket)
```

Se pensó en meter un estado "en preparación" y se descartó: en un puesto de
tacos, entre que se empieza y se entrega pasan dos minutos — un estado más
es un toque más que nadie va a dar y que va a quedar siempre mal puesto.

**Una orden entregada pero no cobrada es dinero en riesgo**, y por eso tiene
su propio candado (ver `PLAN.md`, sección de candados).

---

## 6. La vista del taquero — la parte que de verdad importa

Miguel lo pidió así: *"al abrirla el taquero aparece todo de forma que él lo
pueda leer de la mejor manera posible y clara"*.

Quien lee esto tiene las manos ocupadas, grasa, ruido, y le está echando un
ojo de reojo al celular entre voltear carne. El diseño se rige por eso:

```
┌──────────────────────────────────────┐
│  ORDEN #7  ·  Juan       hace 4 min  │
├──────────────────────────────────────┤
│  AL COMAL:   2 asada  3 adobada      │  ← todo junto, para echarlo de una
│              4 tripa                 │
├──────────────────────────────────────┤
│  PLATO 1                  con todo   │
│     2   ASADA                        │  ← el NÚMERO manda, grande
│     3   ADOBADA                      │
├──────────────────────────────────────┤
│  PLATO 2      ⚠ SIN CEBOLLA          │  ← la advertencia NO se puede pasar
│               ⚠ TODO APARTE          │
│     4   TRIPA                        │
│     1   QUESADILLA                   │
├──────────────────────────────────────┤
│  [       ENTREGADA        ]          │
└──────────────────────────────────────┘
```

Las decisiones detrás:

- **El número primero y grande** (`2 ASADA`, no `asada x2`). Lo que el
  taquero hace con ese renglón es *contar piezas y echarlas al comal* — el
  número es el dato, el nombre es el contexto.
- **Los platos separados de verdad**, con línea y bloque propio. Es
  literalmente el mapa de cómo se sirve.
- **Los "sin" en rojo y arriba del plato, no escondidos al final.** Servir
  con cebolla algo que se pidió sin cebolla es *el* error clásico de una
  taquería y significa rehacerlo. La advertencia tiene que ser imposible de
  no ver.
- **Una orden a la vez, pantalla completa.** Nada de una lista con cinco
  órdenes chiquitas: se lee la que toca.

### "AL COMAL" — propuesta mía, no la pidió

El renglón de arriba suma **todo lo de la orden junto, sin importar el
plato**: si el plato 1 lleva 2 asada y el plato 3 lleva 3 asada, el comal
necesita **5 asada**. Se echa todo de una vez y luego se reparte en los
platos leyendo abajo.

Cocinar y servir son dos momentos distintos y necesitan dos vistas
distintas: **el comal quiere el total, el plato quiere el detalle.** Sale
gratis (es una suma de lo que ya está capturado) y creo que va a ser lo que
más mire.

**Falta confirmarlo con el taquero de verdad** — es una suposición mía sobre
cómo cocina. Si resulta que no le sirve, se apaga y ya.

---

## 7. De la orden al cobro

Al tocar **ENTREGADA**, la orden pasa a la lista de "por cobrar". Al
cobrarla:

1. Se abre la calculadora **ya cargada** con todos los productos de la orden
   (todos los platos juntos — para cobrar da igual cómo se sirvió).
2. Se escribe con cuánto paga, si hace falta.
3. **Cobrar.** Se guarda un ticket normal, idéntico a cualquier otro.

El ticket guarda de qué orden vino (`ordenId`), y la orden queda **marcada
como cobrada y bloqueada**: no se puede cobrar dos veces. Sin ese candado,
tarde o temprano se cobra doble en la confusión de la hora pico.

Los reportes de la Fase 4 no cambian: siguen leyendo tickets. Una orden sin
cobrar **no es una venta** y no cuenta en ningún número.

---

## 8. Qué NO va a hacer (y por qué)

- **No hay mesas ni cuentas abiertas.** Decisión ya tomada, sigue.
- **No hay estado "en preparación"** — ver sección 5.
- **No hay impresión de comandas.** Es un puesto, no hay impresora térmica;
  la pantalla ES la comanda.
- **No hay tiempos prometidos** ("listo en 8 min"). Se puede calcular con lo
  que ya se mide, pero prometer un tiempo y fallarlo es peor que no decir
  nada.

---

## 9. Lo que falta decidir

1. **¿Quién levanta la orden?** ¿El mismo taquero, o alguien aparte? Si son
   dos personas en dos celulares, la cola necesita la sincronización de la
   Fase 2 para servir de algo — eso es lo que decide en qué fase entra
   (ver `PLAN.md`).
2. **¿"Para llevar" es un modificador o algo aparte?** Como chip cuesta
   cero; si cambia precios o empaque, es otra cosa.
3. **Los modificadores reales de su taquería.** Los cinco de arriba son los
   que nombró Miguel; falta la lista de él (igual que faltan sus precios).
4. **¿El "AL COMAL" le sirve?** Ver sección 6.
