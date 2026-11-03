import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SourceTextModule} from 'node:vm';
import ts from 'typescript';
const cache=new Map();
async function cargar(nombre){if(cache.has(nombre))return cache.get(nombre);const fuente=await readFile(new URL('../src/lib/'+nombre+'.ts',import.meta.url),'utf8'),m=new SourceTextModule(ts.transpileModule(fuente,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);cache.set(nombre,m);await m.link(n=>cargar(n.replace('@/lib/','')));return m;}
const m=await cargar('validacion-funcionarios');await m.evaluate();const {validarFuncionario,cambiosFuncionario}=m.namespace;
const datos=()=>({nombre:'Persona de ejemplo',rut:'',correo:'',unidad:'',subdireccion:'',cargo:'',fechaIngreso:'',activo:true});
test('la ficha mínima admite datos pendientes y conserva la identidad de una persona',()=>{const d=validarFuncionario(datos());assert.equal(d.nombre,'Persona de ejemplo');assert.equal(d.rut,'');assert.equal(d.correo,'');});
test('normaliza RUN, correo y espacios; admite fecha prevista futura',()=>{const d=validarFuncionario({...datos(),nombre:'  Persona   de ejemplo  ',rut:'12.345.678-5',correo:' EJEMPLO@SLEPB.GOB.CL ',fechaIngreso:'2027-02-01',activo:false});assert.equal(d.nombre,'Persona de ejemplo');assert.equal(d.rut,'12345678-5');assert.equal(d.correo,'ejemplo@slepb.gob.cl');assert.equal(d.activo,false);assert.equal(d.fechaIngreso,'2027-02-01');});
test('rechaza identificadores incorrectos, correos externos y fechas imposibles',()=>{for(const cambio of [{rut:'12345678-9'},{correo:'persona@example.org'},{nombre:'Uno\nDos'},{nombre:''},{fechaIngreso:'2026-02-30'},{fechaIngreso:'2026-13-01'},{fechaIngreso:'1899-12-31'},{activo:'si'}])assert.throws(()=>validarFuncionario({...datos(),...cambio}));});
test('el historial muestra cambios de fecha y de vigencia, sin confundir un dato pendiente',()=>{const cambios=cambiosFuncionario({nombre:'Persona',fecha_ingreso:null,activo:true},{nombre:'Persona',fecha_ingreso:'2027-02-01',activo:false});assert.equal(cambios.length,2);assert.equal(cambios[0].antes,'Sin informar');assert.equal(cambios[1].despues,'Inactivo');});
