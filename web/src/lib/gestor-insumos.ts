import 'server-only';
import {redirect} from 'next/navigation';
import {tienePermiso} from '@/lib/rbac';
import {exigirPermiso} from '@/lib/acceso';import {obtenerBaseDatos} from '@/lib/db';
import type {FiltroGestor} from '@/lib/filtros-gestor-insumos';
export type FilaInformeInsumos=Record<string,string|number|boolean|null>;
export type DatosGestor={totales:{solicitudes:number;pendientes:number;validadas:number;aprobadas:number;entregadas:number;canceladas:number};unidades:{unidad:string;solicitado:number;aprobado:number;entregado:number}[];ranking:{sede_id:string;rbd:string|null;sede:string;solicitudes:number;entregadas:number;pendientes:number}[];stock_unidades:{unidad:string;existencia:number;reservado:number;disponible:number}[];puede_stock:boolean;filas:FilaInformeInsumos[];total:number;pagina:number;paginas:number;solicitudes_ids:string[];pagina_solicitudes:number;paginas_solicitudes:number;generado_en:string};
export async function exigirGestor(){const a=await exigirPermiso('gestion_insumos');if(a.alcance!=='global'||!tienePermiso(a,'seguimiento_insumos')&&!tienePermiso(a,'stock_insumos'))redirect('/sin-permiso');return a;}
export async function consultarGestor(f:FiltroGestor,accion='consultar'){
 const a=await exigirGestor();if(accion==='exportar'){await exigirPermiso('gestion_insumos','exportar');await exigirPermiso('gestion_insumos','descargar');}await exigirPermiso(f.vista==='stock'?'stock_insumos':'seguimiento_insumos');
 return(await obtenerBaseDatos().query<{r:DatosGestor}>('SELECT public.consultar_gestor_insumos($1,$2::jsonb,$3) r',[a.email,JSON.stringify(f),accion])).rows[0].r;
}
export async function opcionesGestor(){await exigirGestor();const db=obtenerBaseDatos();const [sedes,productos]=await Promise.all([db.query<{id:string;nombre:string;rbd:string|null;tipo:string}>(`SELECT id,nombre,rbd,tipo FROM public.sedes s WHERE s.activo OR EXISTS(SELECT 1 FROM public.solicitudes_insumos si WHERE si.sede_id=s.id) ORDER BY lower(nombre),id`),db.query<{id:string;codigo:string;nombre:string;categoria:string}>(`SELECT id,codigo,nombre,categoria FROM public.catalogo_insumos ORDER BY lower(nombre),id`)]);return{sedes:sedes.rows,productos:productos.rows,categorias:Array.from(new Set(productos.rows.map(p=>p.categoria))).sort()};}
export type OpcionesGestor=Awaited<ReturnType<typeof opcionesGestor>>;
