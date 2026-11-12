import { cabeceraCsv, leerCsv, ErrorCargaCsv } from '@/lib/csv-equipos';
import { validarEquipo, valoresEquipo, type DatosEquipo } from '@/lib/validacion-equipos';
import {COLUMNAS_CARGA_INVENTARIO} from '@/lib/columnas-carga-inventario';
import {ESTADOS_ADMINISTRATIVOS_ACTIVO} from '@/lib/estados-activo';
type SedeCarga={id:string;rbd:string|null;tipo:string;activo:boolean};
type CategoriaCarga={id:string;nombre:string;activo:boolean};
export type FilaCarga=DatosEquipo & {estadoHistorico:string;fechaEntrega:string;enlaceActa:string;filaOrigen:number;cantidad:number;estadoAdministrativo:string;antecedentesCarga:Record<string,string>};
const administrativos:Record<string,string>={activo:'activo',robado:'robado',equiporobado:'robado',noencontrado:'no_encontrado',dadodebaja:'dado_de_baja'};
const condiciones:Record<string,string>={operativo:'operativo',enuso:'operativo',bodegadeti:'bodega_ti',bodegati:'bodega_ti',enbodegati:'bodega_ti',mantencion:'mantencion',malestado:'mal_estado',obsoleto:'obsoleto',sinverificar:'sin_verificar',enreparacion:'en_reparacion',fueradeservicio:'fuera_de_servicio'};
function fechaImportada(valor:string):string|null{
 if(['','-','--'].includes(valor))return '';
 const p=/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(valor);
 const iso=p?`${p[3]}-${p[2].padStart(2,'0')}-${p[1].padStart(2,'0')}`:valor;
 return /^\d{4}-\d{2}-\d{2}$/.test(iso)&&Number.isFinite(Date.parse(iso))&&new Date(iso).toISOString().slice(0,10)===iso?iso:null;
}
export function prepararCargaEquipos(texto:string,sedes:SedeCarga[],categorias:CategoriaCarga[]){
 const [cabeceras,...filas]=leerCsv(texto),nombres=cabeceras.map(cabeceraCsv);
 if(new Set(nombres).size!==nombres.length)throw new ErrorCargaCsv('Hay encabezados repetidos.');
 const aliases={rbd:['rbd'],categoria:['categoria','tipodeequipamiento'],marca:['marca'],modelo:['modelo'],serie:['serie','ndeserie','nserie'],inventario:['inventario','ninventario'],estado:['estado'],administrativo:['estadoadministrativo'],condicion:['estadocondicion','estadodecondicion','condiciontecnica'],motivoIdentificacion:['motivoidentificacion'],origen:['origen'],observaciones:['observaciones','detalleuobservaciones'],fechaEntrega:['fechaentrega','fechadeentregaaleeoji'],enlaceActa:['enlaceacta','linkentrega'],cantidad:['cantidad'],anioEntrega:['anioentrega','aniodeentrega','anodeentrega'],modalidadCompra:['modalidadcompra','adquision','adquisicion'],ordenCompra:['ordencompra','noc'],idAdquisicion:['idadquisicion','idadquision'],cdp:['cdp','ncdp'],fechaOrdenCompra:['fechaordencompra','fechaoc'],guiaFactura:['guiafactura','nguiafactura'],condicionIngreso:['condicioningreso','tipodeestado'],financiamiento:['financiamiento','tipodecompra']};
 const indices=Object.fromEntries(Object.entries(aliases).map(([k,opciones])=>{const c=nombres.map((n,i)=>opciones.includes(n)?i:-1).filter(i=>i>=0);if(c.length>1)throw new ErrorCargaCsv(`Hay varias columnas para ${k}. Conserva una única columna de ese dato.`);return [k,c[0]??-1];}));
 for(const campo of ['rbd','categoria','marca','modelo','serie','inventario'])if(indices[campo]<0)throw new ErrorCargaCsv(`Falta la columna ${campo}. Usa la plantilla de Inventario completo.`);
 const moderno=indices.administrativo>=0||indices.condicion>=0;
 if(moderno&&(indices.administrativo<0||indices.condicion<0))throw new ErrorCargaCsv('Incluye ESTADO ADMINISTRATIVO y ESTADO CONDICION.');
 if(!moderno&&indices.estado<0)throw new ErrorCargaCsv('Incluye ESTADO ADMINISTRATIVO y ESTADO CONDICION.');
 const datos:FilaCarga[]=[],errores:string[]=[],avisos:string[]=[],series=new Set<string>(),inventarios=new Set<string>();
 const vistas:{fila:number;rbd:string;categoria:string;marca:string;modelo:string;serie:string;inventario:string;estado:string;cantidad:number;antecedentes:Record<string,string>}[]=[];
 let total=0;
 for(const [pos,fila]of filas.entries()){
  const numero=pos+2,leer=(k:string)=>indices[k]>=0?fila[indices[k]].normalize('NFC').trim():'';
  const antecedente=Object.fromEntries(cabeceras.map((h,i)=>[h.normalize('NFC').trim(),fila[i].normalize('NFC').trim()]));
  const rbd=leer('rbd'),exactas=sedes.filter(s=>s.activo&&(rbd.toUpperCase()==='NC'?s.tipo==='nivel_central':s.rbd===rbd));
  const candidatas=exactas.length?exactas:/^\d+$/.test(rbd)?sedes.filter(s=>s.activo&&s.rbd?.split('-')[0]===rbd):[];
  const cats=categorias.filter(c=>c.activo&&c.nombre.normalize('NFC').toLocaleLowerCase('es')===leer('categoria').toLocaleLowerCase('es'));
  const valores=valoresEquipo();Object.assign(valores,{sedeId:candidatas.length===1?candidatas[0].id:'',categoriaId:cats.length===1?cats[0].id:'',marca:leer('marca'),modelo:leer('modelo'),serie:leer('serie'),inventario:leer('inventario'),origen:leer('origen')||'otro',motivoIdentificacion:leer('motivoIdentificacion'),observaciones:leer('observaciones')});
  if((!valores.serie||!valores.inventario)&&!valores.motivoIdentificacion)valores.motivoIdentificacion='Identificación no informada en la planilla importada; pendiente de completar.';
  if(!valores.serie&&!valores.observaciones)valores.observaciones='Número de serie no informado en la planilla importada; pendiente de identificación física.';
  for(const campo of ['anioEntrega','modalidadCompra','ordenCompra','idAdquisicion','cdp','fechaOrdenCompra','guiaFactura','condicionIngreso','financiamiento']as const)valores[campo]=leer(campo);
  if(valores.fechaOrdenCompra){const fecha=fechaImportada(valores.fechaOrdenCompra);if(fecha===null)errores.push(`Fila ${numero}: FECHA OC inválida.`);else valores.fechaOrdenCompra=fecha;}
  const historico=leer('estado'),admin=moderno?administrativos[cabeceraCsv(leer('administrativo'))]:'activo';
  if(!admin)errores.push(`Fila ${numero}: ESTADO ADMINISTRATIVO no reconocido.`);
  if(moderno){const condicion=leer('condicion');if(admin==='robado'||admin==='no_encontrado'){valores.condicionTecnica='';if(condicion)avisos.push(`Fila ${numero}: la condición queda vacía por el estado administrativo; el valor original se conserva.`);}else if(condicion){valores.condicionTecnica=condiciones[cabeceraCsv(condicion)]??'';if(!valores.condicionTecnica)errores.push(`Fila ${numero}: ESTADO CONDICION no reconocido.`);}else if(admin==='dado_de_baja')valores.condicionTecnica='sin_verificar';else errores.push(`Fila ${numero}: completa ESTADO CONDICION para un bien Activo.`);}
  else if(!['Activo','En Bodega del SLEP'].includes(historico))errores.push(`Fila ${numero}: estado histórico no reconocido.`);
  const estadoHistorico=moderno?(valores.condicionTecnica==='bodega_ti'?'En Bodega del SLEP':'Activo'):historico;
  const rawCantidad=leer('cantidad'),cantidad=indices.cantidad<0?1:/^[1-9]\d{0,3}$/.test(rawCantidad)?Number(rawCantidad):0;
  if(!Number.isInteger(cantidad)||cantidad<1||cantidad>2500)errores.push(`Fila ${numero}: CANTIDAD debe ser un entero entre 1 y 2500, sin puntos ni comas (por ejemplo, 1000).`);else total+=cantidad;
  if(cantidad>1&&(valores.serie||valores.inventario))errores.push(`Fila ${numero}: para varias unidades deja serie e inventario pendientes o separa cada bien en una fila con CANTIDAD 1. Un identificador individual no se puede repetir.`);
  if(cantidad>1)avisos.push(`Fila ${numero}: se crearán ${cantidad} bienes individuales, con identificación pendiente y sin series ni números de inventario inventados.`);
  const f=new FormData();for(const[k,v]of Object.entries(valores))f.set(k,v);const validado=validarEquipo(f);
  if(!validado.datos)errores.push(`Fila ${numero}: revisar ${Object.keys(validado.errores).map(c=>c==='sedeId'?'RBD sin sede activa única':c==='categoriaId'?'categoría sin correspondencia activa':c).join(', ')}.`);
  for(const[campo,conjunto]of [['serie',series],['inventario',inventarios]]as const){const key=valores[campo].toUpperCase();if(!key)continue;if(conjunto.has(key))errores.push(`Fila ${numero}: ${campo} repetido dentro del archivo.`);conjunto.add(key);}
  const fecha=fechaImportada(leer('fechaEntrega'));if(fecha===null)errores.push(`Fila ${numero}: fecha de entrega inválida.`);
  const acta=leer('enlaceActa'),enlace=['--','-'].includes(acta)?'':acta;if(enlace&&(!/^https?:\/\/[^\s]+$/i.test(enlace)||enlace.length>1500))errores.push(`Fila ${numero}: enlace de acta inválido.`);
  if(!fecha&&estadoHistorico==='Activo')avisos.push(`Fila ${numero}: recibido histórico sin fecha de entrega.`);
  if(!enlace&&estadoHistorico==='Activo')avisos.push(`Fila ${numero}: recibido histórico sin enlace de acta.`);
  if(!valores.serie||!valores.inventario)avisos.push(`Fila ${numero}: identificación pendiente con motivo registrado.`);
  if(admin==='dado_de_baja')avisos.push(`Fila ${numero}: baja declarada pendiente de validación TI; no se registra una baja formal ni se inventa su fecha. El bien no podrá asignarse hasta resolverla.`);
  if(validado.datos)datos.push({...validado.datos,estadoHistorico,estadoAdministrativo:admin??'',cantidad,antecedentesCarga:antecedente,fechaEntrega:fecha??'',enlaceActa:enlace,filaOrigen:numero});
  const resumido=Object.fromEntries(COLUMNAS_CARGA_INVENTARIO.map(h=>{const i=nombres.indexOf(cabeceraCsv(h));return[h,i>=0?fila[i].trim():''];}));
  if(vistas.length<20)vistas.push({fila:numero,rbd,categoria:leer('categoria'),marca:valores.marca,modelo:valores.modelo,serie:valores.serie,inventario:valores.inventario,estado:moderno?admin==='dado_de_baja'?'Baja declarada · pendiente TI':`${ESTADOS_ADMINISTRATIVOS_ACTIVO[admin as keyof typeof ESTADOS_ADMINISTRATIVOS_ACTIVO]??leer('administrativo')} · ${leer('condicion')||'Sin condición'}`:historico,cantidad,antecedentes:resumido});
 }
 if(total>2500)errores.push('La suma de CANTIDAD supera 2.500 bienes. Divide el archivo antes de confirmar.');
 return {datos,errores,avisos,vistas,total,filas:filas.length,series:[...series],inventarios:[...inventarios]};
}
