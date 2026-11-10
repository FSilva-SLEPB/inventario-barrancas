import {randomUUID} from 'node:crypto';
import {exigirAdministrador} from "@/lib/acceso";
import {listarCatalogoInsumos,listarStockInsumos} from "@/lib/insumos";
import InsumosMantenedor from "./insumos-mantenedor";
export const metadata={title:'Catálogo de insumos | Mantenedores'};
export default async function MantenedorInsumosPage(){
 await exigirAdministrador();
 const [catalogo,stock]=await Promise.all([listarCatalogoInsumos(false),listarStockInsumos()]);
 return <main><InsumosMantenedor solicitudProducto={randomUUID()} solicitudStock={randomUUID()} catalogo={catalogo} stock={stock}/></main>;
}
