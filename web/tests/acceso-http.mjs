// Integración contra una instancia de prueba ya iniciada. No contacta Google.
// Las cookies se crean solo con el secreto de esa instancia aislada.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import pg from "pg";

const require = createRequire(import.meta.url);
const { encode } = require("next-auth/jwt");
const origen = process.env.ACCESO_HTTP_URL;
const secret = process.env.NEXTAUTH_SECRET;
assert.ok(origen && secret && process.env.TEST_ADMIN_DATABASE_URL,
  "Requiere URL y secreto de la instancia de prueba y conexión administrativa temporal.");
const base = new pg.Client({ connectionString: process.env.TEST_ADMIN_DATABASE_URL });
const correo = `consulta-prueba-${randomUUID()}@slepb.gob.cl`;
const nombreCategoria = `Categoria ficticia ${randomUUID()}`;
const usuarioGestion = `gestion-prueba-${randomUUID()}@slepb.gob.cl`;
const administradoresPrueba = [0, 1].map(() => `admin-prueba-${randomUUID()}@slepb.gob.cl`);
const cookie = async (email, extras = {}) => "next-auth.session-token=" + await encode({
  secret, token: { sub: "identidad-ficticia", correoInstitucional: email, ...extras }, maxAge: 600,
});
async function pedir(ruta, sesion) {
  return fetch(origen + ruta, { redirect: "manual", headers: sesion ? { Cookie: sesion } : {} });
}
function camposAccion(html) {
  const decodificar = (s) => s.replaceAll('&quot;', '"').replaceAll('&#x27;', "'")
    .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
  const campos = [];
  for (const [input] of html.matchAll(/<input\b[^>]*>/g)) {
    if (!input.includes('type="hidden"')) continue;
    const nombre = /\bname="([^"]+)"/.exec(input)?.[1];
    if (nombre?.startsWith('$ACTION')) campos.push([decodificar(nombre),
      decodificar(/\bvalue="([^"]*)"/.exec(input)?.[1] ?? '')]);
  }
  assert.ok(campos.length, 'Se requiere una referencia real de acción.');
  return campos;
}
async function guardar(ruta, campos, valores, sesion) {
  const datos = new FormData();
  for (const [nombre, valor] of [...campos, ...Object.entries(valores)]) datos.append(nombre, valor);
  return fetch(origen + ruta, { method: 'POST', body: datos, redirect: 'manual',
    headers: { Origin: new URL(origen).origin, ...(sesion ? { Cookie: sesion } : {}) } });
}
await base.connect();
let verificaciones = 0;
try {
  await base.query("INSERT INTO public.usuarios_acceso (correo, rol) VALUES ($1, 'consulta')", [correo]);
  const admin = await cookie("felipe.silva@slepb.gob.cl");
  const consulta = await cookie(correo, { rol: "administrador" });
  let formularioCategoria;
  for (const ruta of ["/directorio", "/directorio/establecimientos", "/directorio/directores", "/directorio/jardines", "/directorio/directoras", "/directorio/cargar", "/inventario/celulares", "/documentacion/modelo-datos", "/mantenedores/directorio-establecimientos", "/mantenedores/directores-establecimientos", "/mantenedores/directorio-jardines", "/mantenedores/directoras-jardines", "/inventario", "/inventario/nivel-central", "/inventario/p02", "/inventario/registro", "/inventario/bodega-ti", "/mantenedores/funcionarios", "/mantenedores/directores", "/mantenedores/directores/cargar", "/mantenedores/modelo-datos", "/inventario/robos", "/inventario/robos/dashboard", "/inventario/robos/dashboard/exportar", "/inventario/robos/reportar", "/solicitudes", "/mantenedores",
    "/mantenedores/categorias", "/mantenedores/sedes", "/mantenedores/dependencias"]) {
    const anonimo = await pedir(ruta);
    assert.equal(anonimo.status, 307, ruta);
    assert.equal(anonimo.headers.get("location"), "/ingresar", ruta);
    verificaciones++;
  }
  for (const ruta of ['/', '/ingresar']) {
    const respuesta = await pedir(ruta);
    assert.equal(respuesta.status, 200);
    const html = await respuesta.text();
    assert.ok(!html.includes('<nav'), 'El portal público no debe renderizar el menú.');
    assert.ok(!html.includes('Cerrar sesión'));
    verificaciones++;
  }
  const inicioAdmin = await (await pedir('/', admin)).text();
  assert.ok(inicioAdmin.includes('href="/mantenedores/usuarios"'));
  const inicioConsulta = await (await pedir('/', consulta)).text();
  assert.ok(!inicioConsulta.includes('href="/mantenedores/usuarios"'));
  verificaciones += 2;
  // Dos administradores intentan revocarse entre sí al mismo tiempo. La función
  // debe volver a comprobar al actor después de tomar el bloqueo compartido.
  for (const email of administradoresPrueba) await base.query(
    'SELECT public.guardar_usuario_acceso($1,$2,$3,$4,$5,$6)',
    ['felipe.silva@slepb.gob.cl', email, 'Administrador ficticio', 'administrador', true, 0]);
  const conexiones = [new pg.Client({ connectionString: process.env.DATABASE_URL }),
    new pg.Client({ connectionString: process.env.DATABASE_URL })];
  try {
    await Promise.all(conexiones.map(c => c.connect()));
    const carreras = await Promise.allSettled(conexiones.map((c, i) => c.query(
      'SELECT public.guardar_usuario_acceso($1,$2,$3,$4,$5,$6)',
      [administradoresPrueba[i], administradoresPrueba[1-i], '', 'administrador', false, 1])));
    assert.equal(carreras.filter(c => c.status === 'fulfilled').length, 1);
    assert.equal(carreras.filter(c => c.status === 'rejected' && c.reason.code === '42501').length, 1);
    verificaciones++;
  } finally {
    await Promise.all(conexiones.map(c => c.end()));
  }
  for (const ruta of ["/mantenedores/categorias", "/mantenedores/sedes", "/mantenedores/dependencias"]) {
    const respuestaAdmin = await pedir(ruta, admin);
    assert.equal(respuestaAdmin.status, 200);
    const htmlAdmin = await respuestaAdmin.text();
    if (ruta.endsWith("/categorias")) formularioCategoria = htmlAdmin;
    assert.ok(/id="formulario-(categoria|sede|dependencia)"/.test(htmlAdmin),
      `El administrador debe tener el panel de edición: ${ruta}`);
    const respuestaConsulta = await pedir(ruta, consulta);
    assert.equal(respuestaConsulta.status, 200);
    assert.ok(!/id="formulario-(categoria|sede|dependencia)"/.test(await respuestaConsulta.text()),
      `Consulta no debe tener panel de edición: ${ruta}`);
    verificaciones += 2;
  }
  // Reutilizar la referencia real de una acción obtenida por un administrador
  // no debe permitir escribir a un visitante o a una cuenta de consulta.
  const decodificar = (s) => s.replaceAll('&quot;', '"').replaceAll('&#x27;', "'")
    .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
  const campos = [];
  for (const [input] of formularioCategoria.matchAll(/<input\b[^>]*>/g)) {
    if (!input.includes('type="hidden"')) continue;
    const nombre = /\bname="([^"]+)"/.exec(input)?.[1];
    if (nombre?.startsWith('$ACTION')) {
      campos.push([decodificar(nombre), decodificar(/\bvalue="([^"]*)"/.exec(input)?.[1] ?? '')]);
    }
  }
  assert.ok(campos.length, 'La página debe entregar una referencia real de la acción.');
  for (const [sesion, destino] of [[null, '/ingresar'], [consulta, '/sin-permiso']]) {
    const datos = new FormData();
    for (const [nombre, valor] of campos) datos.append(nombre, valor);
    datos.set('id', '');
    datos.set('nombre', nombreCategoria);
    datos.set('activo', 'true');
    const resultado = await fetch(origen + '/mantenedores/categorias', {
      method: 'POST', body: datos, redirect: 'manual',
      headers: { Origin: new URL(origen).origin, ...(sesion ? { Cookie: sesion } : {}) },
    });
    assert.equal(resultado.status, 303, 'La acción debe redirigir sin guardar.');
    assert.equal(new URL(resultado.headers.get('location'), origen).pathname, destino);
    verificaciones++;
  }
  const contarCategoria = async () => Number((await base.query(
    'SELECT count(*) AS total FROM public.categorias_bienes WHERE nombre = $1', [nombreCategoria],
  )).rows[0].total);
  assert.equal(await contarCategoria(), 0, 'Las acciones denegadas no deben crear datos.');
  const datosAdmin = new FormData();
  for (const [nombre, valor] of campos) datosAdmin.append(nombre, valor);
  datosAdmin.set('id', '');
  datosAdmin.set('nombre', nombreCategoria);
  datosAdmin.set('activo', 'true');
  const guardado = await fetch(origen + '/mantenedores/categorias', {
    method: 'POST', body: datosAdmin, redirect: 'manual',
    headers: { Origin: new URL(origen).origin, Cookie: admin },
  });
  assert.ok([200, 303].includes(guardado.status));
  assert.equal(await contarCategoria(), 1, 'La sesión de administración debe poder guardar en producción.');
  verificaciones += 2;
  // Mantenedor real de usuarios: guardado, auditoría, denegación y edición obsoleta.
  for (const [sesion, destino] of [[null, '/ingresar'], [consulta, '/sin-permiso']]) {
    const denegado = await pedir('/mantenedores/usuarios', sesion);
    assert.equal(denegado.status, 307);
    assert.equal(denegado.headers.get('location'), destino);
    verificaciones++;
  }
  const pantallaUsuarios = await pedir('/mantenedores/usuarios', admin);
  assert.equal(pantallaUsuarios.status, 200);
  const accionUsuario = camposAccion(await pantallaUsuarios.text());
  const valores = { correo: usuarioGestion, nombre: 'Persona ficticia', rol: 'consulta', activo: 'true', version: '0', sedeId: '' };
  for (const [sesion, destino] of [[null, '/ingresar'], [consulta, '/sin-permiso']]) {
    const denegado = await guardar('/mantenedores/usuarios', accionUsuario, valores, sesion);
    assert.equal(denegado.status, 303);
    assert.equal(new URL(denegado.headers.get('location'), origen).pathname, destino);
    verificaciones++;
  }
  const creado = await guardar('/mantenedores/usuarios', accionUsuario, valores, admin);
  assert.equal(creado.status, 200);
  const leerGestion = async () => (await base.query('SELECT rol, activo, version FROM public.usuarios_acceso WHERE correo = $1', [usuarioGestion])).rows[0];
  assert.deepEqual(await leerGestion(), { rol: 'consulta', activo: true, version: 1 });
  const historial = await base.query('SELECT actor, antes, despues FROM public.usuarios_acceso_historial WHERE correo = $1', [usuarioGestion]);
  assert.equal(historial.rows.length, 1);
  assert.equal(historial.rows[0].actor, 'felipe.silva@slepb.gob.cl');
  assert.equal(historial.rows[0].antes, null);
  assert.equal(historial.rows[0].despues.rol, 'consulta');
  verificaciones += 2;
  const editado = await guardar('/mantenedores/usuarios', accionUsuario,
    { ...valores, version: '1', activo: 'false' }, admin);
  assert.equal(editado.status, 303);
  assert.equal(new URL(editado.headers.get('location'),origen).pathname,'/mantenedores/usuarios');assert.equal(new URL(editado.headers.get('location'),origen).searchParams.get('guardado'),'1');assert.ok(new URL(editado.headers.get('location'),origen).searchParams.get('aviso'));
  assert.deepEqual(await leerGestion(), { rol: 'consulta', activo: false, version: 2 });
  const obsoleto = await guardar('/mantenedores/usuarios', accionUsuario, { ...valores, version: '1' }, admin);
  assert.equal(obsoleto.status, 200);
  assert.equal((await leerGestion()).activo, false, 'Un formulario obsoleto no debe reactivar la cuenta.');
  verificaciones += 2;
  await base.query("UPDATE public.usuarios_acceso SET activo = false WHERE correo = $1", [correo]);
  for (const ruta of ['/mantenedores/sedes', '/', '/ingresar']) {
    const revocada = await pedir(ruta, consulta);
    assert.equal(revocada.status, 307);
    assert.equal(revocada.headers.get('location'), '/acceso-denegado');
    verificaciones++;
  }
  const denegada = await pedir('/acceso-denegado', consulta);
  assert.equal(denegada.status, 200);
  const htmlDenegado = await denegada.text();
  for (const texto of ['No tienes acceso al sistema', 'Usar otra cuenta', 'Contactar a UTIC', 'Volver a la bienvenida']) {
    assert.ok(htmlDenegado.includes(texto));
  }
  assert.ok(!htmlDenegado.includes('<nav'));
  verificaciones++;
  assert.equal((await pedir('/ingresar?error=AccessDenied')).headers.get('location'), '/acceso-denegado');
  assert.equal((await pedir('/acceso-denegado', admin)).headers.get('location'), '/');
  const errorOAuth = await pedir('/ingresar?error=OAuthCallback');
  assert.equal(errorOAuth.status, 200);
  assert.ok((await errorOAuth.text()).includes('No fue posible ingresar'));
  verificaciones += 3;
  const errorServicio = await pedir('/ingresar?error=ServicioNoDisponible');
  assert.equal(errorServicio.status, 200);
  assert.ok((await errorServicio.text()).includes('No pudimos comprobar tu acceso'));
  verificaciones++;
  assert.equal((await pedir("/mantenedores/sedes", admin.slice(0, -5) + "xxxxx")).status, 307);
  verificaciones++;
  const respuesta = await pedir("/api/auth/session", admin);
  const sesion = await respuesta.json();
  assert.equal(sesion.user.email, "felipe.silva@slepb.gob.cl");
  assert.equal(sesion.user.rol, "administrador");
  assert.equal(sesion.access_token, undefined);
  verificaciones++;
  const csrf = await pedir("/api/auth/csrf");
  assert.equal(csrf.status, 200);
  const csrfToken = (await csrf.json()).csrfToken;
  assert.ok(csrfToken);
  verificaciones++;
  const cookiesCsrf = csrf.headers.getSetCookie().map(c => c.split(';')[0]);
  const salida = await fetch(origen + '/api/auth/signout', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: [consulta, ...cookiesCsrf].join('; ') },
    body: new URLSearchParams({ csrfToken, callbackUrl: '/', json: 'true' }),
  });
  assert.equal(salida.status, 200);
  assert.ok(salida.headers.getSetCookie().some(c => c.startsWith('next-auth.session-token=;')),
    'Volver a la bienvenida debe retirar la cookie revocada.');
  verificaciones++;
  console.log(`${verificaciones} comprobaciones HTTP: anónimo, administrador, consulta, revocación, cookie alterada y CSRF.`);
  console.log("Se usaron identidades y cookies de prueba; el consentimiento real de Google queda pendiente.");
} finally {
  await base.query('DELETE FROM public.usuarios_acceso_historial WHERE correo = ANY($1)', [administradoresPrueba]);
  await base.query('DELETE FROM public.usuarios_acceso WHERE correo = ANY($1)', [administradoresPrueba]);
  await base.query('DELETE FROM public.usuarios_acceso_historial WHERE correo = $1', [usuarioGestion]);
  await base.query('DELETE FROM public.usuarios_acceso WHERE correo = $1', [usuarioGestion]);
  await base.query("DELETE FROM public.categorias_bienes WHERE nombre = $1", [nombreCategoria]);
  await base.query("DELETE FROM public.usuarios_acceso WHERE correo = $1", [correo]);
  await base.end();
}
