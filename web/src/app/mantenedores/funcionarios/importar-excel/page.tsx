import Link from 'next/link';
import {redirect} from 'next/navigation';
import {exigirAcceso} from '@/lib/acceso';
import {puedeImportarExcel} from '@/lib/importacion-excel/permisos';
import ImportarExcel from '@/components/importar-excel';
export const metadata={title:'Importar funcionarios | Inventario'};
export default async function CargaFuncionarios(){
 const actor=await exigirAcceso();if(!puedeImportarExcel(actor,'funcionarios'))redirect('/sin-permiso');
 return <main><header><h1>Importar funcionarios desde Excel</h1><p className="descripcion-pagina">Crea fichas por RUN válido. Se conservan las fichas existentes sin sobrescribirlas. No crea cuentas, autoriza accesos ni asigna perfiles.</p></header><div className="acciones-catalogos"><Link href="/mantenedores/funcionarios" className="btn btn-outline-primary">Volver a Funcionarios</Link>{puedeImportarExcel(actor,'central')&&<Link href="/inventario/importar-excel" className="btn btn-outline-primary">Importar inventario y vínculos</Link>}</div><p>Solo se leen nombre, RUN, correo institucional, unidad, subdirección y cargo. Las bajas laborales requieren revisión; no se deduce fecha de ingreso de la fecha de cese. No se cargan claves, PIN ni usuarios de impresora.</p><ImportarExcel tipos={['funcionarios']} inicial="funcionarios"/></main>;
}
