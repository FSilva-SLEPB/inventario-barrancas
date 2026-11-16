import type {AccesoModulo} from '@/lib/modulos';
import {esAutorizacionRbac,tienePermiso} from '@/lib/rbac';
import {requiereSede} from '@/lib/politica-acceso';
import {puedeImportarExcel} from '@/lib/importacion-excel/permisos';
import {puedeNumerar} from '@/lib/identificacion/acceso';
export type AmbitoPortada='nc'|'p02';
export function puedeAbrirInventario(actor:unknown,ambito:AmbitoPortada,accion:'consultar'|'registrar'='consultar'){
 if(!tienePermiso(actor,'equipos',accion))return false;
 if(esAutorizacionRbac(actor))return ambito==='nc'?actor.alcance==='global':['global','sede'].includes(actor.alcance);
 return ambito==='p02'||!requiereSede(actor);
}
export function accesosPortadaInventario(actor:unknown,ambito:AmbitoPortada):AccesoModulo[]{
 if(!puedeAbrirInventario(actor,ambito))return [];
 const p02=ambito==='p02',base=p02?'/inventario/p02':'/inventario/nivel-central';
 const accesos:AccesoModulo[]=[{href:base,titulo:'Consultar equipos',descripcion:p02?'Revisar los bienes de establecimientos, jardines y salas cuna dentro de tu alcance.':'Revisar los bienes de Nivel Central y su historial.',icono:p02?'P02':'NC'}];
 if(tienePermiso(actor,'equipos','registrar'))accesos.push({href:base+'/registro',titulo:'Registrar equipo',descripcion:p02?'Ingreso individual P02. El número faltante se genera al guardar, con el año confirmado.':'Ingreso individual de un bien de Nivel Central.',icono:'+'});
 if(puedeImportarExcel(actor,p02?'establecimientos':'central'))accesos.push({href:base+'/importar',titulo:p02?'Importar Excel P02':'Importar Excel de Nivel Central',descripcion:p02?'Planilla de establecimientos y jardines: RBD, categorías y numeración automática.':'Planilla propia de Nivel Central y revisión de vínculos a funcionarios por RUN y serie completa.',icono:'XLS'});
 if(puedeNumerar(actor))accesos.push(p02?{href:'/mantenedores/p02',titulo:'Numeración automática P02',descripcion:'Configurar los prefijos en Mantenedores. Los números anteriores se conservan.',icono:'Nº'}:{href:'/inventario/numeracion?ambito=nc',titulo:'Numeración de Nivel Central',descripcion:'Revisar y generar números pendientes de los equipos de Nivel Central.',icono:'Nº'});
 if(tienePermiso(actor,'etiquetas_inventario')&&tienePermiso(actor,'equipos'))accesos.push({href:'/inventario/etiquetas?ambito='+ambito,titulo:'Preparar etiquetas QR',descripcion:'Seleccionar equipos de este inventario y preparar sus etiquetas con el formato disponible.',icono:'QR'});
 return accesos;
}
/** El menú abre la portada; los listados y modales conservan sus direcciones. */
export function perteneceAlAcceso(ruta:string,href:string){
 const base=['/inventario/nivel-central/inicio','/inventario/p02/inicio'].includes(href)?href.slice(0,-7):href;
 return ruta===base||ruta.startsWith(base+'/');
}
