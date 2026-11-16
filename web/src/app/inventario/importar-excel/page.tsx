import Link from 'next/link';
import {redirect} from 'next/navigation';
import {exigirAcceso} from '@/lib/acceso';
import {puedeImportarExcel} from '@/lib/importacion-excel/permisos';
import type {TipoExcel} from '@/lib/importacion-excel/tipos';
import ImportarExcel from '@/components/importar-excel';
export const metadata={title:'Importar Excel | Inventario'};
export default async function CargaExcel(){
 const actor=await exigirAcceso(),tipos=(['central','vinculos'] as TipoExcel[]).filter(t=>puedeImportarExcel(actor,t));if(!tipos.length)redirect('/sin-permiso');
 return <main><header><h1>Importar inventario de Nivel Central</h1><p className="descripcion-pagina">Selecciona la hoja, revisa las correspondencias y confirma los registros aptos. Las filas repetidas o históricas quedan para revisión.</p></header><div className="acciones-catalogos"><Link href="/inventario/nivel-central/inicio" className="btn btn-outline-primary">Inicio de Nivel Central</Link>{puedeImportarExcel(actor,'funcionarios')&&<Link href="/mantenedores/funcionarios/importar-excel" className="btn btn-outline-primary">Importar funcionarios</Link>}</div><p>Orden recomendado: fichas de funcionarios, inventario de Nivel Central y finalmente vínculos de equipos existentes por RUN y serie completa. No unas hojas de Bodega o Robos al consolidado: pueden repetir los mismos bienes.</p><ImportarExcel tipos={tipos} inicial={tipos[0]}/></main>;
}
