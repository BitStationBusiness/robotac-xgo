const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('../node_modules/pxt-core/pxtcompiler/ext-typescript/lib/typescript');
const js = ts.transpile(fs.readFileSync('main.ts', 'utf8'), {target: ts.ScriptTarget.ES5});
function fixture() {
    const calls = []; let hook;
    const ctx = {
        SerialPin: {P14:14, P13:13},
        pins:{createBufferFromArray: a=>Buffer.from(a)},
        serial:{writeBuffer: b=>calls.push(['serial', ...b])},
        basic:{pause: ms=>{calls.push(['pause',ms]); if(hook)hook();}},
        xgo:{
            direction_enum:{Forward:0,Backward:1},
            rotate_direction_enum:{turn_left:0,turn_right:1},
            init_xgo_serial:(...a)=>calls.push(['init',...a]),
            Manipulator_clamp:n=>calls.push(['clamp',n]),
            move_xgo:(...a)=>calls.push(['move',...a]),
            rotate_angle_continue:(...a)=>calls.push(['turn',...a]),
            init_action:()=>calls.push(['restore'])
        }
    };
    vm.runInNewContext(js,ctx);
    return {api:ctx.robotac_xgos,calls,setHook:h=>hook=h};
}
let f=fixture();
assert.deepEqual(f.calls,[],'Importar la biblioteca no debe ejecutar movimientos');
f.api.iniciarXGOS();
assert.deepEqual(f.calls,[['init',14,13],['clamp',0]]);
f.calls.length=0; f.api.iniciarXGOS(); assert.deepEqual(f.calls,[]);
for(const [name,seconds,dir] of [['avanzar',3.3,0],['retroceder',2.8,1]]) {
    f.calls.length=0; f.api[name](seconds);
    assert.deepEqual(f.calls,[['move',dir,80],['pause',seconds*1000],['move',dir,0]]);
}
for(const [name,ms] of [['tramoA',3300],['tramoB',5000],['tramoC',3000]]) {
    f.calls.length=0; f.api[name]();
    assert.deepEqual(f.calls,[['move',0,80],['pause',ms],['move',0,0]]);
}
for(const v of [0,-1,NaN,Infinity,3601]) {
    f.calls.length=0; f.api.avanzar(v); assert.deepEqual(f.calls,[]);
}
f.calls.length=0; f.api.girarIzquierda(); f.api.girarDerecha();
assert.deepEqual(f.calls,[['turn',0,20,6.5],['turn',1,20,6.8]]);
f.calls.length=0; f.api.cogerObjeto();
assert.deepEqual(f.calls,[['clamp',196]],'Coger no debe mover brazo ni cuerpo después de preparar');
f.calls.length=0; f.api.soltarObjeto();
assert.deepEqual(f.calls,[
 ['serial',85,0,9,0,118,165,219,0,170],['pause',50],
 ['serial',85,0,9,0,119,255,128,0,170],['pause',3000],
 ['clamp',0],['restore'],['pause',500]
]);
for(const call of f.calls.filter(c=>c[0]==='serial')) {
 const b=call.slice(1); assert.equal(b[6],255-((b[2]+b[3]+b[4]+b[5])&255));
}
f.calls.length=0;
f.setHook(()=>{f.api.retroceder(1);f.api.cogerObjeto();});
f.api.avanzar(1); f.setHook(null);
assert.deepEqual(f.calls,[['move',0,80],['pause',1000],['move',0,0]],'Ignorar órdenes concurrentes');
f=fixture(); f.api.tramoA();
assert.deepEqual(f.calls,[['init',14,13],['clamp',0],['move',0,80],['pause',3300],['move',0,0]]);
console.log('PASS: 9 operaciones, tiempos, parada, garra, tramas, inicio único y concurrencia.');

// Giros temporizados: decimales, parámetros inválidos y exclusión durante movimiento.
f=fixture(); f.api.iniciarXGOS(); f.calls.length=0;
f.api.girarIzquierdaSegundos(2.5); f.api.girarDerechaSegundos(0.7);
assert.deepEqual(f.calls,[['turn',0,20,2.5],['turn',1,20,0.7]]);
for(const name of ['girarIzquierdaSegundos','girarDerechaSegundos']) {
 for(const value of [0,-1,NaN,Infinity,3601]) {
  f.calls.length=0; f.api[name](value); assert.deepEqual(f.calls,[]);
 }
}
f.calls.length=0;
f.setHook(()=>{f.api.girarIzquierdaSegundos(1);f.api.girarDerechaSegundos(1);});
f.api.avanzar(1); f.setHook(null);
assert.deepEqual(f.calls,[['move',0,80],['pause',1000],['move',0,0]]);
f.calls.length=0; f.api.girarDerechaSegundos(1);
assert.deepEqual(f.calls,[['turn',1,20,1]],'Se libera el bloqueo al terminar');
console.log('PASS: giros por segundos en ambos sentidos.');
