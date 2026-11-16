import {obtenerAcceso} from '@/lib/acceso';
import {puedeImportarExcel} from '@/lib/importacion-excel/permisos';
import {plantillaP02} from '@/lib/p02/plantilla';
export async function GET(){const a=await obtenerAcceso();if(!a)return new Response(null,{status:401});if(!puedeImportarExcel(a,'establecimientos'))return new Response(null,{status:403});return new Response(new Uint8Array(plantillaP02()),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="Plantilla-P02.xlsx"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
