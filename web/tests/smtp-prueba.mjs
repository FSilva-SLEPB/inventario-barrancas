// Servidor TLS local de prueba: no contacta proveedores ni destinatarios reales.
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:tls';
export async function iniciarSMTPPrueba(){
 const dir=await mkdtemp(join(tmpdir(),'inventario-smtp-prueba-')),key=join(dir,'clave.pem'),cert=join(dir,'ca.pem');
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1','-addext','basicConstraints=critical,CA:TRUE'],{stdio:'ignore'});
 const sockets=new Set();let numero=0;
 const server=createServer({key:await readFile(key),cert:await readFile(cert)},s=>{
  sockets.add(s);s.on('close',()=>sockets.delete(s));s.on('error',()=>{});s.setEncoding('utf8');s.write('220 localhost SMTP de prueba\r\n');let entrada='',datos=false,contenido=[],destinos=[],cola=Promise.resolve();
  s.on('data',chunk=>{entrada+=chunk;while(entrada.includes('\n')){const i=entrada.indexOf('\n'),linea=entrada.slice(0,i).replace(/\r$/,'');entrada=entrada.slice(i+1);cola=cola.then(async()=>{
   if(datos){if(linea!=='.'){contenido.push(linea.startsWith('..')?linea.slice(1):linea);return;}datos=false;await writeFile(join(dir,String(numero++).padStart(4,'0')+'.eml'),contenido.join('\r\n'),{mode:0o600});contenido=[];if(destinos.some(d=>d.includes('incierto@'))){s.destroy();return;}s.write('250 2.0.0 recibido por transporte ficticio\r\n');return;}
   const c=linea.toUpperCase();if(c.startsWith('EHLO'))s.write('250-localhost\r\n250-8BITMIME\r\n250 SIZE 8388608\r\n');else if(c.startsWith('MAIL FROM:')){destinos=[];s.write('250 OK\r\n');}else if(c.startsWith('RCPT TO:')){if(linea.includes('rechazado@'))s.write('550 5.1.1 rechazo ficticio\r\n');else{destinos.push(linea);s.write('250 OK\r\n');}}else if(c==='DATA'){datos=true;s.write('354 End data\r\n');}else if(c==='QUIT')s.end('221 Bye\r\n');else if(c==='RSET'){destinos=[];s.write('250 OK\r\n');}else s.write('250 OK\r\n');
  }).catch(()=>s.destroy());}});
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const ca=join(dir,'confianza.pem');let confianza='';if(process.env.NODE_EXTRA_CA_CERTS){try{confianza=await readFile(process.env.NODE_EXTRA_CA_CERTS,'utf8');}catch{}}
 await writeFile(ca,confianza+'\n'+await readFile(cert,'utf8'));
 return {dir,env:{ACTAS_SMTP_HOST:'127.0.0.1',ACTAS_SMTP_PUERTO:String(server.address().port),ACTAS_SMTP_TLS_DIRECTO:'si',ACTAS_CORREO_REMITENTE:'no-responder@slepb.gob.cl',NODE_EXTRA_CA_CERTS:ca,ACTAS_TEST_MAIL_DIR:dir},async cerrar(){for(const s of sockets)s.destroy();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}};
}
