import 'server-only';
import {exigirAdministrador} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
import {leerModeloDatos} from '@/lib/esquema-base';
export async function obtenerModeloDatos(){await exigirAdministrador();return leerModeloDatos(obtenerBaseDatos());}
