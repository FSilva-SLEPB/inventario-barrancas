import {tienePermiso} from '@/lib/rbac';
export function puedeNumerar(actor:unknown,accion='consultar'){
 if(!actor||typeof actor!=='object')return false;const a=actor as {alcance?:string;clasePerfil?:string};
 return a.alcance==='global'&&['sistema','utic'].includes(a.clasePerfil??'')&&tienePermiso(actor,'equipos')&&tienePermiso(actor,'numeracion_inventario',accion)&&(accion!=='confirmar'||tienePermiso(actor,'equipos','editar'));
}
