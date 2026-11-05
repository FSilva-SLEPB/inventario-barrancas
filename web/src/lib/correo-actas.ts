import 'server-only';
import nodemailer from 'actas-smtp';
import {validarCorreoActa,destinatariosActa,folioActa,TIPOS_ACTA,type DatosActa} from '@/lib/validacion-actas';
export function configuracionCorreoActas(env:NodeJS.ProcessEnv=process.env){
 const modo=env.ACTAS_CORREO_MODO??'prueba';if(!['prueba','produccion'].includes(modo))throw new Error('Modo de correo de actas no válido.');
 const destinosPrueba=modo==='prueba'?destinatariosActa(env.ACTAS_CORREO_PRUEBA_DESTINATARIOS??''):[];
 const host=env.ACTAS_SMTP_HOST??'';if(!host||!env.ACTAS_CORREO_REMITENTE)throw new Error('El envío de actas aún no está habilitado en esta instalación.');const remitente=validarCorreoActa(env.ACTAS_CORREO_REMITENTE);
 const port=Number(env.ACTAS_SMTP_PUERTO??587),secure=env.ACTAS_SMTP_TLS_DIRECTO==='si';
 if(!host||host.length>253||/[\s/\\\p{Cc}]/u.test(host)||!Number.isInteger(port)||port<1||port>65535||!remitente.endsWith('@slepb.gob.cl')||(Boolean(env.ACTAS_SMTP_USUARIO)!==Boolean(env.ACTAS_SMTP_CLAVE)))throw new Error('El envío de actas aún no está habilitado en esta instalación.');
 return {host,port,secure,remitente,modo:modo as 'prueba'|'produccion',destinosPrueba,auth:env.ACTAS_SMTP_USUARIO?{user:env.ACTAS_SMTP_USUARIO,pass:env.ACTAS_SMTP_CLAVE!}:undefined};
}
export function estadoCorreoActas(env:NodeJS.ProcessEnv=process.env){
 const prueba=env.ACTAS_CORREO_MODO!=='produccion';let destinos:string[]=[];try{if(prueba)destinos=destinatariosActa(env.ACTAS_CORREO_PRUEBA_DESTINATARIOS??'');}catch{}
 try{configuracionCorreoActas(env);return {prueba,destinos,disponible:true};}catch{return {prueba,destinos,disponible:false};}
}
export function validarDestinosCorreoActas(config:ReturnType<typeof configuracionCorreoActas>,destinos:string[]){
 if(!['prueba','produccion'].includes(config.modo))throw new Error('Modo de correo de actas no válido.');
 const revisados=destinatariosActa(destinos.join(','));if(config.modo==='prueba'&&(!config.destinosPrueba.length||revisados.some(d=>!config.destinosPrueba.includes(d))))throw new Error('Modo de prueba: solo se permite enviar a los correos de prueba autorizados.');return revisados;
}
export function correoActasDisponible(){try{configuracionCorreoActas();return true;}catch{return false;}}
export async function enviarPdfActa(config:ReturnType<typeof configuracionCorreoActas>,id:string,destinos:string[],d:DatosActa,pdf:Buffer){
 destinos=validarDestinosCorreoActas(config,destinos);
 const t=nodemailer.createTransport({host:config.host,port:config.port,secure:config.secure,requireTLS:true,auth:config.auth,tls:{rejectUnauthorized:true},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,disableFileAccess:true,disableUrlAccess:true});
 try{const r=await t.sendMail({from:{name:'SLEP Barrancas - No responder',address:config.remitente},to:destinos,envelope:{from:config.remitente,to:destinos},messageId:`<acta-${id}@${config.remitente.split('@')[1]}>`,subject:`${config.modo==='prueba'?'[PRUEBA] ':''}${folioActa(d.folio)} · Acta de ${TIPOS_ACTA[d.tipo].toLocaleLowerCase('es')}`,text:`${config.modo==='prueba'?'ENVÍO DE PRUEBA a destinatarios autorizados.\n\n':''}Se adjunta ${folioActa(d.folio)}, versión ${d.version}, correspondiente a la operación registrada de fecha ${d.fecha}.\n\nEste es un correo automático. No responder a esta dirección. Para consultas, contacte a UTIC.`,headers:{'Auto-Submitted':'auto-generated','X-Auto-Response-Suppress':'All'},attachments:[{filename:folioActa(d.folio)+'.pdf',content:pdf,contentType:'application/pdf'}]});
 const aceptados=(r.accepted??[]).map(String),rechazados=(r.rejected??[]).map(String);return {estado:rechazados.length?'parcial':'aceptado',resultado:{aceptados,rechazados,messageId:r.messageId,modo:config.modo}};
 }catch(e){const x=e as {code?:string;command?:string},codigo=/^[A-Z0-9_]{1,40}$/.test(x.code??'')?x.code!:'SMTP_ERROR';return {estado:['EAUTH','ECONNREFUSED','EDNS','EENVELOPE'].includes(codigo)?'fallido':'no_confirmado',resultado:{codigo,modo:config.modo}};}finally{t.close();}
}
