import {puedeImportarExcel} from '@/lib/importacion-excel/permisos';
import {tienePermiso} from '@/lib/rbac';
import Link from 'next/link';
import {redirect} from "next/navigation";
import {exigirAcceso} from "@/lib/acceso";
import {requiereSede} from "@/lib/politica-acceso";
import type { ParametrosInventario } from "@/components/vista-inventario";
import MenuAcciones from "@/components/menu-acciones";
import {modulosSistema} from "@/lib/modulos";

export const metadata = { title: "Inventario | SLEP Barrancas" };

export default async function Inventario({ searchParams }: ParametrosInventario) {
  const actor = await exigirAcceso();
  const p = await searchParams;
  const local = requiereSede(actor);
  const claves = ["vista", "q", "pagina", "tipo", "sede", "rbd", "limite"];
  // Conservar los enlaces anteriores sin volver a mezclar las dos páginas.
  if (typeof p.ambito === "string" || claves.some(k => typeof p[k] === "string")) {
    const ruta = !local && p.ambito === "nc" ? "/inventario/nivel-central" : "/inventario/p02";
    const parametros = new URLSearchParams();
    for (const clave of claves) if (typeof p[clave] === "string") parametros.set(clave, p[clave]);
    redirect(ruta + (parametros.size ? `?${parametros}` : ""));
  }
  const modulo=modulosSistema(actor).find(m=>m.id==='inventario')!;
  const grupos=['Equipamiento','Bodega TI','Entregas, devoluciones y préstamos','Incidentes'];
  return <main className="portada-modulo"><header><h1>Inventario</h1><p className="descripcion-pagina">Consulta los bienes y selecciona el proceso que necesitas realizar.</p></header><div className="grupos-inventario">{grupos.map(g=>{const accesos=modulo.accesos.filter(a=>a.grupo===g);return accesos.length>0&&<section className="grupo-inventario" key={g}><h2>{g}</h2><ul>{accesos.map(a=><li key={a.href}><Link href={a.href}>{a.href==='/inventario/movimientos'?'Historial de asignaciones y movimientos':a.titulo}</Link></li>)}</ul>{g==='Equipamiento'&&<MenuAcciones titulo="Ingresar bienes">{tienePermiso(actor,'equipos','registrar')&&<Link className="btn btn-outline-primary" href="/inventario/registro">Registrar equipo</Link>}{puedeImportarExcel(actor,'central')&&<Link className="btn btn-outline-primary" href="/inventario/importar-excel">Importar Excel (.xlsx)</Link>}</MenuAcciones>}</section>;})}</div></main>;
}
