import {obtenerAcceso} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
import {esIdSede} from '@/lib/validacion-sedes';
export async function GET(req:Request){
 const a=await obtenerAcceso();if(!a)return new Response(null,{status:401});
 if(!a.directorioNC)return new Response(null,{status:403});
 const p=new URL(req.url).searchParams,id=p.get('id'),funcionario=p.get('funcionario');
 if(!id||!funcionario||!esIdSede(id)||!esIdSede(funcionario))return new Response(null,{status:404});
 const foto=(await obtenerBaseDatos().query<{mime:string;contenido:Buffer}>('SELECT * FROM public.foto_directorio_nc($1,$2,$3)',[a.email,funcionario,id])).rows[0];
 if(!foto)return new Response(null,{status:404});
 return new Response(new Uint8Array(foto.contenido),{headers:{'Content-Type':foto.mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
