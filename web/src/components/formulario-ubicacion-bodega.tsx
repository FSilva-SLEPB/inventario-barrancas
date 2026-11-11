'use client';
import {useActionState} from 'react';
import Link from 'next/link';
import {guardarUbicacionBodega,type EstadoUbicacion} from '@/app/inventario/bodega-ti/acciones';
import type {UbicacionBodega} from '@/lib/ubicaciones-bodega';
export default function FormularioUbicacionBodega({tipo,id,version,ubicacion,ubicaciones,solicitud,volver}:{tipo:'equipo'|'celular';id:string;version:number;ubicacion:string;ubicaciones:UbicacionBodega[];solicitud:string;volver:string}){
 const [estado,accion,pendiente]=useActionState(guardarUbicacionBodega,{estado:'inicial',mensaje:'',revision:'',ubicacion} as EstadoUbicacion);
 return <form action={accion} aria-label="Ubicación física del bien" aria-busy={pendiente} className="formulario-catalogos">{Object.entries({tipo,bienId:id,version:String(version),solicitud,volver}).map(([k,v])=><input key={k} type="hidden" name={k} value={v}/>)}
 <fieldset disabled={pendiente} className="border-0 p-0 m-0"><legend className="visually-hidden">Confirmar ubicación en Bodega TI</legend><div className="campo-catalogos"><label htmlFor="ubicacion-bodega">Ubicación física</label><select id="ubicacion-bodega" name="ubicacion" key={estado.revision} defaultValue={estado.ubicacion}><option value="">Sin ubicación confirmada</option>{ubicaciones.map(u=><option key={u.id} value={u.id} disabled={!u.activo}>{u.nombre}{!u.activo?' (inactiva)':''}</option>)}</select></div>
 <p className="ayuda-catalogos">Se conserva el inventario de pertenencia y los estados del bien. Seleccionar Bicentenario no registra una baja.</p><div className="acciones-catalogos"><button className="btn btn-primary" disabled={pendiente}>{pendiente?'Guardando…':'Confirmar ubicación'}</button>{!pendiente&&<Link href={volver} scroll={false}>Cancelar</Link>}</div></fieldset><p className="error-catalogos" role="alert">{estado.mensaje}</p></form>;
}
