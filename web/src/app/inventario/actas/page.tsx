import Link from 'next/link';
import {randomUUID} from 'node:crypto';
import {notFound,redirect} from 'next/navigation';
import {listarActas,fuenteActa} from '@/lib/actas';
import {folioActa} from '@/lib/validacion-actas';
import PanelFiltros from '@/components/panel-filtros';
import PanelResultados from '@/components/panel-resultados';
import ModalFicha from '@/components/modal-ficha';
import FormularioActa from '@/components/actas/formulario-acta';
export const metadata={title:'Actas emitidas | Inventario'};
export default async function Actas({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const p=await searchParams,v=(k:string)=>typeof p[k]==='string'?p[k].trim():'',q=v('q').slice(0,150),limite=[50,100,150].includes(Number(v('limite')))?Number(v('limite')):50,pagina=/^[1-9]\d{0,6}$/.test(v('pagina'))?Number(v('pagina')):1;
 const datos=await listarActas({q,limite,pagina}),fuente=v('movimiento')?await fuenteActa(v('movimiento')):null;if(v('movimiento')&&!fuente)notFound();if(fuente?.actaId)redirect('/inventario/actas/'+fuente.actaId);
 const volver='/inventario/actas?'+new URLSearchParams({q,limite:String(limite),pagina:String(datos.pagina)});
 return <main><header><h1>Actas emitidas</h1><p className="descripcion-pagina">Documentos de asignación y devolución generados desde los movimientos confirmados. Cada acta conserva su folio, datos y PDF.</p><p><Link href="/inventario/movimientos">Volver a Movimientos y actas</Link></p></header><PanelFiltros ruta="/inventario/actas" titulo="Filtrar actas" busqueda={{valor:q,placeholder:'Buscar por folio, receptor o sede'}} ocultos={{limite}}/><PanelResultados total={datos.total} descripcion="actas emitidas" ruta="/inventario/actas" limite={limite} filtros={{q}} pagina={datos.pagina} paginas={datos.paginas}><div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-catalogos"><caption className="visually-hidden">Actas emitidas</caption><thead><tr><th>Folio</th><th>Operación</th><th>Sede</th><th>Recibe</th><th>Fecha real</th><th>Ficha</th></tr></thead><tbody>{datos.filas.map(a=><tr key={a.id}><td>{folioActa(a.folio)}</td><td>{a.datos.tipo==='asignacion'?'Asignación':'Devolución'}</td><td>{a.datos.sedeNombre}</td><td>{a.datos.receptorNombre}</td><td>{a.datos.fecha.split('-').reverse().join('/')}</td><td><Link data-ficha-id={a.id} href={'/inventario/actas/'+a.id}>Ver ficha</Link></td></tr>)}{!datos.filas.length&&<tr><td colSpan={6}>No hay actas para estos filtros.</td></tr>}</tbody></table></div></PanelResultados>
 {fuente&&<ModalFicha titulo="Preparar acta del movimiento" cerrarHref={volver} editando><p><strong>{fuente.accion==='asignacion'?'Asignación':'Devolución'} · {fuente.fecha}</strong></p><p>{String(fuente.despues.sedeNombre??'')} · {String(fuente.despues.numero_inventario??fuente.despues.inventario??fuente.despues.telefono??fuente.despues.modelo??'')}</p><FormularioActa solicitud={randomUUID()} movimiento={fuente.id} receptor={fuente.receptor} cancelarHref={volver}/></ModalFicha>}</main>;
}
