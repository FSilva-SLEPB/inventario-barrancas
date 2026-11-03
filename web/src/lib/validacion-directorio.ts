import { leerCsv, cabeceraCsv } from '@/lib/csv-equipos';
export const SITUACIONES_DIRECTOR={titular:'Titular',subrogante:'Subrogante',vacante:'Cargo vacante',pendiente:'Responsable pendiente'} as const;
export type DatosDirectorio={nombre:string;rut:string;correo:string;situacion:keyof typeof SITUACIONES_DIRECTOR;observaciones:string;sedeNombre:string;direccion:string;comuna:string;correoInstitucional:string};
export type FilaDirectorio=DatosDirectorio&{sedeId:string;version:number;sedeVersion:string};
export type SedeDirectorio={sedeId:string;rbd:string|null;sedeNombre:string;nombre:string|null;version:number;rut?:string|null;correo?:string|null;situacion?:string|null;observaciones?:string|null;direccion?:string|null;comuna?:string|null;correoInstitucional?:string|null;sedeVersion?:string};
export type VistaDirectorio={rbd:string;sede:string;anterior:string;nuevo:string;cambios:{campo:string;antes:string;despues:string}[]};
const limites={nombre:200,rut:12,correo:254,observaciones:2000,sedeNombre:200,direccion:250,comuna:100,correoInstitucional:254};
export function nombreResponsable(valor:unknown):string{
 const nombre=texto(valor,'nombre',200);if(!nombre)throw new Error('Escribe el nombre del director o directora.');return nombre;
}
function texto(valor:unknown,campo:string,maximo:number):string{
 if(typeof valor!=='string')throw new Error(`Revisa ${campo}.`);
 const v=valor.normalize('NFC').trim().replace(/ +/g,' ');
 if(v.length>maximo||/\p{Cc}/u.test(v))throw new Error(`Revisa ${campo}: hasta ${maximo} caracteres, sin saltos de línea.`);return v;
}
export function normalizarRut(valor:unknown):string{
 if(typeof valor!=='string')throw new Error('Revisa el RUN del responsable.');const v=valor.trim().replaceAll('.','').toUpperCase();if(!v)return '';
 if(!/^\d{7,8}-[\dK]$/.test(v))throw new Error('El RUN debe tener formato 12345678-5.');
 const [cuerpo,dv]=v.split('-');let suma=0;[...cuerpo].reverse().forEach((n,i)=>{suma+=Number(n)*(2+i%6);});const resto=11-suma%11,esperado=resto===11?'0':resto===10?'K':String(resto);
 if(dv!==esperado)throw new Error('Revisa el dígito verificador del RUN.');return v;
}
function correo(valor:unknown,campo:string):string{
 const v=texto(valor,campo,254);if(!v||/^-+$/.test(v))return '';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))throw new Error(`Revisa ${campo}.`);return v.toLowerCase();
}
export function validarDatosDirectorio(d:Record<string,unknown>):DatosDirectorio{
 const situacion=d.situacion;
 if(typeof situacion!=='string'||!Object.hasOwn(SITUACIONES_DIRECTOR,situacion))throw new Error('Selecciona la situación del cargo.');
 const nombre=texto(d.nombre,'nombre',limites.nombre),rut=normalizarRut(d.rut),contacto=correo(d.correo,'el correo del responsable');
 const vigente=situacion==='titular'||situacion==='subrogante';
 if(vigente&&!nombre)throw new Error('Indica el nombre del responsable vigente.');
 if(!vigente&&(nombre||rut||contacto))throw new Error('Un cargo vacante o pendiente debe quedar sin persona vigente; el historial conserva a la anterior.');
 const sedeNombre=texto(d.sedeNombre,'nombre del establecimiento',200);if(!sedeNombre)throw new Error('Escribe el nombre del establecimiento.');
 return {nombre,rut,correo:contacto,situacion:situacion as DatosDirectorio['situacion'],observaciones:texto(d.observaciones,'observaciones',2000),sedeNombre,direccion:texto(d.direccion,'dirección',250),comuna:texto(d.comuna,'comuna',100),correoInstitucional:correo(d.correoInstitucional,'el correo institucional')};
}
export function datosDesdeSede(s:SedeDirectorio):DatosDirectorio{return {nombre:s.nombre??'',rut:s.rut??'',correo:s.correo??'',situacion:(s.situacion??(s.nombre?'titular':'pendiente')) as DatosDirectorio['situacion'],observaciones:s.observaciones??'',sedeNombre:s.sedeNombre,direccion:s.direccion??'',comuna:s.comuna??'',correoInstitucional:s.correoInstitucional??''};}
export function versionSede(s:SedeDirectorio):string{return JSON.stringify([s.sedeNombre,s.direccion??'',s.comuna??'',s.correoInstitucional??'']);}
const alias:Record<string,string[]>={
 rbd:['rbd'],nombre:['nombre','directora','director','nombredirector','nombredirectora','nombredeldirector','nombredeladirectora','directoradirector','directoras'],
 rut:['rut','run','rutdirectora','rundirectora','rutdirector','rundirector'],correo:['correo','correodirector','correodirectora','correospersonales','correocontacto'],situacion:['situacion','situaciondelcargo','tipodecese'],
 observaciones:['observaciones','fechaactualizacionyobservaciones'],sedeNombre:['establecimiento','nombredelestablecimiento','sedenombre'],direccion:['direccion'],comuna:['comuna'],correoInstitucional:['correoinstitucional','correoelectronicoestablecimiento']
};
export function prepararDirectorio(textoFuente:string,sedes:SedeDirectorio[]){
 // La planilla pegada desde Excel conserva tabulaciones; se convierte a CSV sin alterar celdas.
 const textoCsv=textoFuente.split(/\r?\n/,1)[0].includes('\t')?textoFuente.split(/\r?\n/).map(l=>l.split('\t').map(c=>'"'+c.replaceAll('"','""')+'"').join(',')).join('\n'):textoFuente;
 const filas=leerCsv(textoCsv),cab=filas.shift()!.map(cabeceraCsv);if(filas.length>1000)throw new Error('El directorio admite hasta 1.000 filas por carga.');
 const columnas:Record<string,number>={};for(const[k,nombres]of Object.entries(alias)){const candidatos=cab.flatMap((v,i)=>nombres.includes(v)?[i]:[]);if(candidatos.length>1)throw new Error(`La columna ${k} aparece repetida o tiene encabezados ambiguos.`);if(candidatos.length)columnas[k]=candidatos[0];}
 if(columnas.rbd===undefined||columnas.nombre===undefined)throw new Error('El archivo debe tener una columna RBD y una columna Nombre o DIRECTOR/A.');
 if(cab.some((_,i)=>!Object.values(columnas).includes(i)))throw new Error('Hay columnas no reconocidas. Usa la plantilla o el listado maestro de establecimientos.');
 const datos:FilaDirectorio[]=[],vista:VistaDirectorio[]=[],omitidas:{fila:number;rbd:string;sede:string;motivo:string}[]=[],vistos=new Set<string>();
 for(const[i,f]of filas.entries()){
  const codigo=f[columnas.rbd].trim(),nombreSede=columnas.sedeNombre===undefined?'':f[columnas.sedeNombre].trim();
  if(!sedes.some(s=>s.rbd===codigo)&&/^(servicio local de educaci[oó]n p[uú]blica|nivel central)\b/i.test(nombreSede)){omitidas.push({fila:i+2,rbd:codigo,sede:nombreSede,motivo:'Corresponde a Nivel Central; este directorio reúne establecimientos y JISC.'});continue;}
  const s=sedes.find(s=>s.rbd===codigo);if(!s||!codigo)throw new Error(`Fila ${i+2}: el RBD no corresponde a un establecimiento/JISC activo.`);
  if(vistos.has(s.sedeId))throw new Error(`Fila ${i+2}: RBD repetido.`);vistos.add(s.sedeId);
  try{
   const nombre=f[columnas.nombre].trim(),mismo=nombre.normalize('NFC')===(s.nombre??'').normalize('NFC');
   const estadoFuente=columnas.situacion===undefined?'':cabeceraCsv(f[columnas.situacion]);
   const estados:Record<string,DatosDirectorio['situacion']>={vigencianormal:'titular',titular:'titular',subrogante:'subrogante',subrogancia:'subrogante',subdorgancia:'subrogante',vacante:'vacante',cargovacante:'vacante',pendiente:'pendiente',responsablependiente:'pendiente'};
   if(estadoFuente&&!estados[estadoFuente])throw new Error('Situación del cargo no reconocida.');
   const situacion=estadoFuente?estados[estadoFuente]:nombre?(mismo&&s.situacion&&Object.hasOwn(SITUACIONES_DIRECTOR,s.situacion)?s.situacion:'titular'):'pendiente';
   const valor=(k:keyof DatosDirectorio,actual:string|null|undefined)=>columnas[k]===undefined?actual??'':f[columnas[k]];
   const d=validarDatosDirectorio({nombre,rut:valor('rut',mismo?s.rut:''),correo:valor('correo',mismo?s.correo:''),situacion,observaciones:valor('observaciones',mismo?s.observaciones:''),sedeNombre:valor('sedeNombre',s.sedeNombre),direccion:valor('direccion',s.direccion),comuna:valor('comuna',s.comuna),correoInstitucional:valor('correoInstitucional',s.correoInstitucional)});
   const labels:Record<keyof DatosDirectorio,string>={nombre:'Director/a',rut:'RUN',correo:'Correo del responsable',situacion:'Situación del cargo',observaciones:'Actualización y observaciones',sedeNombre:'Establecimiento/JISC',direccion:'Dirección',comuna:'Comuna',correoInstitucional:'Correo institucional'};
   const cambios=Object.entries(labels).flatMap(([k,label])=>{const antes=(s as unknown as Record<string,unknown>)[k]??'',despues=d[k as keyof DatosDirectorio];return antes===despues?[]:[{campo:label,antes:k==='situacion'?SITUACIONES_DIRECTOR[antes as keyof typeof SITUACIONES_DIRECTOR]??'Sin registrar':String(antes)||'Sin informar',despues:k==='situacion'?SITUACIONES_DIRECTOR[despues as keyof typeof SITUACIONES_DIRECTOR]:despues||'Sin informar'}];});
   datos.push({...d,sedeId:s.sedeId,version:s.version,sedeVersion:versionSede(s)});vista.push({rbd:codigo,sede:s.sedeNombre,anterior:s.nombre??'Sin registrar',nuevo:d.nombre||SITUACIONES_DIRECTOR[d.situacion],cambios});
  }catch(e){throw new Error(`Fila ${i+2}: ${e instanceof Error?e.message:'Revisa los datos.'}`);}
 }
 if(!datos.length)throw new Error('No hay establecimientos/JISC para cargar.');return {datos,vista,omitidas};
}
export function cambiosDirectorio(antes:Record<string,unknown>|null,despues:Record<string,unknown>){
 const campos:Record<string,string>={nombre:'Nombre completo',nombres:'Nombres Director/a',apellidos:'Apellidos',rut:'RUN',correo:'Correo del responsable',situacion:'Situación del cargo',cargo:'Cargo',observaciones:'Actualización y observaciones','sede.rbd':'RBD','sede.nombre':'Establecimiento/JISC','sede.direccion':'Dirección','sede.comuna':'Comuna','sede.correo_institucional':'Correo institucional'};
 const leer=(obj:Record<string,unknown>|null,k:string):unknown=>k.startsWith('sede.')?(obj?.sede as Record<string,unknown>|undefined)?.[k.slice(5)]:obj?.[k];
 const mostrar=(k:string,v:unknown)=>k==='situacion'?SITUACIONES_DIRECTOR[v as keyof typeof SITUACIONES_DIRECTOR]??'Sin registrar':typeof v==='string'&&v?v:'Sin informar';
 return Object.entries(campos).flatMap(([k,campo])=>{const a=leer(antes,k),d=leer(despues,k);return antes?a===d?[]:[{campo,antes:mostrar(k,a),despues:mostrar(k,d)}]:!d?[]:[{campo,antes:'Sin registrar',despues:mostrar(k,d)}];});
}
export const CAMPOS_DIRECTORIO=['nombre','rut','correo','situacion','observaciones','sedeNombre','direccion','comuna','correoInstitucional'] as const;
