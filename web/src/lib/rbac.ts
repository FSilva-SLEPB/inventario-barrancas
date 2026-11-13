import {PERMISOS_ANTERIORES} from '@/lib/rbac-anteriores';
export type AlcanceRbac='global'|'sede'|'propios';
export type AutorizacionRbac={permisos:readonly string[];alcance:AlcanceRbac;perfilId:string|null;perfilNombre:string;clasePerfil:string;revisionAcceso:string};
export function tienePermiso(actor:unknown,recurso:string,accion='consultar'):boolean{
 if(!actor||typeof actor!=='object')return false;
 const a=actor as Partial<AutorizacionRbac>&{rol?:string};if(!Array.isArray(a.permisos)&&a.rol)return (PERMISOS_ANTERIORES[a.rol]??[]).includes(recurso+'.'+accion);return Array.isArray(a.permisos)&&a.permisos.includes(recurso+'.'+accion);
}
export function esAutorizacionRbac(a:unknown):a is AutorizacionRbac{return Boolean(a&&typeof a==='object'&&Array.isArray((a as AutorizacionRbac).permisos));}
export function esPerfilProtegido(a:unknown){return Boolean(a&&typeof a==='object'&&['sistema','utic'].includes((a as AutorizacionRbac).clasePerfil));}

/** El rótulo de lectura depende de las acciones efectivas, no del rol de compatibilidad. */
export function esSoloLectura(actor:unknown){
 if(!actor||typeof actor!=='object')return true;const a=actor as Partial<AutorizacionRbac>&{rol?:string};const permisos=Array.isArray(a.permisos)?a.permisos:PERMISOS_ANTERIORES[a.rol??'']??[];return !permisos.some(p=>/\.(registrar|editar|aprobar|confirmar|enviar|administrar)$/.test(p));
}
