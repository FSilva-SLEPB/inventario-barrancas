"use client";
import Link from "next/link";
import {useActionState} from "react";
import {aprobarSolicitudInsumoAccion,entregarSolicitudInsumoAccion,cancelarSolicitudInsumoAccion,validarSolicitudInsumoAccion,type EstadoSolicitud} from "@/app/insumos/acciones";
import {ESTADOS_SOLICITUD_INSUMO} from "@/lib/validacion-insumos";
import type {SolicitudInsumo,InsumoStock} from "@/lib/insumos";
import PanelFiltros from "@/components/panel-filtros";
import PanelResultados from "@/components/panel-resultados";
import AccionesRegistro from "@/components/acciones-registro";
import EnlaceAccion from "@/components/enlace-accion";

export type Props={
 modo:'seguimiento'|'historial';
 ruta:string;titulo:string;descripcion:string;
 admin:boolean;sedes:{id:string;nombre:string;rbd:string|null}[];
 solicitudes:SolicitudInsumo[];stock:InsumoStock[];
 total:number;pagina:number;paginas:number;limite:number;
 filtroEstado:string;filtroSede:string;q:string;
 detalle:SolicitudInsumo|null;guardado:boolean;
};

export default function SolicitudesLista(props:Props){
 const {ruta,titulo,descripcion,admin,sedes,solicitudes,stock,total,pagina,paginas,limite,filtroEstado,filtroSede,q,detalle,guardado}=props;
 const filtros={q,estado:filtroEstado,sede:filtroSede};
 const base=new URLSearchParams({q,estado:filtroEstado,sede:filtroSede,limite:String(limite),pagina:String(pagina)});
 const verHref=(id:string)=>ruta+'?'+new URLSearchParams({...Object.fromEntries(base),'ver':id}).toString();
 return <main>
  <header>
   <h1>{titulo}</h1>
   <p className="descripcion-pagina">{descripcion}</p>
   <p><Link className="btn btn-outline-primary btn-sm" href="/insumos">Volver a insumos</Link></p>
  </header>
  <PanelFiltros ruta={ruta} titulo="Filtrar solicitudes" busqueda={{valor:q,placeholder:'Buscar por sede o solicitante'}} ocultos={{limite}}>
   <div className="filtro-inventario"><label htmlFor="filtro-estado">Estado</label><select id="filtro-estado" name="estado" defaultValue={filtroEstado}>
    <option value="">Todos</option>
    <option value="activas">En curso (seguimiento)</option>
    <option value="finalizadas">Finalizadas (historial)</option>
    {Object.entries(ESTADOS_SOLICITUD_INSUMO).map(([k,v])=><option key={k} value={k}>{v}</option>)}
   </select></div>
   <div className="filtro-inventario"><label htmlFor="filtro-sede">Sede</label><select id="filtro-sede" name="sede" defaultValue={filtroSede}><option value="">Todas</option>{sedes.map(s=><option key={s.id} value={s.id}>{s.nombre}{s.rbd&&' ('+s.rbd+')'}</option>)}</select></div>
  </PanelFiltros>
  <PanelResultados total={total} descripcion="solicitudes" ruta={ruta} limite={limite} filtros={filtros} pagina={pagina} paginas={paginas}>
   <div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-catalogos"><caption className="visually-hidden">Solicitudes ({total})</caption><thead><tr><th scope="col">Sede</th><th scope="col">Solicitante</th><th scope="col">Estado</th><th scope="col">Fecha</th><th scope="col">Ítems</th><th scope="col">Acciones</th></tr></thead><tbody>{solicitudes.map((s)=>{
    const nombre=`solicitud ${s.sede_nombre}`;
    const solicitante=(s.solicitante_nombre||s.solicitante_correo||'').trim();
    return <tr key={s.id}><td>{s.sede_nombre}{s.sede_rbd&&` (${s.sede_rbd})`}</td><td>{solicitante}{s.solicitante_nombre&&s.solicitante_correo?` · ${s.solicitante_correo}`:''}</td><td><span className={'estado-solicitud estado-'+s.estado}>{ESTADOS_SOLICITUD_INSUMO[s.estado]||s.estado}</span></td><td>{new Date(s.solicitado_en).toLocaleDateString('es-CL')}</td><td>{s.lineas.length}</td><td><AccionesRegistro id={s.id} nombre={nombre} verTexto="Ver solicitud" verHref={verHref(s.id)}>{admin&&s.estado==='solicitada'&&<Link className="btn btn-primary btn-sm" href={verHref(s.id)+'&paso=validar'}>Validar</Link>}{admin&&s.estado==='en_validacion'&&<Link className="btn btn-primary btn-sm" href={verHref(s.id)+'&paso=aprobar'}>Aprobar</Link>}{admin&&s.estado==='aprobada'&&<Link className="btn btn-primary btn-sm" href={verHref(s.id)+'&paso=entregar'}>Contra entrega</Link>}{s.acta_id&&<EnlaceAccion href={'/inventario/actas/'+s.acta_id} etiqueta={'Ver acta: '+nombre} icono="acta"/>}</AccionesRegistro></td></tr>;
   })}{!solicitudes.length&&<tr><td colSpan={6}>No hay solicitudes para mostrar.</td></tr>}</tbody></table></div>
  </PanelResultados>
  {detalle&&<DetalleSolicitud solicitud={detalle} stock={stock} admin={admin} guardado={guardado}/>}
 </main>;
}

function FotoMini({url,nombre}:{url?:string|null;nombre:string}){
 if(!url) return <div aria-hidden="true" style={{width:52,height:52,borderRadius:14,border:'1px dashed var(--color-borde-suave)',background:'var(--color-superficie-suave)',display:'grid',placeItems:'center',color:'var(--color-parrafo)'}}>▢</div>;
 return <img src={url} alt={nombre} loading="lazy" style={{width:52,height:52,objectFit:'cover',borderRadius:14,border:'1px solid var(--color-borde-suave)',background:'#fff'}}/>;
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
 return <form action={accion} aria-busy={pendiente} className="formulario-catalogos"><input type="hidden" name="solicitud" value={solicitud.id}/><h3>Validar solicitud (TI)</h3><div className="campo-catalogos"><label htmlFor="validacion-observacion">Observación (opcional)</label><textarea id="validacion-observacion" name="observacion" maxLength={1000}/></div><div className="acciones-catalogos"><button className="btn btn-primary" disabled={pendiente}>{pendiente?'Validando…':'Pasar a aprobación'}</button></div>{estado.mensaje&&<p className={estado.estado==='error'?'error-catalogos':'ayuda-catalogos'} role="alert">{estado.mensaje}</p>}</form>;
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
 return <form action={accion} aria-busy={pendiente} className="formulario-catalogos"><input type="hidden" name="solicitud" value={solicitud.id}/><h3>Contra entrega y acta</h3>
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
