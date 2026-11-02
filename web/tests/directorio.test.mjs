import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {SourceTextModule} from 'node:vm';
import ts from 'typescript';
const cache=new Map();
async function cargar(nombre){if(cache.has(nombre))return cache.get(nombre);const ruta=new URL('../src/lib/'+nombre+'.ts',import.meta.url);const fuente=await readFile(ruta,'utf8');const m=new SourceTextModule(ts.transpileModule(fuente,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);cache.set(nombre,m);await m.link(n=>cargar(n.replace('@/lib/','')));return m;}
const m=await cargar('validacion-directorio');await m.evaluate();const {prepararDirectorio,nombreResponsable}=m.namespace;
const h=await cargar('presentacion-historial');await h.evaluate();const {cambiosHistorial}=h.namespace;
const sedes=[{sedeId:'1',rbd:'00123-4',sedeNombre:'Jardín de ejemplo',nombre:'Directora anterior',version:2}];
test('CSV identifica por RBD exacto y conserva versión para revisión',()=>{const p=prepararDirectorio('RBD;Nombre\n00123-4;Directora nueva',sedes);assert.equal(p.datos[0].sedeId,'1');assert.equal(p.datos[0].version,2);assert.equal(p.vista[0].anterior,'Directora anterior');assert.equal(p.vista[0].nuevo,'Directora nueva');});
test('rechaza RBD desconocido, repetido y encabezados ambiguos',()=>{for(const csv of ['RBD,Nombre\n123-4,Nombre','RBD,Nombre\n00123-4,Uno\n00123-4,Dos','RBD,Nombre,Directora\n00123-4,Uno,Dos'])assert.throws(()=>prepararDirectorio(csv,sedes));});
test('nombre normalizado no admite vacíos ni controles',()=>{assert.equal(nombreResponsable('  Ana  Pe\u0301rez  '),'Ana Pérez');for(const v of ['',null,'A\nB','A\tB','x'.repeat(201)])assert.throws(()=>nombreResponsable(v));});
test('historial inicial omite vacíos y separa los datos de adquisición',()=>{const r=cambiosHistorial(null,{marca:'HP',modelo:'Probook',serie:'001',numero_inventario:'002',motivo_identificacion:'',observaciones:'',fecha_entrega:null,datos_compra:{cdp:'CDP-01',ordenCompra:'OC-02'}},[]);assert.ok(!r.some(x=>x.campo==='Observaciones'||x.campo==='Dato de identificación pendiente'||x.campo==='Fecha de entrega'));assert.ok(r.some(x=>x.campo==='CDP'&&x.despues==='CDP-01'));assert.ok(r.some(x=>x.campo==='Número de OC'));});
test('historial conserva antes/después sin modificar las instantáneas',()=>{const a={serie:'001',datos_compra:{cdp:'A'}},d={serie:'002',datos_compra:{cdp:'B'}};const copia=JSON.stringify([a,d]);const r=cambiosHistorial(a,d,[]);assert.equal(r.length,2);assert.equal(r[0].antes,'001');assert.equal(r[0].despues,'002');assert.equal(JSON.stringify([a,d]),copia);});
