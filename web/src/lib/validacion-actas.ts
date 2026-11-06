import {normalizarRut} from '@/lib/validacion-directorio';
export const CAMPOS_ACTA={entregaNombre:200,entregaRun:12,entregaCargo:200,entregaCorreo:254,recibeRun:12,recibeCargo:200,recibeCorreo:254,recibeUnidad:200,recibeSubdireccion:200,accesorios:500,observaciones:2000} as const;
export type MetadataActa=Record<keyof typeof CAMPOS_ACTA,string>;
export function metadatosActa(v:Record<string,unknown>,historica=false,correoOriginal?:string):MetadataActa{
 const r={} as MetadataActa,conservaCorreo=Boolean(historica&&correoOriginal&&typeof v.recibeCorreo==='string'&&v.recibeCorreo.trim().toLowerCase()===correoOriginal.toLowerCase());
 for(const[k,max]of Object.entries(CAMPOS_ACTA)){
  if(k==='recibeCorreo'&&conservaCorreo){r.recibeCorreo=correoOriginal!;continue;}
  const x=v[k]??(['recibeUnidad','recibeSubdireccion'].includes(k)?'':undefined);if(typeof x!=='string'||x.length>max||/\p{Cc}/u.test(k==='observaciones'||k==='accesorios'?x.replace(/[\r\n\t]/g,''):x))throw new Error('Revisa los datos del acta.');r[k as keyof MetadataActa]=x.normalize('NFC').trim();
 }
 if(!historica&&!r.entregaNombre)throw new Error('Indica el nombre de quien entrega.');
 for(const k of ['entregaRun','recibeRun'] as const){if(!r[k])continue;r[k]=normalizarRut(r[k]);if(!r[k])throw new Error('Indica un RUN válido para quien entrega y quien recibe.');}
 for(const k of ['entregaCorreo','recibeCorreo'] as const){if(k==='recibeCorreo'&&conservaCorreo)continue;r[k]=r[k]?validarCorreoActa(r[k]):'';}
 return r;
}
export function validarCorreoActa(s:string){
 const x=s.trim().toLowerCase();if(x.length>254||!/^[a-z0-9._%+!-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(x)||/[\p{Cc}<>]/u.test(x)||x.includes('..'))throw new Error('Indica una dirección de correo válida, sin nombres ni cabeceras.');return x;
}
export function destinatariosActa(s:string){const a=s.split(',').map(validarCorreoActa);if(!a.length||a.length>5||new Set(a).size!==a.length)throw new Error('Indica hasta cinco correos distintos separados por comas.');return a;}
export function folioActa(n:number|string){const v=String(n);if(!/^\d{1,12}$/.test(v))throw new Error('Folio inválido.');return 'ACT-'+v.padStart(6,'0');}
export type DatosActa={schema:number;tipo:'asignacion'|'devolucion'|'entrega_historica'|'prestamo'|'devolucion_prestamo'|'cambio'|'traspaso';operacionId?:string;procedencia?:string;ruta?:'directa'|'bodega';bienesDevueltos?:Array<Record<string,unknown>>;detalleDevueltos?:string;detalleEntregados?:string;motivo?:string;fecha:string;fechaLimite?:string;prestamoId?:string;folioPrestamo?:number;emitidoEn:string;movimientoId:string|null;entregaId?:string;clase:'equipo'|'celular';origen:string;destino:string;sedeNombre:string;rbd:string;receptorNombre:string;sedeTipo?:string;comuna?:string;sedeDatos?:{direccion?:string;comuna?:string;correoInstitucional?:string};actor:string;actorNombre?:string;bienes:Array<Record<string,unknown>>;metadata:MetadataActa;folio:number;version:number};

export const TIPOS_ACTA={cambio:"Cambio de equipamiento",traspaso:"Traspaso",asignacion:"Asignación",devolucion:"Devolución",entrega_historica:"Entrega histórica",prestamo:"Préstamo",devolucion_prestamo:"Devolución de préstamo"};
