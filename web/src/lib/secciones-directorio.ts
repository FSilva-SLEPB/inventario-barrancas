import type {DirectorSede} from '@/lib/directorio';
export const SECCIONES_DIRECTORIO={
 establecimientos:{href:'/directorio/establecimientos',titulo:'Directorio de establecimientos',tipo:'establecimiento',personas:false,correo:true},
 directores:{href:'/directorio/directores',titulo:'Directores/as EE.EE.',tipo:'establecimiento',personas:true,correo:true},
 jardines:{href:'/directorio/jardines',titulo:'Directorio JI y SC',tipo:'jardin_infantil',personas:false,correo:true},
 directoras:{href:'/directorio/directoras',titulo:'Directoras JI y SC',tipo:'jardin_infantil',personas:true,correo:false},
} as const;
export type SeccionDirectorio=keyof typeof SECCIONES_DIRECTORIO;
export function esSeccionDirectorio(v:unknown):v is SeccionDirectorio{return typeof v==='string'&&Object.hasOwn(SECCIONES_DIRECTORIO,v);}
export function filtrosDirectorio(fuente:string){
 const p=new URLSearchParams(fuente),r=new URLSearchParams();
 for(const[k,max]of [['q',150],['comuna',100],['situacion',30],['orden',10]] as const){const v=p.get(k)?.trim().slice(0,max);if(v)r.set(k,v);}
 return r;
}
export function enlaceDirectorio(seccion:SeccionDirectorio,filtros='',accion?:'ver'|'editar',id?:string,guardado=false){
 const p=filtrosDirectorio(filtros);if(accion&&id)p.set(accion,id);if(guardado)p.set('guardado','1');
 return SECCIONES_DIRECTORIO[seccion].href+(p.size?'?'+p:'');
}
export function versionSedeDirectorio(d:Pick<DirectorSede,'tipo'|'rbd'|'sedeNombre'|'direccion'|'comuna'|'correoInstitucional'>){return JSON.stringify([d.tipo,d.rbd??'',d.sedeNombre,d.direccion??'',d.comuna??'',d.correoInstitucional??'']);}
