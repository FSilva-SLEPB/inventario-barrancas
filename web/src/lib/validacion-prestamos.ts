import {validarMovimiento,type DatosMovimiento} from '@/lib/validacion-movimientos-inventario';
import {esIdSede} from '@/lib/validacion-sedes';
import {hoyChile} from '@/lib/validacion-entregas';
export type DatosPrestamo=Omit<DatosMovimiento,'accion'>&{accion:'prestamo'|'devolucion_prestamo';fechaLimite:string;prestamoId:string};
export const esOperacionPrestamo=(accion:unknown)=>accion==='prestamo'||accion==='devolucion_prestamo';
export function validarPrestamo(f:FormData,hoy=hoyChile()){
 const campos=['solicitud','tipo','bienId','accion','destino','fecha','receptor','motivo','version','volver','fechaLimite','prestamoId'];
 if(campos.some(k=>f.getAll(k).length!==1||typeof f.get(k)!=='string')||[...f.keys()].some(k=>!campos.includes(k)))throw new Error('Formulario de préstamo inválido o repetido.');
 const accion=f.get('accion');if(accion!=='prestamo'&&accion!=='devolucion_prestamo')throw new Error('Operación de préstamo inválida.');
 const base=new FormData();for(const k of campos.filter(k=>!['fechaLimite','prestamoId'].includes(k)))base.set(k,f.get(k)!);base.set('accion',accion==='prestamo'?'asignacion':'devolucion');const valido=validarMovimiento(base,hoy);
 const fechaLimite=String(f.get('fechaLimite')),prestamoId=String(f.get('prestamoId'));
 if(accion==='prestamo'){
  const limite=/^\d{4}-\d{2}-\d{2}$/.test(fechaLimite)?new Date(fechaLimite+'T00:00:00Z'):null;
  if(!limite||Number.isNaN(limite.getTime())||limite.toISOString().slice(0,10)!==fechaLimite||fechaLimite<valido.datos.fecha||prestamoId!=='')throw new Error('Indica una fecha límite válida, desde la fecha de salida.');
 }else if(fechaLimite!==''||!esIdSede(prestamoId))throw new Error('Identifica el préstamo que se devuelve.');
 return {...valido,datos:{...valido.datos,accion,fechaLimite,prestamoId} as DatosPrestamo};
}
