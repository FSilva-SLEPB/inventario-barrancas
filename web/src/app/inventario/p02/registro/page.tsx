import {randomUUID} from 'node:crypto';
import {exigirPermiso} from '@/lib/acceso';
import {listarSedes} from '@/lib/sedes';
import {listarCategorias} from '@/lib/catalogos';
import {requiereSede} from '@/lib/politica-acceso';
import {retornoInventario} from '@/lib/ficha-inventario';
import ModalFicha from '@/components/modal-ficha';
import FormularioEquipo from '@/components/formulario-equipo';
export default async function RegistroP02({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const a=await exigirPermiso('equipos','registrar'),p=await searchParams,volver=retornoInventario(p.volver)??'/inventario/p02/inicio';const[sedes,categorias]=await Promise.all([listarSedes(),listarCategorias()]);return <main><header><h1>Registrar equipo P02</h1><p className="descripcion-pagina">Establecimientos y jardines. El número faltante se genera al guardar.</p></header><ModalFicha titulo="Registrar equipo P02" cerrarHref={volver} editando><FormularioEquipo sedes={sedes.filter(s=>['establecimiento','jardin_infantil'].includes(s.tipo))} categorias={categorias} local={requiereSede(a)} volver={volver} p02 solicitudRegistro={randomUUID()}/></ModalFicha></main>;}
