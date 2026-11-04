import 'server-only';
import PDFDocument from 'pdfkit';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {folioActa,type DatosActa} from '@/lib/validacion-actas';
import {CONDICIONES} from '@/lib/validacion-equipos';
const azul='#12578C',tinta='#183851',borde='#CAD8E3';
export async function generarPdfActa(d:DatosActa){
 const [regular,negrita]=await Promise.all(['gobCL_Regular.otf','gobCL_Bold.otf'].map(f=>readFile(join(process.cwd(),'src/app/fonts',f))));
 const doc=new PDFDocument({size:'A4',margin:42,bufferPages:true,autoFirstPage:false,info:{Title:folioActa(d.folio)+' · Acta de '+(d.tipo==='asignacion'?'asignación':'devolución'),Author:'SLEP Barrancas · UTIC',CreationDate:new Date(d.emitidoEn),ModDate:new Date(d.emitidoEn)}}),partes:Buffer[]=[];
 const terminado=new Promise<Buffer>((resolve,reject)=>{doc.on('data',c=>partes.push(c));doc.on('end',()=>resolve(Buffer.concat(partes)));doc.on('error',reject);});
 try{
 doc.registerFont('institucional',regular);doc.registerFont('institucional-negrita',negrita);
 const ancho=doc.page?.width??595.28,W=ancho-84;
 const nueva=()=>{doc.addPage();doc.save().rect(0,0,doc.page.width,77).fill(azul).fillColor('white').font('institucional-negrita').fontSize(16).text('SLEP BARRANCAS',42,24).font('institucional').fontSize(9).text('Unidad de Tecnologías de la Información y Comunicaciones',42,48).restore();doc.font('institucional').fontSize(10).fillColor(tinta);doc.y=99;};
 const espacio=(h:number)=>{if(doc.y+h>750)nueva();};
 const texto=(s:string,tam=10)=>{for(const linea of s.split(/\r?\n/)){doc.font('institucional').fontSize(tam);const h=doc.heightOfString(linea||' ',{width:W,lineGap:3});espacio(h+6);doc.font('institucional').fontSize(tam).text(linea||' ',42,doc.y,{width:W,lineGap:3});doc.y+=6;}};
 const seccion=(s:string)=>{doc.y+=8;espacio(35);doc.font('institucional-negrita').fontSize(12).fillColor(azul).text(s,42,doc.y);doc.fillColor(tinta);doc.y+=8;};
 const fila=(a:string,b:string)=>{doc.fontSize(10).font('institucional');const h=Math.max(doc.heightOfString(a,{width:145}),doc.heightOfString(b,{width:W-160}))+10;espacio(h);const y=doc.y;doc.save().strokeColor(borde).moveTo(42,y+h).lineTo(42+W,y+h).stroke().restore();doc.font('institucional-negrita').text(a,46,y+4,{width:140});doc.font('institucional').text(b||'Sin informar',200,y+4,{width:W-164});doc.y=y+h;};
 nueva();doc.font('institucional-negrita').fontSize(20).text('Acta de '+(d.tipo==='asignacion'?'asignación':'devolución'),42,doc.y);doc.y+=10;
 fila('Folio / versión',folioActa(d.folio)+' · Versión '+d.version);fila('Fecha del movimiento',d.fecha.split('-').reverse().join('/'));fila('Fecha de emisión',new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'short',timeZone:'America/Santiago'}).format(new Date(d.emitidoEn)));
 seccion('Origen, destino y participantes');fila('Origen',d.origen);fila('Destino',d.destino);if(d.rbd)fila('RBD',d.rbd);fila('Entrega',d.metadata.entregaNombre+' · RUN '+d.metadata.entregaRun);if(d.metadata.entregaCargo)fila('Cargo / unidad',d.metadata.entregaCargo);fila('Recibe',d.receptorNombre+' · RUN '+d.metadata.recibeRun);if(d.metadata.recibeCargo)fila('Cargo / unidad',d.metadata.recibeCargo);
 seccion('Detalle de bienes');
 for(const b of d.bienes){const valor=(...k:string[])=>String(k.map(x=>b[x]).find(v=>v!==null&&v!==undefined&&v!=='')??'');fila('Bien',d.clase==='celular'?'Celular':valor('categoriaNombre')||'Equipo');fila('Marca / modelo',[valor('marca'),valor('modelo')].filter(Boolean).join(' · ')||'Sin informar');fila('N.º inventario',valor('numero_inventario','inventario')||'Pendiente');if(d.clase==='celular'){fila('IMEI',valor('imei')||'Pendiente');fila('Teléfono',valor('telefono'));}else fila('Serie',valor('serie')||'Pendiente');const c=valor('condicion_tecnica','condicionTecnica');fila('Funcionamiento registrado',CONDICIONES[c as keyof typeof CONDICIONES]??'Sin verificar');}
 if(d.metadata.accesorios){seccion('Accesorios y condición de recepción');texto(d.metadata.accesorios);}
 if(d.metadata.observaciones){seccion('Observaciones');texto(d.metadata.observaciones);}
 texto('Se deja constancia del movimiento registrado y de los bienes indicados. Este documento conserva los datos de su emisión. Los espacios de firma corresponden a la suscripción de sus participantes; su generación no acredita una firma.',9);
 espacio(120);doc.y+=20;const y=doc.y;doc.font('institucional-negrita').text('ENTREGA',42,y,{width:W/2-16}).text('RECIBE',42+W/2+8,y,{width:W/2-16});doc.font('institucional').fontSize(9).text(d.metadata.entregaNombre+'\nRUN '+d.metadata.entregaRun,42,y+20,{width:W/2-16}).text(d.receptorNombre+'\nRUN '+d.metadata.recibeRun,42+W/2+8,y+20,{width:W/2-16});doc.strokeColor(borde).moveTo(42,y+86).lineTo(42+W/2-16,y+86).moveTo(42+W/2+8,y+86).lineTo(42+W,y+86).stroke();doc.text('Firma',42,y+90).text('Firma',42+W/2+8,y+90);
 const rango=doc.bufferedPageRange();for(let i=0;i<rango.count;i++){doc.switchToPage(i);doc.font('institucional').fontSize(8).fillColor(tinta);doc.text(folioActa(d.folio)+' · v'+d.version,42,doc.page.height-34,{lineBreak:false});doc.text(`Página ${i+1} de ${rango.count}`,doc.page.width-138,doc.page.height-34,{lineBreak:false});}
 doc.end();return await terminado;
 }catch(e){doc.destroy();throw e;}
}
