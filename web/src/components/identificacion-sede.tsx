import type {Sede} from '@/lib/validacion-sedes';
import {TIPOS_SEDE} from '@/lib/validacion-sedes';
export default function IdentificacionSede({sede}:{sede:Sede}){
 const campos=[['Nombre',sede.nombre],['RBD',sede.rbd],['Tipo',TIPOS_SEDE[sede.tipo]],['Comuna',sede.comuna],['Dirección',sede.direccion],['Correo institucional',sede.correoInstitucional]];
 return <section className="panel-catalogos directorio-ficha" aria-labelledby="identificacion-sede"><h2 id="identificacion-sede">Identificación de mi sede</h2><dl className="ficha-datos">{campos.map(([titulo,valor])=><div key={titulo}><dt>{titulo}</dt><dd>{valor||'Sin informar'}</dd></div>)}</dl></section>;
}
