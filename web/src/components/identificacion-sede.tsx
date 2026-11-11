import {exigirAcceso} from '@/lib/acceso';
import {obtenerFotoSede} from '@/lib/fotos-sedes';
import {puedeEditarFotoSede} from '@/lib/politica-fotos-sedes';
import FotoEstablecimiento from '@/components/foto-establecimiento';
import type {Sede} from '@/lib/validacion-sedes';
import {TIPOS_SEDE} from '@/lib/validacion-sedes';
export default async function IdentificacionSede({sede}:{sede:Sede}){
 const actor=await exigirAcceso(),foto=await obtenerFotoSede(sede.id);
 const campos=[['Nombre',sede.nombre],['RBD',sede.rbd],['Tipo',TIPOS_SEDE[sede.tipo]],['Comuna',sede.comuna],['Dirección',sede.direccion],['Correo institucional',sede.correoInstitucional]];
 return <section className="panel-catalogos directorio-ficha" aria-labelledby="identificacion-sede"><h2 id="identificacion-sede">Datos del establecimiento</h2><div className="datos-sede-con-foto"><dl className="ficha-datos">{campos.map(([titulo,valor])=><div key={titulo}><dt>{titulo}</dt><dd>{valor||'Sin informar'}</dd></div>)}</dl><FotoEstablecimiento key={sede.id} sede={sede.id} nombre={sede.nombre} foto={foto} editable={puedeEditarFotoSede(actor.rol,actor.sedeId,sede.id)}/></div></section>;
}
