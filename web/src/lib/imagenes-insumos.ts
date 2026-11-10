import 'server-only';
export const MAX_IMAGEN_INSUMO=5*1024*1024;
export function imagenInsumoValida(mime:string,b:Uint8Array){
 if(b.length<12||b.length>MAX_IMAGEN_INSUMO)return false;
 const hex=Buffer.from(b).subarray(0,8).toString('hex');
 return mime==='image/png'&&hex==='89504e470d0a1a0a'||mime==='image/jpeg'&&hex.startsWith('ffd8ff')||mime==='image/webp'&&Buffer.from(b).subarray(0,4).toString()==='RIFF'&&Buffer.from(b).subarray(8,12).toString()==='WEBP';
}
export function origenInsumoValido(req:Request){
 const esquema=req.headers.get('x-forwarded-proto')??new URL(req.url).protocol.slice(0,-1);
 const origen=req.headers.get('origin'),host=req.headers.get('x-forwarded-host')??req.headers.get('host');
 if(!origen||!host||host.includes(','))return false;
 try{const u=new URL(origen);return ['http','https'].includes(esquema)&&u.protocol===esquema+':'&&u.host===host&&u.origin===origen;}catch{return false;}
}
/** Limita el cuerpo incluso cuando el cliente utiliza transferencia sin Content-Length. */
export async function formularioImagenLimitado(req:Request,max=MAX_IMAGEN_INSUMO+65536){
 if(Number(req.headers.get('content-length'))>max)throw new Error('La imagen supera el tamaño permitido.');
 const lector=req.body?.getReader();if(!lector)throw new Error('Falta la imagen.');
 const bloques:Uint8Array[]=[];let total=0;
 try{for(;;){const {done,value}=await lector.read();if(done)break;total+=value.byteLength;if(total>max){await lector.cancel();throw new Error('La imagen supera el tamaño permitido.');}bloques.push(value);}}finally{lector.releaseLock();}
 return new Request(req.url,{method:'POST',headers:req.headers,body:new Uint8Array(Buffer.concat(bloques))}).formData();
}
