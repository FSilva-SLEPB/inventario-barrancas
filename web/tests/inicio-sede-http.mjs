// Base y sesiones ficticias. Comprueba identidad de sede, alcance y navegación.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import pg from 'pg';
const {encode}=createRequire(import.meta.url)('next-auth/jwt'),origen=process.env.ACCESO_HTTP_URL;
assert.ok(origen&&process.env.TEST_ADMIN_DATABASE_URL&&process.env.DATABASE_URL);
const db=new pg.Client({connectionString:process.env.TEST_ADMIN_DATABASE_URL}),app=new pg.Client({connectionString:process.env.DATABASE_URL});
const suf=randomUUID(),ee=randomUUID(),ji=randomUUID();
const cuentas={ee:'inicio-ee-'+suf+'@slepb.gob.cl',ji:'inicio-ji-'+suf+'@slepb.gob.cl',gestor:'inicio-gestor-'+suf+'@slepb.gob.cl',admin:'inicio-admin-'+suf+'@slepb.gob.cl'};
const cookie=async correo=>'next-auth.session-token='+await encode({secret:process.env.NEXTAUTH_SECRET,token:{sub:'ficticio',correoInstitucional:correo},maxAge:900});
const pedir=async(ruta,correo)=>fetch(origen+ruta,{redirect:'manual',headers:{Cookie:await cookie(correo)}});
await db.connect();await app.connect();
try{
 for(const[id,tipo,nombre,rbd,direccion,comuna,correo]of [[ee,'establecimiento','Escuela inicio '+suf,'EE-'+suf,'Dirección EE '+suf,'Comuna EE '+suf,'escuela@example.org'],[ji,'jardin_infantil','Jardín inicio '+suf,'JI-'+suf,null,'Comuna JI '+suf,null]])await db.query('INSERT INTO public.sedes(id,tipo,nombre,rbd,direccion,comuna,correo_institucional,activo) VALUES($1,$2,$3,$4,$5,$6,$7,true)',[id,tipo,nombre,rbd,direccion,comuna,correo]);
 for(const[correo,rol,sede]of [[cuentas.ee,'encargado',ee],[cuentas.ji,'consulta_sede',ji],[cuentas.gestor,'gestor_insumos',null],[cuentas.admin,'administrador_gestion',null]])await app.query('SELECT public.guardar_usuario_acceso($1,$2,$3,$4,true,0,$5)',['felipe.silva@slepb.gob.cl',correo,'Persona ficticia',rol,sede]);
 for(const[k,id,tipo,propio,ajeno]of [['ee',ee,'Establecimiento','EE','JI'],['ji',ji,'Jardín infantil','JI','EE']]){
  const r=await pedir('/?sede='+(id===ee?ji:ee),cuentas[k]);assert.equal(r.status,200);const h=await r.text();assert.match(h,/Datos del establecimiento/);assert.ok(h.includes(tipo));assert.ok(h.includes(propio+'-'+suf));assert.ok(h.includes('Comuna '+propio+' '+suf));assert.equal(h.includes(ajeno+'-'+suf),false,'No muestra otra sede por cambiar la URL');
  if(k==='ee'){assert.ok(h.includes('Dirección EE '+suf));assert.ok(h.includes('escuela@example.org'));}else assert.match(h,/Sin informar/);
  const link=/<a\b[^>]*href="https:\/\/soporteti\.slepb\.gob\.cl\/"[^>]*>/.exec(h)?.[0];assert.ok(link);assert.match(link,/target="_blank"/);assert.match(link,/rel="noopener noreferrer"/);assert.match(h,/Sistema de tickets/);
 }
 for(const k of ['gestor','admin']){const h=await(await pedir('/',cuentas[k])).text();assert.doesNotMatch(h,/Datos del establecimiento/);assert.equal(h.includes('EE-'+suf)||h.includes('JI-'+suf),false);}
 for(const k of ['gestor','admin']){
  const p=await(await pedir('/insumos',cuentas[k])).text();assert.doesNotMatch(/<main\b[^>]*>([\s\S]*?)<\/main>/.exec(p)?.[1]??'',/Catálogo de insumos/,'El catálogo no se repite en Solicitudes');
  const r=await pedir('/mantenedores',cuentas[k]);assert.equal(r.status,200);const h=await r.text();assert.match(h,/Catálogo de insumos/);const tarjetas=h.match(/class="acceso-modulo"/g)||[];assert.equal(tarjetas.length,k==='gestor'?1:6);
 }
 console.log('Inicio por sede: EE/JI con identidad propia, datos faltantes explícitos, aislamiento ante URL alterada, acceso externo a tickets y catálogo único en Mantenedores comprobados.');
}finally{await db.query('UPDATE public.usuarios_acceso SET activo=false WHERE correo=ANY($1::text[])',[Object.values(cuentas)]);await app.end();await db.end();}
