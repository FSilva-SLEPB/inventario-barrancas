import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import ts from 'typescript';
import { esIdSede } from '../src/lib/validacion-sedes.ts';
const source=await readFile(new URL('../src/lib/validacion-entregas.ts',import.meta.url),'utf8');
const modulo=new SourceTextModule(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
await modulo.link(()=>new SyntheticModule(['esIdSede'],function(){this.setExport('esIdSede',esIdSede)}));await modulo.evaluate();
const {fechaSugeridaEntrega,validarRegularizacion}=modulo.namespace;
const sede=randomUUID(),equipo=randomUUID();
const bases=[{sedeId:sede,equipos:[{id:equipo,version:1}]}];
function formulario(){const f=new FormData();for(const[k,v]of Object.entries({solicitud:randomUUID(),seleccion:JSON.stringify(bases),confirmo:'si',[`fecha-${sede}`]:'2026-10-26',[`receptora-${sede}`]:'Directora ficticia',[`acta-${sede}`]:''}))f.set(k,v);return f;}
const validar=f=>validarRegularizacion(f,'2026-11-02');
test('fechas históricas por comuna y desconocidas sin fecha inventada',()=>{
 assert.equal(fechaSugeridaEntrega(' Pudahuel '),'2026-10-26');assert.equal(fechaSugeridaEntrega('LO PRADO'),'2026-10-27');assert.equal(fechaSugeridaEntrega('Cerro Navia'),'2026-10-28');assert.equal(fechaSugeridaEntrega(null),'');assert.equal(fechaSugeridaEntrega('Otra comuna'),'');
});
test('receptora una vez por jardín, sin inventar folio o enlace',()=>{const r=validar(formulario());assert.equal(r.grupos[0].receptora,'Directora ficticia');assert.equal(r.grupos[0].enlaceActa,'');assert.deepEqual(JSON.parse(JSON.stringify(r.grupos[0].equipos)),bases[0].equipos);});
test('rechaza falta de directora, controles y campos repetidos',()=>{
 for(const v of ['', 'Nombre\nOtra línea']){const f=formulario();f.set(`receptora-${sede}`,v);assert.throws(()=>validar(f));}
 const f=formulario();f.append(`fecha-${sede}`,'2026-10-27');assert.throws(()=>validar(f));
});
test('rechaza fechas imposibles o futuras sin sustituirlas por hoy',()=>{for(const v of ['2026-02-30','2026-13-01','2026-11-03','1899-01-01','']){const f=formulario();f.set(`fecha-${sede}`,v);assert.throws(()=>validar(f));}});
test('rechaza equipos duplicados, versiones inválidas y grupos vacíos',()=>{
 for(const valor of [[{sedeId:sede,equipos:[{id:equipo,version:1},{id:equipo,version:1}]}], [...bases,...bases],[{sedeId:sede,equipos:[]}],[{sedeId:sede,equipos:[{id:equipo,version:0}]}]]){const f=formulario();f.set('seleccion',JSON.stringify(valor));assert.throws(()=>validar(f));}
});
test('enlace de acta opcional solo admite HTTP/HTTPS sin credenciales',()=>{for(const v of ['javascript:alert(1)','https://usuario:clave@ejemplo.cl/acta','https://ejemplo.cl/acta con espacio']){const f=formulario();f.set(`acta-${sede}`,v);assert.throws(()=>validar(f));}const f=formulario();f.set(`acta-${sede}`,'https://ejemplo.cl/acta.pdf');assert.equal(validar(f).grupos[0].enlaceActa,'https://ejemplo.cl/acta.pdf');});
test('exige revisión explícita y solicitud válida',()=>{const f=formulario();f.delete('confirmo');assert.throws(()=>validar(f));const g=formulario();g.set('solicitud','otra');assert.throws(()=>validar(g));});
