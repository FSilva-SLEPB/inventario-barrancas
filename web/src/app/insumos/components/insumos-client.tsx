"use client";
import {useMemo,useState} from "react";
import {guardarSolicitudInsumo} from "@/app/insumos/acciones";
import type {InsumoCatalogo,InsumoStock,SolicitudInsumo} from "@/lib/insumos";
import {avisarError,avisarExito,confirmarAccion} from "@/components/confirmacion";

export type InsumosClientProps={
 local:boolean;admin:boolean;puedeSolicitar:boolean;
 sedes:{id:string;nombre:string;rbd:string|null;direccion?:string|null;comuna?:string|null}[];
 catalogo:InsumoCatalogo[];stock:InsumoStock[];
 solicitudes:SolicitudInsumo[];total:number;pagina:number;paginas:number;limite:number;
 filtroEstado:string;filtroSede:string;q:string;
 detalle:SolicitudInsumo|null;guardado:boolean;
 actor:{email:string;sedeId:string|null;sedeNombre:string|null;sedeRbd:string|null};
};

type Producto={id:string;codigo:string;nombre:string;categoria:string;unidad:string;foto_url:string|null};
type ItemCarrito={id:string;n:number;p:Producto};

export default function InsumosClient(props:InsumosClientProps){
 const {sedes,catalogo,actor,local}=props;
 return <main>
  <SolicitudInsumos sedes={sedes} catalogo={catalogo} actor={actor} local={local}/>
 </main>;
}

function SolicitudInsumos({sedes,catalogo,actor,local}:{sedes:InsumosClientProps['sedes'];catalogo:InsumoCatalogo[];actor:InsumosClientProps['actor'];local:boolean}){
 const sedeInicial=useMemo(()=>{
  if(actor.sedeId){const s=sedes.find(x=>x.id===actor.sedeId); if(s) return s;}
  if(sedes.length===1) return sedes[0];
  return null;
 },[actor.sedeId,sedes]);
 const [sede,setSede]=useState(sedeInicial);
 const [editSede,setEditSede]=useState(!sedeInicial && !local);
 const [solicitante,setSolicitante]=useState({nombre:'',run:'',cargo:'',telefono:'',correo:actor.email||''});
 const [editSolicitante,setEditSolicitante]=useState(false);

 const [filtro,setFiltro]=useState('');
 const [modalProd,setModalProd]=useState<Producto|null>(null);
 const [cantidadModal,setCantidadModal]=useState('1');
 const [carrito,setCarrito]=useState<Record<string,number>>({});
 const [editCantId,setEditCantId]=useState<string|null>(null);
 const [editCantVal,setEditCantVal]=useState('1');
 const [enviando,setEnviando]=useState(false);

 const productos=useMemo(()=>catalogo.filter(c=>c.activo && c.foto_url).map(c=>({
  id:c.id,codigo:c.codigo,nombre:c.nombre,categoria:c.categoria||'',unidad:c.unidad||'',foto_url:c.foto_url
 }) as Producto),[catalogo]);
 const filtrados=useMemo(()=>{ const t=filtro.trim().toLowerCase(); if(!t) return productos;
  return productos.filter(p=>`${p.nombre} ${p.categoria} ${p.codigo} ${p.unidad}`.toLowerCase().includes(t));
 },[productos,filtro]);
 const items=useMemo(()=>Object.entries(carrito).flatMap(([id,n]):ItemCarrito[]=>{ if(n<=0) return []; const p=productos.find(x=>x.id===id); if(!p) return []; return [{id,n,p}]; }),[carrito,productos]);
 const totalItems=items.reduce((a,i)=>a+i.n,0);

 const abrirModal=(p:Producto)=>{ setModalProd(p); setCantidadModal(String(carrito[p.id]||1)); };
 const agregarDesdeModal=()=>{
  if(!modalProd) return;
  const cant=Math.max(1,Math.min(999,Math.floor(Number(cantidadModal)||1)));
  setCarrito(c=>({...c,[modalProd.id]:cant}));
  setModalProd(null);
 };
 const guardarEdicion=(id:string)=>{
  const cant=Math.max(1,Math.min(999,Math.floor(Number(editCantVal)||1)));
  setCarrito(c=>({...c,[id]:cant}));
  setEditCantId(null);
 };

 const enviar=async()=>{
  if(!sede?.id){await avisarError('Falta el establecimiento','No se pudo determinar el establecimiento.');return;}
  if(!items.length){await avisarError('Carrito vacío','Agrega al menos un insumo al carrito.');return;}
  const ok=await confirmarAccion('Enviar solicitud',`Se enviarán ${totalItems} ítem(s) para revisión. ¿Deseas continuar?`,'Sí, enviar');
  if(!ok) return;
  setEnviando(true);
  const form=new FormData();
  form.set('sede_id',sede.id);
  form.set('lineas',JSON.stringify(items.map(i=>({producto_id:i.id,cantidad:i.n}))));
  form.set('datos',JSON.stringify({nombre:solicitante.nombre,run:solicitante.run,cargo:solicitante.cargo,telefono:solicitante.telefono,modalidad:'',motivo:''}));
  try{
   const res=await guardarSolicitudInsumo({estado:'inicial',mensaje:'',revision:'',valores:{},errores:{}},form);
   if(res?.estado==='error'){await avisarError('No se pudo enviar',res.mensaje);setEnviando(false);return;}
  }catch(e:unknown){
   if(e && typeof e==='object' && 'digest' in e && String((e as {digest?:unknown}).digest).includes('NEXT_REDIRECT')){
    await avisarExito('Solicitud enviada','Tu solicitud fue enviada correctamente.');
    window.location.assign('/insumos'); return;
   }
   await avisarError('No se pudo enviar', e instanceof Error ? e.message : 'Error inesperado.');
   setEnviando(false); return;
  }
  await avisarExito('Solicitud enviada','Tu solicitud fue enviada correctamente.');
  window.location.assign('/insumos');
 };

 const labelCampo=(label:string,value:string)=>(
  <div className="campo-catalogos"><span className="dato-secundario" style={{display:'block',marginBottom:2}}>{label}</span><div style={{fontWeight:600}}>{value||'—'}</div></div>
 );

 return <section className="panel-catalogos" style={{display:'grid',gap:'1.25rem'}}>
  <header>
   <h1 style={{margin:'0 0 .25rem'}}>Solicitud de insumos</h1>
   <p className="descripcion-pagina" style={{margin:0}}>Revisa tus datos, selecciona los insumos y envía la solicitud.</p>
  </header>

  <div className="panel-catalogos" style={{display:'grid',gap:'.75rem',padding:'1rem'}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'.5rem'}}>
    <h2 style={{margin:0,fontSize:'1.05rem'}}>Establecimiento</h2>
    <button type="button" className="btn btn-outline-primary btn-sm" aria-label="Editar establecimiento" title="Editar establecimiento" onClick={()=>setEditSede(v=>!v)}>✎</button>
   </div>
   {editSede ? <div className="campo-catalogos" style={{maxWidth:420}}>
    <label htmlFor="sel-sede">Establecimiento / RBD</label>
    <select id="sel-sede" value={sede?.id||''} onChange={e=>{const s=sedes.find(x=>x.id===e.target.value)||null; setSede(s);}} disabled={local && !!actor.sedeId}>
     <option value="">Seleccione establecimiento...</option>
     {sedes.map(s=><option key={s.id} value={s.id}>{s.rbd?`${s.rbd} · `:''}{s.nombre}</option>)}
    </select>
   </div> : null}
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:'.75rem'}}>
    {labelCampo('Establecimiento',sede?.nombre||'')}
    {labelCampo('RBD',sede?.rbd||'')}
    {labelCampo('Comuna',sede?.comuna||'')}
    {labelCampo('Dirección',sede?.direccion||'')}
   </div>
  </div>

  <div className="panel-catalogos" style={{display:'grid',gap:'.75rem',padding:'1rem'}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'.5rem'}}>
    <h2 style={{margin:0,fontSize:'1.05rem'}}>Datos del solicitante</h2>
    <button type="button" className="btn btn-outline-primary btn-sm" aria-label="Editar datos del solicitante" title="Editar datos del solicitante" onClick={()=>setEditSolicitante(v=>!v)}>✎</button>
   </div>
   {editSolicitante ? <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:'.75rem'}}>
    <div className="campo-catalogos"><label htmlFor="sol-nombre">Nombre</label><input id="sol-nombre" value={solicitante.nombre} onChange={e=>setSolicitante(v=>({...v,nombre:e.target.value}))}/></div>
    <div className="campo-catalogos"><label htmlFor="sol-run">RUN</label><input id="sol-run" value={solicitante.run} onChange={e=>setSolicitante(v=>({...v,run:e.target.value}))}/></div>
    <div className="campo-catalogos"><label htmlFor="sol-cargo">Cargo</label><input id="sol-cargo" value={solicitante.cargo} onChange={e=>setSolicitante(v=>({...v,cargo:e.target.value}))}/></div>
    <div className="campo-catalogos"><label htmlFor="sol-tel">Teléfono</label><input id="sol-tel" value={solicitante.telefono} onChange={e=>setSolicitante(v=>({...v,telefono:e.target.value}))}/></div>
    <div className="campo-catalogos"><label htmlFor="sol-correo">Correo</label><input id="sol-correo" value={solicitante.correo} onChange={e=>setSolicitante(v=>({...v,correo:e.target.value}))}/></div>
   </div> : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:'.75rem'}}>
    {labelCampo('Nombre',solicitante.nombre)}
    {labelCampo('RUN',solicitante.run)}
    {labelCampo('Cargo',solicitante.cargo)}
    {labelCampo('Teléfono',solicitante.telefono)}
    {labelCampo('Correo',solicitante.correo)}
   </div>}
  </div>

  <div style={{display:'grid',gap:'.75rem'}}>
   <h2 style={{margin:0,fontSize:'1.05rem'}}>Catálogo</h2>
   <div className="campo-catalogos" style={{maxWidth:420}}>
    <label htmlFor="filtro-insumos">Mostrar insumos y características</label>
    <input id="filtro-insumos" placeholder="Buscar por nombre, categoría o características..." value={filtro} onChange={e=>setFiltro(e.target.value)}/>
   </div>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:'0.75rem'}}>
    {filtrados.map(p=>(
     <button key={p.id} type="button" onClick={()=>abrirModal(p)} title={`Ver ${p.nombre}`} style={{border:'1px solid var(--color-borde-suave)',borderRadius:16,background:'#fff',padding:'.6rem',textAlign:'left',cursor:'pointer',display:'grid',gap:'.4rem'}}>
      <img src={p.foto_url||''} alt={p.nombre} loading="lazy" style={{width:'100%',height:140,objectFit:'contain',borderRadius:12,background:'#fff'}}/>
      <div style={{fontWeight:700,fontSize:'.95rem',lineHeight:1.2}}>{p.nombre}</div>
      <div className="dato-secundario" style={{fontSize:'.85rem'}}>{p.categoria||'Sin categoría'}</div>
     </button>
    ))}
    {!filtrados.length&&<div className="dato-secundario" style={{gridColumn:'1/-1',padding:'1rem'}}>No hay insumos para mostrar.</div>}
   </div>
  </div>

  <div style={{display:'grid',gap:'.75rem'}}>
   <h2 style={{margin:0,fontSize:'1.05rem'}}>Carrito de solicitud</h2>
   <div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-catalogos">
    <thead><tr><th scope="col">Descripción</th><th scope="col" style={{textAlign:'center',width:140}}>Cantidad</th><th scope="col" style={{textAlign:'right',width:80}}>Editar</th></tr></thead>
    <tbody>
     {items.map(i=>(
      <tr key={i.id}>
       <td><div style={{fontWeight:600}}>{i.p.nombre}</div><div className="dato-secundario">{i.p.categoria||''}</div></td>
       <td style={{textAlign:'center'}}>
        {editCantId===i.id ? <span style={{display:'inline-flex',gap:4,alignItems:'center'}}><input type="number" min={1} max={999} value={editCantVal} onChange={e=>setEditCantVal(e.target.value)} style={{width:72}} aria-label={`Cantidad de ${i.p.nombre}`}/><button type="button" className="btn btn-primary btn-sm" onClick={()=>guardarEdicion(i.id)}>OK</button></span> : <strong>{i.n}</strong>}
       </td>
       <td style={{textAlign:'right'}}>
        <button type="button" className="btn btn-outline-primary btn-sm" aria-label={`Editar cantidad de ${i.p.nombre}`} title="Editar cantidad" onClick={()=>{setEditCantId(i.id);setEditCantVal(String(i.n));}}>✎</button>
       </td>
      </tr>
     ))}
     {!items.length&&<tr><td colSpan={3} className="text-center text-muted py-4">Aún no hay insumos en el carrito.</td></tr>}
    </tbody>
   </table></div>
   <div style={{display:'flex',justifyContent:'flex-end',gap:'.75rem',flexWrap:'wrap'}}>
    <button type="button" className="btn btn-primary" onClick={enviar} disabled={!items.length||enviando||!sede?.id}>{enviando?'Enviando…':'Enviar solicitud'}</button>
   </div>
  </div>

  {modalProd && <div role="dialog" aria-modal="true" aria-label={modalProd.nombre} onClick={()=>setModalProd(null)} style={{position:'fixed',inset:0,background:'rgba(15,23,42,.45)',display:'grid',placeItems:'center',padding:'1rem',zIndex:1000}}>
   <div onClick={e=>e.stopPropagation()} className="panel-catalogos" style={{width:'min(520px,100%)',background:'#fff',borderRadius:16,padding:'1rem',display:'grid',gap:'.75rem'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',gap:'.5rem'}}>
     <h3 style={{margin:0}}>{modalProd.nombre}</h3>
     <button type="button" className="btn btn-outline-primary btn-sm" onClick={()=>setModalProd(null)} aria-label="Cerrar">✕</button>
    </div>
    {modalProd.foto_url && <img src={modalProd.foto_url} alt={modalProd.nombre} style={{width:'100%',maxHeight:260,objectFit:'contain',borderRadius:12,background:'#fff'}}/>}
    <div className="dato-secundario">{modalProd.categoria||'Sin categoría'}</div>
    <div className="campo-catalogos"><label htmlFor="modal-cant">Cantidad</label><input id="modal-cant" type="number" min={1} max={999} value={cantidadModal} onChange={e=>setCantidadModal(e.target.value)}/></div>
    <div style={{display:'flex',justifyContent:'flex-end',gap:'.5rem'}}>
     <button type="button" className="btn btn-outline-primary" onClick={()=>setModalProd(null)}>Cancelar</button>
     <button type="button" className="btn btn-primary" onClick={agregarDesdeModal}>Agregar al carrito</button>
    </div>
   </div>
  </div>}
 </section>;
}
