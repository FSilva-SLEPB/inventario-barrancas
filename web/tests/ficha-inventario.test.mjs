import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {SourceTextModule} from 'node:vm';
import ts from 'typescript';
const cache=new Map();
async function cargar(nombre){if(cache.has(nombre))return cache.get(nombre);const fuente=await readFile(new URL('../src/lib/'+nombre+'.ts',import.meta.url),'utf8');const m=new SourceTextModule(ts.transpileModule(fuente,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);cache.set(nombre,m);await m.link(n=>cargar(n.replace('@/lib/','')));return m;}
const m=await cargar('ficha-inventario');await m.evaluate();const {retornoInventario,enlaceFichaInventario,equipoEnVista}=m.namespace;
const id='11111111-1111-4111-8111-111111111111';
test('la ventana conserva todos los filtros de la página de origen sin duplicar acciones',()=>{
 const ruta='/inventario/p02?'+new URLSearchParams({vista:'inventario',q:'Serie & modelo',pagina:'2',tipo:'establecimiento',sede:id,rbd:'00123',limite:'100'});
 assert.equal(retornoInventario(ruta),ruta);
 for(const accion of ['ver','editar']){const u=new URL(enlaceFichaInventario(ruta,accion,id),'http://localhost');assert.equal(u.searchParams.get(accion),id);assert.equal(u.searchParams.get('q'),'Serie & modelo');assert.equal(u.searchParams.get('pagina'),'2');assert.equal(u.searchParams.size,8);}
});
test('el regreso solo permite los tres listados locales y rechaza destinos manipulados',()=>{
 for(const ruta of ['/inventario/nivel-central','/inventario/p02','/inventario/bodega-ti'])assert.equal(retornoInventario(ruta),ruta);
 for(const ruta of ['https://otro.invalid/inventario/p02','//otro.invalid/inventario/p02','/inventario/p02#algo','/inventario/robos','/inventario/p02?aviso=inventado','/inventario/p02?editar='+id,'/inventario/p02?q=a&q=b','/inventario/p02?pagina=0','/inventario/p02?limite=1000','/inventario/p02?sede=incorrecto','/inventario/p02?tipo=nivel_central','/inventario/p02?q=%0a','/inventario/\\otro.invalid',{},null,'x'.repeat(2001)])assert.equal(retornoInventario(ruta),null,String(ruta));
});
test('abrir una ficha respeta Nivel Central, P02 y la separación entre recibido y pendiente',()=>{
 const nc={sedeTipo:'nivel_central',situacion:'registrado_nc'},ee={sedeTipo:'establecimiento',situacion:'recibido'},ji={sedeTipo:'jardin_infantil',situacion:'pendiente_entrega'};
 assert.equal(equipoEnVista(nc,'nc','inventario'),true);assert.equal(equipoEnVista(nc,'eeji','inventario'),false);
 assert.equal(equipoEnVista(ee,'eeji','inventario'),true);assert.equal(equipoEnVista(ee,'eeji','pendientes'),false);
 assert.equal(equipoEnVista(ji,'eeji','pendientes'),true);assert.equal(equipoEnVista(ji,'eeji','inventario'),false);
});
