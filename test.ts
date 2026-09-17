input.onButtonPressed(Button.A, function () {
    robotac_xgos.ninosAvanzar(10)
    robotac_xgos.ninosGirarIzquierda()
    robotac_xgos.ninosCerrarHocico()
})

input.onButtonPressed(Button.B, function () {
    robotac_xgos.ninosRetroceder(10)
    robotac_xgos.ninosGirarDerecha()
    robotac_xgos.ninosAbrirHocico()
})

input.onButtonPressed(Button.AB, function () {
    robotac_xgos.ninosAvanzarA()
    robotac_xgos.ninosAvanzarB()
    robotac_xgos.ninosAvanzarC()
})
