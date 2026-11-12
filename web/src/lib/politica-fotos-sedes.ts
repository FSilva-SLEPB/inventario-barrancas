import {esAutorizacionRbac,tienePermiso} from '@/lib/rbac';
import {puedeAdministrar,requiereSede} from '@/lib/politica-acceso';
export function puedeVerFotoSede(rol:unknown,sedeActor:string|null,sede:string){return esAutorizacionRbac(rol)?tienePermiso(rol,'fotos_sedes')&&(rol.alcance==='global'||sedeActor===sede):puedeAdministrar(rol)||rol==='consulta'||requiereSede(rol)&&sedeActor===sede;}
export function puedeEditarFotoSede(rol:unknown,sedeActor:string|null,sede:string){return esAutorizacionRbac(rol)?tienePermiso(rol,'fotos_sedes','editar')&&(rol.alcance==='global'||sedeActor===sede):puedeAdministrar(rol);}
