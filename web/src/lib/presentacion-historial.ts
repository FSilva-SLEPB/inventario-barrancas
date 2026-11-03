import {CUSTODIAS} from '@/lib/validacion-movimientos-inventario';
import { CAMPOS_COMPRA, CONDICIONES, ORIGENES, SITUACIONES } from "@/lib/validacion-equipos";
const etiquetas:Record<string,string>={custodia:'Estado',sedeNombre:'Sede',marca:'Marca',modelo:'Modelo',serie:'Número de serie',numero_inventario:'Número de inventario',motivo_identificacion:'Dato de identificación pendiente',categoria_id:'Categoría',condicion_tecnica:'Estado de funcionamiento',observaciones:'Observaciones',situacion:'Situación de entrega',fecha_entrega:'Fecha de entrega',enlace_acta:'Acta existente',origen:'Origen'};
const valor=(v:unknown)=>v===null||v===undefined||v===''?'Sin informar':String(v);
export type CambioHistorial={campo:string;antes:string;despues:string};
export function cambiosHistorial(antes:Record<string,unknown>|null,despues:Record<string,unknown>,categorias:{id:string;nombre:string}[]):CambioHistorial[]{
  const representar=(k:string,v:unknown)=>{
    if(k==='categoria_id')return categorias.find(c=>c.id===v)?.nombre??valor(v);
    if(k==='condicion_tecnica')return CONDICIONES[v as keyof typeof CONDICIONES]??valor(v);
    if(k==='custodia')return CUSTODIAS[v as keyof typeof CUSTODIAS]??valor(v);
    if(k==='situacion')return SITUACIONES[v as keyof typeof SITUACIONES]??valor(v);
    if(k==='origen')return ORIGENES[v as keyof typeof ORIGENES]??valor(v);
    return valor(v);
  };
  const cambios:CambioHistorial[]=[];
  for(const[k,label]of Object.entries(etiquetas)){
    const a=antes?.[k],d=despues[k];
    if(antes?JSON.stringify(a)===JSON.stringify(d):d===null||d===undefined||d==='')continue;
    cambios.push({campo:label,antes:representar(k,a),despues:representar(k,d)});
  }
  const compraAntes=antes?.datos_compra as Record<string,unknown>|undefined,compraDespues=despues.datos_compra as Record<string,unknown>|undefined;
  for(const[k,label]of Object.entries(CAMPOS_COMPRA)){
    const a=compraAntes?.[k],d=compraDespues?.[k];if(antes?JSON.stringify(a)===JSON.stringify(d):!d)continue;
    cambios.push({campo:label,antes:valor(a),despues:valor(d)});
  }
  return cambios;
}
