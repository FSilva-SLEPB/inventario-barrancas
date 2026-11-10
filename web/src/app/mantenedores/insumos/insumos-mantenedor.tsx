"use client";
import {useState} from "react";
import type {InsumoCatalogo,InsumoStock} from "@/lib/insumos";
import {avisarError,avisarExito} from "@/components/confirmacion";

export default function InsumosMantenedor({catalogo,stock}:{catalogo:InsumoCatalogo[];stock:InsumoStock[]}){
 const [subiendo,setSubiendo]=useState<string|null>(null);
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
 return <section className="panel-catalogos">
  <header style={{marginBottom:'1rem'}}>
   <h1 style={{margin:'0 0 .25rem'}}>Catálogo, stock e ingreso de productos</h1>
   <p className="descripcion-pagina" style={{margin:0}}>Administra el catálogo de insumos, revisa stock disponible y gestiona fotos/ingreso de productos.</p>
  </header>
  <div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-catalogos"><caption className="visually-hidden">Catálogo de insumos</caption><thead><tr><th scope="col">Foto</th><th scope="col">Producto</th><th scope="col">Categoría</th><th scope="col">Stock / disponible</th><th scope="col">Subir imagen</th></tr></thead><tbody>{catalogo.map(c=>{const s=stock.find(x=>x.producto_id===c.id);return <tr key={c.id}><td>{c.foto_url?<img src={c.foto_url} alt={c.nombre} style={{width:52,height:52,objectFit:'cover',borderRadius:14,border:'1px solid var(--color-borde-suave)'}}/>:<span className="dato-secundario">Sin foto</span>}</td><td><div style={{fontWeight:600}}>{c.codigo} · {c.nombre}</div><div className="dato-secundario">{c.unidad||'—'} {c.activo?'· Activo':'· Inactivo'}</div></td><td>{c.categoria||'—'}</td><td>{s?.existencia??0} / {s?.disponible??0}</td><td><input type="file" accept="image/jpeg,image/png,image/webp" disabled={subiendo===c.id} aria-label={`Subir foto de ${c.nombre}`} onChange={e=>{const f=e.target.files?.[0]; if(f) subirFoto(c.id,f);}}/></td></tr>;})}{!catalogo.length&&<tr><td colSpan={5}>No hay productos registrados.</td></tr>}</tbody></table></div>
 </section>;
}
