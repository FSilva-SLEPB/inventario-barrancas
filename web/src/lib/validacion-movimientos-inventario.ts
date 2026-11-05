import {esIdSede} from '@/lib/validacion-sedes';
import {hoyChile} from '@/lib/validacion-entregas';
export const CUSTODIAS={en_bodega:'En Bodega TI',asignado:'Asignado / recibido'} as const;
export type TipoBien='equipo'|'celular';
export type DatosMovimiento={tipo:TipoBien;bienId:string;accion:'devolucion'|'asignacion';destino:string;fecha:string;receptor:string;motivo:string;version:number};
export function validarMovimiento(f:FormData,hoy=hoyChile()){
 const campos=['solicitud','tipo','bienId','accion','destino','fecha','receptor','motivo','version','volver'],v:Record<string,string>={};
 if(campos.some(k=>f.getAll(k).length!==1)||[...f.keys()].some(k=>!campos.includes(k)&&!k.startsWith('$ACTION')))throw new Error('Formulario inválido o repetido. Vuelve a abrir la ficha.');
 for(const k of campos){const raw=f.get(k);if(typeof raw!=='string'||raw.length>(k==='volver'?2000:k==='motivo'?500:k==='receptor'?200:50)||/\p{Cc}/u.test(raw))throw new Error('Revisa los datos del movimiento.');v[k]=raw.normalize('NFC').trim();}
 if(!esIdSede(v.solicitud)||!esIdSede(v.bienId)||!['equipo','celular'].includes(v.tipo)||!['devolucion','asignacion'].includes(v.accion)||!/^[1-9]\d{0,9}$/.test(v.version)||Number(v.version)>=2147483647)throw new Error('La identificación o versión no es válida.');
 if(v.accion==='asignacion'?!esIdSede(v.destino):v.destino!=='')throw new Error('Selecciona una sede de destino válida.');
 const fecha=/^\d{4}-\d{2}-\d{2}$/.test(v.fecha)?new Date(v.fecha+'T00:00:00Z'):null;
 if(!fecha||Number.isNaN(fecha.getTime())||fecha.toISOString().slice(0,10)!==v.fecha||v.fecha<'1900-01-01'||v.fecha>hoy)throw new Error('Indica una fecha real válida, sin fechas futuras.');
 if(!v.receptor||!v.motivo)throw new Error('Indica quién recibe y el motivo del movimiento.');
 return {solicitud:v.solicitud,volver:v.volver,datos:{tipo:v.tipo,bienId:v.bienId,accion:v.accion,destino:v.destino,fecha:v.fecha,receptor:v.receptor,motivo:v.motivo,version:Number(v.version)} as DatosMovimiento};
}
export function retornoMovimiento(v:string){
 if(!v.startsWith('/inventario/')||v.length>2000||/[\p{Cc}\\]/u.test(v))return null;
 try{const u=new URL(v,'http://inventario.local');if(u.origin!=='http://inventario.local'||u.hash||!['/inventario/nivel-central','/inventario/p02','/inventario/bodega-ti','/inventario/celulares'].includes(u.pathname))return null;
 const p=new URLSearchParams();for(const[k,max]of [['vista',20],['q',150],['pagina',7],['tipo',30],['sede',36],['rbd',120],['limite',3],['estado',20],['clase',10]] as const){const valores=u.searchParams.getAll(k);if(valores.length>1)return null;const valor=valores[0];if(valor!==undefined){if(valor.length>max)return null;p.set(k,valor);}}
 if([...u.searchParams.keys()].some(k=>!['vista','q','pagina','tipo','sede','rbd','limite','estado','clase'].includes(k)))return null;
 return u.pathname+(p.size?'?'+p:'');}catch{return null;}
}
export function enlaceMovimiento(ruta:string,tipo:TipoBien,id:string,accion:'devolucion'|'asignacion'){
 const base=retornoMovimiento(ruta);if(!base||!esIdSede(id))throw new Error('Enlace de movimiento inválido.');const u=new URL(base,'http://inventario.local');u.searchParams.set('movimiento',accion);u.searchParams.set('bien',id);u.searchParams.set('claseBien',tipo);return u.pathname+u.search;
}

export function enlaceActaInventario(volver:string,id:string){
 const base=retornoMovimiento(volver);if(!base||!esIdSede(id))throw new Error('Regreso al inventario inválido.');const u=new URL(base,'http://inventario.local');u.searchParams.set('acta',id);return u.pathname+u.search;
}
