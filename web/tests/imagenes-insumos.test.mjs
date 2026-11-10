import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(readFileSync(new URL('../src/lib/imagenes-insumos.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};new Function('exports','require',js)(exports,n=>{if(n!=='server-only')throw new Error('Dependencia inesperada');return {};});
const {imagenInsumoValida,origenInsumoValido,formularioImagenLimitado,MAX_IMAGEN_INSUMO}=exports;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
test('verifica firma y límite de la imagen sin confiar en el tipo declarado',()=>{
 assert.equal(imagenInsumoValida('image/png',png),true);assert.equal(imagenInsumoValida('image/jpeg',png),false);assert.equal(imagenInsumoValida('image/png',Buffer.from('<html>no PNG</html>')),false);assert.equal(imagenInsumoValida('image/svg+xml',png),false);assert.equal(imagenInsumoValida('image/png',Buffer.alloc(MAX_IMAGEN_INSUMO+1)),false);
});
test('rechaza orígenes distintos, ausentes, opacos y esquemas que no corresponden',()=>{
 const req=headers=>new Request('http://127.0.0.1/api/insumos/imagen',{headers});
 assert.equal(origenInsumoValido(req({host:'inventario.example.org',origin:'https://inventario.example.org','x-forwarded-proto':'https'})),true);
 for(const h of [{host:'inventario.example.org'},{host:'inventario.example.org',origin:'null'},{host:'inventario.example.org',origin:'https://otro.example.org','x-forwarded-proto':'https'},{host:'inventario.example.org',origin:'http://inventario.example.org','x-forwarded-proto':'https'}])assert.equal(origenInsumoValido(req(h)),false);
});
test('limita un cuerpo transmitido sin Content-Length antes de analizar multipart',async()=>{
 const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(4097));c.close();}}),req=new Request('http://localhost/api',{method:'POST',duplex:'half',body});await assert.rejects(formularioImagenLimitado(req,4096),/tamaño/);
});
test('el multipart admitido conserva sus bytes dentro del límite',async()=>{
 const f=new FormData();f.set('imagen',new File([png],'prueba.png',{type:'image/png'}));const req=new Request('http://localhost/api',{method:'POST',body:f});const r=await formularioImagenLimitado(req);assert.deepEqual(Buffer.from(await r.get('imagen').arrayBuffer()),png);
});
