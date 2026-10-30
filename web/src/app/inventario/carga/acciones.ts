"use server";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { exigirAdministrador } from "@/lib/acceso";
import { listarSedes } from "@/lib/sedes";
import { listarCategorias } from "@/lib/catalogos";
import { prepararCargaEquipos } from "@/lib/preparar-carga-equipos";
import { obtenerBaseDatos } from "@/lib/db";
import { ErrorCargaCsv } from "@/lib/csv-equipos";
export type EstadoCarga={estado:"inicial"|"error"|"previa"|"guardado";mensaje:string;hash:string;total:number;
  errores:string[];avisos:string[];cantidadAvisos:number;vistas:{fila:number;rbd:string;categoria:string;marca:string;modelo:string;serie:string;inventario:string;estado:string}[]};
export async function procesarCarga(_anterior:EstadoCarga,f:FormData):Promise<EstadoCarga> {
  const actor=await exigirAdministrador();
  const base:EstadoCarga={estado:"error",mensaje:"",hash:"",total:0,errores:[],avisos:[],cantidadAvisos:0,vistas:[]};
  const archivo=f.get("archivo");const operacion=f.getAll("operacion");const hashes=f.getAll("hash");
  if(!(archivo instanceof File) || !/\.csv$/i.test(archivo.name) || archivo.size===0 || archivo.size>2*1024*1024
    || f.getAll("archivo").length!==1 || operacion.length!==1 || !["previa","confirmar"].includes(String(operacion[0])))
    return {...base,mensaje:"Selecciona un CSV UTF-8 de hasta 2 MB y una operación válida."};
  try {
    const buffer=new Uint8Array(await archivo.arrayBuffer());const hash=createHash("sha256").update(buffer).digest("hex");
    const texto=new TextDecoder("utf-8",{fatal:true}).decode(buffer);
    const [sedes,categorias]=await Promise.all([listarSedes(),listarCategorias()]);
    const preparado=prepararCargaEquipos(texto,sedes,categorias);
    const db=obtenerBaseDatos();
    // Un archivo ya confirmado no vuelve a crear equipos, aunque se reenvíe la petición.
    const existente=await db.query("SELECT cantidad FROM public.cargas_equipos WHERE sha256=$1",[hash]);
    if(existente.rows[0])return {...base,estado:"guardado",mensaje:`Este archivo ya fue cargado: ${existente.rows[0].cantidad} equipos. No se duplicaron.`,hash};
    const duplicados=await db.query(`SELECT count(*) FROM public.equipos WHERE upper(serie)=ANY($1::text[]) OR upper(numero_inventario)=ANY($2::text[])`,[preparado.series,preparado.inventarios]);
    if(Number(duplicados.rows[0].count))preparado.errores.push("Hay identificadores ya registrados en el sistema. No se sobrescriben equipos ni se muestran datos de otra ficha.");
    const estado={...base,hash,total:preparado.total,errores:preparado.errores.slice(0,100),avisos:preparado.avisos.slice(0,30),cantidadAvisos:preparado.avisos.length,vistas:preparado.vistas};
    if(preparado.errores.length)return {...estado,mensaje:`Hay ${preparado.errores.length} errores. Corrige el archivo; no se guardó ninguna fila.`};
    if(operacion[0]==="previa")return {...estado,estado:"previa",mensaje:"Vista previa preparada. Revisa los avisos antes de confirmar."};
    if(hashes.length!==1 || hashes[0]!==hash)return {...base,mensaje:"El archivo cambió. Genera nuevamente la vista previa."};
    if(f.getAll("aceptarAvisos").length!==1 || f.get("aceptarAvisos")!=="si")return {...estado,mensaje:"Confirma que revisaste los datos y avisos antes de cargar."};
    const nombre=archivo.name.split(/[\\/]/).pop()!.replace(/[\p{Cc}]/gu,"").slice(0,200)||"equipos.csv";
    const {rows}=await db.query("SELECT public.cargar_equipos_acceso($1,$2::jsonb,$3,$4) AS resultado",[actor.email,JSON.stringify(preparado.datos),nombre,hash]);
    revalidatePath("/inventario");return {...base,estado:"guardado",hash,mensaje:`Carga confirmada: ${rows[0].resultado.cantidad} equipos con historial.`,total:rows[0].resultado.cantidad};
  } catch(error) {
    const codigo=(error as {code?:string})?.code;
    if(codigo) return {...base,mensaje:codigo==="23505" ? "Un identificador se registró durante la revisión. Se canceló toda la carga sin cambios parciales."
      : "La carga no pudo confirmarse. Revisa permisos, sedes y categorías; no se guardaron cambios parciales."};
    if(error instanceof ErrorCargaCsv)return {...base,mensaje:error.message};
    if(error instanceof TypeError)return {...base,mensaje:"El archivo debe estar codificado como CSV UTF-8."};
    console.error("No se pudo procesar la carga de equipos.");return {...base,mensaje:"No se pudo procesar el archivo."};
  }
}
