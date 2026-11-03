import assert from 'node:assert/strict';
import test from 'node:test';
import {emitirRecibo,verificarRecibo} from '../src/lib/recibo-guardado.ts';
import {sugerirNombre} from '../src/lib/nombres-directorio.ts';
const secreto='secreto_ficticio_exclusivo_de_la_prueba';
test('el recibo identifica un guardado real, sin datos personales, y vence en dos minutos',()=>{
 const token=emitirRecibo('/directorio/directores','contacto',secreto,1000);
 assert.equal(verificarRecibo(token,'/directorio/directores',secreto,1001)?.titulo,'Contacto actualizado');
 assert.equal(verificarRecibo(token,'/directorio/directores',secreto,121001),null);
 assert.equal(verificarRecibo(token,'/directorio/directores',secreto,999),null);
 assert.equal(verificarRecibo(token,'/mantenedores/usuarios',secreto,1001),null);
 assert.equal(verificarRecibo(token,'/directorio/directores','otra clave',1001),null);
 const datos=JSON.parse(Buffer.from(token.split('.')[0],'base64url').toString());
 assert.deepEqual(Object.keys(datos).sort(),['id','ruta','tipo','v','vence']);
});
test('la confirmación no acepta parámetros inventados, firmas alteradas ni contenido excesivo',()=>{
 const token=emitirRecibo('/directorio/directores','guardado',secreto,1000);
 for(const invalido of ['guardado=1','<script>alert(1)</script>','x'.repeat(1501),token+'.extra',token.replace(/^./,c=>c==='a'?'b':'a'),token.split('.')[0]+'.AAAA'])assert.equal(verificarRecibo(invalido,'/directorio/directores',secreto,1001),null);
});
test('la sugerencia admite varios nombres y apellidos con partículas sin modificar el original',()=>{
 for(const [original,nombres,apellidos] of [
 ['Ana María Pérez Soto','Ana María','Pérez Soto'],
 ['María de los Ángeles Pérez de la Cruz','María de los Ángeles','Pérez de la Cruz'],
 ['Ana De la Cruz Soto','Ana','De la Cruz Soto'],
 ['Juan Pérez y Soto','Juan','Pérez y Soto'],
 ['  Ana  Pe\u0301rez  Soto  ','Ana','Pérez Soto'],
 ]){assert.deepEqual(sugerirNombre(original),{nombres,apellidos});}
 assert.deepEqual(sugerirNombre('Ana Pérez'),{nombres:'Ana Pérez',apellidos:''});
 assert.deepEqual(sugerirNombre(null),{nombres:'',apellidos:''});
});
