import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SourceTextModule} from 'node:vm';
import ts from 'typescript';
const cache=new Map();
async function cargar(nombre){if(cache.has(nombre))return cache.get(nombre);const fuente=await readFile(new URL('../src/lib/'+nombre+'.ts',import.meta.url),'utf8'),m=new SourceTextModule(ts.transpileModule(fuente,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);cache.set(nombre,m);await m.link(n=>cargar(n.replace('@/lib/','')));return m;}
const m=await cargar('validacion-robos');await m.evaluate();const {validarReporteRobo,fechaRobo,textoRobo}=m.namespace;
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
function form(){const f=new FormData();for(const[k,v]of Object.entries({solicitud:ids[0],sedeId:ids[1],fecha:'2026-10-20',lugar:'Lugar ficticio',descripcion:'Antecedentes de prueba',enlace:''}))f.set(k,v);f.append('equipo',JSON.stringify({id:ids[2],version:3}));return f;}
test('reporte conserva identificadores y versiones de los equipos',()=>{const r=validarReporteRobo(form(),'2026-11-02');assert.equal(r.id,ids[0]);assert.equal(r.datos.equipos[0].version,3);assert.equal(r.datos.equipos[0].id,ids[2]);});
test('rechaza fechas imposibles, futuras y anteriores al incidente',()=>{for(const fecha of ['2026-02-30','2026-11-03','2026-2-01','0000-01-01','no'])assert.throws(()=>fechaRobo(fecha,'2026-11-02'));assert.throws(()=>fechaRobo('2026-10-19','2026-11-02','2026-10-20'));assert.equal(fechaRobo('2024-02-29','2026-11-02'),'2024-02-29');});
test('rechaza selección duplicada, sin equipo, versión inválida y cabeceras repetidas',()=>{for(const cambiar of [f=>f.append('equipo',f.get('equipo')),f=>f.delete('equipo'),f=>f.set('equipo',JSON.stringify({id:ids[2],version:0})),f=>f.append('sedeId',ids[1]),f=>f.set('equipo','{')]){const f=form();cambiar(f);assert.throws(()=>validarReporteRobo(f,'2026-11-02'));}});
test('rechaza enlaces ejecutables, controles y excesos de texto',()=>{const f=form();for(const enlace of ['javascript:alert(1)','https://persona:clave@example.org','http://?']){f.set('enlace',enlace);assert.throws(()=>validarReporteRobo(f,'2026-11-02'));}for(const v of ['',null,'x'.repeat(301),'Lugar\nOtro'])assert.throws(()=>textoRobo(v,'lugar',300));assert.equal(textoRobo('Uno\nDos','descripción',100,true),'Uno\nDos');});

test('el reporte mínimo registra un lugar no informado sin inventar dónde ocurrió',()=>{const f=form();f.set('lugar','');assert.equal(validarReporteRobo(f,'2026-11-02').datos.lugar,'No informado');});
