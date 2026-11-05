import 'server-only';
import PDFDocument from 'pdfkit';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {folioActa,type DatosActa} from '@/lib/validacion-actas';
import {tituloDocumentoActa,condicionesActa} from '@/lib/modelo-actas';
import {CONDICIONES} from '@/lib/validacion-equipos';
const azul='#12578C',tinta='#183851',borde='#CAD8E3',margen=42,W=511.28;
export async function generarPdfActa(d:DatosActa){
 const [regular,negrita,logo]=await Promise.all([readFile(join(process.cwd(),'src/app/fonts/gobCL_Regular.otf')),readFile(join(process.cwd(),'src/app/fonts/gobCL_Bold.otf')),readFile(join(process.cwd(),'public/identidad/barrancas-blanco.png'))]);
 const doc=new PDFDocument({size:'A4',margins:{top:100,bottom:48,left:margen,right:margen},bufferPages:true,autoFirstPage:false,info:{Title:folioActa(d.folio)+' · '+tituloDocumentoActa(d),Author:'SLEP Barrancas · UTIC',CreationDate:new Date(d.emitidoEn),ModDate:new Date(d.emitidoEn)}}),partes:Buffer[]=[];
 const terminado=new Promise<Buffer>((resolve,reject)=>{doc.on('data',c=>partes.push(c));doc.on('end',()=>resolve(Buffer.concat(partes)));doc.on('error',reject);});
 try{
  doc.registerFont('institucional',regular);doc.registerFont('institucional-negrita',negrita);
  const cabecera=()=>{doc.save().rect(0,0,doc.page.width,82).fill(azul);doc.image(logo,margen,24,{fit:[146,48],valign:'center'});doc.fillColor('white').font('institucional-negrita').fontSize(10).text('SERVICIO LOCAL DE EDUCACIÓN PÚBLICA DE BARRANCAS',207,20,{width:346,lineGap:2});doc.font('institucional').fontSize(8).text('SUBDIRECCIÓN DE PLANIFICACIÓN Y CONTROL DE GESTIÓN',207,48,{width:346}).text('UNIDAD DE TECNOLOGÍAS DE LA INFORMACIÓN Y COMUNICACIONES',207,62,{width:346});doc.restore();doc.font('institucional').fontSize(9).fillColor(tinta);doc.x=margen;doc.y=100;};
  doc.on('pageAdded',cabecera);const nueva=()=>doc.addPage(),espacio=(h:number)=>{if(doc.y+h>doc.page.height-55)nueva();};
  const texto=(s:string,tam=9)=>{doc.font('institucional').fontSize(tam);for(const linea of s.split(/\r?\n/)){const h=doc.heightOfString(linea||' ',{width:W,lineGap:2});espacio(Math.min(h+6,doc.page.height-170));doc.font('institucional').fontSize(tam).text(linea||' ',margen,doc.y,{width:W,lineGap:2});doc.y+=6;}};
  const seccion=(s:string,minimo=45)=>{espacio(minimo);doc.y+=4;doc.font('institucional-negrita').fontSize(11).fillColor(azul).text(s,margen,doc.y,{width:W});doc.fillColor(tinta);doc.y+=4;};
  const fila=(a:string,b:string)=>{b=b||'No informado al registrar';doc.font('institucional').fontSize(9);const h=Math.max(doc.heightOfString(a,{width:136}),doc.heightOfString(b,{width:W-158}))+7;espacio(h);const y=doc.y;doc.save().strokeColor(borde).moveTo(margen,y+h).lineTo(margen+W,y+h).stroke().restore();doc.font('institucional-negrita').text(a,margen+3,y+3,{width:133});doc.font('institucional').text(b,margen+151,y+3,{width:W-155});doc.y=y+h;};
  const filaPar=(a:string,b:string,c:string,e:string)=>{const ancho=W/2,etiqueta=82,valor=ancho-etiqueta-9;doc.font('institucional').fontSize(9);const alto=Math.max(...[b||'Sin informar',e||'Sin informar'].map(v=>doc.heightOfString(v,{width:valor})),... [a,c].map(v=>doc.heightOfString(v,{width:etiqueta-6})))+7;espacio(alto);const y=doc.y;for(const [i,[l,v]]of [[a,b],[c,e]].entries()){const x=margen+i*ancho;doc.font('institucional-negrita').text(l,x+3,y+3,{width:etiqueta-6});doc.font('institucional').text(v||'Sin informar',x+etiqueta,y+3,{width:valor});}doc.save().strokeColor(borde).moveTo(margen,y+alto).lineTo(margen+W,y+alto).stroke().restore();doc.y=y+alto;};
  nueva();doc.font('institucional-negrita').fontSize(17).text(tituloDocumentoActa(d),margen,doc.y,{width:W});doc.y+=8;
  filaPar('Folio / versión',folioActa(d.folio)+' · v'+d.version,d.tipo==='entrega_historica'?'Fecha de entrega':'Fecha operación',d.fecha.split('-').reverse().join('/'));fila('Fecha de emisión',new Intl.DateTimeFormat('es-CL',{dateStyle:'short',timeStyle:'short',timeZone:'America/Santiago'}).format(new Date(d.emitidoEn)));
  if(d.tipo==='entrega_historica')texto('Documento emitido desde una entrega histórica registrada. Conserva sus bienes, fecha y receptora originales; no registra una nueva asignación. Los datos que no fueron informados al registrar permanecen identificados como tales.',8);
  seccion('Origen y destino');filaPar('Origen',d.origen,'Destino',d.destino);fila('Establecimiento / sede',d.sedeNombre);filaPar('RBD',d.rbd,'Comuna',d.sedeDatos?.comuna||d.comuna||'');fila('Dirección',d.sedeDatos?.direccion??'');
  seccion('Recibe');filaPar('Nombre',d.receptorNombre,'RUN',d.metadata.recibeRun);filaPar('Cargo',d.metadata.recibeCargo,'Correo',d.metadata.recibeCorreo);if(d.sedeTipo==='nivel_central'||d.metadata.recibeUnidad||d.metadata.recibeSubdireccion){filaPar('Unidad',d.metadata.recibeUnidad??'','Subdirección',d.metadata.recibeSubdireccion??'');}
  seccion('Detalle de bienes',80);texto(d.tipo==='devolucion'?'Se deja constancia de la devolución de los siguientes bienes a la Unidad TIC:':'La firma de este documento deja constancia de la recepción de los siguientes bienes, en el estado registrado:');
  const columnas=d.clase==='celular'?['N.º inventario','Equipamiento','Marca / modelo','IMEI','Teléfono']:['N.º inventario','Descripción','Marca','Modelo','Serie'],anchos=d.clase==='celular'?[83,75,137,108,108.28]:[85,95,76,131,124.28];
  const filaBien=(celdas:string[],encabezado=false,reserva=0)=>{doc.font(encabezado?'institucional-negrita':'institucional').fontSize(8.5);const alto=Math.max(...celdas.map((s,i)=>doc.heightOfString(s||'Sin informar',{width:anchos[i]-10})))+13;if(doc.y+alto+reserva>doc.page.height-55){nueva();if(!encabezado)filaBien(columnas,true);}const y=doc.y;let x=margen;
   celdas.forEach((s,i)=>{doc.save();if(encabezado)doc.rect(x,y,anchos[i],alto).fill('#EDF3F8');doc.rect(x,y,anchos[i],alto).strokeColor(borde).stroke();doc.restore();doc.fillColor(tinta).font(encabezado?'institucional-negrita':'institucional').fontSize(8.5).text(s||'Sin informar',x+5,y+5,{width:anchos[i]-10});x+=anchos[i];});doc.y=y+alto;};
  filaBien(columnas,true);
  for(const b of d.bienes){const valor=(...k:string[])=>String(k.map(x=>b[x]).find(v=>v!==null&&v!==undefined&&v!=='')??'');filaBien(d.clase==='celular'?[valor('numero_inventario','inventario'), 'Celular',[valor('marca'),valor('modelo')].filter(Boolean).join(' · '),valor('imei'),valor('telefono')]:[valor('numero_inventario','inventario'),valor('categoriaNombre')||'Equipo',valor('marca'),valor('modelo'),valor('serie')],false,20);const condicion=valor('condicion_tecnica','condicionTecnica');doc.y+=3;texto('Funcionamiento registrado: '+(CONDICIONES[condicion as keyof typeof CONDICIONES]??'Sin verificar'),8);}
  if(d.metadata.accesorios){seccion('Estado y accesorios');texto(d.metadata.accesorios);}
  if(d.metadata.observaciones){seccion('Observaciones');texto(d.metadata.observaciones);}
  seccion(d.tipo==='devolucion'?'Constancia de devolución':'Condiciones de uso y responsabilidades',65);
  for(const [i,c]of condicionesActa(d).entries())texto((d.tipo==='devolucion'?'':String(i+1)+'. ')+c,8.5);
  fila('Emisor del documento',d.actor);
  const participantes=[{titulo:'ENTREGA',nombre:d.metadata.entregaNombre||'No informado al registrar',run:d.metadata.entregaRun||'Sin informar',cargo:d.metadata.entregaCargo},{titulo:'RECIBE',nombre:d.receptorNombre,run:d.metadata.recibeRun||'Sin informar',cargo:d.metadata.recibeCargo}],col=W/2-12;
  doc.font('institucional').fontSize(9);const alto=Math.max(105,...participantes.map(p=>doc.heightOfString(p.nombre+'\nRUN '+p.run+(p.cargo?'\n'+p.cargo:''),{width:col})+75));espacio(alto+14);const y=doc.y+10;
  participantes.forEach((p,i)=>{const x=margen+i*(W/2+12);doc.font('institucional-negrita').fontSize(10).text(p.titulo,x,y,{width:col});doc.font('institucional').fontSize(9).text(p.nombre+'\nRUN '+p.run+(p.cargo?'\n'+p.cargo:''),x,y+20,{width:col});doc.save().strokeColor(borde).moveTo(x,y+alto-30).lineTo(x+col,y+alto-30).stroke().restore();doc.fontSize(8).text('Firma',x,y+alto-24,{width:col});});
  const rango=doc.bufferedPageRange();for(let i=0;i<rango.count;i++){doc.switchToPage(i);doc.font('institucional').fontSize(7.5).fillColor(tinta).text(folioActa(d.folio)+' · v'+d.version+' · Documento para suscripción',margen,doc.page.height-28,{lineBreak:false});doc.text(`Página ${i+1} de ${rango.count}`,doc.page.width-133,doc.page.height-28,{lineBreak:false});}
  doc.end();return await terminado;
 }catch(e){doc.destroy();throw e;}
}
