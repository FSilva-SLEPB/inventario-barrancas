import {redirect} from 'next/navigation';
import {exigirPermiso} from '@/lib/acceso';
import {listarSedes} from '@/lib/sedes';
import {listarCategorias} from '@/lib/catalogos';
import {puedeAbrirInventario} from '@/lib/portadas-inventario';
import {retornoInventario} from '@/lib/ficha-inventario';
import ModalFicha from '@/components/modal-ficha';
import FormularioEquipo from '@/components/formulario-equipo';
export const metadata={title:'Registrar equipo Nivel Central | SLEP Barrancas'};
export default async function RegistroNC({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const a=await exigirPermiso('equipos','registrar');if(!puedeAbrirInventario(a,'nc','registrar'))redirect('/sin-permiso');
 const p=await searchParams,retorno=retornoInventario(p.volver),volver=retorno?.split('?')[0]==='/inventario/nivel-central'?retorno:'/inventario/nivel-central/inicio';
 const[sedes,categorias]=await Promise.all([listarSedes(),listarCategorias()]);
 return <main><header><h1>Registrar equipo de Nivel Central</h1><p className="descripcion-pagina">Ingreso de bienes de Nivel Central. La asignación a funcionarios se realiza desde el equipo.</p></header><ModalFicha titulo="Registrar equipo de Nivel Central" cerrarHref={volver} editando><FormularioEquipo sedes={sedes.filter(s=>s.tipo==='nivel_central')} categorias={categorias} volver={volver}/></ModalFicha></main>;
}
