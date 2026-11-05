import {esIdSede} from '@/lib/validacion-sedes';
export const RUTAS_INVENTARIO=['/inventario/nivel-central','/inventario/p02','/inventario/bodega-ti'] as const;
// Solo filtros de consulta conocidos. Nunca se permite una redirección externa.
export function retornoInventario(valor:unknown):string|null {
 if(typeof valor!=='string'||valor.length>2000||/[\p{Cc}\\]/u.test(valor))return null;
 try{
  const u=new URL(valor,'http://inventario.local');
  if(u.origin!=='http://inventario.local'||!RUTAS_INVENTARIO.some(r=>r===u.pathname)||!valor.startsWith('/inventario/')||u.hash)return null;
  const salida=new URLSearchParams();
  const limites:Record<string,number>={vista:20,q:150,pagina:7,tipo:30,clase:10,claseBien:10,sede:36,rbd:120,limite:3};
  for(const [k,max] of Object.entries(limites)){
   const entradas=u.searchParams.getAll(k);if(entradas.length>1)return null;
   const v=entradas[0];if(v===undefined)continue;if(v.length>max||/\p{Cc}/u.test(v))return null;
   if(k==='vista'&&!['inventario','pendientes'].includes(v))return null;
   if(k==='tipo'&&(!['','nivel_central','establecimiento','jardin_infantil'].includes(v)||(v==='nivel_central'&&u.pathname!=='/inventario/bodega-ti')))return null;
   if(['clase','claseBien'].includes(k)&&!['','equipo','celular'].includes(v))return null;
   if(k==='sede'&&v&&!esIdSede(v))return null;
   if(k==='pagina'&&!/^[1-9]\d{0,6}$/.test(v))return null;
   if(k==='limite'&&!['50','100','150'].includes(v))return null;
   salida.set(k,v);
  }
  if([...u.searchParams.keys()].some(k=>!Object.hasOwn(limites,k)))return null;
  return u.pathname+(salida.size?'?'+salida:'');
 }catch{return null;}
}
export function enlaceFichaInventario(volver:string,accion:'ver'|'editar',id:string){
 const base=retornoInventario(volver);if(!base||!esIdSede(id))throw new Error('Ficha de inventario inválida.');
 const u=new URL(base,'http://inventario.local');u.searchParams.set(accion,id);return u.pathname+u.search;
}
export function equipoEnVista(e:{sedeTipo:string;situacion:string;custodia?:string},ambito:'nc'|'eeji',vista:string){
 return e.custodia!=='en_prestamo'&&(ambito==='nc'?e.sedeTipo==='nivel_central':['establecimiento','jardin_infantil'].includes(e.sedeTipo))&&((vista==='pendientes')===(e.custodia?e.custodia==='en_bodega':e.situacion==='pendiente_entrega'));
}
