import Link from 'next/link';
import PanelFiltros from '@/components/panel-filtros';
import PanelResultados from '@/components/panel-resultados';
import {exigirAcceso} from '@/lib/acceso';
import {puedeGestionarDependencias,requiereSede} from '@/lib/politica-acceso';
import {listarSedes} from '@/lib/sedes';
import {esIdSede} from '@/lib/validacion-sedes';
import {etiquetaSede} from '@/lib/etiqueta-sede';
import {consolidadoRobos,type FiltrosRobos} from '@/lib/robos';
import {ESTADOS_ROBO,fechaRobo} from '@/lib/validacion-robos';
export const metadata={title:'Consolidado de robos | Inventario'};
export default async function Robos({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const actor=await exigirAcceso(),p=await searchParams,local=requiereSede(actor.rol),gestiona=puedeGestionarDependencias(actor.rol);
 const valor=(k:string,max=150)=>typeof p[k]==='string'?p[k].trim().slice(0,max):'';
 const fecha=(k:string)=>{try{return fechaRobo(valor(k),'9999-12-31');}catch{return '';}};
 const f:FiltrosRobos={ambito:local?'eeji':['nc','eeji'].includes(valor('ambito'))?valor('ambito'):'',sede:esIdSede(valor('sede'))?valor('sede'):'',comuna:valor('comuna'),estado:Object.hasOwn(ESTADOS_ROBO,valor('estado'))?valor('estado'):'',desde:fecha('desde'),hasta:fecha('hasta'),q:valor('q'),limite:[50,100,150].includes(Number(valor('limite')))?Number(valor('limite')):50,pagina:/^[1-9]\d{0,6}$/.test(valor('pagina'))?Number(valor('pagina')):1};
 const [datos,sedes]=await Promise.all([consolidadoRobos(f),listarSedes()]);
 const comunas=[...new Set(sedes.map(s=>s.comuna).filter((c):c is string=>Boolean(c)))].sort((a,b)=>a.localeCompare(b,'es'));

 return <main><header><h1>Consolidado de robos</h1><p className="descripcion-pagina">Consulta los equipos reportados, los robos validados y las recuperaciones de Nivel Central y establecimientos/JISC.</p><p><Link href={local?'/inventario/p02':'/inventario'}>Volver al inventario</Link></p></header>
 {gestiona&&<div className="acciones-catalogos"><Link href="/inventario/robos/reportar" className="btn btn-primary">Reportar robo</Link></div>}
 <PanelFiltros ruta="/inventario/robos" titulo="Filtrar robos" busqueda={{id:'robos-q',valor:f.q,placeholder:'Buscar por equipo, categoría, serie, inventario, RBD o establecimiento'}} ocultos={{limite:f.limite??50}}><div className="campo-catalogos"><label htmlFor="robos-ambito">Inventario</label><select id="robos-ambito" name="ambito" defaultValue={f.ambito} disabled={local}><option value="">Todos</option><option value="nc">Nivel Central</option><option value="eeji">Establecimientos / JISC</option></select></div>
 <div className="campo-catalogos"><label htmlFor="robos-sede">Establecimiento / JISC / sede</label><select id="robos-sede" name="sede" defaultValue={f.sede}><option value="">Todos los autorizados</option>{sedes.map(s=><option key={s.id} value={s.id}>{etiquetaSede(s)}</option>)}</select></div>
 <div className="campo-catalogos"><label htmlFor="robos-comuna">Comuna</label><select id="robos-comuna" name="comuna" defaultValue={f.comuna}><option value="">Todas</option>{comunas.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
 <div className="campo-catalogos"><label htmlFor="robos-estado">Estado</label><select id="robos-estado" name="estado" defaultValue={f.estado}><option value="">Todos los estados</option>{Object.entries(ESTADOS_ROBO).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
 <div className="campo-catalogos"><label htmlFor="robos-desde">Incidente desde</label><input id="robos-desde" name="desde" type="date" defaultValue={f.desde}/></div><div className="campo-catalogos"><label htmlFor="robos-hasta">Incidente hasta</label><input id="robos-hasta" name="hasta" type="date" defaultValue={f.hasta}/></div>
 </PanelFiltros>
 {f.desde&&f.hasta&&f.desde>f.hasta&&<p role="alert">La fecha «desde» debe ser anterior o igual a «hasta».</p>}
 <p className="ayuda-catalogos">La validación de un robo no genera una baja administrativa.</p>
 <details className="consolidado-sedes" open><summary>Consolidado por establecimiento / JISC / sede</summary><div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-catalogos"><thead><tr><th>Sede / RBD</th><th>Comuna</th><th>Robo validado sin recuperar</th><th>Pendiente de validación</th><th>Recuperados</th></tr></thead><tbody>{datos.grupos.map((g,k)=><tr key={g.sedeId+'-'+k}><td>{g.rbd?g.rbd+' · ':''}{g.sedeNombre}</td><td>{g.comuna||'Sin informar'}</td><td>{g.robados}</td><td>{g.reportados}</td><td>{g.recuperados}</td></tr>)}{!datos.grupos.length&&<tr><td colSpan={5}>No hay incidentes para los filtros seleccionados.</td></tr>}</tbody></table></div></details>
 <h2>Equipos e incidentes</h2><PanelResultados total={Number(datos.resumen.filas)} descripcion="registros de equipo por incidente" ruta="/inventario/robos" limite={f.limite??50} filtros={Object.fromEntries(Object.entries(f).map(([k,v])=>[k,String(v)]))} pagina={datos.pagina} paginas={datos.paginas}><div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-catalogos"><caption className="visually-hidden">{datos.resumen.filas} registros de equipo por incidente · página {datos.pagina} de {datos.paginas}</caption><thead><tr><th>Sede / RBD</th><th>Fecha del incidente</th><th>Equipo</th><th>Serie</th><th>Inventario</th><th>Estado</th>{gestiona&&<th>Detalle</th>}</tr></thead><tbody>{datos.filas.map(e=><tr key={e.incidenteId+e.equipoId}><td>{e.rbd?e.rbd+' · ':''}{e.sedeNombre}<p className="ayuda-catalogos">{e.comuna||'Sin comuna'}</p></td><td>{e.fecha.split('-').reverse().join('/')}</td><td>{e.categoria}<p>{e.marca} {e.modelo}</p></td><td>{e.serie||'Pendiente'}</td><td>{e.inventario||'Pendiente'}</td><td>{ESTADOS_ROBO[e.estado]}</td>{gestiona&&<td><Link href={'/inventario/robos/'+e.incidenteId}>Ver incidente</Link></td>}</tr>)}{!datos.filas.length&&<tr><td colSpan={gestiona?7:6}>Todavía no hay equipos con incidentes para estos filtros.</td></tr>}</tbody></table></div>
 </PanelResultados></main>;
}
