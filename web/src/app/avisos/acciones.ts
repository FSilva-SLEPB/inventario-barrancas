'use server';
import {obtenerAcceso} from '@/lib/acceso';
import {verificarRecibo} from '@/lib/recibo-guardado';
export async function validarAvisoExito(token:string,ruta:string){
 if(typeof token!=='string'||typeof ruta!=='string'||ruta.length>500||!await obtenerAcceso())return null;
 return verificarRecibo(token,ruta,process.env.NEXTAUTH_SECRET??'');
}
