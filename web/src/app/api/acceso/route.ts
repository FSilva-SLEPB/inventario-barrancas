import {obtenerAcceso} from '@/lib/acceso';
export async function GET(){const a=await obtenerAcceso();return Response.json(a?{revision:a.revisionAcceso}:{} ,{status:a?200:401,headers:{'Cache-Control':'private, no-store'}});}
