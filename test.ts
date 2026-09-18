robotac_xgos.iniciarXGOS()
basic.showIcon(IconNames.Yes)
let recorridoEnCurso = false
input.onButtonPressed(Button.A, function () {
    if (!recorridoEnCurso) {
        recorridoEnCurso = true
        robotac_xgos.cogerObjeto()
        robotac_xgos.tramoA()
        robotac_xgos.girarIzquierda()
        robotac_xgos.tramoB()
        robotac_xgos.girarIzquierda()
        robotac_xgos.tramoC()
        robotac_xgos.soltarObjeto()
        recorridoEnCurso = false
    }
})
