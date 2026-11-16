import {tienePermiso} from '@/lib/rbac';
import type {TipoExcel} from '@/lib/importacion-excel/tipos';
export function puedeImportarExcel(actor:unknown,tipo:TipoExcel){
 if(!actor||typeof actor!=='object')return false;const a=actor as {alcance?:string;clasePerfil?:string};
 if(a.alcance!=='global'||!['sistema','utic'].includes(a.clasePerfil??''))return false;
 const permisos=tipo==='funcionarios'?['funcionarios.consultar','funcionarios.registrar']:tipo==='vinculos'?['equipos.consultar','equipos.editar','funcionarios.consultar','funcionarios.editar']:['equipos.consultar','equipos.registrar'];
 return permisos.every(p=>{const[r,accion]=p.split('.');return tienePermiso(actor,r,accion);});
}
