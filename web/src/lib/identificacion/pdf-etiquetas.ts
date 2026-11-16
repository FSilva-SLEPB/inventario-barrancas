import 'server-only';
import PDFDocument from 'pdfkit';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {make} from './qr-matrix.cjs';
import {contenidoQr,validarOpcionesEtiqueta,type BienIdentificacion,type OpcionesEtiqueta} from './reglas';
const mm=(n:number)=>n*72/25.4;
/** Adaptación del formato Adetec entregado: Carta, 3×10, 66,5×25 mm. */
export async function crearPdfEtiquetas(bienes:BienIdentificacion[],opciones:OpcionesEtiqueta){
 const o=validarOpcionesEtiqueta(opciones),cantidad=bienes.length*o.copias;
 if(!bienes.length||bienes.length>150||cantidad>300)throw new Error('Selecciona entre 1 y 150 equipos, con un máximo de 300 etiquetas.');
 const matrices=bienes.map(b=>{const texto=contenidoQr(b,o.campos);if(Buffer.byteLength(texto)>600)throw new Error('El QR contiene demasiados datos. Reduce los campos seleccionados.');const matriz=make(texto,'L');if(23/(matriz.getModuleCount()+8)<0.3)throw new Error('El QR queda demasiado denso para 23 mm. Reduce los campos seleccionados.');return matriz;});
 const [regular,negrita]=await Promise.all([readFile(join(process.cwd(),'src/app/fonts/gobCL_Regular.otf')),readFile(join(process.cwd(),'src/app/fonts/gobCL_Bold.otf'))]);
 const doc=new PDFDocument({size:'LETTER',margin:0,compress:true,info:{Title:'Etiquetas de inventario · SLEP Barrancas',Author:'SLEP Barrancas · Unidad TIC'}}),partes:Buffer[]=[];
 const resultado=new Promise<Buffer>((resolve,reject)=>{doc.on('data',b=>partes.push(b));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(partes)));});
 try{doc.registerFont('normal',regular);doc.registerFont('negrita',negrita);
  const texto=(t:string,x:number,y:number,w:number,tamano:number,bold=false)=>{doc.font(bold?'negrita':'normal').fontSize(tamano).fillColor('#192F46');let s=t;while(s&&doc.widthOfString(s)>w)s=s.slice(0,-1);if(s!==t){while(s&&doc.widthOfString(s+'…')>w)s=s.slice(0,-1);s+='…';}doc.text(s,x,y,{width:w,lineBreak:false});};
  for(let i=0;i<cantidad;i++){
   const posicion=o.posicion-1+i;if(i>0&&posicion%30===0)doc.addPage();
   const sitio=posicion%30,x=mm(4.2+(sitio%3)*70.5+o.ajusteX),y=mm(14.7+Math.floor(sitio/3)*25+o.ajusteY),w=mm(66.5),h=mm(25),b=bienes[Math.floor(i/o.copias)],qr=matrices[Math.floor(i/o.copias)],n=qr.getModuleCount(),paso=mm(23)/(n+8),qx=x+w-mm(24),qy=y+mm(1);
   doc.save().lineWidth(.25).strokeColor('#A6B6C7').rect(x,y,w,h).stroke();doc.rect(qx,qy,mm(23),mm(23)).fill('#FFFFFF');
   for(let fila=0;fila<n;fila++)for(let col=0;col<n;col++)if(qr.isDark(fila,col))doc.rect(qx+(col+4)*paso,qy+(fila+4)*paso,paso,paso).fill('#000000');
   const tx=x+mm(1.5),ancho=mm(40);
   texto('INVENTARIO UNIDAD TIC',tx,y+mm(2),ancho,6.6,true);texto('SLEP BARRANCAS',tx,y+mm(5.2),ancho,5.6);
   texto(b.inventario!,tx,y+mm(9),ancho,9,true);texto(b.tipo==='nivel_central'?b.categoria:'RBD '+(b.rbd||'Sin informar'),tx,y+mm(14),ancho,6.7,true);
   texto(b.tipo==='nivel_central'?'Nivel Central':b.sede,tx,y+mm(18),ancho,5.8);texto('QR: datos del equipo · solo lectura',tx,y+mm(21.5),ancho,4.8);doc.restore();
  }
  doc.end();return await resultado;
 }catch(e){doc.destroy();void resultado.catch(()=>{});throw e;}
}
