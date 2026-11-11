import {notFound} from 'next/navigation';
import {exigirAdministrador} from '@/lib/acceso';
import {listarCatalogoInsumos,listarStockInsumos,listarCategoriasCodigosInsumos,listarIngresosInsumo} from '@/lib/insumos';
import {esIdSede} from '@/lib/validacion-sedes';
import ModalFicha from '@/components/modal-ficha';
import PanelResultados from '@/components/panel-resultados';
import InsumosMantenedor from './insumos-mantenedor';
export const metadata={title:'Catálogo de insumos | Mantenedores'};
export default async function MantenedorInsumosPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await exigirAdministrador();const p=await searchParams;
 const [catalogo,stock,categorias]=await Promise.all([listarCatalogoInsumos(false),listarStockInsumos(),listarCategoriasCodigosInsumos()]);
 const compras=typeof p.compras==='string'?p.compras:'',producto=compras?catalogo.find(c=>c.id===compras):null;if(compras&&(!esIdSede(compras)||!producto))notFound();
 const limite=[50,100,150].includes(Number(p.limite))?Number(p.limite):50,pagina=typeof p.pagina==='string'&&/^[1-9]\d{0,6}$/.test(p.pagina)?Number(p.pagina):1,historial=producto?await listarIngresosInsumo(producto.id,pagina,limite):null;
 return <main><InsumosMantenedor categorias={categorias} catalogo={catalogo} stock={stock}/>
 {producto&&historial&&<ModalFicha titulo={'Ingresos y compras: '+producto.nombre} cerrarHref="/mantenedores/insumos" focoId={producto.id}><p>Las compras conservan su OC, fecha, cantidad y datos del producto al ingresar. Los saldos anteriores no tienen OC ni fecha inventadas.</p>
 <PanelResultados total={historial.total} descripcion="ingresos registrados" ruta="/mantenedores/insumos" filtros={{compras:producto.id}} limite={limite} pagina={historial.pagina} paginas={historial.paginas}><div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-catalogos"><thead><tr><th>Tipo</th><th>Fecha de compra</th><th>OC</th><th>Producto</th><th>Cantidad</th><th>Registro</th></tr></thead><tbody>{historial.filas.map(i=><tr key={i.id}><td className="text-nowrap">{i.clase==='compra'?'Compra':'Saldo anterior sin documento'}</td><td className="text-nowrap">{i.fechaCompra?i.fechaCompra.split('-').reverse().join('/'):'Sin fecha registrada'}</td><td>{i.oc??'Sin OC registrada'}</td><td>{i.producto.codigo} · {i.producto.nombre}<small className="dato-secundario">{i.producto.unidad}</small></td><td>{i.cantidad}</td><td>{new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'short',timeZone:'America/Santiago'}).format(new Date(i.registradoEn))}<small className="dato-secundario">{i.clase==='compra'?i.actor:'Antecedente conservado en la actualización'}</small></td></tr>)}{!historial.filas.length&&<tr><td colSpan={6}>No hay compras registradas para este producto.</td></tr>}</tbody></table></div></PanelResultados></ModalFicha>}
 </main>;
}
