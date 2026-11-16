import {prepararExcel,type ContextoExcel} from '@/lib/importacion-excel/preparar';
import {ErrorExcel} from '@/lib/importacion-excel/lector';
import {anioOC} from '@/lib/identificacion/reglas';
export type PrefijoP02={id:string;nombre:string;prefijo:string|null;activo:boolean;version:number};
export function anioConfirmadoP02(valor:unknown,confirmacion:unknown):number|null{
 if(valor===null||valor==='')return null;
 if(typeof valor!=='string'||!/^(19|20)\d{2}$/.test(valor)||confirmacion!=='si')throw new ErrorExcel('Confirma el año de numeración del registro o lote; no se completará una OC ficticia.');
 return Number(valor);
}
export function prepararExcelP02(filas:{fila:number;celdas:string[]}[],c:ContextoExcel,prefijos:PrefijoP02[],anio:number|null,mapeo:Record<string,string>={}){
 if(anio!==null&&(!Number.isInteger(anio)||anio<1900||anio>2099))throw new ErrorExcel('Año de numeración inválido.');
 const base=prepararExcel(filas,'establecimientos',{...c,sedes:c.sedes.filter(s=>['establecimiento','jardin_infantil'].includes(s.tipo))},mapeo);
 const config=new Map<string,{id:string;prefijo:string;version:number}>(),excluidas=[...base.excluidas],operaciones:typeof base.operaciones=[],vista:typeof base.vista=[];let unidades=0;
 for(const op of base.operaciones){
  const d=op.datos,v=base.vista.find(x=>x.fila===op.fila)!;
  if(typeof d.inventario==='string'&&d.inventario.trim()){operaciones.push(op);unidades+=Number(d.cantidad);vista.push({...v,accion:v.accion+' · conservar número existente'});continue;}
  const pref=prefijos.find(p=>p.id===d.categoriaId&&p.activo&&p.prefijo&&/^[A-Z]{2,5}$/.test(p.prefijo));
  if(!pref?.prefijo){excluidas.push({fila:op.fila,motivo:'Categoría sin prefijo P02 activo. UTIC debe configurarlo en Mantenedores y preparar otra revisión.'});continue;}
  const compra=d.compra as Record<string,string>,fecha=compra.fechaOrdenCompra??'',year=anioOC(fecha)??(fecha?null:anio);
  if(year===null){excluidas.push({fila:op.fila,motivo:'Sin año de OC: confirma el año de numeración del lote y vuelve a preparar la vista previa.'});continue;}
  config.set(pref.id,{id:pref.id,prefijo:pref.prefijo,version:pref.version});operaciones.push(op);unidades+=Number(d.cantidad);
  vista.push({...v,accion:v.accion+' · generar número automáticamente',aviso:[v.aviso,'Prefijo '+pref.prefijo+' · año '+year+'. El correlativo definitivo se reserva al confirmar.'].filter(Boolean).join(' ')});
 }
 return {...base,operaciones,vista,excluidas:excluidas.sort((a,b)=>a.fila-b.fila),unidades,configNumeracion:[...config.values()],avisosGenerales:[...base.avisosGenerales,'Carga exclusiva P02. Los números existentes se conservan; los faltantes se generan al confirmar.','Las condiciones desconocidas quedan Sin verificar para revisión de TI; no se convierten en Operativo.']};
}
