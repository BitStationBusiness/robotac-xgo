# ROBOTAC XGOS

Extensión educativa para controlar XGOS V2 desde MakeCode usando bloques simples.

## Bloques visibles para los niños

Al importar este repositorio, la categoría `ROBOTAC XGOS` muestra únicamente:

- `Avanzar ... cm`
- `Retroceder ... cm`
- `Girar izquierda`
- `Girar derecha`
- `Avanzar A`
- `Avanzar B`
- `Avanzar C`
- `Abrir hocico`
- `Cerrar hocico`

El robot se inicializa automáticamente la primera vez que se utiliza cualquiera
de estos bloques. No hace falta añadir un bloque de inicio. Los controles de
calibración, diagnóstico y pruebas permanecen en el código para conservar la
configuración validada, pero están ocultos de la caja de herramientas.

Los tres bloques `Avanzar A`, `Avanzar B` y `Avanzar C` no necesitan números:
incluyen respectivamente los valores confirmados de `45 cm`, `77 cm` y `48 cm`,
además de sus correcciones rectas independientes `5`, `7` y `6`.

## Detalles internos para mantenimiento

## Unidad de movimiento

Un **paso** es una unidad educativa calibrable, no la pisada individual de una
pata ni una distancia absoluta. Por defecto dura 500 ms a una velocidad estable.
Esto permite que el mismo programa sea fácil de leer y que el docente pueda
ajustarlo al suelo, la batería y el peso de la pelota sin cambiar el reto de los
niños.

En el grupo `Calibración` están los bloques:

- calibrar 1 paso a milisegundos
- calibrar giro izquierdo de 90° (velocidad y milisegundos)
- calibrar giro derecho de 90° (velocidad y milisegundos)
- usar IMU en giros de 90° (activación, tolerancia y tiempo máximo)
- compensar giro izquierdo avanzando centímetros
- corrección recta B (ganancia y velocidad máxima)
- calibrar brazo (posición retraída, desplegada y tiempo de espera)
- calibrar extensión (ángulo y alcance en milímetros)
- calibrar avance con una prueba cronometrada y una cinta métrica
- configurar las distancias A, B y C en centímetros

Los giros izquierdo y derecho se calibran por separado porque la mecánica, el
suelo y el peso de la pelota pueden hacerlos distintos. El rango de prueba es de
10 a 100 de velocidad y de 100 a 5000 ms.

La compensación geométrica de `7.5 cm` se suma ahora al final de los recorridos
A y B. De este modo, el centro del robot llega a la esquina durante el tramo
recto y el bloque de giro solamente rota, sin avanzar antes. El bloque
`compensar giro izquierdo avanzando ... cm` permite ajustar ese tramo entre
`0` y `20 cm` sin modificar C.

Cuando el modo IMU está activo, los giros de 90° solicitan el ángulo `yaw` del
XGO por el registro `0x64`. Cada giro toma como base el `yaw` real medido al
comenzar. De este modo, un pequeño error físico no se hereda ni se amplifica en
el siguiente giro.

El objetivo vuelve a ser geométricamente exacto (`90°`). La velocidad principal
es `35`; el robot frena 15° antes, descarta las respuestas atrasadas tomadas
durante el movimiento y valida cada pulso con una lectura nueva de la IMU. Puede
hacer hasta 18 correcciones en ambos sentidos hasta obtener dos lecturas estables
dentro de la tolerancia. El sentido positivo del yaw se detecta automáticamente, por lo que
el montaje de la IMU no necesita una convención manual. Antes de una nueva prueba,
alinee físicamente el perro y use `fijar rumbo actual como inicio`. Si la IMU no
responde desde el inicio, se conserva la calibración de respaldo por tiempo.

El bloque `calibrar giro físico de 90°` ajusta la relación entre la lectura de
la IMU y el ángulo visible del cuerpo. El valor inicial es `108° IMU`; se puede
ajustar entre `90` y `130`, de uno en uno, usando una escuadra. En modo de prueba,
`último giro medido en grados` devuelve qué cambio registró el XGO y
`mostrar código del último giro` lo deja como un patrón fijo de 8 bits en la
matriz LED para poder fotografiarlo sin depender de texto desplazándose.

Si `fijar rumbo actual como inicio` no puede leer la IMU, muestra `-1` cuando
no llega ningún byte por RX o `-2` cuando llega una trama que no supera la
validación. En ese caso el giro utiliza automáticamente el tiempo de respaldo,
inicialmente `2050 ms`, que puede calibrarse sin alterar los recorridos A, B y C.

## Recorridos A, B y C en centímetros

Los bloques `A avanzar ... cm`, `B avanzar ... cm` y `C avanzar ... cm` solamente
hacen avanzar al robot y ahora incluyen su propio campo numérico. Sus valores
iniciales son 51, 84 y 52 cm. Cambiar el número de un bloque solo modifica ese
tramo y conserva su ajuste interno de calibración.

La unidad interna ideal es **milisegundos por centímetro (ms/cm)** a velocidad
fija. Para evitar cálculos manuales, MakeCode la obtiene con dos bloques:

1. Ejecute `prueba de calibración durante 3000 ms` sobre el suelo del circuito.
2. Mida con una cinta métrica la distancia recorrida.
3. Use `calibrar avance: en 3000 ms recorrió ... cm` con esa medición.
4. Compruebe el resultado con `probar avance de 51 cm`.

Para el ajuste fino se recomienda el bloque
`calibrar avance preciso a ... ms por cm`. Acepta decimales entre `20.00` y
`500.00`; en MakeCode se escriben con punto, por ejemplo `103.75`. Primero se
prueba A, cuyo objetivo es 51 cm. Si A recorre una distancia distinta, el nuevo
factor se obtiene con:

`factor nuevo = factor actual × 51 ÷ distancia real medida`

El factor actual se mantiene en `92.00 ms/cm`. Tras la prueba física, el
recorrido A se aumentó de 46 a 51 cm y conserva su ajuste independiente de
`100%`. El recorrido B usa ahora una distancia nominal de 84 cm con su corrección
física independiente de `91.01%`. A y C conservan sus valores. C se había
ajustado a `85.25%`; para añadir 2 cm pasó a `85.25 × 54 ÷ 52 = 88.53%`.

Estos porcentajes se controlan con el bloque
`ajustes: A ... % B ... % C ... %`. Modificar B o C no cambia el recorrido A.

Los recorridos A, B y C conservan el rumbo con realimentación del `yaw`: toman
como referencia la orientación inicial y aplican pequeñas correcciones mientras
avanzan. Además usan una compensación base hacia la derecha, inicialmente `3`,
para neutralizar la tendencia mecánica observada a desviarse a la izquierda.
El tiempo total se mide con `runningTime`, así que las lecturas de la IMU no
alargan la distancia ya calibrada. El bloque `corrección recta B` permite ajustar
la ganancia entre `0` y `5` y limitar la corrección entre `5` y `30`; los valores
iniciales son `2` y `15`.

Conviene repetir la prueba con la batería cargada y la pelota colocada, porque el
suelo, el nivel de batería y la carga pueden modificar ligeramente el resultado.

## Modo de pruebas

El proyecto de prueba deja los parámetros editables en `on start` y asigna:

- botón A: probar giro de 90° a la izquierda
- botón B: probar giro de 90° a la derecha
- botones A+B: probar la entrega completa de la pelota
- logotipo táctil: mostrar el `yaw` actual; una X indica que no hubo respuesta

Cambie los números de los bloques de calibración, descargue al micro:bit y repita
la prueba. En `Modo de pruebas` también puede mover el brazo a cualquier posición
entre 0 y 100 y detener el robot.

Para el brazo use inicialmente una espera de `3000 ms`. Es el tiempo que reserva
la extensión oficial del XGO para cada recorrido del manipulador. Durante la
entrega se ignoran nuevas pulsaciones hasta completar la secuencia. La retracción
final usa la acción `255` (restaurar postura inicial), la misma orden que repliega
correctamente el brazo al encender, en lugar de intentar reconstruir esa postura
moviendo solamente el eje X.

Antes de abrir la pinza, el bloque de entrega despliega el brazo mediante las
coordenadas polares del XGO: `200°` y `140 mm`. Los `140 mm` son el alcance máximo
admitido. Estos dos valores permanecen editables con el bloque `calibrar extensión`.

## Uso recomendado

En el botón A se puede programar una ruta únicamente con los bloques infantiles:

```blocks
Cerrar hocico
Avanzar 45 cm
Girar izquierda
Avanzar 30 cm
Abrir hocico
```

`Abrir hocico` despliega el brazo, suelta el objeto y después lo retrae. La
inicialización se realiza automáticamente al ejecutar el primer bloque.

## Pines usados

* TX: P14
* RX: P13
* Baudrate: 115200
