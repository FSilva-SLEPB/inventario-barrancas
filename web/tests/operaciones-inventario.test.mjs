import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const cache=new Map();
function cargar(n){if(cache.has(n))return cache.get(n);const exports={},js=ts.transpileModule(readFileSync(new URL('../src/'+n.slice(2)+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('exports','require',js)(exports,cargar);cache.set(n,exports);return exports;}
const {validarOperacionInventario,funcionarioDeEntrega}=cargar('@/lib/validacion-operaciones-inventario');
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const linea=n=>({id:uuid(n),version:1,movimientoId:uuid(n+100)});
const formulario=(c={})=>{const f=new FormData();for(const[k,v]of Object.entries({solicitud:uuid(999),tipo:'cambio',clase:'equipo',destino:uuid(900),fecha:'2026-11-06',receptor:'Persona que recibe',receptorDevolucion:'Persona UTIC',motivo:'',devoluciones:JSON.stringify([linea(1),linea(2)]),entregas:JSON.stringify([linea(3),linea(4),linea(5)]),detalleDevueltos:'',detalleEntregados:'',volver:'/inventario/nivel-central?q=ejemplo&pagina=2&limite=100',...c}))f.set(k,v);return f;};
const validar=f=>validarOperacionInventario(f,'2026-11-06');
test('cambio admite dos grupos de distinto tamaño para equipos o celulares',()=>{for(const clase of ['equipo','celular']){const r=validar(formulario({clase}));assert.equal(r.datos.devoluciones.length,2);assert.equal(r.datos.entregas.length,3);assert.equal(r.datos.motivo,'');assert.ok(r.volver.includes('pagina=2'));}});
test('normaliza orden de selección sin cambiar la identidad de los movimientos',()=>{const a=validar(formulario()),b=validar(formulario({devoluciones:JSON.stringify([linea(2),linea(1)]),entregas:JSON.stringify([linea(5),linea(3),linea(4)])}));assert.deepEqual(a,b);});
test('traspaso solo tiene grupo de entrega y conserva origen por resolución del servidor',()=>{const base={tipo:'traspaso',devoluciones:'[]',receptorDevolucion:'',detalleDevueltos:''};assert.equal(validar(formulario(base)).datos.tipo,'traspaso');for(const c of [{devoluciones:JSON.stringify([linea(1)])},{receptorDevolucion:'Persona'},{detalleDevueltos:'No corresponde'}])assert.throws(()=>validar(formulario({...base,...c})));});
test('ambos grupos de cambio son obligatorios y la selección está acotada',()=>{for(const c of [{devoluciones:'[]'},{entregas:'[]'},{entregas:JSON.stringify(Array.from({length:101},(_,i)=>linea(i+10)))}])assert.throws(()=>validar(formulario(c)));});
test('rechaza bienes duplicados, solapados y movimientos reutilizados',()=>{for(const c of [{entregas:JSON.stringify([linea(1)])},{entregas:JSON.stringify([linea(3),linea(3)])},{entregas:JSON.stringify([{...linea(3),movimientoId:linea(1).movimientoId}])},{entregas:JSON.stringify([{...linea(3),movimientoId:uuid(999)}])}])assert.throws(()=>validar(formulario(c)));});
test('rechaza identificaciones, versiones, campos extra y JSON inválido',()=>{for(const x of [{...linea(3),version:0},{...linea(3),version:'1'},{...linea(3),version:2147483647},{...linea(3),version:1.2},{...linea(3),id:'otro'},{...linea(3),movimientoId:'otro'},{...linea(3),custodia:'asignado'}])assert.throws(()=>validar(formulario({entregas:JSON.stringify([x])})));for(const entregas of ['{','null','{}'])assert.throws(()=>validar(formulario({entregas})));const f=formulario();f.append('sede_id',uuid(90));assert.throws(()=>validar(f));const g=formulario();g.append('tipo','traspaso');assert.throws(()=>validar(g));});
test('fecha real, destino y participantes usan las validaciones compartidas',()=>{for(const c of [{fecha:'2026-02-30'},{fecha:'2026-11-07'},{fecha:'1899-01-01'},{destino:''},{clase:'otro'},{tipo:'asignacion'},{receptor:''},{receptorDevolucion:''},{receptor:'Nombre\nOtro'},{motivo:'x'.repeat(501)},{volver:'https://ajeno.example'}])assert.throws(()=>validar(formulario(c)));});
test('observaciones de grupo admiten texto multilinea sin controles ocultos',()=>{assert.equal(validar(formulario({detalleDevueltos:'  Accesorios\nObservación  '})).datos.detalleDevueltos,'Accesorios\nObservación');for(const detalleEntregados of ['x'.repeat(1001),'Texto\0oculto'])assert.throws(()=>validar(formulario({detalleEntregados})));});

test('precarga NC requiere correo no vacío y coincidencia única; no inferir identidad por nombre',()=>{
 const personal=[{id:uuid(1),correo:null,nombre:'Homónimo'},{id:uuid(2),correo:'persona@example.org',nombre:'Homónimo'}];
 for(const correo of [undefined,'',' ','otro@example.org'])assert.equal(funcionarioDeEntrega(personal,correo),'');
 assert.equal(funcionarioDeEntrega(personal,' Persona@Example.org '),uuid(2));
 assert.equal(funcionarioDeEntrega([...personal,{id:uuid(3),correo:'PERSONA@example.org'}],'persona@example.org'),'');
});
