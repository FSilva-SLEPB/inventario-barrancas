import {exigirPermiso} from '@/lib/acceso';
import {tienePermiso} from '@/lib/rbac';
import Link from 'next/link';
import {documentosBien} from '@/lib/actas';
import {TIPOS_ACTA} from '@/lib/validacion-actas';
import AccionesRegistro from '@/components/acciones-registro';
import BotonImprimirActa from '@/components/actas/boton-imprimir-acta';
export default async function DocumentosBien({tipo,id,volver}:{tipo:'equipo'|'celular';id:string;volver:string}){
 const actor=await exigirPermiso('actas'),documentos=(await documentosBien(tipo,id)).filter(d=>d.actaId||tienePermiso(actor,'actas','registrar'));if(!documentos.length)return null;
 return <section className="ficha-seccion documentos-bien"><h3>Actas del bien</h3><p className="ayuda-catalogos">Las operaciones nuevas generan el acta al confirmar. Aquí puedes completar documentación de operaciones anteriores sin repetir la entrega ni la devolución.</p><div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-catalogos"><thead><tr><th>Fecha real</th><th>Operación</th><th>Acciones</th></tr></thead><tbody>{documentos.map(d=><tr key={d.fuente+d.id}><td className="dato-identificador">{d.fecha.split('-').reverse().join('/')}</td><td>{TIPOS_ACTA[d.operacion as keyof typeof TIPOS_ACTA]}{d.cantidad>1&&<span className="dato-secundario">Entrega registrada con {d.cantidad} bienes</span>}</td><td><AccionesRegistro nombre={'acta del '+d.fecha} verTexto={d.actaId?'Ver acta':'Completar acta'} verHref={d.actaId?'/inventario/actas/'+d.actaId:'/inventario/actas?'+new URLSearchParams({[d.fuente]:d.id,volver})}>{d.actaId&&tienePermiso(actor,'actas','imprimir')&&<BotonImprimirActa id={d.actaId}/>}</AccionesRegistro></td></tr>)}</tbody></table></div>{tienePermiso(actor,'movimientos')&&<Link href="/inventario/movimientos">Consultar Movimientos y actas</Link>}</section>;
}
