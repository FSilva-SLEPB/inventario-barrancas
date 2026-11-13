const rutas=['/insumos/seguimiento','/insumos/historial','/gestor-insumos/solicitudes','/gestor-insumos/pendientes','/gestor-insumos/entregadas'];
const limites:Record<string,number>={q:150,estado:30,sede:36,limite:3,pagina:7,producto:36,categoria:120,tipo:30,desde:10,hasta:10,base:20,bandeja:20};
/** Conserva filtros de un listado local, sin aceptar URLs externas ni parámetros de acciones. */
export function retornoInsumos(valor:string):string|null{
 if(!(valor.startsWith('/insumos/')||valor.startsWith('/gestor-insumos/'))||valor.length>2000||/[\p{Cc}\\]/u.test(valor))return null;
 try{const u=new URL(valor,'http://insumos.local');if(u.origin!=='http://insumos.local'||u.hash||!rutas.includes(u.pathname))return null;
 const p=new URLSearchParams();for(const k of u.searchParams.keys()){if(!Object.hasOwn(limites,k)||u.searchParams.getAll(k).length!==1)return null;const v=u.searchParams.get(k)!;if(v.length>limites[k])return null;p.set(k,v);}
 return u.pathname+(p.size?'?'+p:'');}catch{return null;}
}
export function destinoSolicitudInsumo(valor:unknown,id:string,fallback='/insumos/seguimiento'){
 const base=typeof valor==='string'?retornoInsumos(valor):null;const u=new URL(base??fallback,'http://insumos.local');u.searchParams.set('ver',id);return u.pathname+u.search;
}
export function enlaceActaInsumos(id:string,volver:string){
 const retorno=retornoInsumos(volver);if(!retorno)throw new Error('Regreso a insumos inválido.');return '/inventario/actas/'+encodeURIComponent(id)+'?'+new URLSearchParams({volver:retorno});
}
