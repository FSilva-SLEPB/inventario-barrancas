import {puedeAdministrar,requiereSede} from '@/lib/politica-acceso';
export function puedeVerFotoSede(rol:unknown,sedeActor:string|null,sede:string){return puedeAdministrar(rol)||rol==='consulta'||requiereSede(rol)&&sedeActor===sede;}
export function puedeEditarFotoSede(rol:unknown,sedeActor:string|null,sede:string){return puedeAdministrar(rol)||rol==='encargado'&&sedeActor===sede;}
