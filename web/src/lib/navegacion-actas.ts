import {retornoMovimiento,enlaceActaInventario} from '@/lib/validacion-movimientos-inventario';
import {retornoInsumos,enlaceActaInsumos} from '@/lib/navegacion-insumos';
export function retornoDocumento(valor:string){return retornoMovimiento(valor)??retornoInsumos(valor);}
export function enlaceDocumentoConRetorno(volver:string,id:string){return retornoInsumos(volver)?enlaceActaInsumos(id,volver):enlaceActaInventario(volver,id);}
