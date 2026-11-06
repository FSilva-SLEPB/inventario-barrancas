import {esIdSede} from '@/lib/validacion-sedes';
import {hoyChile} from '@/lib/validacion-entregas';
import {retornoMovimiento,validarMovimiento,type TipoBien} from '@/lib/validacion-movimientos-inventario';

export type TipoOperacionInventario='cambio'|'traspaso';
export type LineaOperacionInventario={id:string;version:number;movimientoId:string};
export type DatosOperacionInventario={tipo:TipoOperacionInventario;clase:TipoBien;destino:string;fecha:string;receptor:string;receptorDevolucion:string;motivo:string;devoluciones:LineaOperacionInventario[];entregas:LineaOperacionInventario[];detalleDevueltos:string;detalleEntregados:string};
export const CAMPOS_OPERACION_INVENTARIO=['solicitud','tipo','clase','destino','fecha','receptor','receptorDevolucion','motivo','devoluciones','entregas','detalleDevueltos','detalleEntregados','volver'] as const;
export const MAX_BIENES_OPERACION=100;

function lineasOperacion(texto:string):LineaOperacionInventario[]{
 let valor:unknown;
 try{valor=JSON.parse(texto);}catch{throw new Error('Revisa la selección de bienes.');}
 if(!Array.isArray(valor)||valor.length>MAX_BIENES_OPERACION)throw new Error('Selecciona hasta 100 bienes por grupo.');
 return valor.map(v=>{
  if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!=='id,movimientoId,version'||typeof v.id!=='string'||!esIdSede(v.id)||typeof v.movimientoId!=='string'||!esIdSede(v.movimientoId)||!Number.isInteger(v.version)||v.version<1||v.version>=2147483647)throw new Error('La identificación o versión de un bien no es válida.');
  return {id:v.id.toLowerCase(),version:v.version,movimientoId:v.movimientoId.toLowerCase()};
 }).sort((a,b)=>a.id.localeCompare(b.id,'en'));
}

export function validarOperacionInventario(f:FormData,hoy=hoyChile()){
 const v:Record<string,string>={};
 if(CAMPOS_OPERACION_INVENTARIO.some(k=>f.getAll(k).length!==1)||[...f.keys()].some(k=>!CAMPOS_OPERACION_INVENTARIO.includes(k as typeof CAMPOS_OPERACION_INVENTARIO[number])&&!k.startsWith('$ACTION')))throw new Error('Formulario inválido o repetido. Abre la operación desde el bien.');
 for(const k of CAMPOS_OPERACION_INVENTARIO){
  const raw=f.get(k),notas=k==='detalleDevueltos'||k==='detalleEntregados',max=k==='devoluciones'||k==='entregas'?150000:k==='volver'?2000:notas?1000:k==='motivo'?500:k==='receptor'||k==='receptorDevolucion'?200:50;
  if(typeof raw!=='string'||raw.length>max||/\p{Cc}/u.test(notas?raw.replace(/[\r\n\t]/g,''):raw))throw new Error('Revisa los datos de la operación.');
  v[k]=raw.normalize('NFC').trim();
 }
 if(!esIdSede(v.solicitud)||!['cambio','traspaso'].includes(v.tipo)||!['equipo','celular'].includes(v.clase)||!esIdSede(v.destino)||!retornoMovimiento(v.volver))throw new Error('La operación, el destino o el retorno no son válidos.');
 const devoluciones=lineasOperacion(v.devoluciones),entregas=lineasOperacion(v.entregas);
 if(!entregas.length||v.tipo==='cambio'&&!devoluciones.length||v.tipo==='traspaso'&&(devoluciones.length>0||v.receptorDevolucion!==''||v.detalleDevueltos!==''))throw new Error('Revisa los grupos de bienes devueltos y entregados.');
 const bienes=new Set<string>(),movimientos=new Set<string>();
 for(const [fase,lineas] of [['devolucion',devoluciones],['asignacion',entregas]] as const)for(const l of lineas){
  if(bienes.has(l.id)||movimientos.has(l.movimientoId)||l.movimientoId===v.solicitud.toLowerCase())throw new Error('Un bien o identificador de movimiento aparece más de una vez.');
  bienes.add(l.id);movimientos.add(l.movimientoId);
  const movimiento=new FormData();
  for(const[k,x]of Object.entries({solicitud:l.movimientoId,tipo:v.clase,bienId:l.id,accion:fase,destino:fase==='asignacion'?v.destino:'',fecha:v.fecha,receptor:fase==='asignacion'?v.receptor:v.receptorDevolucion,motivo:v.motivo,version:String(l.version),volver:v.volver}))movimiento.set(k,x);
  validarMovimiento(movimiento,hoy);
 }
 return {solicitud:v.solicitud.toLowerCase(),volver:retornoMovimiento(v.volver)!,datos:{tipo:v.tipo,clase:v.clase,destino:v.destino.toLowerCase(),fecha:v.fecha,receptor:v.receptor,receptorDevolucion:v.receptorDevolucion,motivo:v.motivo,devoluciones,entregas,detalleDevueltos:v.detalleDevueltos,detalleEntregados:v.detalleEntregados} as DatosOperacionInventario};
}

// El nombre no identifica a una persona: evitar homónimos y correos ausentes.
export function funcionarioDeEntrega(personal:Array<{id:string;correo:string|null}>,correo?:string){
 const normalizado=correo?.trim().toLowerCase();if(!normalizado)return '';
 const coincidentes=personal.filter(f=>f.correo?.trim().toLowerCase()===normalizado);return coincidentes.length===1?coincidentes[0].id:'';
}
