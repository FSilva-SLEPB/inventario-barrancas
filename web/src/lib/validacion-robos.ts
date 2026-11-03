import { esIdSede } from '@/lib/validacion-sedes';
export const ESTADOS_ROBO={reportado:'Reportado · pendiente de validación',validado:'Robo validado · sin recuperar',rechazado:'Reporte rechazado',recuperado:'Equipo recuperado'} as const;
export function fechaRobo(valor:unknown,hoy:string,minimo='1900-01-01'):string{
 if(typeof valor!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(valor)||valor<minimo||valor>hoy||new Date(valor+'T12:00:00Z').toISOString().slice(0,10)!==valor)throw new Error('Revisa la fecha indicada.');
 return valor;
}
export function textoRobo(valor:unknown,nombre:string,maximo:number,multilinea=false):string{
 if(typeof valor!=='string'||!valor.trim()||valor.trim().length>maximo||(multilinea?/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/:/\p{Cc}/u).test(valor))throw new Error(`Revisa ${nombre}.`);
 return valor.trim();
}
export function validarReporteRobo(f:FormData,hoy:string){
 for(const campo of ['solicitud','sedeId','fecha','lugar','descripcion','enlace'])if(f.getAll(campo).length!==1)throw new Error('Formulario inválido. Recarga la página.');
 const id=f.get('solicitud'),sedeId=f.get('sedeId');if(typeof id!=='string'||!esIdSede(id)||typeof sedeId!=='string'||!esIdSede(sedeId))throw new Error('Selecciona un establecimiento o Nivel Central.');
 const elegidos=f.getAll('equipo');if(!elegidos.length||elegidos.length>200)throw new Error('Selecciona entre 1 y 200 equipos.');
 const equipos=elegidos.map(v=>{if(typeof v!=='string')throw new Error('Selección inválida.');let e;try{e=JSON.parse(v);}catch{throw new Error('Selección inválida.');}if(!e||!esIdSede(e.id)||!Number.isInteger(e.version)||e.version<1)throw new Error('Selección inválida.');return {id:e.id as string,version:e.version as number};});
 if(new Set(equipos.map(e=>e.id)).size!==equipos.length)throw new Error('Hay equipos repetidos en la selección.');
 const enlace=f.get('enlace');if(typeof enlace!=='string'||enlace.length>1500||(enlace&&!/^https?:\/\/\S+$/i.test(enlace)))throw new Error('El enlace debe comenzar con https:// o http://.');
 if(enlace){let url:URL;try{url=new URL(enlace);}catch{throw new Error('Revisa el enlace a los antecedentes.');}if(url.username||url.password)throw new Error('El enlace no debe incluir credenciales.');}
 const lugar=f.get('lugar');if(typeof lugar!=='string')throw new Error('Revisa el lugar del incidente.');
 return {id,datos:{sedeId,fecha:fechaRobo(f.get('fecha'),hoy),lugar:lugar.trim()?textoRobo(lugar,'el lugar',300):'No informado',descripcion:textoRobo(f.get('descripcion'),'la descripción',3000,true),enlace,equipos}};
}
