import {esIdSede} from '@/lib/validacion-sedes';
import {CONDICIONES} from '@/lib/validacion-equipos';
export const CAMPOS_CELULAR=['sedeId','telefono','marca','modelo','imei','inventario','condicionTecnica','responsable','observaciones'] as const;
export type DatosCelular=Record<typeof CAMPOS_CELULAR[number],string>&{activo:boolean};
export const celularVacio=():DatosCelular=>({sedeId:'',telefono:'',marca:'',modelo:'',imei:'',inventario:'',condicionTecnica:'sin_verificar',responsable:'',observaciones:'',activo:true});
export function normalizarTelefono(valor:string){
 let n=valor.trim().replace(/[\s().-]/gu,'');if(/^9\d{8}$/.test(n))n='+56'+n;else if(/^569\d{8}$/.test(n))n='+'+n;
 if(!/^[+]569\d{8}$/.test(n))throw new Error('Indica un número móvil chileno válido, por ejemplo +56 9 1234 5678.');return n;
}
export function validarImei(imei:string){
 if(!/^\d{15}$/.test(imei))return false;let suma=0;for(let i=0;i<15;i++){let d=Number(imei[i]);if(i%2===1){d*=2;if(d>9)d-=9;}suma+=d;}return suma%10===0;
}
export function validarCelular(v:Record<string,unknown>):DatosCelular{
 const r=celularVacio();for(const k of CAMPOS_CELULAR){if(typeof v[k]!=='string')throw new Error('Revisa los campos del formulario.');r[k]=v[k].normalize('NFC').trim();
  const max=k==='observaciones'?2000:['modelo','responsable'].includes(k)?200:k==='imei'?15:k==='sedeId'?36:k==='telefono'?30:120;
  if(r[k].length>max||/\p{Cc}/u.test(k==='observaciones'?r[k].replace(/[\r\n\t]/g,''):r[k]))throw new Error('Revisa la longitud y los caracteres de los datos.');
 }
 if(!esIdSede(r.sedeId))throw new Error('Selecciona una sede válida.');r.telefono=normalizarTelefono(r.telefono);
 if(r.imei&&!validarImei(r.imei))throw new Error('Revisa el IMEI: debe tener 15 dígitos y un dígito verificador válido.');
 if(!Object.hasOwn(CONDICIONES,r.condicionTecnica)||typeof v.activo!=='boolean')throw new Error('Selecciona un funcionamiento y una vigencia válidos.');r.activo=v.activo;return r;
}
export function filtrosCelulares(fuente:string){
 const p=new URLSearchParams(fuente),r=new URLSearchParams();for(const[k,max]of [['q',150],['rbd',120],['vista',20],['tipo',30],['sede',36],['estado',10],['pagina',7],['limite',3]] as const){const v=p.get(k);if(v!==null)r.set(k,v.slice(0,max));}return r;
}
export function enlaceCelulares(filtros='',accion?:'ver'|'editar'|'nuevo',id?:string){
 const p=filtrosCelulares(filtros);if(accion==='nuevo')p.set('nuevo','1');else if(accion&&id&&esIdSede(id))p.set(accion,id);return '/inventario/celulares'+(p.size?'?'+p:'');
}
export const ETIQUETAS_CELULAR:Record<string,string>={custodia:'Estado',sedeNombre:'Sede',rbd:'RBD',telefono:'Número de teléfono',marca:'Marca',modelo:'Modelo',imei:'IMEI',inventario:'Número de inventario',condicionTecnica:'Funcionamiento',responsable:'Responsable o uso',observaciones:'Observaciones',activo:'Vigencia'};
