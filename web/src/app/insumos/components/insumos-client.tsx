"use client";
import Link from "next/link";
import {useActionState,useMemo,useState,type CSSProperties} from "react";
import {aprobarSolicitudInsumoAccion,entregarSolicitudInsumoAccion,cancelarSolicitudInsumoAccion,guardarSolicitudInsumo,validarSolicitudInsumoAccion,type EstadoSolicitud} from "@/app/insumos/acciones";
import {ESTADOS_SOLICITUD_INSUMO} from "@/lib/validacion-insumos";
import type {SolicitudInsumo,InsumoStock,InsumoCatalogo} from "@/lib/insumos";
import {avisarError,avisarExito,confirmarAccion} from "@/components/confirmacion";
import PanelFiltros from "@/components/panel-filtros";
import PanelResultados from "@/components/panel-resultados";
import AccionesRegistro from "@/components/acciones-registro";
import EnlaceAccion from "@/components/enlace-accion";

export type InsumosClientProps={local:boolean;admin:boolean;puedeSolicitar:boolean;sedes:{id:string;nombre:string;rbd:string|null}[];catalogo:InsumoCatalogo[];stock:InsumoStock[];solicitudes:SolicitudInsumo[];total:number;pagina:number;paginas:number;limite:number;filtroEstado:string;filtroSede:string;q:string;detalle:SolicitudInsumo|null;guardado:boolean;};

export default function InsumosClient(props:InsumosClientProps){
 const {local,admin,puedeSolicitar,sedes,catalogo,stock,solicitudes,total,pagina,paginas,limite,filtroEstado,filtroSede,q,detalle,guardado}=props;
 const filtros={q,estado:filtroEstado,sede:filtroSede};
 const base=new URLSearchParams({q,estado:filtroEstado,sede:filtroSede,limite:String(limite),pagina:String(pagina)});
 const verHref=(id:string)=>'/insumos?'+new URLSearchParams({...Object.fromEntries(base),'ver':id}).toString();
 return <main>
  <header>
   <h1>Solicitudes de insumos</h1>
   <p className="descripcion-pagina">Selecciona los insumos requeridos, agrégalos al carrito y envía la solicitud para revisión. Flujo: solicitud → validación TI → aprobación/reserva → contra entrega con acta.</p>
   <p><Link className="btn btn-outline-primary btn-sm" href="/">Volver al inicio</Link></p>
  </header>
  {puedeSolicitar&&<CarritoCompras sedes={sedes} catalogo={catalogo} stock={stock} local={local}/>}
  {admin&&<GestionCatalogo catalogo={catalogo} stock={stock}/>}
  <PanelFiltros ruta="/insumos" titulo={local?'Filtrar mis solicitudes':'Filtrar solicitudes'} busqueda={{valor:q,placeholder:'Buscar por sede o solicitante'}} ocultos={{limite}}>
   <div className="filtro-inventario"><label htmlFor="filtro-estado">Estado</label><select id="filtro-estado" name="estado" defaultValue={filtroEstado}><option value="">Todos</option>{Object.entries(ESTADOS_SOLICITUD_INSUMO).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
   <div className="filtro-inventario"><label htmlFor="filtro-sede">Sede</label><select id="filtro-sede" name="sede" defaultValue={filtroSede}><option value="">Todas</option>{sedes.map(s=><option key={s.id} value={s.id}>{s.nombre}{s.rbd&&' ('+s.rbd+')'}</option>)}</select></div>
  </PanelFiltros>
  <PanelResultados total={total} descripcion={local?'solicitudes registradas':'solicitudes registradas'} ruta="/insumos" limite={limite} filtros={filtros} pagina={pagina} paginas={paginas}>
   <div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-catalogos"><caption className="visually-hidden">Solicitudes de insumos ({total})</caption><thead><tr><th scope="col">Sede</th><th scope="col">Solicitante</th><th scope="col">Estado</th><th scope="col">Fecha</th><th scope="col">Ítems</th><th scope="col">Acciones</th></tr></thead><tbody>{solicitudes.map((s)=>{
    const nombre=`solicitud ${s.sede_nombre}`;
    const solicitante=(s.solicitante_nombre||s.solicitante_correo||'').trim();
    return <tr key={s.id}><td>{s.sede_nombre}{s.sede_rbd&&` (${s.sede_rbd})`}</td><td>{solicitante}{s.solicitante_nombre&&s.solicitante_correo?` · ${s.solicitante_correo}`:''}</td><td><span className={'estado-solicitud estado-'+s.estado}>{ESTADOS_SOLICITUD_INSUMO[s.estado]||s.estado}</span></td><td>{new Date(s.solicitado_en).toLocaleDateString('es-CL')}</td><td>{s.lineas.length}</td><td><AccionesRegistro id={s.id} nombre={nombre} verTexto="Ver solicitud" verHref={verHref(s.id)}>{admin&&s.estado==='solicitada'&&<Link className="btn btn-primary btn-sm" href={verHref(s.id)+'&paso=validar'}>Validar</Link>}{admin&&s.estado==='en_validacion'&&<Link className="btn btn-primary btn-sm" href={verHref(s.id)+'&paso=aprobar'}>Aprobar</Link>}{admin&&s.estado==='aprobada'&&<Link className="btn btn-primary btn-sm" href={verHref(s.id)+'&paso=entregar'}>Contra entrega</Link>}{s.acta_id&&<EnlaceAccion href={'/inventario/actas/'+s.acta_id} etiqueta={'Ver acta: '+nombre} icono="acta"/>}</AccionesRegistro></td></tr>;
   })}{!solicitudes.length&&<tr><td colSpan={6}>No hay solicitudes para estos filtros.</td></tr>}</tbody></table></div>
  </PanelResultados>
  {detalle&&<DetalleSolicitud solicitud={detalle} stock={stock} admin={admin} guardado={guardado}/>}
 </main>;
}

function Foto({url,nombre,grande=false,className='' }:{url?:string|null;nombre:string;grande?:boolean;className?:string}){
 const size=grande?220:54;
 if(!url) return <div aria-hidden="true" className={className} style={{width:'100%',height:size,borderRadius:16,border:'1px dashed var(--color-borde-suave)',background:'var(--color-superficie-suave)',display:'grid',placeItems:'center',color:'var(--color-parrafo)',fontSize:grande?28:18}}>Sin foto</div>;
 return <img src={url} alt={nombre} loading="lazy" className={className} style={{width:'100%',height:size,objectFit:'contain',borderRadius:16,border:'1px solid var(--color-borde-suave)',background:'#fff',padding:grande?10:4}}/>;
}
function FotoMini({url,nombre}:{url?:string|null;nombre:string}){
 if(!url) return <div aria-hidden="true" style={{width:52,height:52,borderRadius:14,border:'1px dashed var(--color-borde-suave)',background:'var(--color-superficie-suave)',display:'grid',placeItems:'center',color:'var(--color-parrafo)'}}>▢</div>;
 return <img src={url} alt={nombre} loading="lazy" style={{width:52,height:52,objectFit:'cover',borderRadius:14,border:'1px solid var(--color-borde-suave)',background:'#fff'}}/>;
}

type Producto={id:string;codigo:string;nombre:string;categoria:string;unidad:string;activo:boolean;foto_url:string|null;disponible:number};

function CarritoCompras({sedes,catalogo,stock,local}:{sedes:{id:string;nombre:string;rbd:string|null}[];catalogo:InsumoCatalogo[];stock:InsumoStock[];local:boolean}){
 const [sedeId,setSedeId]=useState(sedes.length===1?sedes[0].id:'');
 const [busqueda,setBusqueda]=useState('');
 const [categoria,setCategoria]=useState('');
 const [seleccionado,setSeleccionado]=useState<string>('');
 const [cantidad,setCantidad]=useState('1');
 const [carrito,setCarrito]=useState<Record<string,number>>({});
 const [solicitante,setSolicitante]=useState({nombre:'',run:'',cargo:'',telefono:'',modalidad:'',motivo:''});

 const sedeSel=sedes.find(s=>s.id===sedeId);
 const productos=useMemo(()=>catalogo.filter(c=>c.activo).map(c=>{const s=stock.find(x=>x.producto_id===c.id);return {...c,disponible:s?.disponible??0} as Producto;}),[catalogo,stock]);
 const categorias=useMemo(()=>Array.from(new Set(productos.map(p=>p.categoria).filter(Boolean))).sort(),[productos]);
 const filtrados=useMemo(()=>productos.filter(p=>{
  const t=`${p.codigo} ${p.nombre} ${p.categoria}`.toLowerCase();
  if(busqueda && !t.includes(busqueda.toLowerCase())) return false;
  if(categoria && p.categoria!==categoria) return false;
  return true;
 }),[productos,busqueda,categoria]);
 const prodSel=productos.find(p=>p.id===seleccionado)||null;
 const items=useMemo(()=>Object.entries(carrito).filter(([,n])=>n>0).map(([id,n])=>{const p=productos.find(x=>x.id===id);return {id,n,p};}).filter(i=>i.p),[carrito,productos]) as {id:string;n:number;p:Producto}[];
 const totalItems=items.reduce((a,i)=>a+i.n,0);

 const agregar=()=>{
  if(!prodSel) return;
  const cant=Math.max(1,Math.min(999,Math.floor(Number(cantidad)||1)));
  setCarrito(c=>({...c,[prodSel.id]:Math.min(999,(c[prodSel.id]||0)+cant)}));
  setCantidad('1');
 };
 const quitar=(id:string)=>setCarrito(c=>{const n={...c}; delete n[id]; return n;});

 const enviar=async()=>{
  if(!sedeId){await avisarError('Falta el establecimiento','Selecciona el establecimiento/RBD para la solicitud.');return;}
  if(!items.length){await avisarError('Carrito vacío','Agrega al menos un insumo al carrito.');return;}
  const ok=await confirmarAccion('Enviar solicitud',`Se enviarán ${totalItems} ítem(s) para revisión. ¿Continuar?`,'Enviar solicitud');
  if(!ok) return;
  const form=new FormData();
  form.set('sede_id',sedeId);
  form.set('lineas',JSON.stringify(items.map(i=>({producto_id:i.id,cantidad:i.n}))));
  form.set('datos',JSON.stringify({nombre:solicitante.nombre,run:solicitante.run,cargo:solicitante.cargo,telefono:solicitante.telefono,modalidad:solicitante.modalidad,motivo:solicitante.motivo}));
  try{
   const res=await guardarSolicitudInsumo({estado:'inicial',mensaje:'',revision:'',valores:{},errores:{}},form);
   if(res?.estado==='error'){await avisarError('No se pudo enviar',res.mensaje);return;}
  }catch(e:unknown){
   if(e && typeof e==='object' && 'digest' in e && String((e as {digest?:unknown}).digest).includes('NEXT_REDIRECT')){ await avisarExito('Solicitud registrada','Tu solicitud fue enviada correctamente.'); location.assign('/insumos'); return; }
   await avisarError('No se pudo enviar', e instanceof Error ? e.message : 'Error inesperado.');
   return;
  }
  await avisarExito('Solicitud registrada','Tu solicitud fue enviada correctamente.');
  location.assign('/insumos');
 };

 const cardStyle:CSSProperties={border:'1px solid var(--color-borde-suave)',borderRadius:16,background:'#fff',padding:'0.75rem',textAlign:'left',cursor:'pointer',boxShadow:'0 8px 18px rgba(15,23,42,.05)',display:'grid',gap:'0.4rem',width:'100%'};

 return <section className="panel-catalogos" style={{display:'grid',gap:'1.25rem'}}>
  <div>
   <div className="section-badge mb-2">Solicitud de establecimiento</div>
   <h2 style={{margin:'0 0 .25rem'}}>Nueva solicitud de insumos</h2>
   <p className="descripcion-pagina" style={{margin:0}}>Selecciona los insumos requeridos, agrégalos al carrito y envía la solicitud para revisión.</p>
  </div>

  <div style={{display:'grid',gap:'1rem'}}>
   <h3 style={{margin:0}}>Establecimiento</h3>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:'0.75rem',alignItems:'end'}}>
    <div className="campo-catalogos"><label htmlFor="sol-rbd">Establecimiento / RBD</label>
     <select id="sol-rbd" value={sedeId} onChange={e=>setSedeId(e.target.value)} disabled={local && sedes.length===1}>
      <option value="">Seleccione establecimiento...</option>
      {sedes.map(s=><option key={s.id} value={s.id}>{s.rbd||'SIN RBD'} · {s.nombre}</option>)}
     </select>
     <p className="ayuda-catalogos" style={{margin:'.25rem 0 0'}}>{local?'Establecimiento asociado a tu cuenta.':'Selecciona el establecimiento para el cual registrarás la solicitud.'}</p>
    </div>
    <div className="campo-catalogos"><label>RBD</label><input readOnly value={sedeSel?.rbd||''} placeholder="—"/></div>
   </div>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:'0.75rem'}}>
    <div className="panel-catalogos" style={{padding:'0.75rem'}}><div className="dato-secundario">Establecimiento</div><div style={{fontWeight:700}}>{sedeSel?.nombre||'—'}</div></div>
    <div className="panel-catalogos" style={{padding:'0.75rem'}}><div className="dato-secundario">Comuna</div><div style={{fontWeight:700}}>—</div></div>
    <div className="panel-catalogos" style={{padding:'0.75rem'}}><div className="dato-secundario">Dirección</div><div style={{fontWeight:700}}>—</div></div>
   </div>
  </div>

  <div style={{display:'grid',gap:'1rem'}}>
   <h3 style={{margin:0}}>Datos del solicitante</h3>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:'0.75rem'}}>
    <div className="campo-catalogos"><label htmlFor="sol-nombre">Nombre solicitante</label><input id="sol-nombre" placeholder="Ej: Juan Pérez" value={solicitante.nombre} onChange={e=>setSolicitante(v=>({...v,nombre:e.target.value}))}/></div>
    <div className="campo-catalogos"><label htmlFor="sol-run">RUN solicitante</label><input id="sol-run" placeholder="Ej: 12345678-9" value={solicitante.run} onChange={e=>setSolicitante(v=>({...v,run:e.target.value}))}/><p className="ayuda-catalogos" style={{margin:'.25rem 0 0'}}>Se usará para precargar los datos de recepción en la entrega.</p></div>
    <div className="campo-catalogos"><label htmlFor="sol-cargo">Cargo</label><input id="sol-cargo" placeholder="Ej: Encargado de infraestructura" value={solicitante.cargo} onChange={e=>setSolicitante(v=>({...v,cargo:e.target.value}))}/></div>
    <div className="campo-catalogos"><label htmlFor="sol-telefono">Teléfono de contacto</label><input id="sol-telefono" placeholder="Ej: +56912345678" value={solicitante.telefono} onChange={e=>setSolicitante(v=>({...v,telefono:e.target.value}))}/><p className="ayuda-catalogos" style={{margin:'.25rem 0 0'}}>Se usará para coordinar retiro o despacho de materiales.</p></div>
   </div>
   <div className="campo-catalogos"><label htmlFor="sol-modalidad">Modalidad de entrega</label><select id="sol-modalidad" value={solicitante.modalidad} onChange={e=>setSolicitante(v=>({...v,modalidad:e.target.value}))}><option value="">Seleccione modalidad...</option><option value="RETIRO_SERVICIO">Retiro en el servicio (previa coordinación)</option><option value="DESPACHO">Despacho al establecimiento</option></select><p className="ayuda-catalogos" style={{margin:'.25rem 0 0'}}>Indica si el establecimiento retirará los materiales o requiere coordinación de despacho.</p></div>
   <div className="campo-catalogos"><label htmlFor="sol-motivo">Motivo de la solicitud</label><textarea id="sol-motivo" rows={3} placeholder="Ingrese motivo de solicitud de materiales" value={solicitante.motivo} onChange={e=>setSolicitante(v=>({...v,motivo:e.target.value}))}/></div>
  </div>

  <div style={{display:'grid',gap:'1rem'}}>
   <div style={{display:'flex',justifyContent:'space-between',gap:'1rem',flexWrap:'wrap',alignItems:'center'}}>
    <div><h3 style={{margin:0}}>Catálogo de Materiales</h3><p className="descripcion-pagina" style={{margin:'.25rem 0 0'}}>Busca el insumo, revisa su foto referencial y selecciona la cantidad para agregarlo al carrito.</p></div>
    <span className="badge bg-light text-dark border">{filtrados.length} producto(s)</span>
   </div>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:'0.75rem',alignItems:'end'}}>
    <div className="campo-catalogos"><label htmlFor="sol-buscar">Buscar producto</label><input id="sol-buscar" placeholder="Buscar por nombre o categoría..." value={busqueda} onChange={e=>setBusqueda(e.target.value)}/></div>
    <div className="campo-catalogos"><label htmlFor="sol-categoria">Categoría</label><select id="sol-categoria" value={categoria} onChange={e=>setCategoria(e.target.value)}><option value="">Todas las categorías</option>{categorias.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
    <div><button type="button" className="btn btn-outline-primary" onClick={()=>{setBusqueda('');setCategoria('');}}>Limpiar</button></div>
   </div>

   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:'1rem',alignItems:'start'}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(170px,1fr))',gap:'0.75rem',maxHeight:520,overflow:'auto',paddingRight:4}}>
     {filtrados.map(p=>{const active=seleccionado===p.id; return <button key={p.id} type="button" onClick={()=>setSeleccionado(p.id)} style={{...cardStyle,borderColor:active?'var(--color-primario)':'var(--color-borde-suave)',boxShadow:active?'0 0 0 3px rgba(15,105,180,.16), 0 12px 24px rgba(15,105,180,.14)':cardStyle.boxShadow}}>
      <Foto url={p.foto_url} nombre={p.nombre}/>
      <div style={{fontWeight:700,fontSize:'.95rem',lineHeight:1.2}}>{p.nombre}</div>
      <div style={{display:'flex',gap:'.35rem',flexWrap:'wrap'}}>
       <span className="badge rounded-pill" style={{background:'var(--color-seleccion)',color:'var(--color-primario)'}}>{p.categoria||'Sin categoría'}</span>
       <span className="badge rounded-pill" style={{background:'var(--color-seleccion)',color:'var(--color-primario)'}}>{p.unidad||'Sin unidad'}</span>
      </div>
      <div className="dato-secundario" style={{fontSize:'.85rem'}}>Disponible: {p.disponible}</div>
     </button>;})}
     {!filtrados.length&&<div className="dato-secundario" style={{gridColumn:'1/-1',padding:'1rem'}}>No hay productos para mostrar con los filtros aplicados.</div>}
    </div>

    <div className="panel-catalogos" style={{padding:'1rem',minHeight:420,display:'grid',gap:'0.75rem',alignContent:prodSel?'start':'center'}}>
     {!prodSel ? <div style={{textAlign:'center',color:'var(--color-parrafo)',border:'1px dashed var(--color-borde-suave)',borderRadius:16,padding:'2rem 1rem',background:'var(--color-superficie-suave)'}}>
      <div style={{fontSize:28,marginBottom:8}}>☝</div>
      <div style={{fontWeight:700,marginBottom:4}}>Selecciona un producto</div>
      <div>Haz clic sobre una tarjeta del catálogo para ver la foto y datos principales antes de agregarlo al carrito.</div>
     </div> : <>
      <Foto url={prodSel.foto_url} nombre={prodSel.nombre} grande/>
      <div>
       <div style={{fontSize:'1.1rem',fontWeight:700}}>{prodSel.nombre}</div>
       <div className="dato-secundario">{prodSel.categoria||'Sin categoría'} · Unidad: {prodSel.unidad||'—'} · Disponible: {prodSel.disponible}</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1.2fr',gap:'0.75rem',alignItems:'end'}}>
       <div className="campo-catalogos"><label htmlFor="sol-cantidad">Cantidad</label><input id="sol-cantidad" type="number" min={1} max={999} value={cantidad} onChange={e=>setCantidad(e.target.value)}/></div>
       <button type="button" className="btn btn-primary" onClick={agregar} disabled={prodSel.disponible<=0}>{prodSel.disponible<=0?'Sin stock':'Agregar al carrito'}</button>
      </div>
     </>}
    </div>
   </div>
  </div>

  <div style={{display:'grid',gap:'0.75rem'}}>
   <div style={{display:'flex',justifyContent:'space-between',gap:'1rem',alignItems:'center',flexWrap:'wrap'}}>
    <h3 style={{margin:0}}>Carrito de solicitud</h3>
    <span className="badge bg-light text-dark border">{totalItems} ítem(s)</span>
   </div>
   <div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-catalogos">
    <thead><tr><th style={{width:'8%'}}>Foto</th><th>Insumo / Material</th><th style={{textAlign:'center'}}>Cantidad</th><th style={{textAlign:'center'}}>Unidad</th><th style={{textAlign:'right'}}>Quitar</th></tr></thead>
    <tbody>
     {items.map(i=><tr key={i.id}>
      <td><FotoMini url={i.p.foto_url} nombre={i.p.nombre}/></td>
      <td><div style={{fontWeight:600}}>{i.p.nombre}</div><div className="dato-secundario">{i.p.codigo}{i.p.categoria?` · ${i.p.categoria}`:''}</div></td>
      <td style={{textAlign:'center',fontWeight:700}}>{i.n}</td>
      <td style={{textAlign:'center'}}>{i.p.unidad}</td>
      <td style={{textAlign:'right'}}><button type="button" className="btn btn-outline-danger btn-sm" onClick={()=>quitar(i.id)} aria-label={`Quitar ${i.p.nombre}`}>✕</button></td>
     </tr>)}
     {!items.length&&<tr><td colSpan={5} className="text-center text-muted py-4">Aún no hay insumos agregados al carrito.</td></tr>}
    </tbody>
   </table></div>
   <div style={{display:'flex',justifyContent:'space-between',gap:'0.75rem',flexWrap:'wrap'}}>
    <button type="button" className="btn btn-outline-primary" onClick={async()=>{if(items.length && await confirmarAccion('Limpiar carrito','¿Deseas quitar todos los insumos agregados?','Sí, limpiar')) setCarrito({});}}>Limpiar carrito</button>
    <button type="button" className="btn btn-primary" onClick={enviar} disabled={!items.length}>Enviar solicitud</button>
   </div>
   <p className="ayuda-catalogos" style={{margin:0}}>Los datos de solicitante (RUN, contacto, modalidad, motivo) se registran en el formulario; el envío del carrito utiliza el flujo vigente del sistema.</p>
  </div>
 </section>;
}

function GestionCatalogo({catalogo,stock}:{catalogo:InsumoCatalogo[];stock:InsumoStock[]}){
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
 return <section className="panel-catalogos"><h2>Catálogo y fotos (TI)</h2><p className="ayuda-catalogos">Sube fotos para que se vean en el carrito de compras.</p>
  <div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-catalogos"><caption className="visually-hidden">Catálogo de insumos</caption><thead><tr><th scope="col">Foto</th><th scope="col">Producto</th><th scope="col">Stock / disponible</th><th scope="col">Subir imagen</th></tr></thead><tbody>{catalogo.map(c=>{const s=stock.find(x=>x.producto_id===c.id);return <tr key={c.id}><td><FotoMini url={c.foto_url} nombre={c.nombre}/></td><td>{c.codigo} · {c.nombre}</td><td>{s?.existencia??0} / {s?.disponible??0}</td><td><input type="file" accept="image/jpeg,image/png,image/webp" disabled={subiendo===c.id} aria-label={`Subir foto de ${c.nombre}`} onChange={e=>{const f=e.target.files?.[0]; if(f) subirFoto(c.id,f);}}/></td></tr>;})}</tbody></table></div>
 </section>;
}

function DetalleSolicitud({solicitud,stock,admin,guardado}:{solicitud:SolicitudInsumo;stock:InsumoStock[];admin:boolean;guardado:boolean}){
 const mod=solicitud.modalidad_entrega==='DESPACHO'?'Despacho al establecimiento':solicitud.modalidad_entrega==='RETIRO_SERVICIO'?'Retiro en el servicio':(solicitud.modalidad_entrega||'');
 return <section className="panel-catalogos detalle-solicitud">
  <h2>Solicitud {solicitud.id.slice(0,8)}</h2>
  <dl className="ficha-datos">
   <div><dt>Sede</dt><dd>{solicitud.sede_nombre}{solicitud.sede_rbd&&` (${solicitud.sede_rbd})`}</dd></div>
   <div><dt>Solicitante</dt><dd>{solicitud.solicitante_nombre||solicitud.solicitante_correo}{solicitud.solicitante_nombre&&solicitud.solicitante_correo?` (${solicitud.solicitante_correo})`:''}</dd></div>
   {solicitud.solicitante_run&&<div><dt>RUN solicitante</dt><dd>{solicitud.solicitante_run}</dd></div>}
   {solicitud.solicitante_cargo&&<div><dt>Cargo</dt><dd>{solicitud.solicitante_cargo}</dd></div>}
   {solicitud.solicitante_telefono&&<div><dt>Teléfono</dt><dd>{solicitud.solicitante_telefono}</dd></div>}
   {mod&&<div><dt>Modalidad de entrega</dt><dd>{mod}</dd></div>}
   <div><dt>Estado</dt><dd><span className={'estado-solicitud estado-'+solicitud.estado}>{ESTADOS_SOLICITUD_INSUMO[solicitud.estado]||solicitud.estado}</span></dd></div>
   <div><dt>Solicitado</dt><dd>{new Date(solicitud.solicitado_en).toLocaleString('es-CL')}</dd></div>
   {solicitud.motivo&&<div><dt>Motivo</dt><dd>{solicitud.motivo}</dd></div>}
   {solicitud.validado_en&&<div><dt>Validado</dt><dd>{new Date(solicitud.validado_en).toLocaleString('es-CL')} por {solicitud.validado_por}{solicitud.observacion_validacion?` — ${solicitud.observacion_validacion}`:''}</dd></div>}
   {solicitud.aprobado_en&&<div><dt>Aprobado</dt><dd>{new Date(solicitud.aprobado_en).toLocaleString('es-CL')} por {solicitud.aprobado_por}</dd></div>}
   {solicitud.entregado_en&&<div><dt>Contra entrega</dt><dd>{new Date(solicitud.entregado_en).toLocaleString('es-CL')}</dd></div>}
   {solicitud.cancelado_en&&<div><dt>Cancelado</dt><dd>{new Date(solicitud.cancelado_en).toLocaleString('es-CL')} — {solicitud.cancelado_motivo}</dd></div>}
  </dl>
  {solicitud.acta_id&&<div className="acciones-catalogos">
   <strong>Acta de entrega:</strong>
   <Link className="btn btn-primary btn-sm" href={`/inventario/actas/${solicitud.acta_id}`}>Ver acta</Link>
   <a className="btn btn-outline-primary btn-sm" href={`/inventario/actas/${solicitud.acta_id}/pdf?descargar=si`}>Descargar PDF</a>
   <Link className="btn btn-outline-primary btn-sm" href={`/inventario/actas/${solicitud.acta_id}?correo=si`}>Enviar por correo</Link>
   <a className="btn btn-outline-primary btn-sm" href={`/inventario/actas/${solicitud.acta_id}/pdf`} target="_blank" rel="noopener noreferrer">Imprimir / Abrir PDF</a>
  </div>}
  <div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-catalogos"><caption>{solicitud.lineas.length} producto(s)</caption><thead><tr><th scope="col">Foto</th><th scope="col">Producto</th><th scope="col">Solicitada</th><th scope="col">Aprobada</th><th scope="col">Entregada</th><th scope="col">Motivo reducción</th></tr></thead><tbody>{solicitud.lineas.map(l=><tr key={l.id}><td><FotoMini url={l.foto_url} nombre={l.nombre}/></td><td>{l.codigo} · {l.nombre}</td><td>{l.cantidad_solicitada}</td><td>{l.cantidad_aprobada}</td><td>{l.cantidad_entregada}</td><td>{l.motivo_reduccion||'—'}</td></tr>)}</tbody></table></div>
  {guardado&&<p role="status" className="ayuda-catalogos">Cambios guardados.</p>}
  {admin&&solicitud.estado==='solicitada'&&<FormularioValidacion solicitud={solicitud}/>}
  {admin&&solicitud.estado==='en_validacion'&&<FormularioAprobacion solicitud={solicitud} stock={stock}/>}
  {admin&&solicitud.estado==='aprobada'&&<><FormularioEntrega solicitud={solicitud}/><FormularioCancelacion solicitud={solicitud}/></>}
  {admin&&(solicitud.estado==='solicitada'||solicitud.estado==='en_validacion')&&<FormularioCancelacion solicitud={solicitud}/>}
 </section>;
}

function FormularioValidacion({solicitud}:{solicitud:SolicitudInsumo}){
 const inicial:EstadoSolicitud={estado:'inicial',mensaje:'',revision:'',valores:{},errores:{}};
 const [estado,accion,pendiente]=useActionState(validarSolicitudInsumoAccion,inicial);
 return <form action={accion} aria-busy={pendiente} className="formulario-catalogos"><input type="hidden" name="solicitud" value={solicitud.id}/><h3>Validar solicitud (TI)</h3><p className="ayuda-catalogos">Revisa la solicitud y pásala a aprobación.</p><div className="campo-catalogos"><label htmlFor="validacion-observacion">Observación (opcional)</label><textarea id="validacion-observacion" name="observacion" maxLength={1000}/></div><div className="acciones-catalogos"><button className="btn btn-primary" disabled={pendiente}>{pendiente?'Validando…':'Pasar a aprobación'}</button></div>{estado.mensaje&&<p className={estado.estado==='error'?'error-catalogos':'ayuda-catalogos'} role="alert">{estado.mensaje}</p>}</form>;
}
function FormularioAprobacion({solicitud,stock}:{solicitud:SolicitudInsumo;stock:InsumoStock[]}){
 const inicial:EstadoSolicitud={estado:'inicial',mensaje:'',revision:'',valores:{},errores:{}};
 const [estado,accion,pendiente]=useActionState(aprobarSolicitudInsumoAccion,inicial);
 return <form action={accion} aria-busy={pendiente} className="formulario-catalogos"><input type="hidden" name="solicitud" value={solicitud.id}/><h3>Aprobar y reservar</h3><div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-catalogos"><thead><tr><th scope="col">Producto</th><th scope="col">Solicitada</th><th scope="col">Disponible</th><th scope="col">Aprobada</th><th scope="col">Motivo reducción</th></tr></thead><tbody>{solicitud.lineas.map(l=>{const s=stock.find(x=>x.producto_id===l.producto_id);return <tr key={l.id}><td>{l.codigo} · {l.nombre}</td><td>{l.cantidad_solicitada}</td><td>{s?.disponible??0}</td><td><input type="number" name={'cant_aprobada_'+l.producto_id} min={0} defaultValue={String(l.cantidad_solicitada)} aria-label={'Cantidad aprobada '+l.nombre}/></td><td><input type="text" name={'motivo_redu_'+l.producto_id} aria-label={'Motivo reducción '+l.nombre}/></td></tr>;})}</tbody></table></div><div className="campo-catalogos"><label htmlFor="ap-motivo">Observación</label><textarea id="ap-motivo" name="motivo" maxLength={1000}/></div><div className="acciones-catalogos"><button className="btn btn-primary" disabled={pendiente}>{pendiente?'Aprobando…':'Aprobar y reservar'}</button></div>{estado.mensaje&&<p role="alert" className={estado.estado==='error'?'error-catalogos':'ayuda-catalogos'}>{estado.mensaje}</p>}</form>;
}
function FormularioEntrega({solicitud}:{solicitud:SolicitudInsumo}){
 const inicial:EstadoSolicitud={estado:'inicial',mensaje:'',revision:'',valores:{},errores:{}};
 const [estado,accion,pendiente]=useActionState(entregarSolicitudInsumoAccion,inicial);
 const hoy=new Date().toISOString().slice(0,10);
 return <form action={accion} aria-busy={pendiente} className="formulario-catalogos"><input type="hidden" name="solicitud" value={solicitud.id}/><h3>Contra entrega y acta</h3><p className="ayuda-catalogos">Al confirmar se registra la entrega y se genera el <strong>acta institucional de entrega de insumos</strong> con folio del sistema (PDF conservado). Podrás imprimir, descargar o enviar por correo desde el acta.</p>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:'0.75rem'}}>
   <div className="campo-catalogos"><label htmlFor="ent-rec">Quien recibe</label><input id="ent-rec" name="receptor" required defaultValue={solicitud.solicitante_correo}/></div>
   <div className="campo-catalogos"><label htmlFor="ent-rec-cargo">Cargo de quien recibe</label><input id="ent-rec-cargo" name="recibeCargo" maxLength={200}/></div>
   <div className="campo-catalogos"><label htmlFor="ent-rec-run">RUN quien recibe (opcional)</label><input id="ent-rec-run" name="recibeRun" maxLength={12}/></div>
   <div className="campo-catalogos"><label htmlFor="ent-resp">Responsable TI (entrega)</label><input id="ent-resp" name="responsable_ti" required/></div>
   <div className="campo-catalogos"><label htmlFor="ent-cargo">Cargo/unidad TI</label><input id="ent-cargo" name="entregaCargo" defaultValue="UTIC" maxLength={200}/></div>
   <div className="campo-catalogos"><label htmlFor="ent-fecha">Fecha de entrega</label><input id="ent-fecha" name="fecha_entrega" type="date" required defaultValue={hoy}/></div>
  </div>
  <div className="campo-catalogos"><label htmlFor="ent-obs">Observaciones</label><textarea id="ent-obs" name="observaciones" maxLength={1000}/></div>
  <div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-catalogos"><thead><tr><th scope="col">Producto</th><th scope="col">Aprobada</th><th scope="col">Entregada</th></tr></thead><tbody>{solicitud.lineas.map(l=><tr key={l.id}><td>{l.codigo} · {l.nombre}</td><td>{l.cantidad_aprobada}</td><td><input type="number" name={'cant_entregada_'+l.producto_id} min={0} max={l.cantidad_aprobada} defaultValue={String(l.cantidad_aprobada)} required aria-label={'Cantidad entregada '+l.nombre}/></td></tr>)}</tbody></table></div>
  <div className="acciones-catalogos"><button className="btn btn-primary" disabled={pendiente}>{pendiente?'Generando entrega y acta…':'Confirmar contra entrega y generar acta'}</button></div>
  {estado.mensaje&&<p role="alert" className={estado.estado==='error'?'error-catalogos':'ayuda-catalogos'}>{estado.mensaje}</p>}
 </form>;
}
function FormularioCancelacion({solicitud}:{solicitud:SolicitudInsumo}){
 const inicial:EstadoSolicitud={estado:'inicial',mensaje:'',revision:'',valores:{},errores:{}};
 const [estado,accion,pendiente]=useActionState(cancelarSolicitudInsumoAccion,inicial);
 return <form action={accion} aria-busy={pendiente} className="formulario-catalogos"><input type="hidden" name="solicitud" value={solicitud.id}/><h3>Cancelar solicitud</h3><div className="campo-catalogos"><label htmlFor="can-mot">Motivo (obligatorio)</label><textarea id="can-mot" name="motivo" required maxLength={1000}/></div><div className="acciones-catalogos"><button className="btn btn-outline-danger" disabled={pendiente}>{pendiente?'Cancelando…':'Cancelar solicitud'}</button></div>{estado.mensaje&&<p role="alert" className={estado.estado==='error'?'error-catalogos':'ayuda-catalogos'}>{estado.mensaje}</p>}</form>;
}
