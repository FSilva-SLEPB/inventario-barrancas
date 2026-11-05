import VentanaActaEmitida from '@/components/actas/ventana-acta-emitida';
import AccionesRegistro from '@/components/acciones-registro';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {exigirAcceso,exigirGestionDependencias} from '@/lib/acceso';
import {puedeAdministrar,puedeGestionarDependencias,requiereSede} from '@/lib/politica-acceso';
import {listarSedes} from '@/lib/sedes';
import {esIdSede} from '@/lib/validacion-sedes';
import {listarCelulares,detalleCelular,type FiltrosCelulares} from '@/lib/celulares';
import {enlaceCelulares} from '@/lib/validacion-celulares';
import {CONDICIONES} from '@/lib/validacion-equipos';
import {CUSTODIAS} from '@/lib/validacion-movimientos-inventario';
import ModalFicha from '@/components/modal-ficha';
import FichaCelular,{telefonoCelular} from '@/components/ficha-celular';
import VentanaMovimiento,{AccionesCustodia} from '@/components/ventana-movimiento';
import FiltrosInventario from '@/components/filtros-inventario';
import PanelResultados from '@/components/panel-resultados';
export const metadata={title:'Inventario de celulares | Inventario'};
export default async function Celulares({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const actor=await exigirAcceso(),p=await searchParams,local=requiereSede(actor.rol),gestiona=puedeGestionarDependencias(actor.rol),admin=puedeAdministrar(actor.rol),valor=(k:string,max=150)=>typeof p[k]==='string'?p[k].trim().slice(0,max):'';
 const tipo=!local&&['nivel_central','establecimiento','jardin_infantil'].includes(valor('tipo'))?valor('tipo'):'',vista=p.vista==='pendientes'?'pendientes':'inventario';
 const f:FiltrosCelulares={q:valor('q'),tipo,sede:tipo&&esIdSede(valor('sede'))?valor('sede'):'',rbd:tipo&&tipo!=='nivel_central'?valor('rbd',120):'',vista,estado:['activo','inactivo'].includes(valor('estado'))?valor('estado'):p.estado===undefined?'activo':'',pagina:/^[1-9]\d{0,6}$/.test(valor('pagina'))?Number(valor('pagina')):1,limite:[50,100,150].includes(Number(valor('limite')))?Number(valor('limite')):50};
 const [datos,sedes]=await Promise.all([listarCelulares(f),listarSedes()]);f.pagina=datos.pagina;
 const filtros=new URLSearchParams(Object.entries(f).map(([k,v])=>[k,String(v)])).toString(),enlace=(accion?:'ver'|'editar'|'nuevo',id?:string)=>enlaceCelulares(filtros,accion,id),volver=enlace();
 const editar=valor('editar'),id=editar||valor('ver'),nuevo=p.nuevo==='1';if(nuevo)await exigirGestionDependencias();if(id&&!esIdSede(id))notFound();const detalle=id?await detalleCelular(id):null;
 if(id&&(!detalle||tipo&&detalle.celular.sedeTipo!==tipo))notFound();const c=detalle?.celular,editando=Boolean(gestiona&&editar&&c&&(!local||c.custodia==='asignado'));
 return <main><header><h1>Inventario de celulares</h1><p className="descripcion-pagina">Celulares y números asociados de establecimientos, jardines infantiles, salas cuna y Nivel Central. Cada equipo conserva su ficha e historial.</p><p><Link href="/inventario">Volver a Inventario</Link></p></header><div className="acciones-catalogos">{gestiona&&<Link className="btn btn-primary" scroll={false} href={enlace('nuevo')}>Registrar celular</Link>}{admin&&<Link className="btn btn-outline-primary" href="/inventario/bodega-ti?clase=celular">Bodega TI</Link>}</div><p className="ayuda-catalogos">La referencia habitual es de dos celulares por establecimiento o jardín. Se permiten excepciones; cada celular tiene un número propio.</p>
 <FiltrosInventario key={JSON.stringify(f)} ambito="eeji" permitirNC vista={vista} local={local} tipo={tipo} sedeId={f.sede} rbd={f.rbd??''} q={f.q} sedes={sedes.filter(s=>local||s.tipo===tipo)} limite={f.limite} ruta="/inventario/celulares" titulo="Filtrar celulares" placeholder="Buscar por teléfono, marca, modelo, IMEI, inventario o responsable" extras={<div className="campo-catalogos"><label htmlFor="celulares-estado">Vigencia</label><select id="celulares-estado" name="estado" defaultValue={f.estado}><option value="activo">Vigentes</option><option value="inactivo">Archivados</option><option value="">Todos</option></select></div>}/>
 <PanelResultados total={datos.total} descripcion={vista==='pendientes'?'celulares en Bodega TI':'celulares asignados / recibidos'} ruta="/inventario/celulares" limite={f.limite} filtros={Object.fromEntries(new URLSearchParams(filtros))} pagina={datos.pagina} paginas={datos.paginas}>
 <div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-catalogos tabla-celulares"><caption className="visually-hidden">Celulares según los filtros</caption><thead><tr><th scope="col">RBD</th><th scope="col">Establecimiento / sede</th><th scope="col">Equipo</th><th scope="col">Número de teléfono</th><th scope="col">Inventario</th><th scope="col">Estado</th><th scope="col">Vigencia</th><th scope="col">Acciones</th></tr></thead><tbody>{datos.filas.map(c=><tr key={c.id}><td className="dato-identificador">{c.rbd||(c.sedeTipo==='nivel_central'?'Nivel Central':'Sin RBD')}</td><td>{c.sedeNombre}</td><td>{c.marca||'Marca sin informar'}<span className="dato-secundario">{c.modelo||'Modelo sin informar'}</span></td><td className="celular-telefono">{telefonoCelular(c.telefono)}</td><td className="dato-identificador">{c.inventario||'Sin informar'}</td><td><span className={'estado-custodia '+c.custodia}>{CUSTODIAS[c.custodia as keyof typeof CUSTODIAS]}</span><small className="dato-secundario">Funcionamiento: {CONDICIONES[c.condicionTecnica as keyof typeof CONDICIONES]}</small></td><td>{c.activo?'Vigente':'Archivado'}</td><td><AccionesRegistro id={c.id} nombre={'celular '+telefonoCelular(c.telefono)} verHref={enlace('ver',c.id)} editarHref={gestiona&&(!local||c.custodia==='asignado')?enlace('editar',c.id):undefined}><AccionesCustodia tipo="celular" id={c.id} custodia={c.custodia} volver={volver} permitido={admin&&c.activo}/></AccionesRegistro></td></tr>)}{!datos.filas.length&&<tr><td colSpan={8}>No hay celulares para estos filtros.</td></tr>}</tbody></table></div></PanelResultados>
 {(nuevo||c)&&<ModalFicha titulo={nuevo?'Registrar celular':editando?'Editar celular':'Registro del celular'} cerrarHref={volver} editando={nuevo||editando} focoId={c?.id}><FichaCelular detalle={detalle} nuevo={nuevo} editar={editando} sedes={sedes} local={local} gestiona={gestiona} admin={admin} filtros={filtros} volver={volver} editarHref={enlace('editar',c?.id)} cancelarHref={nuevo?volver:enlace('ver',c?.id)}/></ModalFicha>}
 <VentanaMovimiento parametros={p} volver={volver}/><VentanaActaEmitida parametros={p} volver={volver}/></main>;
}
