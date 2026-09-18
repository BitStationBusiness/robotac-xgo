const fs = require('node:fs');
require('../node_modules/pxt-core/built/pxt');
pxt.setAppTarget(require('../node_modules/pxt-microbit/pxtarget.json'));
const fileSystem={'main.ts':fs.readFileSync('test.ts','utf8'),'robot.ts':fs.readFileSync('main.ts','utf8')};
for (const pkg of fs.readdirSync('pxt_modules')) {
 const dir='pxt_modules/'+pkg+'/';
 if (!fs.existsSync(dir+'pxt.json')) continue;
 const config=JSON.parse(fs.readFileSync(dir+'pxt.json','utf8'));
 for (const name of config.files) if(name.endsWith('.ts'))fileSystem[dir+name]=fs.readFileSync(dir+name,'utf8');
}
const opts={fileSystem,sourceFiles:Object.keys(fileSystem),target:{...pxt.appTarget.compile,isNative:false},ast:true};
const result=ts.pxtc.decompile(ts.pxtc.getTSProgram(opts),opts,'main.ts');
if(!result.success)throw Error(JSON.stringify(result.diagnostics));
const xml=result.outfiles['main.blocks'];
if(xml.includes('typescript_statement')||xml.includes('typescript_expression'))throw Error('Bloques grises en el ejemplo');
fs.mkdirSync('built',{recursive:true});
fs.writeFileSync('built/ejemplo.blocks',xml);
console.log('PASS: ejemplo convertido a bloques nativos sin bloques grises.');

