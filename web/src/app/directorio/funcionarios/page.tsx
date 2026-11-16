import {redirect} from 'next/navigation';
import {exigirPermiso} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
import PanelFiltros from '@/components/panel-filtros';
import PanelResultados from '@/components/panel-resultados';
export const metadata={title:'Directorio de funcionarios de Nivel Central'};
type Persona={id:string;nombre:string;subdireccion:string;unidad:string;cargo:string;correo:string|null;foto:string|null};
export default async function DirectorioFuncionarios({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const a=await exigirPermiso('directorio_nc');
 if(!a.directorioNC)redirect('/sin-permiso');
 const p=await searchParams,q=typeof p.q==='string'?p.q.trim().slice(0,150):'',limite=typeof p.limite==='string'&&['50','100','150'].includes(p.limite)?Number(p.limite):50,pagina=typeof p.pagina==='string'&&/^\d{1,7}$/.test(p.pagina)?Math.max(1,Number(p.pagina)):1;
 const {rows}=await obtenerBaseDatos().query<{r:{filas:Persona[];total:number;pagina:number;paginas:number}}>('SELECT public.directorio_funcionarios_nc($1,$2,$3,$4) r',[a.email,q,limite,pagina]),d=rows[0].r,ruta='/directorio/funcionarios';
 return <main><header><h1>Directorio de funcionarios de Nivel Central</h1><p className="descripcion-pagina">Contacto interno del personal activo.</p></header><PanelFiltros ruta={ruta} titulo="Buscar funcionarios" busqueda={{valor:q,placeholder:'Nombre, subdirección, unidad, cargo o correo'}} ocultos={{limite}}/><PanelResultados ruta={ruta} total={d.total} descripcion="funcionarios" limite={limite} filtros={{q}} pagina={d.pagina} paginas={d.paginas}><div className="tabla-contenedor" role="region" aria-label="Directorio de funcionarios" tabIndex={0}><table className="tabla-datos tabla-catalogos tabla-directorio-nc"><caption className="visually-hidden">Directorio interno de Nivel Central</caption><thead><tr>{['Fotografía','Nombre','Subdirección','Unidad','Cargo','Correo institucional'].map(c=><th scope="col" key={c}>{c}</th>)}</tr></thead><tbody>{d.filas.map(f=><tr key={f.id}><td>{f.foto?<img className="directorio-foto" width={48} height={48} loading="lazy" src={'/api/directorio-funcionarios/foto?funcionario='+f.id+'&id='+f.foto} alt={'Fotografía de '+f.nombre}/>:<span className="directorio-foto directorio-foto-vacia" aria-label="Sin fotografía">—</span>}</td><th scope="row">{f.nombre}</th><td>{f.subdireccion||'Sin informar'}</td><td>{f.unidad||'Sin informar'}</td><td>{f.cargo||'Sin informar'}</td><td>{f.correo||'Sin informar'}</td></tr>)}{!d.filas.length&&<tr><td colSpan={6}>No hay funcionarios para esta búsqueda.</td></tr>}</tbody></table></div></PanelResultados></main>;
}
