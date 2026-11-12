import 'server-only';
import {exigirPermiso} from '@/lib/acceso';import {obtenerBaseDatos} from '@/lib/db';
export type MisDatos={id:string;nombre:string;rut:string|null;correo:string|null;unidad:string;subdireccion:string;cargo:string;version:number};
export type MiBien={clase:string;id:string;marca:string;modelo:string;serie:string|null;inventario:string|null;estado:string;condicion:string};
export async function misDatos(){const a=await exigirPermiso('mis_datos');return(await obtenerBaseDatos().query<{r:MisDatos|null}>('SELECT public.rbac_mis_datos($1) r',[a.email])).rows[0].r;}
export async function misAsignaciones(accion='consultar'){const a=await exigirPermiso('mis_asignaciones',accion);return(await obtenerBaseDatos().query<{r:MiBien[]}>('SELECT public.rbac_mis_asignaciones($1,$2) r',[a.email,accion])).rows[0].r;}
export async function directorioAutorizado(accion='consultar'){await exigirPermiso('directorio_autorizado',accion);return(await obtenerBaseDatos().query<{rbd:string|null;nombre:string;tipo:string;comuna:string|null;direccion:string|null;correo:string|null}>(`SELECT rbd,nombre,tipo,comuna,direccion,correo_institucional AS correo FROM public.sedes WHERE activo AND tipo IN ('establecimiento','jardin_infantil') ORDER BY nombre,id`)).rows;}
