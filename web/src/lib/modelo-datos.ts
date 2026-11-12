import 'server-only';
import {exigirPermiso} from '@/lib/acceso';
import {obtenerBaseDatos} from '@/lib/db';
import {leerModeloDatos} from '@/lib/esquema-base';
export async function obtenerModeloDatos(){await exigirPermiso('perfiles','consultar');return leerModeloDatos(obtenerBaseDatos());}
