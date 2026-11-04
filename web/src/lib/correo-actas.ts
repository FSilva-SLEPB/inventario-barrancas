import 'server-only';
import nodemailer from 'actas-smtp';
import {validarCorreoActa,folioActa,type DatosActa} from '@/lib/validacion-actas';
export function configuracionCorreoActas(env:NodeJS.ProcessEnv=process.env){
 const host=env.ACTAS_SMTP_HOST??'';if(!host||!env.ACTAS_CORREO_REMITENTE)throw new Error('El envío de actas aún no está habilitado en esta instalación.');const remitente=validarCorreoActa(env.ACTAS_CORREO_REMITENTE);
 const port=Number(env.ACTAS_SMTP_PUERTO??587),secure=env.ACTAS_SMTP_TLS_DIRECTO==='si';
 if(!host||host.length>253||/[\s/\\\p{Cc}]/u.test(host)||!Number.isInteger(port)||port<1||port>65535||!remitente.endsWith('@slepb.gob.cl')||(Boolean(env.ACTAS_SMTP_USUARIO)!==Boolean(env.ACTAS_SMTP_CLAVE)))throw new Error('El envío de actas aún no está habilitado en esta instalación.');
 return {host,port,secure,remitente,auth:env.ACTAS_SMTP_USUARIO?{user:env.ACTAS_SMTP_USUARIO,pass:env.ACTAS_SMTP_CLAVE!}:undefined};
}
export function correoActasDisponible(){try{configuracionCorreoActas();return true;}catch{return false;}}
export async function enviarPdfActa(config:ReturnType<typeof configuracionCorreoActas>,id:string,destinos:string[],d:DatosActa,pdf:Buffer){
 const t=nodemailer.createTransport({host:config.host,port:config.port,secure:config.secure,requireTLS:true,auth:config.auth,tls:{rejectUnauthorized:true},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,disableFileAccess:true,disableUrlAccess:true});
 try{const r=await t.sendMail({from:{name:'SLEP Barrancas - No responder',address:config.remitente},to:destinos,envelope:{from:config.remitente,to:destinos},messageId:`<acta-${id}@${config.remitente.split('@')[1]}>`,subject:`${folioActa(d.folio)} · Acta de ${d.tipo==='asignacion'?'asignación':'devolución'}`,text:`Se adjunta ${folioActa(d.folio)}, versión ${d.version}, correspondiente al movimiento de fecha ${d.fecha}.\n\nEste es un correo automático. No responder a esta dirección. Para consultas, contacte a UTIC.`,headers:{'Auto-Submitted':'auto-generated','X-Auto-Response-Suppress':'All'},attachments:[{filename:folioActa(d.folio)+'.pdf',content:pdf,contentType:'application/pdf'}]});
 const aceptados=(r.accepted??[]).map(String),rechazados=(r.rejected??[]).map(String);return {estado:rechazados.length?'parcial':'aceptado',resultado:{aceptados,rechazados,messageId:r.messageId}};
 }catch(e){const x=e as {code?:string;command?:string},codigo=/^[A-Z0-9_]{1,40}$/.test(x.code??'')?x.code!:'SMTP_ERROR';return {estado:['EAUTH','ECONNREFUSED','EDNS','EENVELOPE'].includes(codigo)?'fallido':'no_confirmado',resultado:{codigo}};}finally{t.close();}
}
