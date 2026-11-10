"use client";
import {useActionState,useEffect,useRef,useState} from "react";
import type {InsumoCatalogo,InsumoStock} from "@/lib/insumos";
import {avisarError,avisarExito} from "@/components/confirmacion";
import {guardarProductoAccion,ingresarStockAccion,type EstadoProducto,type EstadoStock} from "./acciones";

export default function InsumosMantenedor({catalogo,stock}:{catalogo:InsumoCatalogo[];stock:InsumoStock[]}){
 const [subiendo,setSubiendo]=useState<string|null>(null);
 const [editando,setEditando]=useState<InsumoCatalogo|null>(null);
 const prodOkRef=useRef('');
 const stockRef=useRef('');

 const iniProd:EstadoProducto={estado:'inicial',mensaje:'',revision:'',valores:{codigo:'',nombre:'',categoria:'',unidad:'',activo:'true',id:''}};
 const [ep,ap,pp]=useActionState(guardarProductoAccion,iniProd);
 const iniStock:EstadoStock={estado:'inicial',mensaje:'',revision:''};
 const [es,as,ps]=useActionState(ingresarStockAccion,iniStock);

 useEffect(()=>{
  if(ep.estado==='ok' && ep.revision && ep.revision!==prodOkRef.current){ prodOkRef.current=ep.revision; setEditando(null); }
 },[ep.revision,ep.estado]);
 useEffect(()=>{
  if(!es.revision || es.revision===stockRef.current) return;
  stockRef.current=es.revision;
  if(es.estado==='ok') void avisarExito('Stock actualizado','El ingreso de stock se registró correctamente.');
  if(es.estado==='error') void avisarError('No se pudo ingresar stock',es.mensaje);
 },[es.revision,es.estado,es.mensaje]);

 const subirFoto=async(productoId:string,file:File)=>{
  setSubiendo(productoId);
  const fd=new FormData();fd.set('imagen',file);
  const r=await fetch('/api/insumos/imagen',{method:'POST',body:fd});
  const j=await r.json().catch(()=>({}));
  if(!r.ok){await avisarError('No se pudo subir',j.error||'Error al subir imagen.');setSubiendo(null);return;}
  const fd2=new FormData();fd2.set('producto_id',productoId);fd2.set('foto_url',j.url);
  const r2=await fetch('/api/insumos/producto',{method:'POST',body:fd2});
  if(!r2.ok){const j2=await r2.json().catch(()=>({})) as {error?:string}; await avisarError('No se pudo guardar',j2.error||'Error.');}
  else await avisarExito('Foto actualizada','Recarga la página para verla en el catálogo.');
  setSubiendo(null);
 };

 return <section style={{display:'grid',gap:'1rem'}}>
  <header>
   <h1 style={{margin:'0 0 .25rem'}}>Catálogo, stock e ingreso de productos</h1>
   <p className="descripcion-pagina" style={{margin:0}}>Administra el catálogo de insumos, registra nuevos productos y gestiona el stock disponible.</p>
  </header>

  <div className="panel-catalogos" style={{padding:'1rem',display:'grid',gap:'.75rem'}}>
   <h2 style={{margin:0,fontSize:'1.05rem'}}>{editando?'Editar producto':'Ingreso de producto'}</h2>
   <form action={ap} aria-busy={pp} style={{display:'grid',gap:'.75rem'}}>
    <input type="hidden" name="id" value={ep.valores?.id ?? (editando?.id||'')} />
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:'.75rem'}}>
     <div className="campo-catalogos"><label htmlFor="p-codigo">Código</label><input id="p-codigo" name="codigo" required defaultValue={ep.valores?.codigo || editando?.codigo || ''} key={`cod-${ep.revision}-${editando?.id||'n'}`}/></div>
     <div className="campo-catalogos"><label htmlFor="p-nombre">Nombre</label><input id="p-nombre" name="nombre" required defaultValue={ep.valores?.nombre || editando?.nombre || ''} key={`nom-${ep.revision}-${editando?.id||'n'}`}/></div>
     <div className="campo-catalogos"><label htmlFor="p-categoria">Categoría</label><input id="p-categoria" name="categoria" required defaultValue={ep.valores?.categoria || editando?.categoria || ''} key={`cat-${ep.revision}-${editando?.id||'n'}`}/></div>
     <div className="campo-catalogos"><label htmlFor="p-unidad">Unidad</label><input id="p-unidad" name="unidad" required defaultValue={ep.valores?.unidad || editando?.unidad || ''} key={`uni-${ep.revision}-${editando?.id||'n'}`} placeholder="unidad, caja, par…"/></div>
     <div className="campo-catalogos"><label htmlFor="p-activo">Estado</label><select id="p-activo" name="activo" defaultValue={ep.valores?.activo ?? String(editando?.activo ?? true)} key={`act-${ep.revision}-${editando?.id||'n'}`}><option value="true">Activo</option><option value="false">Inactivo</option></select></div>
    </div>
    <div style={{display:'flex',gap:'.5rem',flexWrap:'wrap',alignItems:'center'}}>
     <button className="btn btn-primary" type="submit" disabled={pp}>{pp?'Guardando…':(editando?'Guardar cambios':'Crear producto')}</button>
     {editando && <button type="button" className="btn btn-outline-primary" onClick={()=>setEditando(null)}>Cancelar edición</button>}
     {ep.estado==='error' && <span role="alert" className="error-catalogos">{ep.mensaje}</span>}
     {ep.estado==='ok' && <span role="status" className="ayuda-catalogos">{ep.mensaje}</span>}
    </div>
   </form>
  </div>

  <div className="panel-catalogos" style={{padding:'1rem',display:'grid',gap:'.75rem'}}>
   <h2 style={{margin:0,fontSize:'1.05rem'}}>Catálogo y stock</h2>
   <div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-catalogos"><caption className="visually-hidden">Catálogo de insumos</caption><thead><tr><th scope="col">Foto</th><th scope="col">Producto</th><th scope="col">Categoría</th><th scope="col">Stock / disp.</th><th scope="col">Ingresar stock</th><th scope="col">Acciones</th></tr></thead><tbody>{catalogo.map(c=>{const s=stock.find(x=>x.producto_id===c.id);return <tr key={c.id}>
    <td>{c.foto_url?<img src={c.foto_url} alt={c.nombre} style={{width:52,height:52,objectFit:'cover',borderRadius:14,border:'1px solid var(--color-borde-suave)'}}/>:<span className="dato-secundario">Sin foto</span>}</td>
    <td><div style={{fontWeight:600}}>{c.codigo} · {c.nombre}</div><div className="dato-secundario">{c.unidad||'—'} {c.activo?'· Activo':'· Inactivo'}</div></td>
    <td>{c.categoria||'—'}</td>
    <td>{s?.existencia??0} / {s?.disponible??0}</td>
    <td>
     <form action={as} style={{display:'flex',gap:4,alignItems:'center',flexWrap:'wrap'}}>
      <input type="hidden" name="producto_id" value={c.id}/>
      <input type="number" name="cantidad" min={1} max={100000} placeholder="+ cant." aria-label={`Cantidad a ingresar para ${c.nombre}`} style={{width:90}}/>
      <button type="submit" className="btn btn-outline-primary btn-sm" disabled={ps}>Ingresar</button>
     </form>
    </td>
    <td style={{whiteSpace:'nowrap'}}>
     <div style={{display:'grid',gap:4}}>
      <button type="button" className="btn btn-outline-primary btn-sm" onClick={()=>{setEditando(c); window.scrollTo({top:0,behavior:'smooth'});}}>Editar</button>
      <label className="btn btn-outline-primary btn-sm" style={{margin:0,cursor:'pointer'}}>
       {subiendo===c.id?'Subiendo…':'Foto'}
       <input type="file" accept="image/jpeg,image/png,image/webp" disabled={subiendo===c.id} style={{display:'none'}} aria-label={`Subir foto de ${c.nombre}`} onChange={e=>{const f=e.target.files?.[0]; if(f) subirFoto(c.id,f); e.target.value='';}}/>
      </label>
     </div>
    </td>
   </tr>;})}{!catalogo.length&&<tr><td colSpan={6}>No hay productos registrados.</td></tr>}</tbody></table></div>
   {es.estado==='error' && <p role="alert" className="error-catalogos">{es.mensaje}</p>}
  </div>
 </section>;
}
