// Solo datos sintéticos en una base temporal; no utiliza Google ni datos de planillas.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import pg from 'pg';
const { encode } = createRequire(import.meta.url)('next-auth/jwt');
const origen = process.env.ACCESO_HTTP_URL;
assert.ok(origen && process.env.NEXTAUTH_SECRET && process.env.TEST_ADMIN_DATABASE_URL);
const db = new pg.Client({ connectionString: process.env.TEST_ADMIN_DATABASE_URL });
const app = new pg.Client({ connectionString: process.env.DATABASE_URL });
const sufijo = randomUUID();
const correos = Object.fromEntries(['gestion', 'encargado', 'local', 'general', 'nuevo', 'gestion2'].map(
  rol => [rol, `prueba-${rol}-${sufijo}@slepb.gob.cl`]));
const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const deps = [randomUUID(), randomUUID()];
let comprobaciones = 0;
const cookie = async email => 'next-auth.session-token=' + await encode({ secret: process.env.NEXTAUTH_SECRET,
  token: { sub: 'identidad-ficticia', correoInstitucional: email, rol: 'administrador', sedeId: ids[1] }, maxAge: 600 });
const pedir = (ruta, sesion) => fetch(origen + ruta, { redirect: 'manual', headers: { Cookie: sesion } });
function accion(html) {
  const dec = s => s.replaceAll('&quot;', '"').replaceAll('&#x27;', "'").replaceAll('&amp;', '&');
  const campos = [];
  for (const [input] of html.matchAll(/<input\b[^>]*>/g)) {
    if (!input.includes('type="hidden"')) continue;
    const nombre = /\bname="([^"]+)"/.exec(input)?.[1];
    if (nombre?.startsWith('$ACTION')) campos.push([dec(nombre), dec(/\bvalue="([^"]*)"/.exec(input)?.[1] ?? '')]);
  }
  assert.ok(campos.length);
  return campos;
}
async function guardar(ruta, campos, valores, sesion) {
  const f = new FormData();
  for (const [k,v] of [...campos, ...Object.entries(valores)]) f.append(k,v);
  return fetch(origen + ruta, { method: 'POST', redirect: 'manual', body: f,
    headers: { Origin: new URL(origen).origin, Cookie: sesion } });
}
async function fallaSql(parametros, codigo) {
  await assert.rejects(app.query('SELECT public.guardar_usuario_acceso($1,$2,$3,$4,$5,$6,$7::uuid)', parametros),
    error => error.code === codigo);
  comprobaciones++;
}
await db.connect();
await app.connect();
try {
  await db.query(`INSERT INTO public.sedes(id,tipo,nombre,activo) VALUES
    ($1,'establecimiento',$5,true),($2,'jardin_infantil',$6,true),
    ($3,'nivel_central',$7,true),($4,'establecimiento',$8,false)`,
  [...ids, ...['Escuela A ', 'Jardin B ', 'Central ', 'Inactiva '].map(x => x+sufijo)]);
  await db.query(`INSERT INTO public.dependencias(id,sede_id,nombre) VALUES ($1,$3,$5),($2,$4,$6)`,
    [...deps, ids[0], ids[1], 'Sala A '+sufijo, 'Sala B '+sufijo]);
  const roles = { gestion: 'administrador_gestion', encargado: 'encargado', local: 'consulta_sede', general: 'consulta' };
  for (const [tipo,rol] of Object.entries(roles)) await app.query(
    'SELECT public.guardar_usuario_acceso($1,$2,$3,$4,$5,$6,$7::uuid)',
    ['felipe.silva@slepb.gob.cl', correos[tipo], 'Persona ficticia', rol, true, 0,
      ['encargado','local'].includes(tipo) ? ids[0] : null]);
  await fallaSql(['felipe.silva@slepb.gob.cl','felipe.silva@slepb.gob.cl','','consulta',true,1,null],'P1001');
  const cookies = Object.fromEntries(await Promise.all(Object.entries(correos).map(async ([tipo,email]) => [tipo,await cookie(email)])));
  const admin = await cookie('felipe.silva@slepb.gob.cl');
  // Lectura local: no se filtran nombres/IDs ajenos ni al forzar parámetros de edición.
  for (const tipo of ['encargado','local']) {
    for (const ruta of ['/mantenedores/sedes?editar='+ids[1], '/mantenedores/dependencias?editar='+deps[1]]) {
      const r = await pedir(ruta,cookies[tipo]); assert.equal(r.status,200);
      const html = await r.text();
      assert.ok(html.includes('Escuela A '+sufijo));
      assert.ok(!html.includes('Jardin B '+sufijo));
      assert.ok(!html.includes('Sala B '+sufijo));
      assert.ok(!html.includes('Central '+sufijo));
      assert.ok(!html.includes('id="formulario-sede"'));
      comprobaciones++;
    }
    assert.equal((await pedir('/mantenedores/usuarios',cookies[tipo])).headers.get('location'),'/sin-permiso');
    comprobaciones++;
  }
  for (const tipo of ['gestion','general']) {
    const html = await (await pedir('/mantenedores/sedes?nuevo=1',cookies[tipo])).text();
    for (const prefijo of ['Escuela A ','Jardin B ','Central ']) assert.ok(html.includes(prefijo+sufijo));
    assert.equal(html.includes('id="formulario-sede"'),tipo==='gestion');
    comprobaciones++;
  }
  const paginaGestion = await (await pedir('/mantenedores/usuarios?nuevo=1',cookies.gestion)).text();
  const accionUsuario = accion(paginaGestion);
  assert.ok(!paginaGestion.includes('value="administrador"'));
  assert.ok(!paginaGestion.includes('value="administrador_gestion"'));
  comprobaciones++;
  const reservada = await (await pedir('/mantenedores/usuarios?editar=felipe.silva%40slepb.gob.cl',cookies.gestion)).text();
  assert.ok(!reservada.includes('id="formulario-usuario"'));
  comprobaciones++;
  const valores = { correo: correos.nuevo, nombre: 'Persona ficticia', rol: 'consulta_sede', activo: 'true', version: '0', sedeId: ids[1] };
  assert.equal((await guardar('/mantenedores/usuarios',accionUsuario,valores,cookies.gestion)).status,200);
  assert.equal((await db.query('SELECT sede_id FROM public.usuarios_acceso WHERE correo=$1',[correos.nuevo])).rows[0].sede_id,ids[1]);
  comprobaciones++;
  // Referencia de acción legítima y payload modificado: no permite elevar perfil.
  await guardar('/mantenedores/usuarios',accionUsuario,{...valores,rol:'administrador',sedeId:'',version:'1'},cookies.gestion);
  assert.equal((await db.query('SELECT rol FROM public.usuarios_acceso WHERE correo=$1',[correos.nuevo])).rows[0].rol,'consulta_sede');
  comprobaciones++;
  for (const rol of ['administrador','administrador_gestion']) {
    await fallaSql([correos.gestion,correos.gestion2,'',rol,true,0,null],'P1004');
  }
  await fallaSql([correos.gestion,correos.gestion,'','consulta',false,1,null],'P1004');
  await fallaSql([correos.gestion,'felipe.silva@slepb.gob.cl','','consulta',false,1,null],'P1004');
  for (const sede of [null,ids[2],ids[3],randomUUID()]) {
    await fallaSql([correos.gestion,correos.gestion2,'','encargado',true,0,sede],'P1005');
  }
  await fallaSql([correos.gestion,correos.gestion2,'','consulta',true,0,ids[0]],'P1005');
  // El gestor tampoco elude restricciones mediante la firma antigua de seis parámetros.
  await assert.rejects(app.query('SELECT public.guardar_usuario_acceso($1,$2,$3,$4,$5,$6)',
    [correos.gestion,correos.gestion2,'','administrador',true,0]),e=>e.code==='P1004');
  comprobaciones++;
  const paginaDependencias = await (await pedir('/mantenedores/dependencias?nuevo=1',cookies.encargado)).text();
  const accionDep = accion(paginaDependencias);
  const valoresDep = {id:'',sedeId:ids[0],nombre:'Nueva sala '+sufijo,activo:'true'};
  await guardar('/mantenedores/dependencias',accionDep,valoresDep,cookies.encargado);
  const contar = async nombre => Number((await db.query('SELECT count(*) FROM public.dependencias WHERE nombre=$1',[nombre])).rows[0].count);
  assert.equal(await contar(valoresDep.nombre),1);
  comprobaciones++;
  await guardar('/mantenedores/dependencias',accionDep,{...valoresDep,sedeId:ids[1],nombre:'Ajena '+sufijo},cookies.encargado);
  assert.equal(await contar('Ajena '+sufijo),0);
  await guardar('/mantenedores/dependencias',accionDep,{...valoresDep,id:deps[1],nombre:'Secuestro '+sufijo},cookies.encargado);
  assert.equal(await contar('Secuestro '+sufijo),0);
  comprobaciones+=2;
  for (const tipo of ['local','general']) {
    const r = await guardar('/mantenedores/dependencias',accionDep,{...valoresDep,nombre:'Solo lectura '+sufijo},cookies[tipo]);
    assert.equal(r.status,303);assert.equal(new URL(r.headers.get('location'),origen).pathname,'/sin-permiso');
    assert.equal(await contar('Solo lectura '+sufijo),0);comprobaciones++;
  }
  // Reutilizar una acción global tampoco deja escribir al encargado.
  const accionSede = accion(await (await pedir('/mantenedores/sedes?nuevo=1',admin)).text());
  const r = await guardar('/mantenedores/sedes',accionSede,{},cookies.encargado);
  assert.equal(new URL(r.headers.get('location'),origen).pathname,'/sin-permiso');comprobaciones++;
  // Cambio de sede en la base: la misma cookie deja de ver la anterior inmediatamente.
  await app.query('SELECT public.guardar_usuario_acceso($1,$2,$3,$4,$5,$6,$7::uuid)',
    [correos.gestion,correos.encargado,'','encargado',true,1,ids[1]]);
  const cambiada = await (await pedir('/mantenedores/sedes',cookies.encargado)).text();
  assert.ok(cambiada.includes('Jardin B '+sufijo)); assert.ok(!cambiada.includes('Escuela A '+sufijo));
  const hist = (await db.query('SELECT antes,despues FROM public.usuarios_acceso_historial WHERE correo=$1 ORDER BY id DESC LIMIT 1',[correos.encargado])).rows[0];
  assert.equal(hist.antes.sede_id,ids[0]);assert.equal(hist.despues.sede_id,ids[1]);comprobaciones+=2;
  await guardar('/mantenedores/dependencias',accionDep,{...valoresDep,nombre:'Formulario anterior '+sufijo},cookies.encargado);
  assert.equal(await contar('Formulario anterior '+sufijo),0);comprobaciones++;
  await app.query('SELECT public.guardar_usuario_acceso($1,$2,$3,$4,$5,$6,$7::uuid)',
    ['felipe.silva@slepb.gob.cl',correos.gestion,'','administrador_gestion',false,1,null]);
  await fallaSql([correos.gestion,correos.gestion2,'','consulta',true,0,null],'42501');
  assert.equal((await pedir('/mantenedores/usuarios',cookies.gestion)).headers.get('location'),'/acceso-denegado');
  comprobaciones++;
  await db.query('UPDATE public.sedes SET activo=false WHERE id=$1',[ids[1]]);
  assert.equal((await pedir('/mantenedores/sedes',cookies.encargado)).headers.get('location'),'/acceso-denegado');comprobaciones++;
  console.log(`${comprobaciones} comprobaciones de perfiles/sedes: aislamiento, escritura local, solo lectura, delegación, historial y cambio inmediato.`);
} finally {
  await db.query('DELETE FROM public.usuarios_acceso_historial WHERE correo=ANY($1)',[Object.values(correos)]);
  await db.query('DELETE FROM public.usuarios_acceso WHERE correo=ANY($1)',[Object.values(correos)]);
  await db.query('DELETE FROM public.dependencias WHERE sede_id=ANY($1::uuid[])',[ids]);
  await db.query('DELETE FROM public.sedes WHERE id=ANY($1::uuid[])',[ids]);
  await Promise.all([app.end(),db.end()]);
}
