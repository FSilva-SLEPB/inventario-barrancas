import assert from 'node:assert/strict';import test from 'node:test';
import {retornoInsumos,destinoSolicitudInsumo,enlaceActaInsumos} from '../src/lib/navegacion-insumos.ts';
test('retorno de insumos conserva filtros sin aceptar destinos externos o acciones encubiertas',()=>{
 const v='/insumos/seguimiento?q=papel&estado=aprobada&sede=abc&limite=100&pagina=2';assert.equal(retornoInsumos(v),v);
 for(const invalido of ['https://otro.invalid/insumos/seguimiento','//otro.invalid/insumos/seguimiento','/insumos/seguimiento#x','/insumos/seguimiento?q=a&q=b','/insumos/seguimiento?paso=entregar','/insumos/seguimiento?ver=x','/insumos/seguimiento?correo=si','/insumos/seguimiento?volver=x','/insumos/solicitud','/insumos/seguimiento?toString=x','/insumos/seguimiento?q='+'x'.repeat(151),'/insumos/seguimiento?q=\n'])assert.equal(retornoInsumos(invalido),null,invalido);
});
test('solicitudes y actas conservan el retorno validado y rechazan enlaces externos',()=>{
 assert.equal(destinoSolicitudInsumo('/insumos/historial?q=papel&limite=100&pagina=2','id'),'/insumos/historial?q=papel&limite=100&pagina=2&ver=id');assert.equal(destinoSolicitudInsumo('//otro.invalid','id'),'/insumos/seguimiento?ver=id');
 const u=new URL(enlaceActaInsumos('id','/insumos/seguimiento?q=papel'),'http://local');assert.equal(u.pathname,'/inventario/actas/id');assert.equal(u.searchParams.get('volver'),'/insumos/seguimiento?q=papel');assert.throws(()=>enlaceActaInsumos('id','//otro.invalid'));
});
test('bandejas del gestor conservan filtros y regreso del acta, sin aceptar exportaciones o acciones',()=>{
 const volver='/gestor-insumos/pendientes?bandeja=validadas&base=solicitud&desde=2026-01-01&categoria=Papel&producto=abc&limite=50&pagina=2';assert.equal(retornoInsumos(volver),volver);assert.equal(new URL(enlaceActaInsumos('id',volver),'http://local').searchParams.get('volver'),volver);
 for(const v of ['/gestor-insumos/exportar','/gestor-insumos/pendientes?paso=entregar','/gestor-insumos/pendientes?bandeja=a&bandeja=b'])assert.equal(retornoInsumos(v),null);
});
