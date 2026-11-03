import 'server-only';
import {emitirRecibo,type TipoExito} from '@/lib/recibo-guardado';
export function destinoConExito(destino:string,tipo:TipoExito='guardado'){
 const secreto=process.env.NEXTAUTH_SECRET;
 if(!secreto||!destino.startsWith('/')||destino.startsWith('//'))return destino;
 const url=new URL(destino,'http://interno.local');
 url.searchParams.set('aviso',emitirRecibo(url.pathname,tipo,secreto));
 return url.pathname+url.search+url.hash;
}
