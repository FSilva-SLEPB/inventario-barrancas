import {createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
export const MENSAJES_EXITO={
 acta:{titulo:'Acta emitida',texto:'El folio y el PDF de esta versión quedaron guardados.'},
 correo:{titulo:'Correo enviado',texto:'El servidor de correo aceptó el envío con el PDF adjunto.'},
 devolucion:{titulo:'Devolución registrada',texto:'El bien quedó en Bodega TI y su acta está lista para imprimir o enviar.'},
 asignacion:{titulo:'Asignación registrada',texto:'El bien quedó asignado y su acta está lista para imprimir o enviar.'},
 guardado:{titulo:'Cambios guardados',texto:'La actualización se realizó correctamente.'},
 contacto:{titulo:'Contacto actualizado',texto:'La actualización del contacto se realizó correctamente.'},
 entrega:{titulo:'Entrega registrada',texto:'Los datos de la entrega se guardaron correctamente.'},
 robo:{titulo:'Registro actualizado',texto:'Los antecedentes del incidente se guardaron correctamente.'},
} as const;
export type TipoExito=keyof typeof MENSAJES_EXITO;
const firma=(texto:string,secreto:string)=>createHmac('sha256',secreto).update('aviso.v1:'+texto).digest();
export function emitirRecibo(ruta:string,tipo:TipoExito,secreto:string,ahora=Date.now()){
 const datos=Buffer.from(JSON.stringify({v:1,id:randomUUID(),tipo,ruta,vence:ahora+120000})).toString('base64url');
 return datos+'.'+firma(datos,secreto).toString('base64url');
}
export function verificarRecibo(token:string,ruta:string,secreto:string,ahora=Date.now()){
 if(!secreto||token.length>1500)return null;
 try{
  const [datos,mac,extra]=token.split('.');if(!datos||!mac||extra)return null;
  const recibida=Buffer.from(mac,'base64url'),esperada=firma(datos,secreto);
  if(recibida.length!==esperada.length||!timingSafeEqual(recibida,esperada))return null;
  const p=JSON.parse(Buffer.from(datos,'base64url').toString('utf8'));
  if(p.v!==1||typeof p.id!=='string'||!/^[a-f0-9-]{36}$/.test(p.id)||p.ruta!==ruta||typeof p.vence!=='number'||p.vence<ahora||p.vence>ahora+120000||!Object.hasOwn(MENSAJES_EXITO,p.tipo))return null;
  return {id:p.id,...MENSAJES_EXITO[p.tipo as TipoExito]};
 }catch{return null;}
}
