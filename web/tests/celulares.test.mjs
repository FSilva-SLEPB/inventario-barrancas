import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {SourceTextModule} from 'node:vm';
import ts from 'typescript';
const cache=new Map();async function cargar(n){if(cache.has(n))return cache.get(n);const fuente=await readFile(new URL('../src/lib/'+n+'.ts',import.meta.url),'utf8');const m=new SourceTextModule(ts.transpileModule(fuente,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);cache.set(n,m);await m.link(p=>cargar(p.replace('@/lib/','')));return m;}
const m=await cargar('validacion-celulares');await m.evaluate();const {celularVacio,normalizarTelefono,validarImei,validarCelular,enlaceCelulares}=m.namespace;
const id='11111111-1111-4111-8111-111111111111',datos=()=>({...celularVacio(),sedeId:id,telefono:'9 1234 5678'});
test('normaliza un número móvil chileno por celular sin inventar dígitos',()=>{
 for(const n of ['912345678','9 1234 5678','56912345678','+56 (9) 1234-5678'])assert.equal(normalizarTelefono(n),'+56912345678');
 for(const n of ['','+56 2 1234 5678','91234567','+569123456789','+51 9 1234 5678','9texto12345678'])assert.throws(()=>normalizarTelefono(n));
});
test('IMEI es opcional, conserva ceros y valida longitud y dígito verificador',()=>{
 assert.equal(validarImei('490154203237518'),true);assert.equal(validarImei('000000000000000'),true);
 for(const n of ['490154203237519','49015420323751','4901542032375188','IMEI49015420323'])assert.equal(validarImei(n),false);
 assert.equal(validarCelular(datos()).imei,'');assert.throws(()=>validarCelular({...datos(),imei:'490154203237519'}));
});
test('el registro mínimo requiere sede y teléfono; los datos del equipo se pueden completar después',()=>{
 const d=validarCelular(datos());assert.equal(d.telefono,'+56912345678');assert.equal(d.marca,'');assert.equal(d.activo,true);
 for(const cambios of [{sedeId:'incorrecta'},{activo:'si'},{condicionTecnica:'robado'},{marca:'x'.repeat(121)},{responsable:'A\nB'}])assert.throws(()=>validarCelular({...datos(),...cambios}));
 assert.equal(validarCelular({...datos(),observaciones:' Primera línea\nSegunda línea '}).observaciones,'Primera línea\nSegunda línea');
});
test('las ventanas conservan los filtros y descartan destinos y acciones inyectados',()=>{
 const href=enlaceCelulares('q=Celular&estado=activo&pagina=2&limite=100&aviso=falso&volver=https://ajeno.invalid','editar',id),u=new URL(href,'http://localhost');
 assert.equal(u.pathname,'/inventario/celulares');assert.equal(u.searchParams.get('editar'),id);assert.equal(u.searchParams.get('pagina'),'2');assert.equal(u.searchParams.has('aviso'),false);assert.equal(u.searchParams.has('volver'),false);
});
const a=await cargar('robos-anterior');await a.evaluate();test('las antiguas direcciones del dashboard llevan al consolidado y conservan filtros conocidos',()=>{
 const destino=a.namespace.destinoRobosAnterior({q:'Equipo & sede',desde:'2026-01-01',volver:'https://ajeno.invalid'}),u=new URL(destino,'http://localhost');assert.equal(u.pathname,'/inventario/robos');assert.equal(u.searchParams.get('q'),'Equipo & sede');assert.equal(u.searchParams.has('volver'),false);
});
