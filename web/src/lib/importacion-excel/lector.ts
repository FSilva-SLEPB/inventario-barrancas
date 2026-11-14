import {unzipSync,strFromU8} from 'fflate';
import {SaxesParser} from 'saxes';
export class ErrorExcel extends Error {}
export const MAX_EXCEL=5*1024*1024;
export type HojaExcel={nombre:string;ruta:string};
export type LibroExcel={hojas:HojaExcel[];leer:(nombre:string)=>{fila:number;celdas:string[]}[]};
const limiteXML=40*1024*1024;
function xml(bytes:Uint8Array,abrir:(n:string,a:Record<string,string>)=>void,cerrar:(n:string)=>void,texto:(s:string)=>void){
 const p=new SaxesParser({xmlns:false});let nivel=0;
 p.on('doctype',()=>{throw new ErrorExcel('El Excel contiene una declaración XML no permitida.');});
 p.on('opentag',t=>{if(++nivel>40)throw new ErrorExcel('XML demasiado anidado.');abrir(t.name.split(':').pop()!,t.attributes as Record<string,string>);});
 p.on('closetag',t=>{cerrar(t.name.split(':').pop()!);nivel--;});p.on('text',texto);p.on('cdata',texto);
 p.on('error',()=>{throw new ErrorExcel('El Excel contiene XML inválido.');});p.write(strFromU8(bytes)).close();
}
/** Solo OOXML: sin ejecutar fórmulas, macros, vínculos, DTD ni archivos del sistema. */
export function abrirExcel(bytes:Uint8Array):LibroExcel{
 if(bytes.length===0||bytes.length>MAX_EXCEL||bytes[0]!==80||bytes[1]!==75)throw new ErrorExcel('Selecciona un archivo .xlsx de hasta 5 MB.');
 const nombres=new Set<string>();let total=0,entradas=0;
 let archivos:Record<string,Uint8Array>;
 try{archivos=unzipSync(bytes,{filter:f=>{
  if(++entradas>1000||nombres.has(f.name)||f.name.includes('..')||f.name.startsWith('/')||f.name.includes('\\'))throw new ErrorExcel('Estructura ZIP no permitida.');
  nombres.add(f.name);total+=f.originalSize;
  if(total>limiteXML||f.originalSize>limiteXML)throw new ErrorExcel('El contenido descomprimido supera 40 MB.');
  if(/vbaProject|externalLinks|embeddings/i.test(f.name))throw new ErrorExcel('Usa un Excel sin macros, objetos incrustados ni vínculos externos de libro.');
  return /^(?:xl\/(?:workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|worksheets\/sheet\d+\.xml)|\[Content_Types\]\.xml)$/.test(f.name);
 }});}catch(e){if(e instanceof ErrorExcel)throw e;throw new ErrorExcel('No se pudo leer el archivo .xlsx.');}
 const requerido=(n:string)=>{if(!archivos[n])throw new ErrorExcel('Falta una parte del libro Excel.');return archivos[n];};
 const relaciones=new Map<string,string>();
 xml(requerido('xl/_rels/workbook.xml.rels'),(n,a)=>{if(n==='Relationship'&&a.TargetMode!=='External')relaciones.set(a.Id,a.Target);},()=>{},()=>{});
 const hojas:HojaExcel[]=[];let epoch1904=false;
 xml(requerido('xl/workbook.xml'),(n,a)=>{if(n==='workbookPr')epoch1904=['1','true'].includes(a.date1904);if(n==='sheet'&&a.state!=='hidden'&&a.state!=='veryHidden'){
  const target=relaciones.get(a['r:id'])??'';const ruta=target.startsWith('/xl/')?target.slice(1):'xl/'+target;
  if(!/^xl\/worksheets\/sheet\d+\.xml$/.test(ruta)||!archivos[ruta])throw new ErrorExcel('Hoja sin referencia válida.');
  hojas.push({nombre:a.name,ruta});
 }},()=>{},()=>{});
 if(!hojas.length||hojas.length>20||new Set(hojas.map(h=>h.nombre)).size!==hojas.length)throw new ErrorExcel('El libro debe tener entre 1 y 20 hojas visibles con nombres únicos.');
 const compartidas:string[]=[];let cadena='',enSi=false,enT=false;
 if(archivos['xl/sharedStrings.xml'])xml(archivos['xl/sharedStrings.xml'],n=>{if(n==='si'){enSi=true;cadena='';}if(n==='t')enT=true;},n=>{if(n==='t')enT=false;if(n==='si'){if(compartidas.length>=200000)throw new ErrorExcel('Demasiados textos compartidos.');compartidas.push(cadena);enSi=false;}},s=>{if(enSi&&enT){cadena+=s;if(cadena.length>16000)throw new ErrorExcel('Una celda supera 16.000 caracteres.');}});
 const formatos=new Map<number,string>(),estilos:number[]=[];let xfs=false;
 if(archivos['xl/styles.xml'])xml(archivos['xl/styles.xml'],(n,a)=>{if(n==='numFmt')formatos.set(Number(a.numFmtId),a.formatCode);if(n==='cellXfs')xfs=true;if(n==='xf'&&xfs)estilos.push(Number(a.numFmtId));},n=>{if(n==='cellXfs')xfs=false;},()=>{});
 function fecha(valor:string,estilo:number){const fmt=estilos[estilo],personal=formato(fmt);if(!([14,15,16,17,22,27,30,36,50,57].includes(fmt)||personal))return valor;
  const v=Number(valor);if(!Number.isFinite(v)||v<0||v>2958465)return '#FECHA_INVALIDA';
  if(!epoch1904&&v>=60&&v<61)return '#FECHA_INVALIDA';
  const base=epoch1904?Date.UTC(1904,0,1):Date.UTC(1899,11,30);return new Date(base+Math.floor(v+(epoch1904||v>=60?0:1))*86400000).toISOString().slice(0,10);
 }
 function formato(id:number){return /[dy]/i.test((formatos.get(id)??'').replace(/"[^"]*"|\[[^\]]*\]|\\./g,''));}
 return {hojas,leer(nombre){const hoja=hojas.find(h=>h.nombre===nombre);if(!hoja)throw new ErrorExcel('Selecciona una hoja visible del archivo.');
  const filas:{fila:number;celdas:string[]}[]=[];let fila=0,celdas:string[]=[],col=0,tipo='',estilo=0,v='',inline='',captura='',formula=false,cache=false,cuenta=0;const vistas=new Set<number>();
  xml(requerido(hoja.ruta),(n,a)=>{
   if(n==='row'){fila=Number(a.r);if(!Number.isInteger(fila)||fila<1||fila>10000||vistas.has(fila))throw new ErrorExcel('Fila fuera de rango o repetida.');vistas.add(fila);celdas=[];}
   if(n==='c'){
    const ref=/^([A-Z]{1,3})(\d+)$/.exec(a.r??'');if(!ref||Number(ref[2])!==fila)throw new ErrorExcel('Referencia de celda inválida.');
    col=[...ref[1]].reduce((a,c)=>a*26+c.charCodeAt(0)-64,0)-1;
    if(col>=128||celdas[col]!==undefined||++cuenta>200000)throw new ErrorExcel('La hoja supera 128 columnas o 200.000 celdas.');
    tipo=a.t??'';estilo=Number(a.s??0);v='';inline='';formula=false;cache=false;
   }
   if(n==='f')formula=true;if(n==='v'){captura='v';cache=true;}if(n==='t')captura='t';
  },n=>{
   if(n==='v'||n==='t')captura='';if(n==='c'){
    let valor=tipo==='s'?compartidas[Number(v)]:tipo==='inlineStr'?inline:v;
    if(valor===undefined||tipo==='e'||formula&&!cache)valor='#REVISAR_FORMULA';
    if(!tipo&&v&&cache)valor=fecha(v,estilo);
    celdas[col]=valor.normalize('NFC').trim();
   }
   if(n==='row'&&celdas.some(c=>c?.trim())){if(filas.length>=5001)throw new ErrorExcel('La hoja admite hasta 5.000 filas de datos.');filas.push({fila,celdas});}
  },s=>{if(captura==='v')v+=s;if(captura==='t')inline+=s;if(v.length>16000||inline.length>16000)throw new ErrorExcel('Una celda supera 16.000 caracteres.');});
  return filas;
 }};
}
