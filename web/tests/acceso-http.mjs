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
const cookie = async (email, extras = {}) => "next-auth.session-token=" + await encode({
  secret, token: { sub: "identidad-ficticia", correoInstitucional: email, ...extras }, maxAge: 600,
});
async function pedir(ruta, sesion) {
  return fetch(origen + ruta, { redirect: "manual", headers: sesion ? { Cookie: sesion } : {} });
}
await base.connect();
let verificaciones = 0;
try {
  await base.query("INSERT INTO public.usuarios_acceso (correo, rol) VALUES ($1, 'consulta')", [correo]);
  const admin = await cookie("felipe.silva@slepb.gob.cl");
  const consulta = await cookie(correo, { rol: "administrador" });
  let formularioCategoria;
  for (const ruta of ["/", "/inventario", "/solicitudes", "/mantenedores",
    "/mantenedores/categorias", "/mantenedores/sedes", "/mantenedores/dependencias"]) {
    const anonimo = await pedir(ruta);
    assert.equal(anonimo.status, 307, ruta);
    assert.equal(anonimo.headers.get("location"), "/ingresar", ruta);
    verificaciones++;
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
  await base.query("UPDATE public.usuarios_acceso SET activo = false WHERE correo = $1", [correo]);
  assert.equal((await pedir("/mantenedores/sedes", consulta)).status, 307);
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
  assert.ok((await csrf.json()).csrfToken);
  verificaciones++;
  console.log(`${verificaciones} comprobaciones HTTP: anónimo, administrador, consulta, revocación, cookie alterada y CSRF.`);
  console.log("Se usaron identidades y cookies de prueba; el consentimiento real de Google queda pendiente.");
} finally {
  await base.query("DELETE FROM public.categorias_bienes WHERE nombre = $1", [nombreCategoria]);
  await base.query("DELETE FROM public.usuarios_acceso WHERE correo = $1", [correo]);
  await base.end();
}
