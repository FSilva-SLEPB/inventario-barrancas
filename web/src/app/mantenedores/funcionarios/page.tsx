import FotoEstablecimiento from '@/components/foto-establecimiento';import {obtenerFotoFuncionario,puedeEditarFotoFuncionario} from '@/lib/fotos-funcionarios';
import {tienePermiso} from '@/lib/rbac';
import AccionesRegistro from '@/components/acciones-registro';
import PanelFiltros from '@/components/panel-filtros';
import PanelResultados from '@/components/panel-resultados';
import ModalFicha from '@/components/modal-ficha';
import Link from 'next/link';
import {randomUUID} from 'node:crypto';
import {notFound} from 'next/navigation';
import {exigirPermiso} from '@/lib/acceso';
import {listarFuncionarios,detalleFuncionario,type FiltrosFuncionarios} from '@/lib/funcionarios';
import {esIdSede} from '@/lib/validacion-sedes';
import {cambiosFuncionario} from '@/lib/validacion-funcionarios';
import FormularioFuncionario from '@/components/formulario-funcionario';
export const metadata={title:'Funcionarios de Nivel Central | Inventario'};
export default async function Funcionarios({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const actor=await exigirPermiso('funcionarios','consultar'),puedeCrear=tienePermiso(actor,'funcionarios','registrar'),puedeEditar=tienePermiso(actor,'funcionarios','editar');const p=await searchParams,valor=(k:string,max=150)=>typeof p[k]==='string'?p[k].trim().slice(0,max):'';
 const f:FiltrosFuncionarios={q:valor('q'),estado:['activo','inactivo'].includes(valor('estado'))?valor('estado') as 'activo'|'inactivo':p.estado===undefined?'activo':'',limite:[50,100,150].includes(Number(valor('limite')))?Number(valor('limite')):50,pagina:/^[1-9]\d{0,6}$/.test(valor('pagina'))?Number(valor('pagina')):1};
 const id=valor('editar')||valor('ver'),editar=puedeEditar&&Boolean(valor('editar')),detalle=esIdSede(id)?await detalleFuncionario(id):null;
 if(id&&!detalle)notFound();
 const nuevo=puedeCrear&&valor('nuevo')==='1'&&!detalle,datos=await listarFuncionarios(f),funcionario=detalle?.funcionario;
 const params=(pagina=datos.pagina)=>new URLSearchParams({q:f.q,estado:f.estado,pagina:String(pagina),limite:String(f.limite??50)});
 const enlace=(accion?:string,id?:string)=>{const b=params();if(accion)b.set(accion,id??'1');return '/mantenedores/funcionarios?'+b+'';};
 const foto=funcionario?await obtenerFotoFuncionario(funcionario.id):null;
 const prefijoFicha='/mantenedores/funcionarios?'+params()+'&ver=';
 const dato=(titulo:string,v:string|null|undefined)=><div key={titulo}><dt>{titulo}</dt><dd>{v||'Sin informar'}</dd></div>;
 return <main><header><h1>Funcionarios de Nivel Central</h1><p className="descripcion-pagina">Registro de las personas de Nivel Central: datos de contacto, unidad y estado, con historial de cambios. El registro de personas se mantiene separado de las cuentas autorizadas del sistema.</p></header><div className="acciones-catalogos"><Link className="btn btn-outline-primary btn-sm" href="/mantenedores">Volver a Mantenedores</Link>{puedeCrear&&<Link className="btn btn-primary btn-sm" scroll={false} href={enlace('nuevo')}>Registrar funcionario</Link>}</div>
 {p.guardado==='1'&&<p role="status">Cambios guardados. La edición está cerrada.</p>}
 {(nuevo||funcionario)&&<ModalFicha titulo={nuevo?'Registrar funcionario':editar?'Editar funcionario':'Registro del funcionario'} cerrarHref={enlace()} editando={Boolean(nuevo||editar)} focoId={funcionario?.id}><section id="ficha-funcionario" className="ficha-seccion directorio-ficha"><div className="ficha-cabecera"><h2>{nuevo?'Registrar funcionario':funcionario!.nombre}</h2><div className="acciones-catalogos">{puedeEditar&&funcionario&&!editar&&<Link data-editar-ficha scroll={false} className="btn btn-outline-primary" href={enlace('editar',funcionario.id)}>✎ Editar registro</Link>}</div></div>
 {nuevo||editar?<FormularioFuncionario key={funcionario?.id??'nuevo'} id={funcionario?.id??randomUUID()} funcionario={funcionario} cancelarHref={funcionario?enlace('ver',funcionario.id):enlace()} prefijoFicha={prefijoFicha}/>:<dl className="ficha-datos">{dato('Nombre completo',funcionario!.nombre)}{dato('RUN',funcionario!.rut)}{dato('Correo institucional',funcionario!.correo)}{dato('Unidad',funcionario!.unidad)}{dato('Subdirección',funcionario!.subdireccion)}{dato('Cargo',funcionario!.cargo)}{dato('Fecha de ingreso prevista o real',funcionario!.fechaIngreso?.split('-').reverse().join('/'))}{dato('Estado',funcionario!.activo?'Activo':'Inactivo')}</dl>}
 {funcionario&&<FotoEstablecimiento key={funcionario.id} entidad="funcionario" sede={funcionario.id} nombre={funcionario.nombre} foto={foto} editable={funcionario.activo&&puedeEditarFotoFuncionario(actor)}/>}
 {detalle&&detalle.historial.length>0&&<details className="directorio-historial"><summary>Historial de cambios del registro</summary><p className="ayuda-catalogos">Hasta 50 eventos recientes; los registros anteriores se conservan.</p><ol className="linea-historial">{detalle.historial.map(h=><li key={h.id}><article className="evento-historial"><div className="evento-cabecera"><strong>{h.motivo}</strong><time>{new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'short',timeZone:'America/Santiago'}).format(new Date(h.fecha))}</time></div><p className="evento-actor">{h.actor}</p><div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-historial"><thead><tr><th>Dato</th><th>Antes</th><th>Después</th></tr></thead><tbody>{cambiosFuncionario(h.antes,h.despues).map(c=><tr key={c.campo}><th scope="row">{c.campo}</th><td>{c.antes}</td><td>{c.despues}</td></tr>)}</tbody></table></div></article></li>)}</ol></details>}
 </section></ModalFicha>}
 <PanelFiltros ruta="/mantenedores/funcionarios" titulo="Filtrar funcionarios" busqueda={{id:'funcionarios-q',valor:f.q,placeholder:'Buscar por nombre, RUN, correo, unidad, subdirección o cargo'}} ocultos={{limite:f.limite??50}}><div className="campo-catalogos"><label htmlFor="funcionarios-estado">Estado</label><select id="funcionarios-estado" name="estado" defaultValue={f.estado}><option value="activo">Activos</option><option value="inactivo">Inactivos</option><option value="">Todos</option></select></div></PanelFiltros>
 <PanelResultados total={datos.total} descripcion="funcionarios según los filtros" ruta="/mantenedores/funcionarios" limite={f.limite??50} filtros={{q:f.q,estado:f.estado}} pagina={datos.pagina} paginas={datos.paginas}>
 <div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-catalogos tabla-funcionarios"><caption className="visually-hidden">{datos.total} funcionarios según filtros · página {datos.pagina} de {datos.paginas}</caption><thead><tr><th>Nombre</th><th>RUN</th><th>Unidad / Subdirección</th><th>Correo institucional</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{datos.filas.map(g=><tr key={g.id}><td>{g.nombre}{g.cargo&&<span className="dato-secundario">{g.cargo}</span>}</td><td>{g.rut||'Pendiente'}</td><td>{g.unidad||'Sin informar'}{g.subdireccion&&<span className="dato-secundario">{g.subdireccion}</span>}</td><td>{g.correo||'Pendiente'}</td><td>{g.activo?'Activo':'Inactivo'}</td><td><AccionesRegistro id={g.id} nombre={g.nombre} verHref={enlace('ver',g.id)} editarHref={puedeEditar?enlace('editar',g.id):undefined}/></td></tr>)}{!datos.filas.length&&<tr><td colSpan={6}>No hay funcionarios para estos filtros.</td></tr>}</tbody></table></div>
 </PanelResultados>
 </main>;
}
