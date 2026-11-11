"use client";
import ModalFicha from '@/components/modal-ficha';
import IconoAccion from '@/components/icono-accion';
import PanelFiltros from '@/components/panel-filtros';
import PanelResultados from '@/components/panel-resultados';
import {useMemo,useState} from "react";
import {guardarSolicitudInsumo} from "@/app/insumos/acciones";
import type {ParticipanteActual} from '@/lib/participante-actual';
import type {InsumoCatalogo} from "@/lib/insumos";
import {avisarError,confirmarAccion} from "@/components/confirmacion";

export type SolicitudFormProps={
 sedes:{id:string;nombre:string;rbd:string|null;direccion?:string|null;comuna?:string|null}[];
 catalogo:InsumoCatalogo[];
 actor:{email:string;sedeId:string|null;sedeNombre:string|null;sedeRbd:string|null};
 local:boolean;solicitudId:string;participante:ParticipanteActual;
};

type Producto={id:string;codigo:string;nombre:string;categoria:string;unidad:string;foto_url:string|null};
type ItemCarrito={id:string;n:number;p:Producto};

export default function SolicitudForm({sedes,catalogo,actor,local,solicitudId,participante}:SolicitudFormProps){
 const sedeInicial=useMemo(()=>{
  if(actor.sedeId){const s=sedes.find(x=>x.id===actor.sedeId); if(s) return s;}
  if(sedes.length===1) return sedes[0];
  return null;
 },[actor.sedeId,sedes]);
 const [sede,setSede]=useState(sedeInicial);
 const [editSede,setEditSede]=useState(!sedeInicial && !local);
 const [solicitante,setSolicitante]=useState(participante);
 const [editSolicitante,setEditSolicitante]=useState(false);

 const [filtroNombre,setFiltroNombre]=useState('');
 const [filtroCategoria,setFiltroCategoria]=useState('');
 const [categoriaBorrador,setCategoriaBorrador]=useState('');
 const [limite,setLimite]=useState(50),[pagina,setPagina]=useState(1);
 const [modalProd,setModalProd]=useState<Producto|null>(null);
 const [cantidadModal,setCantidadModal]=useState('1');
 const [carrito,setCarrito]=useState<Record<string,number>>({});
 const [editCantId,setEditCantId]=useState<string|null>(null);
 const [editCantVal,setEditCantVal]=useState('1');
 const [enviando,setEnviando]=useState(false);

 const productos=useMemo(()=>catalogo.filter(c=>c.activo).map(c=>({
  id:c.id,codigo:c.codigo,nombre:c.nombre,categoria:c.categoria||'',unidad:c.unidad||'',foto_url:c.foto_url||null
 }) as Producto),[catalogo]);
 const categorias=useMemo(()=>Array.from(new Set(productos.map(p=>p.categoria).filter(Boolean))).sort(),[productos]);
 const filtrados=useMemo(()=>productos.filter(p=>{
  const n=filtroNombre.trim().toLowerCase();
  if(n && !p.nombre.toLowerCase().includes(n) && !p.codigo.toLowerCase().includes(n)) return false;
  if(filtroCategoria && p.categoria!==filtroCategoria) return false;
  return true;
 }),[productos,filtroNombre,filtroCategoria]);
 const items=useMemo(()=>Object.entries(carrito).flatMap(([id,n]):ItemCarrito[]=>{ if(n<=0) return []; const p=productos.find(x=>x.id===id); if(!p) return []; return [{id,n,p}]; }),[carrito,productos]);
 const totalItems=items.reduce((a,i)=>a+i.n,0);

 const abrirModal=(p:Producto)=>{ setModalProd(p); setCantidadModal(String(carrito[p.id]||1)); };
 const agregarDesdeModal=()=>{
  if(!modalProd) return;
  const cant=Number(cantidadModal);if(!Number.isInteger(cant)||cant<1||cant>10000){void avisarError('Cantidad inválida','Indica una cantidad entera entre 1 y 10.000.');return;}
  setCarrito(c=>({...c,[modalProd.id]:cant}));
  setModalProd(null);
 };
 const guardarEdicion=(id:string)=>{
  const cant=Number(editCantVal);if(!Number.isInteger(cant)||cant<1||cant>10000){void avisarError('Cantidad inválida','Indica una cantidad entera entre 1 y 10.000.');return;}
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
  form.set('sede_id',sede.id);form.set('solicitud',solicitudId);
  form.set('lineas',JSON.stringify(items.map(i=>({producto_id:i.id,cantidad:i.n}))));
  form.set('datos',JSON.stringify({nombre:solicitante.nombre,run:solicitante.run,cargo:solicitante.cargo,telefono:solicitante.telefono,modalidad:'',motivo:''}));
  try{
   const res=await guardarSolicitudInsumo({estado:'inicial',mensaje:'',revision:'',valores:{},errores:{}},form);
   if(res.estado!=='guardado'||!res.valores.destino){await avisarError('No se pudo enviar',res.mensaje||'Revisa la solicitud.');setEnviando(false);return;}
   window.location.assign(res.valores.destino);
  }catch(e:unknown){
   if(e&&typeof e==='object'&&'digest' in e&&String(e.digest).includes('NEXT_REDIRECT'))return;
   await avisarError('No se pudo enviar',e instanceof Error?e.message:'Error de conexión. Conserva el carrito y vuelve a intentarlo.');setEnviando(false);
  }
 };

 const labelCampo=(label:string,value:string)=>(
  <div className="campo-catalogos"><span className="dato-secundario" style={{display:'block',marginBottom:4}}>{label}</span><div style={{fontWeight:600,background:'#fff',border:'1px solid var(--color-borde-suave)',borderRadius:10,padding:'.45rem .65rem'}}>{value||'—'}</div></div>
 );

 return <section style={{display:'grid',gap:'1.25rem'}}>
  <header>
   <h1>Solicitud de insumos</h1>
   <p className="descripcion-pagina">Completa los datos, selecciona insumos por separado y envía la solicitud.</p>
  </header>

  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:'1rem',alignItems:'stretch'}}>
   <div className="panel-catalogos" style={{display:'grid',gap:'.75rem',padding:'1rem',alignContent:'start',height:'100%'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'.5rem'}}>
     <h2 style={{margin:0,fontSize:'1.05rem'}}>Establecimiento</h2>
     <button type="button" className="btn btn-outline-primary btn-sm" aria-label="Editar establecimiento" title="Editar establecimiento" onClick={()=>setEditSede(v=>!v)}><IconoAccion tipo="editar"/></button>
    </div>
    {editSede ? <div className="campo-catalogos">
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

   <div className="panel-catalogos" style={{display:'grid',gap:'.75rem',padding:'1rem',alignContent:'start',height:'100%'}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'.5rem'}}>
     <h2 style={{margin:0,fontSize:'1.05rem'}}>Datos del solicitante</h2>
     <button type="button" className="btn btn-outline-primary btn-sm" aria-label="Editar datos del solicitante" title="Editar datos del solicitante" onClick={()=>setEditSolicitante(v=>!v)}><IconoAccion tipo="editar"/></button>
    </div>
    {editSolicitante ? <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:'.75rem'}}>
     <div className="campo-catalogos"><label htmlFor="sol-nombre">Nombre</label><input id="sol-nombre" value={solicitante.nombre} onChange={e=>setSolicitante(v=>({...v,nombre:e.target.value}))}/></div>
     <div className="campo-catalogos"><label htmlFor="sol-run">RUN</label><input id="sol-run" value={solicitante.run} onChange={e=>setSolicitante(v=>({...v,run:e.target.value}))}/></div>
     <div className="campo-catalogos"><label htmlFor="sol-cargo">Cargo</label><input id="sol-cargo" value={solicitante.cargo} onChange={e=>setSolicitante(v=>({...v,cargo:e.target.value}))}/></div>
     <div className="campo-catalogos"><label htmlFor="sol-tel">Teléfono</label><input id="sol-tel" value={solicitante.telefono} onChange={e=>setSolicitante(v=>({...v,telefono:e.target.value}))}/></div>
     <div className="campo-catalogos"><label htmlFor="sol-correo">Correo</label><input id="sol-correo" value={actor.email} readOnly/></div>
    </div> : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:'.75rem'}}>
     {labelCampo('Nombre',solicitante.nombre)}
     {labelCampo('RUN',solicitante.run)}
     {labelCampo('Cargo',solicitante.cargo)}
     {labelCampo('Teléfono',solicitante.telefono)}
     {labelCampo('Correo',solicitante.correo)}
    </div>}
   </div>
  </div>

  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))',gap:'1rem',alignItems:'stretch'}}>
   <div className="panel-catalogos" style={{display:'grid',gap:'.75rem',padding:'1rem',alignContent:'start',height:'100%',minWidth:0}}>
    <h2 style={{margin:0,fontSize:'1.05rem'}}>Catálogo</h2>
    <PanelFiltros ruta="/insumos/solicitud" titulo="Filtrar insumos" busqueda={{id:'solicitud-buscar',valor:filtroNombre,placeholder:'Buscar por producto o código'}} local={{buscar:valor=>{setFiltroNombre(valor);setFiltroCategoria(categoriaBorrador);setPagina(1);},limpiar:()=>{setFiltroNombre('');setFiltroCategoria('');setCategoriaBorrador('');setPagina(1);}}}><div className="filtro-inventario"><label htmlFor="filtro-categoria">Categoría</label><select id="filtro-categoria" value={categoriaBorrador} onChange={e=>setCategoriaBorrador(e.target.value)}><option value="">Todas las categorías</option>{categorias.map(c=><option key={c} value={c}>{c}</option>)}</select></div></PanelFiltros>
    <PanelResultados total={filtrados.length} descripcion="insumos" ruta="/insumos/solicitud" filtros={{}} limite={limite} pagina={pagina} paginas={Math.max(1,Math.ceil(filtrados.length/limite))} local={{id:'productos-por-pagina',cambiarPagina:setPagina,cambiarLimite:n=>{setLimite(n);setPagina(1);}}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:'0.75rem'}}>
     {filtrados.slice((pagina-1)*limite,pagina*limite).map(p=>(
      <button key={p.id} type="button" onClick={()=>abrirModal(p)} title={`Ver ${p.nombre}`} style={{border:'1px solid var(--color-borde-suave)',borderRadius:16,background:'#fff',padding:'.6rem',textAlign:'left',cursor:'pointer',display:'grid',gap:'.4rem'}}>
       {p.foto_url ? <img src={p.foto_url} alt={p.nombre} loading="lazy" style={{width:'100%',height:130,objectFit:'contain',borderRadius:12,background:'#fff'}}/> : <div aria-hidden="true" style={{width:'100%',height:130,borderRadius:12,border:'1px dashed var(--color-borde-suave)',background:'var(--color-superficie-suave)',display:'grid',placeItems:'center',color:'var(--color-parrafo)'}}>Sin foto</div>}
       <div style={{fontWeight:700,fontSize:'.95rem',lineHeight:1.2}}>{p.nombre}</div>
       <div className="dato-secundario" style={{fontSize:'.85rem'}}>{p.categoria||'Sin categoría'}</div>
      </button>
     ))}
     {!filtrados.length&&<div className="dato-secundario" style={{gridColumn:'1/-1',padding:'1rem'}}>No hay insumos para mostrar.</div>}
    </div>
    </PanelResultados>
   </div>

   <div className="panel-catalogos" style={{display:'grid',gap:'.75rem',padding:'1rem',alignContent:'start',height:'100%',minWidth:0}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'.5rem',flexWrap:'wrap'}}><h2 style={{margin:0,fontSize:'1.05rem'}}>Carrito de solicitud</h2><span className="badge bg-light text-dark border">{totalItems} ítem(s)</span></div>
    <div className="tabla-usuarios-contenedor" style={{minWidth:0,overflowX:'auto'}}><table className="tabla-datos tabla-catalogos" style={{width:'100%',tableLayout:'fixed',minWidth:0}}>
     <thead><tr><th scope="col">Descripción</th><th scope="col" style={{textAlign:'center',width:110}}>Cantidad</th><th scope="col" style={{textAlign:'right',width:70}}>Acciones</th></tr></thead>
     <tbody>
      {items.map(i=>(
       <tr key={i.id}>
        <td style={{whiteSpace:'normal',overflowWrap:'anywhere'}}><div style={{fontWeight:600}}>{i.p.nombre}</div><div className="dato-secundario">{i.p.categoria||''}</div></td>
        <td style={{textAlign:'center'}}>
         {editCantId===i.id ? <span style={{display:'inline-flex',gap:4,alignItems:'center',justifyContent:'center'}}><input type="number" min={1} max={10000} step={1} value={editCantVal} onChange={e=>setEditCantVal(e.target.value)} style={{width:64}} aria-label={`Cantidad de ${i.p.nombre}`}/><button type="button" className="btn btn-primary btn-sm" onClick={()=>guardarEdicion(i.id)}>OK</button></span> : <strong>{i.n}</strong>}
        </td>
        <td style={{textAlign:'right'}}>
         <button type="button" className="btn btn-outline-primary btn-sm" aria-label={`Editar cantidad de ${i.p.nombre}`} title="Editar cantidad" onClick={()=>{setEditCantId(i.id);setEditCantVal(String(i.n));}}><IconoAccion tipo="editar"/></button>
        </td>
       </tr>
      ))}
      {!items.length&&<tr><td colSpan={3} className="text-center text-muted py-4" style={{whiteSpace:'normal'}}>Aún no hay insumos en el carrito.</td></tr>}
     </tbody>
    </table></div>
    <div style={{display:'flex',justifyContent:'flex-end',gap:'.75rem',flexWrap:'wrap',marginTop:'auto'}}>
     <button type="button" className="btn btn-primary" onClick={enviar} disabled={!items.length||enviando||!sede?.id}>{enviando?'Enviando…':'Enviar solicitud'}</button>
    </div>
   </div>
  </div>

  {modalProd && <ModalFicha titulo={modalProd.nombre} alCerrar={()=>setModalProd(null)} editando>
   <div style={{display:'grid',gap:'.75rem'}}>
    {modalProd.foto_url ? <img src={modalProd.foto_url} alt={modalProd.nombre} style={{width:'100%',maxHeight:260,objectFit:'contain',borderRadius:12,background:'#fff'}}/> : <div aria-hidden="true" style={{width:'100%',height:200,borderRadius:12,border:'1px dashed var(--color-borde-suave)',background:'var(--color-superficie-suave)',display:'grid',placeItems:'center',color:'var(--color-parrafo)'}}>Sin foto</div>}
    <div className="dato-secundario">{modalProd.categoria||'Sin categoría'}</div>
    <div className="campo-catalogos" style={{maxWidth:160,margin:'0 auto',textAlign:'center'}}><label htmlFor="modal-cant">Cantidad</label><input id="modal-cant" type="number" min={1} max={10000} step={1} value={cantidadModal} onChange={e=>setCantidadModal(e.target.value)} style={{width:120,margin:'0 auto',textAlign:'center'}}/></div>
    <div style={{display:'flex',justifyContent:'flex-end',gap:'.5rem'}}>
     <button type="button" className="btn btn-outline-primary" onClick={()=>setModalProd(null)}>Cancelar</button>
     <button type="button" className="btn btn-primary" onClick={agregarDesdeModal}>Agregar al carrito</button>
    </div>
   </div>
  </ModalFicha>}
 </section>;
}
