import AccesosModulo from '@/components/accesos-modulo';
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
  const modulo=modulosSistema(actor).find(m=>m.id==='inventario');
  if(!modulo)redirect('/sin-permiso');
  const principales=modulo.accesos.filter(a=>['/inventario/nivel-central/inicio','/inventario/p02/inicio'].includes(a.href));
  const compartidos=modulo.accesos.filter(a=>!principales.includes(a));
  const grupos=['Equipamiento','Bodega TI','Entregas, devoluciones y préstamos','Incidentes'];
  return <main className="portada-modulo"><header><h1>Inventario</h1><p className="descripcion-pagina">Selecciona el inventario para acceder a sus equipos y procesos.</p></header><AccesosModulo id="seleccionar-inventario" titulo="Selecciona tu inventario" accesos={principales}/>{compartidos.length>0&&<section aria-labelledby="operaciones-compartidas"><h2 id="operaciones-compartidas">Operaciones compartidas</h2><div className="acciones-catalogos">{grupos.map(g=>{const accesos=compartidos.filter(a=>a.grupo===g);return accesos.length>0&&<MenuAcciones key={g} titulo={g==='Equipamiento'?'Celulares':g}>{accesos.map(a=><Link className="btn btn-outline-primary btn-sm" key={a.href} href={a.href}>{a.titulo}</Link>)}</MenuAcciones>;})}</div></section>}</main>;
}
