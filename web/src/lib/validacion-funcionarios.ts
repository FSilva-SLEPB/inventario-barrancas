import {normalizarRut} from '@/lib/validacion-directorio';
export type DatosFuncionario={nombre:string;rut:string;correo:string;unidad:string;subdireccion:string;cargo:string;fechaIngreso:string;activo:boolean};
export const CAMPOS_FUNCIONARIO=['nombre','rut','correo','unidad','subdireccion','cargo','fechaIngreso'] as const;
export const ETIQUETAS_FUNCIONARIO:Record<keyof DatosFuncionario,string>={nombre:'Nombre completo',rut:'RUN',correo:'Correo institucional',unidad:'Unidad',subdireccion:'Subdirección',cargo:'Cargo',fechaIngreso:'Fecha de ingreso prevista o real',activo:'Estado'};
const limites={nombre:200,rut:12,correo:254,unidad:120,subdireccion:120,cargo:120,fechaIngreso:10};
export function validarFuncionario(d:Record<string,unknown>):DatosFuncionario{
 const valores={} as Record<typeof CAMPOS_FUNCIONARIO[number],string>;
 for(const k of CAMPOS_FUNCIONARIO){if(typeof d[k]!=='string')throw new Error('Revisa '+ETIQUETAS_FUNCIONARIO[k]+'.');const v=d[k].normalize('NFC').trim().replace(/ +/g,' ');if(v.length>limites[k]||/\p{Cc}/u.test(v))throw new Error('Revisa '+ETIQUETAS_FUNCIONARIO[k]+': longitud o caracteres inválidos.');valores[k]=v;}
 if(!valores.nombre)throw new Error('Indica el nombre completo del funcionario.');
 const rut=normalizarRut(valores.rut),correo=valores.correo.toLowerCase();
 if(correo&&!/^[a-z0-9._%+-]+@slepb\.gob\.cl$/.test(correo))throw new Error('Indica un correo institucional de slepb.gob.cl o déjalo pendiente.');
 const fecha=valores.fechaIngreso;
 const instante=fecha?new Date(fecha+'T12:00:00Z'):null;
 if(fecha&&(!/^\d{4}-\d{2}-\d{2}$/.test(fecha)||fecha<'1900-01-01'||fecha>'9999-12-31'||!instante||Number.isNaN(instante.valueOf())||instante.toISOString().slice(0,10)!==fecha))throw new Error('Revisa la fecha de ingreso.');
 if(typeof d.activo!=='boolean')throw new Error('Selecciona el estado del funcionario.');
 return {...valores,rut,correo,activo:d.activo};
}
export function cambiosFuncionario(antes:Record<string,unknown>|null,despues:Record<string,unknown>){
 const columnas:Record<keyof DatosFuncionario,string>={nombre:'nombre',rut:'rut',correo:'correo',unidad:'unidad',subdireccion:'subdireccion',cargo:'cargo',fechaIngreso:'fecha_ingreso',activo:'activo'};
 const mostrar=(k:keyof DatosFuncionario,v:unknown)=>k==='activo'?v===true?'Activo':'Inactivo':typeof v==='string'&&v?v:'Sin informar';
 return (Object.keys(columnas) as (keyof DatosFuncionario)[]).flatMap(k=>{const a=antes?.[columnas[k]],d=despues[columnas[k]];return antes?a===d?[]:[{campo:ETIQUETAS_FUNCIONARIO[k],antes:mostrar(k,a),despues:mostrar(k,d)}]:d===null||d===''?[]:[{campo:ETIQUETAS_FUNCIONARIO[k],antes:'Sin registrar',despues:mostrar(k,d)}];});
}
