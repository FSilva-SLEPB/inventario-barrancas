import Link from "next/link";
import { exigirAcceso } from "@/lib/acceso";
import { listarEquipos } from "@/lib/equipos";
import { listarSedes } from "@/lib/sedes";
import { listarCategorias } from "@/lib/catalogos";
import { etiquetaSede } from "@/lib/etiqueta-sede";
import { puedeAdministrar,puedeGestionarDependencias,requiereSede } from "@/lib/politica-acceso";
import { SITUACIONES } from "@/lib/validacion-equipos";
import FormularioEquipo from "@/components/formulario-equipo";
import { esIdSede } from "@/lib/validacion-sedes";
export const metadata={title:"Inventario | SLEP Barrancas"};
export default async function Inventario({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const actor=await exigirAcceso();const p=await searchParams;const local=requiereSede(actor.rol);
  const ambito=!local&&p.ambito==="nc"?"nc":"eeji";const vista=p.vista==="pendientes"?"pendientes":"inventario";
  const q=typeof p.q==="string"?p.q.trim().slice(0,120):"";
  const numero=typeof p.pagina==="string"&&/^\d{1,7}$/.test(p.pagina)?Math.max(1,Number(p.pagina)):1;
  const tipo=ambito==="eeji"&&["establecimiento","jardin_infantil"].includes(String(p.tipo))?String(p.tipo):"";
  const sedeId=typeof p.sede==="string"&&esIdSede(p.sede)?p.sede:null;
  const {equipos,total,pagina}=await listarEquipos(ambito,vista,numero,q,tipo,sedeId);
  const editar=puedeGestionarDependencias(actor.rol);
  const [sedes,categorias]=await Promise.all([listarSedes(),editar?listarCategorias():Promise.resolve([])]);
  const url=(a:string,v:string,n=1)=>`/inventario?${new URLSearchParams({ambito:a,vista:v,q,pagina:String(n),tipo:a==="eeji"?tipo:"",sede:a===ambito?sedeId??"":""})}`;
  return <main><h1>{local?"Inventario de mi sede":ambito==="nc"?"Inventario de Nivel Central":"Consolidado EE/JI"}</h1>
    <nav aria-label="Vistas de inventario"><ul>
      {!local&&<><li><Link href={url("eeji","inventario")}>Consolidado EE/JI</Link></li><li><Link href={url("nc","inventario")}>Nivel Central</Link></li></>}
      <li><Link href={url(ambito,"inventario")}>Inventario registrado / recibido</Link></li>
      {ambito==="eeji"&&<li><Link href={url(ambito,"pendientes")}>Pendientes de entrega</Link></li>}
    </ul></nav>
    {vista==="pendientes"&&<p>Equipos destinados a la sede que todavía no forman parte de su inventario recibido. La confirmación de entrega y sus actas se incorporarán en su etapa.</p>}
    {puedeAdministrar(actor.rol)&&<p><Link href="/inventario/carga">Carga histórica con vista previa</Link></p>}
    <form method="get" className="filtros-inventario"><input type="hidden" name="ambito" value={ambito}/><input type="hidden" name="vista" value={vista}/>
      {!local&&<><label htmlFor="filtro-sede">Sede</label><select id="filtro-sede" name="sede" defaultValue={sedeId??""}>
        <option value="">Todas las sedes de esta vista</option>{sedes.filter(s=>ambito==="nc"?s.tipo==="nivel_central":s.tipo!=="nivel_central").map(s=><option key={s.id} value={s.id}>{etiquetaSede(s)}</option>)}</select>
        {ambito==="eeji"&&<><label htmlFor="filtro-tipo">Tipo</label><select id="filtro-tipo" name="tipo" defaultValue={tipo}><option value="">EE y JI</option><option value="establecimiento">Establecimientos</option><option value="jardin_infantil">Jardines infantiles</option></select></>}</>}
      <label htmlFor="buscar-equipo">Buscar por RBD, sede, marca, modelo, serie o inventario</label>
      <input id="buscar-equipo" name="q" maxLength={120} defaultValue={q}/><button type="submit">Buscar</button></form>
    <p>{total} equipos en esta vista.</p>
    <div className="tabla-usuarios-contenedor"><table className="tabla-catalogos"><caption>{vista==="pendientes"?"Pendientes de entrega":"Equipos registrados / recibidos"}</caption>
      <thead><tr><th>Sede</th><th>Equipo</th><th>Serie / inventario</th><th>Situación</th><th>Ficha</th></tr></thead>
      <tbody>{equipos.map(e=><tr key={e.id}><td>{etiquetaSede({nombre:e.sedeNombre,rbd:e.sedeRbd})}</td>
        <td>{e.categoriaNombre} · {e.marca} {e.modelo}</td><td>{e.serie||"Pendiente"} / {e.inventario||"Pendiente"}</td>
        <td>{SITUACIONES[e.situacion as keyof typeof SITUACIONES]}</td><td><Link href={`/inventario/${e.id}`}>Ver ficha e historial</Link></td></tr>)}</tbody>
    </table></div>
    <p>Página {pagina} de {Math.max(1,Math.ceil(total/50))}.</p>
    <div className="acciones-catalogos">{pagina>1&&<Link href={url(ambito,vista,pagina-1)}>Anterior</Link>}{pagina*50<total&&<Link href={url(ambito,vista,pagina+1)}>Siguiente</Link>}</div>
    {editar&&<section className="panel-catalogos" id="nuevo-equipo"><h2>Registrar equipo</h2>
      <p>El registro conserva su identidad e historial. Las correcciones no trasladan equipos ni generan bajas.</p>
      {categorias.length&&sedes.length?<FormularioEquipo sedes={sedes.filter(s=>local||(ambito==="nc"?s.tipo==="nivel_central":s.tipo!=="nivel_central"))} categorias={categorias} local={local}/>:<p>Se requiere una sede y una categoría activa en los mantenedores.</p>}
    </section>}
  </main>;
}
