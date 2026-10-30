import { cabeceraCsv, leerCsv, ErrorCargaCsv } from "@/lib/csv-equipos";
import { validarEquipo, valoresEquipo, type DatosEquipo } from "@/lib/validacion-equipos";
type SedeCarga={id:string;rbd:string|null;tipo:string;activo:boolean};
type CategoriaCarga={id:string;nombre:string;activo:boolean};
export type FilaCarga=DatosEquipo & {estadoHistorico:string;fechaEntrega:string;enlaceActa:string;filaOrigen:number};
export function prepararCargaEquipos(texto:string,sedes:SedeCarga[],categorias:CategoriaCarga[]) {
  const [cabeceras,...filas]=leerCsv(texto);const nombres=cabeceras.map(cabeceraCsv);
  if(new Set(nombres).size!==nombres.length)throw new ErrorCargaCsv("Hay encabezados repetidos.");
  const aliases={rbd:["rbd"],categoria:["categoria","tipodeequipamiento"],marca:["marca"],modelo:["modelo"],
    serie:["serie","ndeserie","nserie"],inventario:["inventario","ninventario"],estado:["estado"],
    motivoIdentificacion:["motivoidentificacion"],origen:["origen"],observaciones:["observaciones","detalleuobservaciones"],
    fechaEntrega:["fechaentrega","fechadeentregaaleeoji"],enlaceActa:["enlaceacta","linkentrega"],
    cantidad:["cantidad"],anioEntrega:["anioentrega","aniodeentrega","anodeentrega"],
    modalidadCompra:["modalidadcompra","adquision","adquisicion"],ordenCompra:["ordencompra","noc"],
    idAdquisicion:["idadquisicion","idadquision"],cdp:["cdp","ncdp"],fechaOrdenCompra:["fechaordencompra","fechaoc"],
    guiaFactura:["guiafactura","nguiafactura"],condicionIngreso:["condicioningreso","tipodeestado"],financiamiento:["financiamiento","tipodecompra"]};
  const indices=Object.fromEntries(Object.entries(aliases).map(([k,opciones])=>{
    const coincidencias=nombres.map((n,i)=>opciones.includes(n)?i:-1).filter(i=>i>=0);
    if(coincidencias.length>1)throw new ErrorCargaCsv(`Hay varias columnas para ${k}. Conserva una única columna de ese dato.`);
    return [k,coincidencias[0]??-1];
  }));
  for(const campo of ["rbd","categoria","marca","modelo","serie","inventario","estado"])
    if(indices[campo]<0)throw new ErrorCargaCsv(`Falta la columna ${campo}. Usa la plantilla o la hoja InventarioTotal exportada a CSV UTF-8.`);
  const datos:FilaCarga[]=[];const errores:string[]=[];const avisos:string[]=[];
  const vistas:{fila:number;rbd:string;categoria:string;marca:string;modelo:string;serie:string;inventario:string;estado:string}[]=[];
  const series=new Set<string>();const inventarios=new Set<string>();
  for(const [pos,fila] of filas.entries()) {
    const numero=pos+2;const leer=(k:string)=>indices[k]>=0 ? fila[indices[k]].normalize("NFC").trim() : "";
    const rbd=leer("rbd"); const candidatas=sedes.filter(s=>s.activo && (rbd==="NC" ? s.tipo==="nivel_central" : s.rbd===rbd));
    const cats=categorias.filter(c=>c.activo && c.nombre.normalize("NFC").toLocaleLowerCase("es")===leer("categoria").toLocaleLowerCase("es"));
    const valores=valoresEquipo();Object.assign(valores,{sedeId:candidatas.length===1?candidatas[0].id:"",categoriaId:cats.length===1?cats[0].id:"",
      marca:leer("marca"),modelo:leer("modelo"),serie:leer("serie"),inventario:leer("inventario"),origen:leer("origen")||"compra_utic",
      motivoIdentificacion:leer("motivoIdentificacion"),observaciones:leer("observaciones")});
    if((!valores.serie || !valores.inventario) && !valores.motivoIdentificacion)
      valores.motivoIdentificacion="Dato no informado en la planilla histórica; pendiente de completar.";
    for(const campo of ["anioEntrega","modalidadCompra","ordenCompra","idAdquisicion","cdp","fechaOrdenCompra","guiaFactura","condicionIngreso","financiamiento"] as const)
      valores[campo]=leer(campo);
    const f=new FormData();for(const [k,v] of Object.entries(valores))f.set(k,v);
    const validado=validarEquipo(f);
    if(!validado.datos) {
      const campos=Object.keys(validado.errores).map(c=>c==="sedeId"?"RBD sin sede activa única":c==="categoriaId"?"categoría sin correspondencia activa":c);
      errores.push(`Fila ${numero}: revisar ${campos.join(", ")}.`);
    }
    for(const [campo,conjunto] of [["serie",series],["inventario",inventarios]] as const) {
      const key=valores[campo].toUpperCase();if(!key)continue;
      if(conjunto.has(key))errores.push(`Fila ${numero}: ${campo} repetido dentro del archivo.`);conjunto.add(key);
    }
    const estado=leer("estado");if(!["Activo","En Bodega del SLEP"].includes(estado))errores.push(`Fila ${numero}: estado histórico no reconocido.`);
    if(leer("cantidad") && !/^1([.,]0+)?$/.test(leer("cantidad")))errores.push(`Fila ${numero}: cada registro debe representar un solo equipo.`);
    let fecha=leer("fechaEntrega");
    if(["--","-"].includes(fecha))fecha="";
    const partes=/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(fecha);
    if(partes)fecha=`${partes[3]}-${partes[2].padStart(2,"0")}-${partes[1].padStart(2,"0")}`;
    if(fecha && (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isFinite(Date.parse(fecha)) || new Date(fecha).toISOString().slice(0,10)!==fecha))errores.push(`Fila ${numero}: fecha de entrega inválida.`);
    const acta=leer("enlaceActa");const enlace=["--","-"].includes(acta)?"":acta;
    if(enlace && (!/^https?:\/\/[^\s]+$/i.test(enlace)||enlace.length>1500))errores.push(`Fila ${numero}: enlace de acta inválido.`);
    if(!fecha && estado==="Activo")avisos.push(`Fila ${numero}: recibido histórico sin fecha de entrega.`);
    if(!enlace && estado==="Activo")avisos.push(`Fila ${numero}: recibido histórico sin enlace de acta.`);
    if(!valores.serie || !valores.inventario)avisos.push(`Fila ${numero}: identificación pendiente con motivo registrado.`);
    if(validado.datos)datos.push({...validado.datos,estadoHistorico:estado,fechaEntrega:fecha,enlaceActa:enlace,filaOrigen:numero});
    if(vistas.length<20)vistas.push({fila:numero,rbd,categoria:leer("categoria"),marca:valores.marca,modelo:valores.modelo,serie:valores.serie,inventario:valores.inventario,estado});
  }
  return {datos,errores,avisos,vistas,total:filas.length,series:[...series],inventarios:[...inventarios]};
}
