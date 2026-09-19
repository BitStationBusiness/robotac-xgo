//% color="#5145CD" icon="\uf1b0" block="ROBOTAC Circuito"
//% groups=['Movimiento', 'Garra', 'Tramos', 'Preparación']
namespace robotac_xgos {
    let iniciado = false
    let ocupado = false

    function preparar(): void {
        if (iniciado) return
        xgo.init_xgo_serial(SerialPin.P14, SerialPin.P13)
        xgo.Manipulator_clamp(0)
        iniciado = true
    }

    function comenzar(): boolean {
        if (ocupado) return false
        ocupado = true
        preparar()
        return true
    }

    /** Usar en al iniciar. Prepara la postura y abre la garra una sola vez. */
    //% block="preparar robot" group="Preparación" advanced=true weight=10
    export function iniciarXGOS(): void {
        if (!comenzar()) return
        ocupado = false
    }

    function mover(segundos: number, direccion: xgo.direction_enum): void {
        // Rechaza NaN, infinito y tiempos negativos sin enviar movimiento.
        if (!(segundos > 0 && segundos <= 3600) || !comenzar()) return
        xgo.move_xgo(direccion, 80)
        basic.pause(segundos * 1000)
        xgo.move_xgo(direccion, 0)
        ocupado = false
    }

    /** Avanza al 80 % y se detiene al terminar. Tiempo en segundos (hasta 3600). */
    //% block="Avanzar %segundos segundos" group="Movimiento" weight=100
    //% segundos.defl=1 segundos.min=0 segundos.max=3600
    export function avanzar(segundos: number): void {
        mover(segundos, xgo.direction_enum.Forward)
    }

    /** Retrocede al 80 % y se detiene al terminar. */
    //% block="Retroceder %segundos segundos" group="Movimiento" weight=90
    //% segundos.defl=1 segundos.min=0 segundos.max=3600
    export function retroceder(segundos: number): void {
        mover(segundos, xgo.direction_enum.Backward)
    }

    /** Giro derecho fijo: 20 durante 6,8 segundos. Pendiente de medir físicamente. */
    //% block="Girar Derecha" group="Movimiento" weight=80
    export function girarDerecha(): void {
        if (!comenzar()) return
        xgo.rotate_angle_continue(xgo.rotate_direction_enum.turn_right, 20, 6.8)
        ocupado = false
    }

    /** Giro izquierdo calibrado para el circuito: 20 durante 6,8 segundos. */
    //% block="Girar Izquierda" group="Movimiento" weight=70
    export function girarIzquierda(): void {
        if (!comenzar()) return
        xgo.rotate_angle_continue(xgo.rotate_direction_enum.turn_left, 20, 6.8)
        ocupado = false
    }

    function girarPorTiempo(segundos: number, direccion: xgo.rotate_direction_enum): void {
        if (!(segundos > 0 && segundos <= 3600) || !comenzar()) return
        xgo.rotate_angle_continue(direccion, 20, segundos)
        ocupado = false
    }

    /** Gira a la izquierda durante los segundos indicados y se detiene. Velocidad interna 20. */
    //% block="Girar Izquierda %segundos segundos" group="Movimiento" weight=68
    //% segundos.defl=1 segundos.min=0 segundos.max=3600
    export function girarIzquierdaSegundos(segundos: number): void {
        girarPorTiempo(segundos, xgo.rotate_direction_enum.turn_left)
    }

    /** Gira a la derecha durante los segundos indicados y se detiene. Velocidad interna 20. */
    //% block="Girar Derecha %segundos segundos" group="Movimiento" weight=66
    //% segundos.defl=1 segundos.min=0 segundos.max=3600
    export function girarDerechaSegundos(segundos: number): void {
        girarPorTiempo(segundos, xgo.rotate_direction_enum.turn_right)
    }

    /** Tras preparar el robot, solo cierra la garra; no desplaza el brazo ni camina. */
    //% block="Coger objeto" group="Garra" weight=60
    export function cogerObjeto(): void {
        if (!comenzar()) return
        xgo.Manipulator_clamp(196)
        ocupado = false
    }

    /** Extiende el brazo, abre la garra y restaura la postura inicial. */
    //% block="Soltar objeto" group="Garra" weight=50
    export function soltarObjeto(): void {
        if (!comenzar()) return
        // Única secuencia recuperada del controlador anterior:
        // polar 200 grados / 140 mm. La extensión oficial no expone el modo polar.
        // Se conserva el truncado a byte de 165,75 usado en la versión anterior.
        serial.writeBuffer(pins.createBufferFromArray([85, 0, 9, 0, 118, 165, 219, 0, 170]))
        basic.pause(50)
        serial.writeBuffer(pins.createBufferFromArray([85, 0, 9, 0, 119, 255, 128, 0, 170]))
        basic.pause(3000)
        xgo.Manipulator_clamp(0)
        xgo.init_action()
        basic.pause(500)
        ocupado = false
    }

    /** Avanza durante 3,3 segundos al 80 %. */
    //% block="Tramo A" group="Tramos" weight=40
    export function tramoA(): void { avanzar(3.3) }

    /** Avanza durante 5 segundos al 80 %. */
    //% block="Tramo B" group="Tramos" weight=30
    export function tramoB(): void { avanzar(5) }

    /** Avanza durante 3 segundos al 80 %. */
    //% block="Tramo C" group="Tramos" weight=20
    export function tramoC(): void { avanzar(3) }
}
