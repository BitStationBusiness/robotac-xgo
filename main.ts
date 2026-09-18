//% color="#3A4A3F" icon="\uf1b9" block="ROBOTAC XGOS"
//% groups=['Movimiento', 'Recorridos listos', 'Hocico']
namespace robotac_xgos {

    let clampState = 0
    let robotInicializado = false
    let duracionPasoMs = 500
    let duracionGiroIzquierda90Ms = 2050
    let duracionGiroDerecha90Ms = 2050
    let velocidadGiroIzquierda90 = 35
    let velocidadGiroDerecha90 = 35
    let brazoRetraido = 50
    let brazoDesplegado = 100
    let anguloBrazoDesplegado = 200
    let alcanceBrazoDesplegadoMm = 140
    let pausaBrazoMs = 3000
    let milisegundosPorCm = 92
    let distanciaRecorridoACm = 51
    let distanciaRecorridoBCm = 84
    let distanciaRecorridoCCm = 52
    let ajusteRecorridoAPorcentaje = 100
    let ajusteRecorridoBPorcentaje = 91.01
    let ajusteRecorridoCPorcentaje = 88.53
    let compensacionGiroIzquierdaCm = 7.5
    // Compensa la tendencia mecanica observada a desviarse hacia la izquierda.
    // Se combina con la realimentacion de yaw durante todos los tramos rectos.
    let correccionDerechaRecta = 5
    let gananciaCorreccionRectaB = 2
    let velocidadMaxCorreccionRectaB = 15
    let entregaEnCurso = false
    let usarImuEnGiros90 = true
    let toleranciaGiroGrados = 1
    let tiempoMaximoGiroImuMs = 6000
    // El XGO puede informar un cambio de yaw algo mayor que el giro visible
    // del cuerpo durante la marcha. Este valor se calibra contra una escuadra.
    // Valor confirmado en la prueba manual del botón B. Dejarlo como valor
    // inicial garantiza que cualquier llamada a girarIzquierda90, incluida la
    // ruta completa del botón A, use la misma calibración desde el encendido.
    let gradosImuPorGiro90 = 97
    let ultimoYawLeido = 0
    let ultimaLecturaYawValida = false
    // 0 = lectura correcta, -1 = no llegaron bytes, -2 = trama inválida.
    let ultimoDiagnosticoYaw = 0
    let ultimoGiroMedido = 0
    let rumboObjetivoGrados = 0
    let rumboObjetivoValido = false
    let signoYawIzquierda = 0

    const GANCHO_ABIERTO = 0
    const GANCHO_CERRADO = 196
    // Valores confirmados físicamente en el circuito final.
    // Distancias físicas impresas en el circuito.
    const RECORRIDO_INFANTIL_A_CM = 48
    const RECORRIDO_INFANTIL_B_CM = 82
    const RECORRIDO_INFANTIL_C_CM = 57
    // Valores internos que ya completaron el circuito correctamente. Los
    // factores mantienen exactamente esos tiempos, aunque los bloques para
    // niños expresen ahora la distancia física medida con cinta métrica.
    const ESCALA_FISICA_A = 49 / 48
    const ESCALA_FISICA_B = 77 / 82
    const ESCALA_FISICA_C = 41 / 57
    const CORRECCION_RECTA_A = 5
    const CORRECCION_RECTA_B = 7
    const CORRECCION_RECTA_C = 6
    const VELOCIDAD_RUTA = 60
    const PAUSA_ESTABILIZACION_MS = 50
    const PAUSA_GANCHO_MS = 3000
    const REGISTRO_YAW = 0x64
    const YAW_NO_VALIDO = 10000
    const ANTICIPACION_GIRO_GRADOS = 15
    const GIRO_RECTO_GRADOS = 90
    const MAX_FALLOS_YAW = 8
    const MAX_CORRECCIONES_GIRO = 8
    const LECTURAS_ESTABLES_REQUERIDAS = 2
    const LECTURAS_REFERENCIA_REQUERIDAS = 3
    const TOLERANCIA_REFERENCIA_GRADOS = 2
    const TIEMPO_REFERENCIA_ESTABLE_MS = 1400
    const GIRO_MAXIMO_SEGURIDAD_GRADOS = 135
    const TIEMPO_MAXIMO_CORRECCIONES_MS = 2500

    enum DireccionMovimiento {
        Avanzar,
        Retroceder
    }

    enum DireccionGiro {
        Izquierda,
        Derecha
    }

    function limitar(valor: number, minimo: number, maximo: number): number {
        if (valor < minimo) {
            return minimo
        }

        if (valor > maximo) {
            return maximo
        }

        return valor
    }

    function segundosAMilisegundos(segundos: number): number {
        segundos = limitar(segundos, 0, 60)
        return segundos * 1000
    }

    // Codifica un ángulo entero (0-255) como ocho bits fijos en la matriz.
    // Las tres esquinas encendidas permiten reconocer la orientación en una foto.
    function mostrarCodigoGiro(angulo: number): void {
        let codigo = Math.round(limitar(angulo, 0, 255))
        basic.clearScreen()
        led.plot(0, 0)
        led.plot(4, 0)
        led.plot(0, 4)
        led.plot(4, 2)

        for (let bit = 0; bit < 4; bit++) {
            if ((codigo & (1 << (7 - bit))) != 0) {
                led.plot(bit, 1)
            }
            if ((codigo & (1 << (3 - bit))) != 0) {
                led.plot(bit, 2)
            }
        }
    }

    function pasosAMilisegundos(pasos: number): number {
        pasos = Math.round(limitar(pasos, 0, 50))
        return pasos * duracionPasoMs
    }

    function enviarComando(registro: number, valor: number): void {
        let buffer = pins.createBuffer(9)

        buffer[0] = 0x55
        buffer[1] = 0x00
        buffer[2] = 0x09
        buffer[3] = 0x00
        buffer[4] = registro
        buffer[5] = valor
        buffer[6] = ~(0x09 + 0x00 + registro + valor)
        buffer[7] = 0x00
        buffer[8] = 0xAA

        serial.writeBuffer(buffer)
    }

    function solicitarLectura(registro: number, cantidad: number): void {
        let buffer = pins.createBuffer(9)
        let tipoLectura = 0x02

        buffer[0] = 0x55
        buffer[1] = 0x00
        buffer[2] = 0x09
        buffer[3] = tipoLectura
        buffer[4] = registro
        buffer[5] = cantidad
        buffer[6] = 255 - ((0x09 + tipoLectura + registro + cantidad) & 0xFF)
        buffer[7] = 0x00
        buffer[8] = 0xAA

        serial.writeBuffer(buffer)
    }

    function normalizarAngulo(angulo: number): number {
        while (angulo < 0) {
            angulo += 360
        }
        while (angulo >= 360) {
            angulo -= 360
        }
        return angulo
    }

    function diferenciaAngular(actual: number, anterior: number): number {
        let diferencia = normalizarAngulo(actual) - normalizarAngulo(anterior)
        if (diferencia > 180) {
            diferencia -= 360
        } else if (diferencia < -180) {
            diferencia += 360
        }
        return diferencia
    }

    function leerYawXGO(tiempoEsperaMs: number): number {
        // No vaciar aquí: una respuesta que llegue con retraso sigue siendo útil
        // para el control y no debe descartarse entre dos lecturas consecutivas.
        solicitarLectura(REGISTRO_YAW, 4)

        let recibidos: number[] = []
        let inicioEspera = input.runningTime()

        while (input.runningTime() - inicioEspera < tiempoEsperaMs) {
            let nuevos = serial.readBuffer(0)
            for (let i = 0; i < nuevos.length; i++) {
                recibidos.push(nuevos[i])
            }

            for (let inicio = 0; inicio + 8 < recibidos.length; inicio++) {
                if (recibidos[inicio] != 0x55 || recibidos[inicio + 1] != 0x00) {
                    continue
                }

                let longitud = recibidos[inicio + 2]
                if (longitud < 9 || inicio + longitud > recibidos.length) {
                    continue
                }

                let tipo = recibidos[inicio + 3]
                let registro = recibidos[inicio + 4]
                let indiceChecksum = inicio + longitud - 3
                let checksum = longitud + tipo + registro

                for (let dato = inicio + 5; dato < indiceChecksum; dato++) {
                    checksum += recibidos[dato]
                }

                let checksumEsperado = 255 - (checksum & 0xFF)
                let finValido = recibidos[inicio + longitud - 2] == 0x00 && recibidos[inicio + longitud - 1] == 0xAA

                if (registro == REGISTRO_YAW && longitud == 12 && recibidos[indiceChecksum] == checksumEsperado && finValido) {
                    let datosYaw = pins.createBuffer(4)
                    for (let j = 0; j < 4; j++) {
                        datosYaw[j] = recibidos[inicio + 5 + j]
                    }

                    let yaw = datosYaw.getNumber(NumberFormat.Float32LE, 0)
                    if (yaw >= -720 && yaw <= 720) {
                        ultimoYawLeido = normalizarAngulo(yaw)
                        ultimaLecturaYawValida = true
                        ultimoDiagnosticoYaw = 0
                        return ultimoYawLeido
                    }
                }
            }

            basic.pause(10)
        }

        ultimaLecturaYawValida = false
        if (recibidos.length == 0) {
            ultimoDiagnosticoYaw = -1
        } else {
            ultimoDiagnosticoYaw = -2
        }
        return YAW_NO_VALIDO
    }

    function leerYawRobusto(intentos: number, tiempoEsperaMs: number): number {
        let yaw = YAW_NO_VALIDO
        intentos = Math.round(limitar(intentos, 1, 5))
        for (let intento = 0; intento < intentos; intento++) {
            yaw = leerYawXGO(tiempoEsperaMs)
            if (yaw != YAW_NO_VALIDO) {
                return yaw
            }
            basic.pause(20)
        }
        return YAW_NO_VALIDO
    }

    // Acepta una referencia únicamente cuando el robot ya está quieto. Esto
    // descarta la deriva que puede quedar después de encenderlo o moverlo en el
    // aire antes de pulsar el botón que inicia el programa.
    function leerYawEstable(): number {
        serial.readBuffer(0)
        let inicio = input.runningTime()
        let anterior = YAW_NO_VALIDO
        let consecutivas = 0

        while (input.runningTime() - inicio < TIEMPO_REFERENCIA_ESTABLE_MS) {
            let actual = leerYawXGO(150)
            if (actual == YAW_NO_VALIDO) {
                consecutivas = 0
            } else if (anterior == YAW_NO_VALIDO || Math.abs(diferenciaAngular(actual, anterior)) <= TOLERANCIA_REFERENCIA_GRADOS) {
                consecutivas += 1
                if (consecutivas >= LECTURAS_REFERENCIA_REQUERIDAS) {
                    return actual
                }
            } else {
                consecutivas = 1
            }

            anterior = actual
            basic.pause(30)
        }

        return YAW_NO_VALIDO
    }

    function posturaInicial(): void {
        enviarComando(0x3E, 0xFF)
        basic.pause(1000)
    }

    function frecuenciaPasoNormal(): void {
        // La frecuencia fija hace que cada paso educativo sea más repetible.
        enviarComando(0x3D, 0x00)
    }

    function moverInterno(direccion: DireccionMovimiento, velocidad: number): void {
        velocidad = limitar(velocidad, 0, 100)

        let valor = 128

        if (direccion == DireccionMovimiento.Avanzar) {
            valor = Math.map(velocidad, 0, 100, 128, 255)
        } else {
            valor = Math.map(velocidad, 0, 100, 128, 0)
        }

        enviarComando(0x30, valor)
    }

    function girarInterno(direccion: DireccionGiro, velocidad: number): void {
        velocidad = limitar(velocidad, 0, 100)

        let valor = 128

        if (direccion == DireccionGiro.Izquierda) {
            valor = Math.map(velocidad, 0, 100, 128, 255)
        } else {
            valor = Math.map(velocidad, 0, 100, 128, 0)
        }

        enviarComando(0x32, valor)
    }

    function detenerMovimiento(): void {
        enviarComando(0x30, 128)
    }

    function detenerGiro(): void {
        enviarComando(0x32, 128)
    }

    function moverTemporal(direccion: DireccionMovimiento, velocidad: number, segundos: number): void {
        moverInterno(direccion, velocidad)
        basic.pause(segundosAMilisegundos(segundos))
        detenerMovimiento()
    }

    function moverPorPasos(direccion: DireccionMovimiento, pasos: number): void {
        let duracion = pasosAMilisegundos(pasos)
        if (duracion <= 0) {
            return
        }

        moverInterno(direccion, VELOCIDAD_RUTA)
        basic.pause(duracion)
        detenerMovimiento()
        basic.pause(PAUSA_ESTABILIZACION_MS)
    }

    function moverPorCentimetros(centimetros: number): void {
        centimetros = limitar(centimetros, 0, 500)
        let duracion = Math.round(centimetros * milisegundosPorCm)
        if (duracion <= 0) {
            return
        }

        moverInterno(DireccionMovimiento.Avanzar, VELOCIDAD_RUTA)
        girarInterno(DireccionGiro.Derecha, correccionDerechaRecta)
        basic.pause(duracion)
        detenerMovimiento()
        detenerGiro()
        basic.pause(PAUSA_ESTABILIZACION_MS)
    }

    function retrocederPorCentimetros(centimetros: number): void {
        centimetros = limitar(centimetros, 0, 500)
        let duracion = Math.round(centimetros * milisegundosPorCm)
        if (duracion <= 0) {
            return
        }

        moverInterno(DireccionMovimiento.Retroceder, VELOCIDAD_RUTA)
        basic.pause(duracion)
        detenerMovimiento()
        basic.pause(PAUSA_ESTABILIZACION_MS)
    }

    function moverPorCentimetrosManteniendoRumbo(centimetros: number): void {
        centimetros = limitar(centimetros, 0, 500)
        let duracion = Math.round(centimetros * milisegundosPorCm)
        if (duracion <= 0) {
            return
        }

        serial.readBuffer(0)
        let yawObjetivo = leerYawRobusto(3, 150)
        if (yawObjetivo == YAW_NO_VALIDO || gananciaCorreccionRectaB <= 0) {
            moverPorCentimetros(centimetros)
            return
        }

        let inicio = input.runningTime()
        moverInterno(DireccionMovimiento.Avanzar, VELOCIDAD_RUTA)
        girarInterno(DireccionGiro.Derecha, correccionDerechaRecta)

        while (input.runningTime() - inicio < duracion) {
            let yawActual = leerYawRobusto(2, 100)
            if (yawActual == YAW_NO_VALIDO) {
                detenerGiro()
            } else {
                let errorRumbo = diferenciaAngular(yawActual, yawObjetivo)
                // El signo del yaw depende de cómo esté montada la IMU. Usar
                // el sentido aprendido durante los giros evita reforzar el
                // desvío cuando el eje está invertido.
                let signoCorreccionRecta = signoYawIzquierda
                if (signoCorreccionRecta == 0) {
                    signoCorreccionRecta = 1
                }
                let correccionFirmada = correccionDerechaRecta + errorRumbo * gananciaCorreccionRectaB * signoCorreccionRecta
                correccionFirmada = limitar(correccionFirmada, 0 - velocidadMaxCorreccionRectaB, velocidadMaxCorreccionRectaB)
                if (Math.abs(correccionFirmada) < 1) {
                    detenerGiro()
                } else if (correccionFirmada > 0) {
                    girarInterno(DireccionGiro.Derecha, Math.abs(correccionFirmada))
                } else {
                    girarInterno(DireccionGiro.Izquierda, Math.abs(correccionFirmada))
                }
            }
            basic.pause(10)
        }

        detenerMovimiento()
        detenerGiro()
        basic.pause(PAUSA_ESTABILIZACION_MS)
    }

    function girarTemporal(direccion: DireccionGiro, velocidad: number, segundos: number): void {
        girarInterno(direccion, velocidad)
        basic.pause(segundosAMilisegundos(segundos))
        detenerGiro()
    }

    function girar90Temporal(direccion: DireccionGiro, velocidad: number, duracion: number): void {
        girarInterno(direccion, velocidad)
        basic.pause(duracion)
        detenerGiro()
        basic.pause(PAUSA_ESTABILIZACION_MS)
    }

    function girar90(direccion: DireccionGiro): void {
        let velocidad = velocidadGiroIzquierda90
        let duracion = duracionGiroIzquierda90Ms

        if (direccion == DireccionGiro.Derecha) {
            velocidad = velocidadGiroDerecha90
            duracion = duracionGiroDerecha90Ms
        }

        if (!usarImuEnGiros90) {
            girar90Temporal(direccion, velocidad, duracion)
            return
        }

        // La referencia se toma al ejecutar el giro, no al encender el robot.
        // Debe permanecer estable durante varias lecturas consecutivas.
        detenerMovimiento()
        detenerGiro()
        basic.pause(250)
        let yawAnterior = leerYawEstable()
        if (yawAnterior == YAW_NO_VALIDO) {
            // Compatibilidad con firmware que no responda a la lectura de IMU.
            rumboObjetivoValido = false
            girar90Temporal(direccion, velocidad, duracion)
            return
        }

        // Cada giro parte de la orientación realmente medida al comenzar. Así
        // un pequeño error físico no se hereda ni se amplifica en el siguiente.
        let rumboBase = yawAnterior
        rumboObjetivoValido = true

        let giroMedido = 0
        let yawMuestraAnterior = yawAnterior
        let signoMovimientoGiro = 0
        let inicioGiro = input.runningTime()
        let velocidadLenta = Math.max(20, Math.round(velocidad * 0.35))
        // La fase final debe ser bastante más lenta que el giro principal;
        // con velocidad 28 los pulsos alternaban alrededor del objetivo.
        let velocidadCorreccion = Math.max(20, Math.round(velocidad * 0.4))
        let velocidadActual = velocidad
        let fallosConsecutivos = 0
        let objetivoFrenado = gradosImuPorGiro90 - ANTICIPACION_GIRO_GRADOS

        girarInterno(direccion, velocidadActual)

        // Nunca se deja girar durante más tiempo que el necesario para cerca
        // de 135 grados, aunque la configuración avanzada permita más tiempo.
        let limiteTiempoGiro = Math.min(tiempoMaximoGiroImuMs, Math.max(1200, Math.round(duracion * 1.35)))
        while (giroMedido < objetivoFrenado && giroMedido < GIRO_MAXIMO_SEGURIDAD_GRADOS && input.runningTime() - inicioGiro < limiteTiempoGiro) {
            let yawActual = leerYawRobusto(2, 90)
            if (yawActual == YAW_NO_VALIDO) {
                fallosConsecutivos += 1
                if (fallosConsecutivos >= MAX_FALLOS_YAW) {
                    break
                }
            } else {
                fallosConsecutivos = 0
                // Acumular cada incremento hace que el progreso sea monotónico.
                // La diferencia respecto al inicio se invierte tras 180 grados
                // y era lo que permitía que un giro fallido llegara a 360 grados.
                let incremento = diferenciaAngular(yawActual, yawMuestraAnterior)
                yawMuestraAnterior = yawActual
                if (Math.abs(incremento) <= 45 && Math.abs(incremento) >= 0.2) {
                    if (signoMovimientoGiro == 0 && Math.abs(incremento) >= 1) {
                        signoMovimientoGiro = incremento > 0 ? 1 : -1
                    }
                    if (signoMovimientoGiro == 0 || incremento * signoMovimientoGiro > 0) {
                        giroMedido += Math.abs(incremento)
                    }
                }

                let gradosRestantes = gradosImuPorGiro90 - giroMedido
                if (gradosRestantes <= 60 && velocidadActual != velocidadLenta) {
                    velocidadActual = velocidadLenta
                    girarInterno(direccion, velocidadActual)
                }
            }

            basic.pause(10)
        }

        detenerGiro()
        basic.pause(180)

        // Medir el desplazamiento por inercia después de frenar.
        // Descartar respuestas atrasadas del tramo en movimiento. La lectura
        // siguiente debe representar al robot ya detenido.
        serial.readBuffer(0)
        let yawFinal = leerYawRobusto(3, 120)
        if (yawFinal != YAW_NO_VALIDO) {
            let incrementoFinal = diferenciaAngular(yawFinal, yawMuestraAnterior)
            if (Math.abs(incrementoFinal) <= 45 && (signoMovimientoGiro == 0 || incrementoFinal * signoMovimientoGiro > 0)) {
                giroMedido += Math.abs(incrementoFinal)
            }
            // Registrar siempre la medicion propia de este giro, incluso si
            // ya quedo dentro de la tolerancia y no necesita correcciones.
            ultimoGiroMedido = giroMedido
            // Los fallos durante el giro principal no deben impedir corregir
            // una vez que la IMU vuelve a responder con el robot detenido.
            fallosConsecutivos = 0
        } else {
            // Sin una orientación final fiable no se debe inventar el rumbo
            // absoluto ni arrastrarlo al siguiente giro.
            rumboObjetivoValido = false
            detenerGiro()
            basic.pause(PAUSA_ESTABILIZACION_MS)
            return
        }

        // Detectar automáticamente si el yaw aumenta o disminuye al girar a
        // la izquierda. Esto evita depender de cómo esté montada la IMU.
        let deltaMovimiento = diferenciaAngular(yawFinal, yawAnterior)
        if (signoMovimientoGiro != 0) {
            let signoMovimiento = signoMovimientoGiro
            if (direccion == DireccionGiro.Izquierda) {
                signoYawIzquierda = signoMovimiento
            } else {
                signoYawIzquierda = -signoMovimiento
            }
        } else if (yawFinal != YAW_NO_VALIDO && Math.abs(deltaMovimiento) >= 5) {
            let signoMovimiento = 1
            if (deltaMovimiento < 0) {
                signoMovimiento = -1
            }
            if (direccion == DireccionGiro.Izquierda) {
                signoYawIzquierda = signoMovimiento
            } else {
                signoYawIzquierda = -signoMovimiento
            }
        }

        if (signoYawIzquierda == 0) {
            // Solo se usa si la lectura final falló antes de poder detectar el
            // signo. La siguiente lectura válida volverá a aprenderlo.
            signoYawIzquierda = 1
        }

        let signoObjetivo = signoYawIzquierda
        if (direccion == DireccionGiro.Derecha) {
            signoObjetivo = -signoYawIzquierda
        }
        let objetivoAbsoluto = normalizarAngulo(rumboBase + signoObjetivo * gradosImuPorGiro90)
        rumboObjetivoGrados = objetivoAbsoluto

        // Correcciones cortas a baja velocidad: también recuperan un pequeño
        // sobrepaso girando en sentido contrario.
        let correcciones = 0
        let lecturasEstables = 0
        let error = diferenciaAngular(objetivoAbsoluto, yawFinal)
        let inicioCorrecciones = input.runningTime()
        while ((Math.abs(error) > toleranciaGiroGrados || lecturasEstables < LECTURAS_ESTABLES_REQUERIDAS) && correcciones < MAX_CORRECCIONES_GIRO && fallosConsecutivos < MAX_FALLOS_YAW && input.runningTime() - inicioCorrecciones < TIEMPO_MAXIMO_CORRECCIONES_MS) {
            if (Math.abs(error) <= toleranciaGiroGrados) {
                lecturasEstables += 1
                basic.pause(60)
            } else {
                lecturasEstables = 0
                let direccionCorreccion = DireccionGiro.Derecha
                if ((error > 0 && signoYawIzquierda > 0) || (error < 0 && signoYawIzquierda < 0)) {
                    direccionCorreccion = DireccionGiro.Izquierda
                }

                girarInterno(direccionCorreccion, velocidadCorreccion)
                // Micropulso proporcional: suficiente para vencer la fricción,
                // pero corto para no saltar repetidamente de un lado al otro.
                basic.pause(Math.round(limitar(Math.abs(error) * 10, 90, 260)))
                detenerGiro()
                basic.pause(180)
            }

            // Cada corrección se valida con una respuesta nueva de la IMU. Sin
            // esta limpieza podía reutilizarse una lectura anterior y el giro
            // terminaba cerca de los 75 grados de frenado.
            serial.readBuffer(0)
            let yawCorregido = leerYawRobusto(3, 120)
            if (yawCorregido == YAW_NO_VALIDO) {
                fallosConsecutivos += 1
            } else {
                fallosConsecutivos = 0
                error = diferenciaAngular(objetivoAbsoluto, yawCorregido)
                ultimoGiroMedido = Math.abs(diferenciaAngular(yawCorregido, yawAnterior))
                if (ultimoGiroMedido >= GIRO_MAXIMO_SEGURIDAD_GRADOS) {
                    break
                }
            }
            correcciones += 1
        }

        detenerGiro()
        basic.pause(PAUSA_ESTABILIZACION_MS)
    }

    function moverGancho(valor: number): void {
        valor = limitar(valor, 0, 255)
        enviarComando(0x71, valor)
        // El controlador oficial reserva 3 s para que la pinza termine el recorrido.
        // Enviar el siguiente movimiento antes puede hacer que el XGO ignore esa orden.
        basic.pause(PAUSA_GANCHO_MS)
    }

    function moverBrazo(posicion: number): void {
        posicion = limitar(posicion, 0, 100)
        enviarComando(0x73, Math.map(posicion, 0, 100, 0, 255))
        basic.pause(pausaBrazoMs)
    }

    function desplegarBrazoCompleto(): void {
        // Control polar oficial: theta 70..270 grados y radio 80..140 mm.
        // Primero fija la dirección y después lleva el brazo al alcance máximo.
        let valorAngulo = Math.map(limitar(anguloBrazoDesplegado, 70, 270), 70, 270, 0, 255)
        let valorAlcance = Math.map(limitar(alcanceBrazoDesplegadoMm, 80, 140), 80, 140, 0, 255)
        enviarComando(0x76, valorAngulo)
        basic.pause(50)
        enviarComando(0x77, valorAlcance)
        basic.pause(pausaBrazoMs)
    }

    function retraerBrazoAPosturaInicial(): void {
        // 0x3E = acción y 255 = restaurar la postura inicial completa.
        // Es la misma orden que repliega correctamente el brazo al encender.
        enviarComando(0x3E, 0xFF)
        basic.pause(1500)
    }

    function abrirPinza(): void {
        clampState = 0
        moverGancho(GANCHO_ABIERTO)
    }

    function asegurarXGOSInicializado(): void {
        if (robotInicializado) {
            return
        }

        clampState = 0
        serial.redirect(
            SerialPin.P14,
            SerialPin.P13,
            BaudRate.BaudRate115200
        )
        serial.setRxBufferSize(64)
        posturaInicial()
        frecuenciaPasoNormal()
        abrirPinza()
        rumboObjetivoValido = false
        signoYawIzquierda = 0
        robotInicializado = true
        basic.showIcon(IconNames.Happy)
    }

    /**
     * Inicializa el robot XGOS V2 y deja el gancho abierto.
     */
    //% block="iniciar XGOS"
    //% group="Inicio"
    //% weight=100
    //% blockHidden=true
    export function iniciarXGOS(): void {
        asegurarXGOSInicializado()
    }

    /**
     * Avanza una cantidad de pasos educativos. Un paso se puede calibrar para el circuito.
     * @param pasos cantidad de pasos, de 1 a 50
     */
    //% block="avanzar $pasos pasos"
    //% group="Ruta"
    //% pasos.min=1 pasos.max=50 pasos.defl=1
    //% weight=95
    //% blockHidden=true
    export function avanzarPasos(pasos: number): void {
        basic.showArrow(ArrowNames.South)
        moverPorPasos(DireccionMovimiento.Avanzar, pasos)
    }

    /**
     * Retrocede una cantidad de pasos educativos. Un paso se puede calibrar para el circuito.
     * @param pasos cantidad de pasos, de 1 a 50
     */
    //% block="retroceder $pasos pasos"
    //% group="Ruta"
    //% pasos.min=1 pasos.max=50 pasos.defl=1
    //% weight=94
    //% blockHidden=true
    export function retrocederPasos(pasos: number): void {
        basic.showArrow(ArrowNames.North)
        moverPorPasos(DireccionMovimiento.Retroceder, pasos)
    }

    /** Ejecuta el recorrido A con una distancia editable en centimetros. */
    //% block="A avanzar $centimetros cm"
    //% group="Recorridos A B C"
    //% centimetros.min=1 centimetros.max=500 centimetros.defl=51
    //% weight=100
    //% blockHidden=true
    export function recorridoA(centimetros: number): void {
        moverPorCentimetrosManteniendoRumbo(limitar(centimetros, 1, 500) * ajusteRecorridoAPorcentaje / 100 + compensacionGiroIzquierdaCm)
    }

    /** Ejecuta el recorrido B con una distancia editable en centimetros. */
    //% block="B avanzar $centimetros cm"
    //% group="Recorridos A B C"
    //% centimetros.min=1 centimetros.max=500 centimetros.defl=84
    //% weight=99
    //% blockHidden=true
    export function recorridoB(centimetros: number): void {
        moverPorCentimetrosManteniendoRumbo(limitar(centimetros, 1, 500) * ajusteRecorridoBPorcentaje / 100 + compensacionGiroIzquierdaCm)
    }

    /** Ejecuta el recorrido C con una distancia editable en centimetros. */
    //% block="C avanzar $centimetros cm"
    //% group="Recorridos A B C"
    //% centimetros.min=1 centimetros.max=500 centimetros.defl=52
    //% weight=98
    //% blockHidden=true
    export function recorridoC(centimetros: number): void {
        moverPorCentimetrosManteniendoRumbo(limitar(centimetros, 1, 500) * ajusteRecorridoCPorcentaje / 100)
    }

    /** Gira aproximadamente 90 grados a la izquierda. */
    //% block="girar 90° a la izquierda"
    //% group="Ruta"
    //% weight=93
    //% blockHidden=true
    export function girarIzquierda90(): void {
        basic.showArrow(ArrowNames.West)
        girar90(DireccionGiro.Izquierda)
    }

    /** Gira aproximadamente 90 grados a la derecha. */
    //% block="girar 90° a la derecha"
    //% group="Ruta"
    //% weight=92
    //% blockHidden=true
    export function girarDerecha90(): void {
        basic.showArrow(ArrowNames.East)
        girar90(DireccionGiro.Derecha)
    }

    /**
     * Ajusta cuánto dura un paso educativo. Uso recomendado: calibración del docente.
     * @param milisegundos duración de un paso en milisegundos
     */
    //% block="calibrar 1 paso a $milisegundos ms"
    //% group="Calibración"
    //% milisegundos.min=100 milisegundos.max=2000 milisegundos.defl=500
    //% weight=20
    //% advanced=true
    //% blockHidden=true
    export function calibrarPaso(milisegundos: number): void {
        duracionPasoMs = Math.round(limitar(milisegundos, 100, 2000))
    }

    /**
     * Calcula la duración por centímetro a partir de una prueba medida con cinta.
     * Ejemplo: si en 3000 ms avanzó 30 cm, la calibración será 100 ms/cm.
     */
    //% block="calibrar avance: en $tiempoPruebaMs ms recorrió $distanciaMedidaCm cm"
    //% group="Calibración"
    //% tiempoPruebaMs.min=1000 tiempoPruebaMs.max=10000 tiempoPruebaMs.defl=3000
    //% distanciaMedidaCm.min=1 distanciaMedidaCm.max=300 distanciaMedidaCm.defl=30
    //% weight=30
    //% blockHidden=true
    export function calibrarDistancia(tiempoPruebaMs: number, distanciaMedidaCm: number): void {
        tiempoPruebaMs = limitar(tiempoPruebaMs, 1000, 10000)
        distanciaMedidaCm = limitar(distanciaMedidaCm, 1, 300)
        milisegundosPorCm = tiempoPruebaMs / distanciaMedidaCm
    }

    /**
     * Ajuste fino decimal de la marcha. Un valor mayor hace que el robot avance
     * durante más tiempo por cada centímetro solicitado.
     */
    //% block="calibrar avance preciso a $factorMsPorCm ms por cm"
    //% group="Calibración"
    //% factorMsPorCm.min=20 factorMsPorCm.max=500 factorMsPorCm.defl=100
    //% weight=31
    //% blockHidden=true
    export function calibrarMilisegundosPorCm(factorMsPorCm: number): void {
        milisegundosPorCm = limitar(factorMsPorCm, 20, 500)
    }

    /** Ajusta en centímetros las distancias de los tres recorridos. */
    //% block="distancias: A $distanciaACm cm B $distanciaBCm cm C $distanciaCCm cm"
    //% group="Calibración"
    //% distanciaACm.min=1 distanciaACm.max=500 distanciaACm.defl=51
    //% distanciaBCm.min=1 distanciaBCm.max=500 distanciaBCm.defl=84
    //% distanciaCCm.min=1 distanciaCCm.max=500 distanciaCCm.defl=52
    //% weight=29
    //% blockHidden=true
    export function calibrarRecorridos(distanciaACm: number, distanciaBCm: number, distanciaCCm: number): void {
        distanciaRecorridoACm = Math.round(limitar(distanciaACm, 1, 500))
        distanciaRecorridoBCm = Math.round(limitar(distanciaBCm, 1, 500))
        distanciaRecorridoCCm = Math.round(limitar(distanciaCCm, 1, 500))
    }

    /**
     * Corrección independiente para cada recorrido. Mantiene visibles las
     * distancias objetivo y compensa diferencias físicas sin alterar A.
     */
    //% block="ajustes: A $porcentajeA % B $porcentajeB % C $porcentajeC %"
    //% group="Calibración"
    //% porcentajeA.min=50 porcentajeA.max=150 porcentajeA.defl=100
    //% porcentajeB.min=50 porcentajeB.max=150 porcentajeB.defl=91.01
    //% porcentajeC.min=50 porcentajeC.max=150 porcentajeC.defl=88.53
    //% weight=28
    //% blockHidden=true
    export function calibrarAjustesRecorridos(porcentajeA: number, porcentajeB: number, porcentajeC: number): void {
        ajusteRecorridoAPorcentaje = limitar(porcentajeA, 50, 150)
        ajusteRecorridoBPorcentaje = limitar(porcentajeB, 50, 150)
        ajusteRecorridoCPorcentaje = limitar(porcentajeC, 50, 150)
    }

    /** Ajusta el avance que compensa el desplazamiento del centro del robot antes de girar a la izquierda. */
    //% block="compensar giro izquierdo avanzando $centimetros cm"
    //% group="Calibración"
    //% centimetros.min=0 centimetros.max=20 centimetros.defl=7.5
    //% weight=22
    //% blockHidden=true
    export function calibrarCompensacionGiroIzquierda(centimetros: number): void {
        compensacionGiroIzquierdaCm = limitar(centimetros, 0, 20)
    }

    /** Ajusta la intensidad de las correcciones que mantienen recto el recorrido B. */
    //% block="corrección recta B: ganancia $ganancia máximo $velocidadMaxima"
    //% group="Calibración"
    //% ganancia.min=0 ganancia.max=5 ganancia.defl=2
    //% velocidadMaxima.min=5 velocidadMaxima.max=30 velocidadMaxima.defl=15
    //% weight=20
    //% blockHidden=true
    export function calibrarCorreccionRectaB(ganancia: number, velocidadMaxima: number): void {
        gananciaCorreccionRectaB = limitar(ganancia, 0, 5)
        velocidadMaxCorreccionRectaB = limitar(velocidadMaxima, 5, 30)
    }

    /** Ajusta el empuje base hacia la derecha usado para neutralizar la deriva al avanzar. */
    //% block="correccion recta hacia derecha $velocidad"
    //% group="Calibración"
    //% velocidad.min=0 velocidad.max=15 velocidad.defl=3 velocidad.step=0.5
    //% weight=19
    //% blockHidden=true
    export function calibrarCorreccionDerechaRecta(velocidad: number): void {
        correccionDerechaRecta = limitar(velocidad, 0, 15)
    }

    /** Hace avanzar el robot durante el tiempo usado en la prueba con cinta métrica. */
    //% block="prueba de calibración durante $tiempoPruebaMs ms"
    //% group="Modo de pruebas"
    //% tiempoPruebaMs.min=1000 tiempoPruebaMs.max=10000 tiempoPruebaMs.defl=3000
    //% weight=35
    //% blockHidden=true
    export function probarCalibracionDistancia(tiempoPruebaMs: number): void {
        moverInterno(DireccionMovimiento.Avanzar, VELOCIDAD_RUTA)
        basic.pause(Math.round(limitar(tiempoPruebaMs, 1000, 10000)))
        detenerMovimiento()
        basic.pause(PAUSA_ESTABILIZACION_MS)
    }

    /** Permite comprobar directamente una distancia en centímetros. */
    //% block="probar avance de $centimetros cm"
    //% group="Modo de pruebas"
    //% centimetros.min=1 centimetros.max=500 centimetros.defl=35
    //% weight=34
    //% blockHidden=true
    export function probarAvanceCm(centimetros: number): void {
        moverPorCentimetros(centimetros)
    }

    /** Conserva la calibración conjunta para proyectos anteriores. */
    //% block="calibrar ambos giros de 90° a $milisegundos ms"
    //% group="Calibración"
    //% milisegundos.min=100 milisegundos.max=5000 milisegundos.defl=1000
    //% weight=18
    //% blockHidden=true
    export function calibrarGiro90(milisegundos: number): void {
        duracionGiroIzquierda90Ms = Math.round(limitar(milisegundos, 100, 5000))
        duracionGiroDerecha90Ms = duracionGiroIzquierda90Ms
    }

    /** Ajusta de forma independiente el giro de 90 grados a la izquierda. */
    //% block="calibrar giro izquierdo 90°: velocidad $velocidad durante $milisegundos ms"
    //% group="Calibración"
    //% velocidad.min=10 velocidad.max=100 velocidad.defl=35
    //% milisegundos.min=100 milisegundos.max=5000 milisegundos.defl=1700
    //% weight=20
    //% blockHidden=true
    export function calibrarGiroIzquierda90(velocidad: number, milisegundos: number): void {
        velocidadGiroIzquierda90 = Math.round(limitar(velocidad, 10, 100))
        duracionGiroIzquierda90Ms = Math.round(limitar(milisegundos, 100, 5000))
    }

    /** Ajusta de forma independiente el giro de 90 grados a la derecha. */
    //% block="calibrar giro derecho 90°: velocidad $velocidad durante $milisegundos ms"
    //% group="Calibración"
    //% velocidad.min=10 velocidad.max=100 velocidad.defl=35
    //% milisegundos.min=100 milisegundos.max=5000 milisegundos.defl=1700
    //% weight=19
    //% blockHidden=true
    export function calibrarGiroDerecha90(velocidad: number, milisegundos: number): void {
        velocidadGiroDerecha90 = Math.round(limitar(velocidad, 10, 100))
        duracionGiroDerecha90Ms = Math.round(limitar(milisegundos, 100, 5000))
    }

    /**
     * Activa el giro de 90 grados medido por la IMU del XGO. Si la primera
     * lectura no responde, se usa automáticamente la calibración por tiempo.
     */
    //% block="usar IMU en giros de 90° $activar tolerancia $tolerancia grados máximo $tiempoMaximoMs ms"
    //% group="Calibración"
    //% activar.defl=true
    //% tolerancia.min=1 tolerancia.max=15 tolerancia.defl=1
    //% tiempoMaximoMs.min=1000 tiempoMaximoMs.max=10000 tiempoMaximoMs.defl=6000
    //% weight=21
    //% blockHidden=true
    export function configurarGiroImu(activar: boolean, tolerancia: number, tiempoMaximoMs: number): void {
        usarImuEnGiros90 = activar
        toleranciaGiroGrados = Math.round(limitar(tolerancia, 1, 15))
        tiempoMaximoGiroImuMs = Math.round(limitar(tiempoMaximoMs, 1000, 10000))
    }

    /**
     * Ajuste manual del giro. El número indica cuántos grados debe medir la
     * IMU del XGO para considerar terminado un giro físico de 90 grados.
     * Cambie de 0,5 en 0,5 usando una escuadra en el suelo.
     */
    //% block="AJUSTE MANUAL giro 90° = $grados"
    //% group="Calibración"
    //% grados.min=80 grados.max=110 grados.defl=97 grados.step=0.5
    //% weight=100
    //% blockHidden=true
    export function calibrarGiroFisico90(grados: number): void {
        gradosImuPorGiro90 = Math.round(limitar(grados, 80, 110) * 10) / 10
    }

    /** Devuelve los grados de yaw medidos durante el último giro de 90°. */
    //% block="último giro medido en grados"
    //% group="Modo de pruebas"
    //% weight=35
    //% blockHidden=true
    export function leerUltimoGiroMedido(): number {
        return Math.round(ultimoGiroMedido)
    }

    /** Muestra el último giro como un patrón fijo de 8 bits para fotografiarlo. */
    //% block="mostrar código del último giro"
    //% group="Modo de pruebas"
    //% weight=34
    //% blockHidden=true
    export function mostrarUltimoGiroEnMatriz(): void {
        mostrarCodigoGiro(ultimoGiroMedido)
    }

    /** Toma la orientación actual como referencia para una nueva prueba. */
    //% block="fijar rumbo actual como inicio"
    //% group="Modo de pruebas"
    //% weight=36
    //% blockHidden=true
    export function fijarRumboActualComoInicio(): void {
        detenerMovimiento()
        detenerGiro()
        basic.pause(250)
        serial.readBuffer(0)
        let rumboActual = leerYawRobusto(5, 250)
        if (rumboActual == YAW_NO_VALIDO) {
            rumboObjetivoValido = false
            basic.showNumber(ultimoDiagnosticoYaw)
        } else {
            rumboObjetivoGrados = rumboActual
            rumboObjetivoValido = true
            signoYawIzquierda = 0
            basic.showIcon(IconNames.Yes)
        }
    }

    /** Ajusta las dos posiciones y la espera del brazo. */
    //% block="calibrar brazo: retraído $retraido desplegado $desplegado espera $esperaMs ms"
    //% group="Calibración"
    //% retraido.min=0 retraido.max=100 retraido.defl=50
    //% desplegado.min=0 desplegado.max=100 desplegado.defl=100
    //% esperaMs.min=1000 esperaMs.max=6000 esperaMs.defl=3000
    //% weight=17
    //% blockHidden=true
    export function calibrarBrazo(retraido: number, desplegado: number, esperaMs: number): void {
        brazoRetraido = Math.round(limitar(retraido, 0, 100))
        brazoDesplegado = Math.round(limitar(desplegado, 0, 100))
        pausaBrazoMs = Math.round(limitar(esperaMs, 1000, 6000))
    }

    /** Ajusta la dirección y el alcance del despliegue usado para soltar la pelota. */
    //% block="calibrar extensión: ángulo $angulo grados alcance $alcanceMm mm"
    //% group="Calibración"
    //% angulo.min=70 angulo.max=270 angulo.defl=200
    //% alcanceMm.min=80 alcanceMm.max=140 alcanceMm.defl=140
    //% weight=16
    //% blockHidden=true
    export function calibrarExtensionBrazo(angulo: number, alcanceMm: number): void {
        anguloBrazoDesplegado = Math.round(limitar(angulo, 70, 270))
        alcanceBrazoDesplegadoMm = Math.round(limitar(alcanceMm, 80, 140))
    }

    /**
     * Avanza durante una cantidad de segundos.
     * @param velocidad velocidad de 0 a 100
     * @param segundos tiempo en segundos
     */
    //% block="avanzar velocidad $velocidad durante $segundos segundos"
    //% group="Avanzado"
    //% velocidad.min=0 velocidad.max=100 velocidad.defl=100
    //% segundos.min=0 segundos.max=10 segundos.defl=1
    //% weight=90
    //% blockHidden=true
    export function avanzar(velocidad: number, segundos: number): void {
        // Mostrar flecha hacia adelante (abajo)
        basic.showLeds(`
            . . # . .
            . . # . .
            # . # . #
            . # # # .
            . . # . .
            `)
        moverTemporal(DireccionMovimiento.Avanzar, velocidad, segundos)
    }

    /**
     * Retrocede durante una cantidad de segundos.
     * @param velocidad velocidad de 0 a 100
     * @param segundos tiempo en segundos
     */
    //% block="retroceder velocidad $velocidad durante $segundos segundos"
    //% group="Avanzado"
    //% velocidad.min=0 velocidad.max=100 velocidad.defl=100
    //% segundos.min=0 segundos.max=10 segundos.defl=1
    //% weight=80
    //% blockHidden=true
    export function retroceder(velocidad: number, segundos: number): void {
        // Mostrar flecha hacia atrás (arriba)
        basic.showLeds(`
            . . # . .
            . # # # .
            # . # . #
            . . # . .
            . . # . .
            `)
        moverTemporal(DireccionMovimiento.Retroceder, velocidad, segundos)
    }

    /**
     * Gira a la izquierda durante una cantidad de segundos.
     * @param velocidad velocidad de 0 a 100
     * @param segundos tiempo en segundos
     */
    //% block="girar izquierda velocidad $velocidad durante $segundos segundos"
    //% group="Avanzado"
    //% velocidad.min=0 velocidad.max=100 velocidad.defl=100
    //% segundos.min=0 segundos.max=10 segundos.defl=1
    //% weight=70
    //% blockHidden=true
    export function girarIzquierda(velocidad: number, segundos: number): void {
        // Mostrar flecha a la izquierda (según configuración de la placa)
        basic.showLeds(`
            . . # . .
            . . . # .
            # # # # #
            . . . # .
            . . # . .
            `)
        girarTemporal(DireccionGiro.Izquierda, velocidad, segundos)
    }

    /**
     * Gira a la derecha durante una cantidad de segundos.
     * @param velocidad velocidad de 0 a 100
     * @param segundos tiempo en segundos
     */
    //% block="girar derecha velocidad $velocidad durante $segundos segundos"
    //% group="Avanzado"
    //% velocidad.min=0 velocidad.max=100 velocidad.defl=100
    //% segundos.min=0 segundos.max=10 segundos.defl=1
    //% weight=60
    //% blockHidden=true
    export function girarDerecha(velocidad: number, segundos: number): void {
        // Mostrar flecha a la derecha (según configuración de la placa)
        basic.showLeds(`
            . . # . .
            . # . . .
            # # # # #
            . # . . .
            . . # . .
            `)
        girarTemporal(DireccionGiro.Derecha, velocidad, segundos)
    }

    /**
     * Despliega el brazo, abre el gancho para soltar el objeto y vuelve a retraerlo.
     */
    //% block="entregar objeto (desplegar, abrir y retraer)"
    //% group="Gancho"
    //% weight=50
    //% blockHidden=true
    export function abrirGancho(): void {
        // Impide que dos pulsaciones mezclen comandos mientras el brazo está moviéndose.
        if (entregaEnCurso) {
            return
        }
        entregaEnCurso = true

        // Mostrar gancho abierto
        basic.showLeds(`
            # . . . #
            # . . . #
            # . . . #
            # . . . #
            # . . . #
            `)
        desplegarBrazoCompleto()
        abrirPinza()
        retraerBrazoAPosturaInicial()
        entregaEnCurso = false
    }

    /**
     * Cierra el gancho.
     */
    //% block="cerrar gancho"
    //% group="Gancho"
    //% weight=40
    //% blockHidden=true
    export function cerrarGancho(): void {
        clampState = 1
        // Mostrar gancho cerrado
        basic.showLeds(`
            . # . # .
            . # . # .
            # # . # #
            . # . # .
            . # . # .
            `)
        moverGancho(GANCHO_CERRADO)
    }

    /**
     * Cambia el estado del gancho. Si está abierto, lo cierra. Si está cerrado, lo abre.
     */
    //% block="alternar gancho"
    //% group="Gancho"
    //% weight=30
    //% blockHidden=true
    export function alternarGancho(): void {
        if (clampState == 0) {
            cerrarGancho()
        } else {
            abrirGancho()
        }
    }

    /** Despliega el brazo hasta su posición calibrada. */
    //% block="desplegar brazo"
    //% group="Modo de pruebas"
    //% weight=30
    //% blockHidden=true
    export function desplegarBrazo(): void {
        desplegarBrazoCompleto()
    }

    /** Retrae el brazo hasta su posición calibrada. */
    //% block="retraer brazo"
    //% group="Modo de pruebas"
    //% weight=29
    //% blockHidden=true
    export function retraerBrazo(): void {
        retraerBrazoAPosturaInicial()
    }

    /** Permite explorar directamente una posición segura del brazo entre 0 y 100. */
    //% block="probar posición del brazo $posicion"
    //% group="Modo de pruebas"
    //% posicion.min=0 posicion.max=100 posicion.defl=50
    //% weight=28
    //% blockHidden=true
    export function probarPosicionBrazo(posicion: number): void {
        moverBrazo(posicion)
    }

    /**
     * Solicita al XGO su ángulo yaw actual. Devuelve -999 si no hay respuesta.
     */
    //% block="leer ángulo yaw del XGO"
    //% group="Modo de pruebas"
    //% weight=27
    //% blockHidden=true
    export function leerAnguloYaw(): number {
        let yaw = leerYawXGO(500)
        if (yaw == YAW_NO_VALIDO) {
            return -999
        }
        return Math.round(yaw)
    }

    /** Indica si la última solicitud de yaw recibió una respuesta válida. */
    //% block="última lectura yaw válida"
    //% group="Modo de pruebas"
    //% weight=26
    //% blockHidden=true
    export function lecturaYawValida(): boolean {
        return ultimaLecturaYawValida
    }

    /** Detiene inmediatamente el avance y el giro. */
    //% block="detener robot"
    //% group="Modo de pruebas"
    //% weight=25
    //% blockHidden=true
    export function detenerRobot(): void {
        detenerMovimiento()
        detenerGiro()
    }

    /** Avanza una distancia sencilla medida con cinta métrica. */
    //% block="Avanzar $centimetros cm"
    //% group="Movimiento"
    //% centimetros.min=1 centimetros.max=500 centimetros.defl=10
    //% weight=100
    export function ninosAvanzar(centimetros: number): void {
        asegurarXGOSInicializado()
        basic.showArrow(ArrowNames.South)
        moverPorCentimetrosManteniendoRumbo(centimetros)
    }

    /** Retrocede una distancia sencilla medida con cinta métrica. */
    //% block="Retroceder $centimetros cm"
    //% group="Movimiento"
    //% centimetros.min=1 centimetros.max=500 centimetros.defl=10
    //% weight=99
    export function ninosRetroceder(centimetros: number): void {
        asegurarXGOSInicializado()
        basic.showArrow(ArrowNames.North)
        retrocederPorCentimetros(centimetros)
    }

    /** Gira a la izquierda usando la calibración confirmada del proyecto. */
    //% block="Girar izquierda"
    //% group="Movimiento"
    //% weight=98
    export function ninosGirarIzquierda(): void {
        asegurarXGOSInicializado()
        girarIzquierda90()
    }

    /** Gira a la derecha usando la calibración confirmada del proyecto. */
    //% block="Girar derecha"
    //% group="Movimiento"
    //% weight=97
    export function ninosGirarDerecha(): void {
        asegurarXGOSInicializado()
        girarDerecha90()
    }

    /** Ejecuta el tramo A con la distancia y la corrección ya confirmadas. */
    //% block="Avanzar A"
    //% group="Recorridos listos"
    //% weight=96
    export function ninosAvanzarA(): void {
        asegurarXGOSInicializado()
        correccionDerechaRecta = CORRECCION_RECTA_A
        recorridoA(RECORRIDO_INFANTIL_A_CM * ESCALA_FISICA_A)
    }

    /** Ejecuta el tramo B con la distancia y la corrección ya confirmadas. */
    //% block="Avanzar B"
    //% group="Recorridos listos"
    //% weight=95
    export function ninosAvanzarB(): void {
        asegurarXGOSInicializado()
        correccionDerechaRecta = CORRECCION_RECTA_B
        recorridoB(RECORRIDO_INFANTIL_B_CM * ESCALA_FISICA_B)
    }

    /** Ejecuta el tramo C con la distancia y la corrección ya confirmadas. */
    //% block="Avanzar C"
    //% group="Recorridos listos"
    //% weight=94
    export function ninosAvanzarC(): void {
        asegurarXGOSInicializado()
        correccionDerechaRecta = CORRECCION_RECTA_C
        recorridoC(RECORRIDO_INFANTIL_C_CM * ESCALA_FISICA_C)
    }

    /** Despliega el brazo, abre el hocico y vuelve a recogerlo. */
    //% block="Abrir hocico"
    //% group="Hocico"
    //% weight=93
    export function ninosAbrirHocico(): void {
        asegurarXGOSInicializado()
        abrirGancho()
    }

    /** Cierra el hocico para sujetar la pelota. */
    //% block="Cerrar hocico"
    //% group="Hocico"
    //% weight=92
    export function ninosCerrarHocico(): void {
        asegurarXGOSInicializado()
        cerrarGancho()
    }
}
