"use client";
import ModalFicha from '@/components/modal-ficha';
import IconoAccion from '@/components/icono-accion';
import {enlaceActaInsumos} from '@/lib/navegacion-insumos';
import type {ParticipanteActual} from '@/lib/participante-actual';
import Link from "next/link";
import {useActionState,useState} from "react";
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
 permisos:{aprobar:boolean;confirmar:boolean;actas:boolean;descargar:boolean};
 admin:boolean;sedes:{id:string;nombre:string;rbd:string|null}[];
 solicitudes:SolicitudInsumo[];stock:InsumoStock[];
 total:number;pagina:number;paginas:number;limite:number;
 filtroEstado:string;filtroSede:string;q:string;
 detalle:SolicitudInsumo|null;paso:string;emisor:ParticipanteActual|null;
};

export default function SolicitudesLista(props:Props){
 const {ruta,titulo,descripcion,admin,permisos,sedes,solicitudes,stock,total,pagina,paginas,limite,filtroEstado,filtroSede,q,detalle,paso,emisor}=props;
 const filtros={q,estado:filtroEstado,sede:filtroSede};
 const base=new URLSearchParams({q,estado:filtroEstado,sede:filtroSede,limite:String(limite),pagina:String(pagina)});
 const volver=ruta+'?'+base.toString();
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
    return <tr key={s.id}><td>{s.sede_nombre}{s.sede_rbd&&` (${s.sede_rbd})`}</td><td>{solicitante}{s.solicitante_nombre&&s.solicitante_correo?` · ${s.solicitante_correo}`:''}</td><td><span className={'estado-solicitud estado-'+s.estado}>{ESTADOS_SOLICITUD_INSUMO[s.estado]||s.estado}</span></td><td>{new Date(s.solicitado_en).toLocaleDateString('es-CL')}</td><td>{s.lineas.length}</td><td><AccionesRegistro id={s.id} nombre={nombre} verTexto="Ver solicitud" verHref={verHref(s.id)}>{permisos.aprobar&&s.estado==='solicitada'&&<EnlaceAccion href={verHref(s.id)+'&paso=validar'} etiqueta={'Validar: '+nombre} icono="editar"/>}{permisos.aprobar&&s.estado==='en_validacion'&&<EnlaceAccion href={verHref(s.id)+'&paso=aprobar'} etiqueta={'Aprobar: '+nombre} icono="editar"/>}{permisos.confirmar&&s.estado==='aprobada'&&<EnlaceAccion href={verHref(s.id)+'&paso=entregar'} etiqueta={'Entregar: '+nombre} icono="asignar"/>}{permisos.actas&&s.acta_id&&<EnlaceAccion href={enlaceActaInsumos(s.acta_id,volver)} etiqueta={'Ver acta: '+nombre} icono="acta"/>}</AccionesRegistro></td></tr>;
   })}{!solicitudes.length&&<tr><td colSpan={6}>No hay solicitudes para mostrar.</td></tr>}</tbody></table></div>
  </PanelResultados>
  {detalle&&<ModalFicha titulo={'Solicitud '+detalle.id.slice(0,8)} cerrarHref={volver} focoId={detalle.id} editando={Boolean(paso)}><DetalleSolicitud key={detalle.id+':'+detalle.estado+':'+paso} solicitud={detalle} stock={stock} admin={admin} permisos={permisos} paso={paso} emisor={emisor} volver={volver} gestionarHref={p=>verHref(detalle.id)+'&paso='+p}/></ModalFicha>}
 </main>;
}

function FotoMini({url,nombre}:{url?:string|null;nombre:string}){
 if(!url) return <div aria-hidden="true" style={{width:52,height:52,borderRadius:14,border:'1px dashed var(--color-borde-suave)',background:'var(--color-superficie-suave)',display:'grid',placeItems:'center',color:'var(--color-parrafo)'}}>▢</div>;
 return <img src={url} alt={nombre} loading="lazy" style={{width:52,height:52,objectFit:'cover',borderRadius:14,border:'1px solid var(--color-borde-suave)',background:'#fff'}}/>;
}

function DetalleSolicitud({solicitud,stock,admin,permisos,paso,emisor,volver,gestionarHref}:{solicitud:SolicitudInsumo;stock:InsumoStock[];admin:boolean;permisos:Props['permisos'];paso:string;emisor:ParticipanteActual|null;volver:string;gestionarHref:(paso:string)=>string}){
 const mod=solicitud.modalidad_entrega==='DESPACHO'?'Despacho al establecimiento':solicitud.modalidad_entrega==='RETIRO_SERVICIO'?'Retiro en el servicio':(solicitud.modalidad_entrega||'');
 return <section className="panel-catalogos detalle-solicitud">
  <h3>Datos de la solicitud</h3>
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
   {solicitud.entregado_en&&<div><dt>Entregado</dt><dd>{new Date(solicitud.entregado_en).toLocaleString('es-CL')}</dd></div>}
   {solicitud.cancelado_en&&<div><dt>Cancelado</dt><dd>{new Date(solicitud.cancelado_en).toLocaleString('es-CL')} — {solicitud.cancelado_motivo}</dd></div>}
  </dl>
  {permisos.actas&&solicitud.acta_id&&<div className="acciones-catalogos">
   <strong>Acta de entrega:</strong>
   <Link className="btn btn-primary btn-sm" href={enlaceActaInsumos(solicitud.acta_id,volver)}>Ver acta</Link>
   {permisos.descargar&&<a download className="btn btn-outline-primary btn-sm" href={`/inventario/actas/${solicitud.acta_id}/pdf?descargar=si`}>Descargar PDF</a>}
  </div>}
  {!permisos.actas&&solicitud.acta_id&&<p>Acta de entrega registrada.</p>}
  <div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-catalogos"><caption>{solicitud.lineas.length} producto(s)</caption><thead><tr><th scope="col">Foto</th><th scope="col">Producto</th><th scope="col">Solicitada</th><th scope="col">Aprobada</th><th scope="col">Entregada</th><th scope="col">Motivo reducción</th></tr></thead><tbody>{solicitud.lineas.map(l=><tr key={l.id}><td><FotoMini url={l.foto_url} nombre={l.nombre}/></td><td>{l.codigo} · {l.nombre}</td><td>{l.cantidad_solicitada}</td><td>{l.cantidad_aprobada}</td><td>{l.cantidad_entregada}</td><td>{l.motivo_reduccion||'—'}</td></tr>)}</tbody></table></div>
  {admin&&<div className="acciones-catalogos">
   {permisos.aprobar&&solicitud.estado==='solicitada'&&<EnlaceAccion href={gestionarHref('validar')} etiqueta="Validar solicitud" icono="editar"/>}
   {permisos.aprobar&&solicitud.estado==='en_validacion'&&<EnlaceAccion href={gestionarHref('aprobar')} etiqueta="Aprobar solicitud" icono="editar"/>}
   {permisos.confirmar&&solicitud.estado==='aprobada'&&<EnlaceAccion href={gestionarHref('entregar')} etiqueta="Entregar insumos y generar acta" icono="asignar"/>}
   {permisos.aprobar&&!['entregada','cancelada'].includes(solicitud.estado)&&<EnlaceAccion href={gestionarHref('cancelar')} etiqueta="Cancelar solicitud" icono="devolver"/>}
  </div>}
  {permisos.aprobar&&paso==='validar'&&solicitud.estado==='solicitada'&&<FormularioValidacion solicitud={solicitud} volver={volver}/>}
  {permisos.aprobar&&paso==='aprobar'&&solicitud.estado==='en_validacion'&&<FormularioAprobacion solicitud={solicitud} stock={stock} volver={volver}/>}
  {permisos.confirmar&&paso==='entregar'&&emisor&&solicitud.estado==='aprobada'&&<FormularioEntrega solicitud={solicitud} emisor={emisor} volver={volver}/>}
  {permisos.aprobar&&paso==='cancelar'&&!['entregada','cancelada'].includes(solicitud.estado)&&<FormularioCancelacion solicitud={solicitud} volver={volver}/>}
 </section>;
}

function FormularioValidacion({solicitud,volver}:{solicitud:SolicitudInsumo;volver:string}){
 const inicial:EstadoSolicitud={estado:'inicial',mensaje:'',revision:'',valores:{},errores:{}};
 const [estado,accion,pendiente]=useActionState(validarSolicitudInsumoAccion,inicial);
 return <form action={accion} aria-busy={pendiente} className="formulario-catalogos"><fieldset disabled={pendiente} className="border-0 p-0 m-0"><input type="hidden" name="solicitud" value={solicitud.id}/><input type="hidden" name="volver" value={volver}/><h3>Validar solicitud</h3><div className="campo-catalogos"><label htmlFor="validacion-observacion">Observación (opcional)</label><textarea id="validacion-observacion" name="observacion" maxLength={1000} key={estado.revision} defaultValue={estado.valores.observacion??''}/></div><div className="acciones-catalogos"><button className="btn btn-primary" disabled={pendiente}>{pendiente?'Validando…':'Pasar a aprobación'}</button></div>{estado.mensaje&&<p className={estado.estado==='error'?'error-catalogos':'ayuda-catalogos'} role="alert">{estado.mensaje}</p>}</fieldset></form>;
}
function FormularioAprobacion({solicitud,stock,volver}:{solicitud:SolicitudInsumo;stock:InsumoStock[];volver:string}){
 const inicial:EstadoSolicitud={estado:'inicial',mensaje:'',revision:'',valores:{},errores:{}};
 const [estado,accion,pendiente]=useActionState(aprobarSolicitudInsumoAccion,inicial);
 return <form action={accion} aria-busy={pendiente} className="formulario-catalogos"><fieldset disabled={pendiente} className="border-0 p-0 m-0"><input type="hidden" name="solicitud" value={solicitud.id}/><input type="hidden" name="volver" value={volver}/><h3>Aprobar y reservar</h3><div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-catalogos"><thead><tr><th scope="col">Producto</th><th scope="col">Solicitada</th><th scope="col">Disponible</th><th scope="col">Aprobada</th><th scope="col">Motivo reducción</th></tr></thead><tbody>{solicitud.lineas.map(l=>{const s=stock.find(x=>x.producto_id===l.producto_id);return <tr key={l.id}><td>{l.codigo} · {l.nombre}</td><td>{l.cantidad_solicitada}</td><td>{s?.disponible??0}</td><td><input type="number" name={'cant_aprobada_'+l.producto_id} min={0} max={l.cantidad_solicitada} step={1} key={estado.revision} defaultValue={estado.valores['cant_aprobada_'+l.producto_id]??String(l.cantidad_solicitada)} aria-label={'Cantidad aprobada '+l.nombre}/></td><td><input type="text" key={estado.revision} maxLength={1000} defaultValue={estado.valores['motivo_redu_'+l.producto_id]??''} name={'motivo_redu_'+l.producto_id} aria-label={'Motivo reducción '+l.nombre}/></td></tr>;})}</tbody></table></div><div className="campo-catalogos"><label htmlFor="ap-motivo">Observación</label><textarea id="ap-motivo" name="motivo" maxLength={1000} key={estado.revision} defaultValue={estado.valores.motivo??''}/></div><div className="acciones-catalogos"><button className="btn btn-primary" disabled={pendiente}>{pendiente?'Aprobando…':'Aprobar y reservar'}</button></div>{estado.mensaje&&<p role="alert" className={estado.estado==='error'?'error-catalogos':'ayuda-catalogos'}>{estado.mensaje}</p>}</fieldset></form>;
}
function FormularioEntrega({solicitud,emisor,volver}:{solicitud:SolicitudInsumo;emisor:ParticipanteActual;volver:string}){
 const inicial:EstadoSolicitud={estado:'inicial',mensaje:'',revision:'',valores:{},errores:{}};
 const [estado,accion,pendiente]=useActionState(entregarSolicitudInsumoAccion,inicial);
 const hoy=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Santiago'}).format(new Date());
 return <form action={accion} aria-label="Entrega de insumos" aria-busy={pendiente} className="formulario-catalogos"><fieldset disabled={pendiente} className="border-0 p-0 m-0"><input type="hidden" name="solicitud" value={solicitud.id}/><input type="hidden" name="volver" value={volver}/><h3>Entrega y acta</h3>
 <fieldset key={estado.revision} disabled={pendiente} className="border-0 p-0 m-0"><legend className="visually-hidden">Participantes y cantidades de la entrega</legend>
 <p>Se registrará una entrega única con su acta. Las unidades no entregadas quedarán liberadas, sin saldo pendiente en esta solicitud.</p>
 <CamposParticipantesEntrega solicitud={solicitud} emisor={emisor} valores={estado.valores} error={estado.estado==='error'}/>
 <div className="campo-catalogos"><label htmlFor="ent-fecha">Fecha de entrega</label><input id="ent-fecha" name="fecha_entrega" type="date" required max={hoy} defaultValue={estado.valores.fecha_entrega??hoy}/></div>
 <div className="campo-catalogos"><label htmlFor="ent-obs">Observaciones (opcional)</label><textarea id="ent-obs" name="observaciones" maxLength={1000} defaultValue={estado.valores.observaciones??''}/></div>
 <div className="tabla-usuarios-contenedor"><table className="tabla-datos tabla-catalogos"><thead><tr><th scope="col">Producto</th><th scope="col">Aprobada</th><th scope="col">Entregada</th></tr></thead><tbody>{solicitud.lineas.map(l=><tr key={l.id}><td>{l.codigo} · {l.nombre}<small className="dato-secundario">{l.unidad}</small></td><td>{l.cantidad_aprobada}</td><td><input type="number" name={'cant_entregada_'+l.producto_id} min={0} max={l.cantidad_aprobada} step={1} defaultValue={estado.valores['cant_entregada_'+l.producto_id]??String(l.cantidad_aprobada)} required aria-label={'Cantidad entregada '+l.nombre}/></td></tr>)}</tbody></table></div>
 <div className="acciones-catalogos"><button className="btn btn-primary" disabled={pendiente}>{pendiente?'Generando entrega y acta…':'Confirmar entrega y generar acta'}</button></div></fieldset>
 <p role="alert" className="error-catalogos">{estado.estado==='error'?estado.mensaje:''}</p>
 </fieldset></form>;
}
function CamposParticipantesEntrega({solicitud,emisor,valores,error}:{solicitud:SolicitudInsumo;emisor:ParticipanteActual;valores:Record<string,string>;error:boolean}){
 const [editarEntrega,setEditarEntrega]=useState(error),[editarRecibe,setEditarRecibe]=useState(error);
 const inicial:Record<string,string>={receptor:solicitud.solicitante_nombre,recibeRun:solicitud.solicitante_run,recibeCargo:solicitud.solicitante_cargo,recibeCorreo:solicitud.solicitante_correo,responsable_ti:emisor.nombre,entregaRun:emisor.run,entregaCargo:emisor.cargo,entregaCorreo:emisor.correo};
 const campo=(k:string,t:string,max:number,editar:boolean,obligatorio=false)=>{const v=valores[k]??inicial[k]??'';return <div className="campo-catalogos" key={k}><label htmlFor={'ent-'+k}>{t}</label><input id={'ent-'+k} name={k} type={k.endsWith('Correo')?'email':'text'} maxLength={max} defaultValue={v} readOnly={!editar&&Boolean(v)} required={obligatorio}/></div>;};
 const lapiz=(t:string,pulsado:boolean,editar:()=>void)=><button type="button" className="btn btn-outline-primary btn-sm accion-icono" title={t} aria-label={t} aria-pressed={pulsado} onClick={editar}><IconoAccion tipo="editar"/></button>;
 return <><section className="operacion-seccion"><h3>Persona que recibe {lapiz('Editar datos de quien recibe',editarRecibe,()=>setEditarRecibe(!editarRecibe))}</h3><div className="operacion-persona">{campo('receptor','Nombre de quien recibe',200,editarRecibe,true)}{campo('recibeRun','RUN de quien recibe (opcional)',12,editarRecibe)}{campo('recibeCargo','Cargo de quien recibe',200,editarRecibe)}{campo('recibeCorreo','Correo de quien recibe',254,editarRecibe)}</div></section>
 <section className="operacion-seccion"><h3>Persona que entrega {lapiz('Editar datos de quien entrega',editarEntrega,()=>setEditarEntrega(!editarEntrega))}</h3><div className="operacion-persona">{campo('responsable_ti','Nombre de quien entrega',200,editarEntrega,true)}{campo('entregaRun','RUN de quien entrega (opcional)',12,editarEntrega)}{campo('entregaCargo','Cargo o unidad TI',200,editarEntrega)}{campo('entregaCorreo','Correo de quien entrega',254,editarEntrega)}</div></section><p className="ayuda-catalogos">La emisión queda registrada por {emisor.correo}. El lápiz permite corregir a quienes participan en esta entrega; no cambia el emisor de un acta ya emitida.</p></>;
}
function FormularioCancelacion({solicitud,volver}:{solicitud:SolicitudInsumo;volver:string}){
 const inicial:EstadoSolicitud={estado:'inicial',mensaje:'',revision:'',valores:{},errores:{}};
 const [estado,accion,pendiente]=useActionState(cancelarSolicitudInsumoAccion,inicial);
 return <form action={accion} aria-busy={pendiente} className="formulario-catalogos"><fieldset disabled={pendiente} className="border-0 p-0 m-0"><input type="hidden" name="solicitud" value={solicitud.id}/><input type="hidden" name="volver" value={volver}/><h3>Cancelar solicitud</h3><div className="campo-catalogos"><label htmlFor="can-mot">Motivo (obligatorio)</label><textarea id="can-mot" name="motivo" required maxLength={1000} key={estado.revision} defaultValue={estado.valores.motivo??''}/></div><div className="acciones-catalogos"><button className="btn btn-outline-danger" disabled={pendiente}>{pendiente?'Cancelando…':'Cancelar solicitud'}</button></div>{estado.mensaje&&<p role="alert" className={estado.estado==='error'?'error-catalogos':'ayuda-catalogos'}>{estado.mensaje}</p>}</fieldset></form>;
}
