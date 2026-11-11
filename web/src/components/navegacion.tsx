'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useRef,useState} from 'react';
import {modulosSistema} from '@/lib/modulos';
import type {RolAcceso} from '@/lib/politica-acceso';
const trazos={directorio:'M5 3h16v18H5zM2 7h5M2 12h5M2 17h5M11 8h6M11 12h6M11 16h4',inicio:'M3 10 12 3l9 7M5 9v12h14V9M10 21v-7h4v7',inventario:'M3 5h18v15H3zM3 10h18M9 5v5M15 5v5M9 15h6',solicitudes:'M8 5H5v16h14V5h-3M8 3h8v4H8zM8 12h8M8 16h5',mantenedores:'M3 6h6m4 0h8M3 12h10m4 0h4M3 18h2m4 0h12M9 4v4m4 2v4M5 16v4'};
function Icono({tipo}:{tipo:keyof typeof trazos}){return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={trazos[tipo]}/></svg>;}
export default function Navegacion({rol,administrador=false,soloLectura=false}:{rol?:RolAcceso;administrador?:boolean;soloLectura?:boolean}){
 const alternarMovil=useRef<HTMLButtonElement>(null);
 const ruta=usePathname(),[movil,setMovil]=useState(false),[eleccion,setEleccion]=useState<{ruta:string;id:string|null}|null>(null),modulos=modulosSistema(rol??(administrador?'administrador':'consulta')).sort((a,b)=>['inventario','directorio','solicitudes','mantenedores'].indexOf(a.id)-['inventario','directorio','solicitudes','mantenedores'].indexOf(b.id));
 const activo=(modulos.find(m=>ruta===m.href||ruta.startsWith(m.href+'/'))??modulos.find(m=>m.accesos.some(a=>ruta===a.href||ruta.startsWith(a.href+'/'))))?.id??(rol==='gestor_insumos'&&ruta.startsWith('/inventario/actas/')?'solicitudes':null);
 const abierto=eleccion?.ruta===ruta?eleccion.id:activo;
 const cerrar=()=>setMovil(false);
 return <nav className="navegacion-principal" aria-label="Principal" onKeyDown={e=>{if(e.key==='Escape'&&movil){e.preventDefault();setMovil(false);alternarMovil.current?.focus();}}}><div className="cabecera-menu"><span className="insignia-menu" aria-hidden="true"><Icono tipo="inventario"/></span><div><p className="titulo-menu">Menú del sistema</p><p className="subtitulo-menu">Navegación institucional</p></div><button ref={alternarMovil} type="button" className="btn btn-outline-primary menu-alternar" aria-expanded={movil} aria-controls="contenido-menu" onClick={()=>setMovil(v=>!v)}>{movil?'Cerrar':'Menú'}</button></div>
 <div id="contenido-menu" className={'menu-contenido'+(movil?' abierto':'')}>{soloLectura&&<p className="menu-solo-lectura">Modo solo lectura</p>}<p className="seccion-menu">Gestión</p><ul><li><Link href="/" aria-current={ruta==='/'?'page':undefined} onClick={cerrar}><span className="icono-menu"><Icono tipo="inicio"/></span><span>Inicio</span></Link></li></ul>
 {modulos.map(m=>{const expandido=abierto===m.id,tiene=m.accesos.length>0;const subactivo=m.accesos.filter(a=>ruta===a.href||ruta.startsWith(a.href+'/')).sort((a,b)=>b.href.length-a.href.length)[0]?.href;
 return <div className="grupo-navegacion" key={m.id}>{m.id==='mantenedores'&&<p className="seccion-menu">Administración</p>}<div className={'fila-modulo'+(activo===m.id?' modulo-activo':'')}><Link href={m.href} aria-current={ruta===m.href?'page':activo===m.id?'location':undefined} onClick={()=>{setEleccion({ruta,id:m.id});cerrar();}}><span className="icono-menu"><Icono tipo={m.id}/></span><span>{m.titulo}</span></Link>{tiene&&<button type="button" className="alternar-submenu" aria-label={`${expandido?'Contraer':'Desplegar'} ${m.titulo}`} aria-expanded={expandido} aria-controls={'submenu-'+m.id} onClick={()=>setEleccion({ruta,id:expandido?null:m.id})}><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2"/></svg></button>}</div>
 {tiene&&<ul id={'submenu-'+m.id} className="submenu" hidden={!expandido}>{m.accesos.map(a=><li key={a.href}><Link href={a.href} aria-current={subactivo===a.href?'page':undefined} onClick={cerrar}>{a.titulo}</Link></li>)}</ul>}</div>;})}
 <p className="pie-menu">Los accesos respetan tu perfil y las sedes autorizadas.</p></div></nav>;
}
