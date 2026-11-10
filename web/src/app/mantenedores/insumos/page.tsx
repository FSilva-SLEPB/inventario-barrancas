import {exigirAdministrador} from "@/lib/acceso";
import {listarCatalogoInsumos,listarStockInsumos} from "@/lib/insumos";
import InsumosMantenedor from "./insumos-mantenedor";
export const metadata={title:'Catálogo de insumos | Mantenedores'};
export default async function MantenedorInsumosPage(){
 await exigirAdministrador();
 let catalogo=[] as Awaited<ReturnType<typeof listarCatalogoInsumos>>;
 let stock=[] as Awaited<ReturnType<typeof listarStockInsumos>>;
 try{[catalogo,stock]=await Promise.all([listarCatalogoInsumos(false),listarStockInsumos()]);}catch{}
 return <main><InsumosMantenedor catalogo={catalogo} stock={stock}/></main>;
}
