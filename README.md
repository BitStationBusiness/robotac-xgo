# ROBOTAC Circuito para micro:bit y XGO

Once bloques para que los niños monten el circuito de la exposición. Movimiento basado en la extensión oficial ELECFREAKS XGO v1.3.9, fijada como dependencia. Se elimina del controlador activo la corrección IMU y la calibración antigua por centímetros.

## Instalar los bloques (recomendado)

1. En https://makecode.microbit.org crea un **Nuevo proyecto**.
2. Abre **Extensiones** y pega **https://github.com/BitStationBusiness/robotac-xgo**.
3. Selecciona ROBOTAC. Aparecerá la categoría **ROBOTAC Circuito**.
4. En **ROBOTAC Circuito > más**, coloca **preparar robot** en **al iniciar**. Inicializa TX P14 / RX P13, restaura postura y abre la garra. Espera a que termine antes de usar el robot.
5. Arrastra los bloques del circuito dentro de **al presionarse el botón A**, en orden.

La dependencia oficial XGO se instala automáticamente; no hay que copiar funciones ni conocer velocidades. La categoría oficial xgo también puede aparecer, pero los niños usan ROBOTAC Circuito.

**Importar > URL** abre el código del repositorio como proyecto para editar la extensión; no equivale a añadirla como biblioteca. Para obtener los once bloques en un proyecto nuevo usa **Extensiones**.

## Los once bloques

| Bloque | Resultado |
| --- | --- |
| Avanzar [1] segundos | Avanza al 80 % y se detiene. |
| Retroceder [1] segundos | Retrocede al 80 % y se detiene. |
| Girar Derecha | Giro fijo: velocidad oficial 20, durante 6,8 s. |
| Girar Izquierda | Giro fijo: velocidad oficial 20, durante 6,8 s. |
| Girar Izquierda [1] segundos | Gira a la izquierda el tiempo indicado, con velocidad interna 20, y se detiene. |
| Girar Derecha [1] segundos | Gira a la derecha el tiempo indicado, con velocidad interna 20, y se detiene. |
| Coger objeto | Cierra únicamente la garra a 196; espera oficial de 3 s. |
| Soltar objeto | Extiende el brazo, abre la garra y vuelve a la postura inicial. |
| Tramo A | Avanza 3,3 s al 80 %. |
| Tramo B | Avanza 5 s al 80 %. |
| Tramo C | Avanza 3 s al 80 %. |

Avanzar, Retroceder y los dos nuevos giros por segundos tienen un campo editable. Los giros fijos conservan sus 6,8 segundos. Aceptan decimales en segundos. Los tiempos no positivos o superiores a 3600 s se ignoran.

**preparar robot** es un bloque de configuración en la sección avanzada, además de los once bloques infantiles. La preparación se hace una sola vez por encendido; también se realiza automáticamente antes del primer bloque si se omite. Para que Coger objeto cierre únicamente la garra, prepara el robot al iniciar.

## Circuito de ejemplo

El archivo test.ts muestra: Coger objeto → Tramo A → Girar Izquierda → Tramo B → Girar Izquierda → Tramo C → Soltar objeto.

Los eventos del ejemplo no se instalan al añadir la extensión: cada clase construye su programa. Ejecuta una sola secuencia a la vez; el ejemplo impide repetirla mientras está en curso. Las órdenes concurrentes dentro de una operación se ignoran, no se encolan.

Los tiempos personalizados 4,5 y 2,8 s que aparecen en la captura de la sesión se pueden introducir en Avanzar; no sustituyen los valores solicitados para Tramo B (5 s) y Tramo C (3 s).

## Qué se ha conservado

- Marcha, giros, inicialización y garra: llamadas a https://github.com/elecfreaks/pxt-xgo.
- Únicamente para Soltar objeto: secuencia polar de la versión anterior, dirección 200° y alcance 140 mm, espera de 3 s, apertura y repliegue. Estas dos órdenes serie quedan encapsuladas; no se exponen al alumno.
- El repositorio publicado contiene únicamente esta versión del circuito.

Tramos e izquierda corresponden a la calibración indicada por el usuario. El giro derecho usa inicialmente los mismos valores invertidos; su ángulo y la secuencia de entrega deben comprobarse en el robot. Compilar o simular no verifica la distancia física. El arranque restaura la postura y abre la garra.

## Desarrollo

Versión 1.1.0: añade giros por segundos en ambos sentidos sin cambiar los bloques existentes.

Versión 1.0.0: nueva interfaz para el circuito; los bloques anteriores de centímetros, pasos e IMU ya no están disponibles. Conserva una copia de los proyectos antiguos antes de actualizar su dependencia.

Ejecutar node tests/exposicion.cjs y compilar con MakeCode/PXT. El proyecto no exige credenciales de los alumnos ni servicios externos para ejecutar el robot.
