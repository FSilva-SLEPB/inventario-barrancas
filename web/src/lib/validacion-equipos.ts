import { esIdSede } from "@/lib/validacion-sedes";

export const ORIGENES = { compra_utic: "Compra gestionada por UTIC", compra_sede: "Compra propia de la sede",
  donacion: "Donación", otro: "Otro origen" } as const;
export const CONDICIONES = { sin_verificar: "Sin verificar", operativo: "Operativo",
  en_reparacion: "En reparación", fuera_de_servicio: "Fuera de servicio (sin baja formal)" } as const;
export const SITUACIONES = { registrado_nc: "Registrado en Nivel Central", pendiente_entrega: "Pendiente de entrega",
  recibido: "Recibido", recibido_historico: "Recibido según registro histórico" } as const;
export const CAMPOS_COMPRA = { anioEntrega: "Año de entrega", modalidadCompra: "Modalidad de adquisición",
  ordenCompra: "Número de OC", idAdquisicion: "ID de adquisición", cdp: "CDP", fechaOrdenCompra: "Fecha de OC",
  guiaFactura: "Guía o factura", condicionIngreso: "Condición al ingreso", financiamiento: "Financiamiento" } as const;
export type DatosEquipo = {
  id: string; sedeId: string; categoriaId: string; marca: string; modelo: string; serie: string; inventario: string;
  motivoIdentificacion: string; origen: keyof typeof ORIGENES; condicionTecnica: keyof typeof CONDICIONES;
  observaciones: string; compra: Record<keyof typeof CAMPOS_COMPRA, string>;
};
export type ValoresEquipo = Omit<DatosEquipo, "origen" | "condicionTecnica" | "compra"> & {
  origen: string; condicionTecnica: string; version: string; motivoCambio: string;
} & Record<keyof typeof CAMPOS_COMPRA, string>;
export type EstadoEquipo = { resultado: "inicial" | "error" | "guardado"; mensaje: string;
  valores: ValoresEquipo; errores: Partial<Record<keyof ValoresEquipo,string>>; revision: string;custodiaInicial?:string };
export function valoresEquipo(): ValoresEquipo {
  return { id:"",sedeId:"",categoriaId:"",marca:"",modelo:"",serie:"",inventario:"",motivoIdentificacion:"",
    origen:"compra_utic",condicionTecnica:"sin_verificar",observaciones:"",version:"0",motivoCambio:"",
    anioEntrega:"",modalidadCompra:"",ordenCompra:"",idAdquisicion:"",cdp:"",fechaOrdenCompra:"",
    guiaFactura:"",condicionIngreso:"",financiamiento:"" };
}
export function validarEquipo(formulario: FormData) {
  const valores=valoresEquipo(); const errores: EstadoEquipo["errores"]={};
  for (const campo of Object.keys(valores) as (keyof ValoresEquipo)[]) {
    const entradas=formulario.getAll(campo);
    if (entradas.length!==1 || typeof entradas[0]!=="string") { errores[campo]="Campo inválido o repetido."; continue; }
    const texto=entradas[0].normalize("NFC").trim();
    valores[campo]=texto;
    const limite=campo==="observaciones" ? 2000 : ["motivoCambio","motivoIdentificacion"].includes(campo) ? 500
      : campo==="modelo" ? 200 : Object.hasOwn(CAMPOS_COMPRA,campo) ? 250 : 120;
    if (texto.length>limite || /\p{Cc}/u.test(campo==="observaciones" ? texto.replace(/[\r\n\t]/g,"") : texto)) errores[campo]=`Usa hasta ${limite} caracteres sin controles ni saltos de línea.`;
  }
  if (valores.id && !esIdSede(valores.id)) errores.id="Equipo inválido.";
  for (const campo of ["sedeId","categoriaId"] as const) if (!esIdSede(valores[campo])) errores[campo]="Selecciona una opción válida.";
  for (const campo of ["marca","modelo"] as const) if (!valores[campo]) errores[campo]="Este dato es obligatorio.";
  for (const campo of ["serie","inventario"] as const) {
    if (/^(S\/?N|N\/?A|SIN (SERIE|INVENTARIO)|NO APLICA|-|0)$/iu.test(valores[campo]))
      errores[campo]="Deja el dato pendiente e indica el motivo; no uses identificadores genéricos.";
  }
  if ((!valores.serie || !valores.inventario) && !valores.motivoIdentificacion)
    errores.motivoIdentificacion="Indica por qué falta la serie o el número de inventario.";
  if (!Object.hasOwn(ORIGENES,valores.origen)) errores.origen="Selecciona el origen.";
  if (!Object.hasOwn(CONDICIONES,valores.condicionTecnica)) errores.condicionTecnica="Selecciona la condición técnica.";
  if (!/^\d{1,10}$/.test(valores.version) || Number(valores.version)>2147483646) errores.version="Versión inválida. Recarga.";
  if (valores.id && !valores.motivoCambio) errores.motivoCambio="Indica el motivo de la corrección.";
  if (valores.anioEntrega && !/^(19|20)\d{2}$/.test(valores.anioEntrega)) errores.anioEntrega="Indica el año con cuatro cifras.";
  const compra=Object.fromEntries(Object.keys(CAMPOS_COMPRA).map(k=>[k,valores[k as keyof typeof CAMPOS_COMPRA]])) as DatosEquipo["compra"];
  const datos: DatosEquipo | null=Object.keys(errores).length ? null : {
    id:valores.id,sedeId:valores.sedeId,categoriaId:valores.categoriaId,marca:valores.marca,modelo:valores.modelo,
    serie:valores.serie,inventario:valores.inventario,motivoIdentificacion:valores.motivoIdentificacion,
    origen:valores.origen as DatosEquipo["origen"],condicionTecnica:valores.condicionTecnica as DatosEquipo["condicionTecnica"],
    observaciones:valores.observaciones,compra,
  };
  return { datos,valores,errores };
}
