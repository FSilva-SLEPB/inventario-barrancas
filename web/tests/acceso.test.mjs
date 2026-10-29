import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { SourceTextModule, SyntheticModule } from "node:vm";
import test from "node:test";
import ts from "typescript";

const raiz = path.resolve(import.meta.dirname, "../src");

// Carga el código real del servidor; sustituye solo I/O y contexto de Next.
async function entorno() {
  const roles = new Map([["felipe.silva@slepb.gob.cl", "administrador"]]);
  const consultas = [];
  let sesion = null;
  let falloBD = false;
  const modulos = new Map();
  const redirigir = (destino) => { throw new Error("REDIRECT:" + destino); };
  const query = async (sql, parametros = []) => {
    consultas.push({ sql, parametros });
    if (falloBD) throw new Error("fallo simulado");
    if (sql.includes("usuarios_acceso")) {
      const rol = roles.get(parametros[0]);
      return { rows: rol ? [{ rol }] : [] };
    }
    return { rows: [], rowCount: 1 };
  };
  const dobles = {
    "server-only": {},
    "react": { cache: (fn) => fn },
    "next-auth": { getServerSession: async () => sesion },
    "next-auth/providers/google": { default: (opciones) => opciones },
    "next/navigation": { redirect: redirigir },
    "next/cache": { revalidatePath() {} },
    "node:crypto": { randomUUID },
    "@/lib/db": { obtenerBaseDatos: () => ({ query }) },
  };
  async function cargar(nombre) {
    if (modulos.has(nombre)) return modulos.get(nombre);
    if (dobles[nombre]) {
      const valores = dobles[nombre];
      const modulo = new SyntheticModule(Object.keys(valores), function () {
        for (const [clave, valor] of Object.entries(valores)) this.setExport(clave, valor);
      });
      modulos.set(nombre, modulo);
      return modulo;
    }
    const archivo = nombre.startsWith("@/") ? path.join(raiz, nombre.slice(2) + ".ts") : nombre;
    const fuente = await readFile(archivo, "utf8");
    const { outputText } = ts.transpileModule(fuente, { compilerOptions: {
      module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
    } });
    const modulo = new SourceTextModule(outputText, { identifier: archivo });
    modulos.set(nombre, modulo);
    await modulo.link(cargar);
    return modulo;
  }
  async function importar(nombre) {
    const modulo = await cargar(nombre);
    if (modulo.status === "unlinked") await modulo.link(cargar);
    if (modulo.status !== "evaluated") await modulo.evaluate();
    return modulo.namespace;
  }
  return { importar, roles, consultas,
    sesion: (valor) => { sesion = valor; },
    fallarBD: () => { falloBD = true; } };
}

const perfil = { sub: "google-id-ficticio", email: "felipe.silva@slepb.gob.cl",
  email_verified: true, hd: "slepb.gob.cl" };

test("dominio, correo verificado e identidad de Google son obligatorios", async () => {
  const e = await entorno();
  const { correoInstitucional } = await e.importar("@/lib/politica-acceso");
  assert.equal(correoInstitucional(perfil), perfil.email);
  for (const cambio of [{ email_verified: false }, { email_verified: "true" },
    { hd: "gmail.com" }, { hd: undefined }, { sub: "" },
    { email: "felipe.silva@slepb.gob.cl.ejemplo.com" }, { email: "externo@gmail.com" },
    { email: "felipe.silva@slepb.gob.cl\n" }]) {
    assert.equal(correoInstitucional({ ...perfil, ...cambio }), null);
  }
  assert.equal(correoInstitucional({ ...perfil, email: perfil.email.toUpperCase() }), perfil.email);
});

test("solo administrador puede modificar; roles desconocidos no conceden permisos", async () => {
  const e = await entorno();
  const { puedeAdministrar, rolValido } = await e.importar("@/lib/politica-acceso");
  assert.equal(puedeAdministrar("administrador"), true);
  for (const rol of ["consulta", "editor", "ADMIN", undefined, null, {}]) {
    assert.equal(puedeAdministrar(rol), false);
  }
  assert.equal(rolValido("consulta"), true);
  assert.equal(rolValido("editor"), false);
});

test("OAuth exige configuración explícita y origen seguro", async () => {
  const e = await entorno();
  const { autenticacionConfigurada } = await e.importar("@/lib/configuracion-auth");
  const original = { ...process.env };
  try {
    Object.assign(process.env, { NEXTAUTH_URL: "http://localhost:3000", NEXTAUTH_SECRET: "x".repeat(32),
      GOOGLE_CLIENT_ID: "id-ficticio", GOOGLE_CLIENT_SECRET: "secreto-ficticio" });
    assert.equal(autenticacionConfigurada(), true);
    for (const url of ["http://192.168.8.18:3000", "https://usuario:clave@ejemplo.cl", "https://ejemplo.cl/otra", "no-url"]) {
      process.env.NEXTAUTH_URL = url;
      assert.equal(autenticacionConfigurada(), false);
    }
    process.env.NEXTAUTH_URL = "https://inventario.ejemplo.cl";
    assert.equal(autenticacionConfigurada(), true);
    process.env.NEXTAUTH_SECRET = "corto";
    assert.equal(autenticacionConfigurada(), false);
  } finally {
    for (const n of ["NEXTAUTH_URL", "NEXTAUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]) {
      if (original[n] === undefined) delete process.env[n]; else process.env[n] = original[n];
    }
  }
});

test("login, revocación inmediata y actualización de sesión sin escalación", async () => {
  const e = await entorno();
  const original = { ...process.env };
  try {
    Object.assign(process.env, { NEXTAUTH_URL: "http://localhost:3000", NEXTAUTH_SECRET: "x".repeat(32),
      GOOGLE_CLIENT_ID: "id-ficticio", GOOGLE_CLIENT_SECRET: "secreto-ficticio" });
    const { opcionesAuth } = await e.importar("@/lib/opciones-auth");
    const { signIn, jwt, session, redirect } = opcionesAuth.callbacks;
    assert.equal(await signIn({ account: { provider: "google" }, profile: perfil }), true);
    assert.equal(await signIn({ account: { provider: "otro" }, profile: perfil }), false);
    assert.equal(await signIn({ account: { provider: "google" }, profile: { ...perfil, email_verified: false } }), false);
    assert.equal(await signIn({ account: { provider: "google" }, profile: { ...perfil, email: "sinpermiso@slepb.gob.cl" } }), false);
    const token = await jwt({ token: {}, account: { provider: "google", access_token: "no-persistir" }, profile: perfil });
    assert.equal(token.correoInstitucional, perfil.email);
    assert.equal(token.access_token, undefined);
    const intento = await jwt({ token, trigger: "update", session: { correoInstitucional: "otro@slepb.gob.cl", rol: "administrador" } });
    assert.deepEqual(intento, token);
    const activa = await session({ session: {}, token });
    assert.equal(activa.user.rol, "administrador");
    e.roles.set(perfil.email, "consulta");
    assert.equal((await session({ session: {}, token })).user.rol, "consulta");
    e.roles.delete(perfil.email);
    assert.equal((await session({ session: {}, token })).user, undefined);
    assert.equal((await session({ session: {}, token: { email: perfil.email, sub: "id" } })).user, undefined);
    assert.equal(await redirect({ baseUrl: "http://localhost:3000", url: "https://sitio-ajeno.cl" }), "http://localhost:3000/");
    e.fallarBD();
    assert.equal(await signIn({ account: { provider: "google" }, profile: perfil }), false);
    assert.equal((await session({ session: {}, token })).user, undefined);
  } finally {
    for (const n of ["NEXTAUTH_URL", "NEXTAUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]) {
      if (original[n] === undefined) delete process.env[n]; else process.env[n] = original[n];
    }
  }
});

for (const [nombre, accion] of [["categorias", "guardarCategoria"], ["sedes", "guardarSede"],
  ["dependencias", "guardarDependencia"]]) {
  for (const rol of [null, "consulta"]) {
    test(`acción ${nombre} rechaza ${rol ?? "anónimo"} antes de consultar o escribir datos`, async () => {
      const e = await entorno();
      // El guard consulta la sesión simulada; la configuración se sustituye solo en esta prueba.
      const originales = { ...process.env };
      try {
        Object.assign(process.env, { NEXTAUTH_URL: "http://localhost:3000", NEXTAUTH_SECRET: "x".repeat(32),
          GOOGLE_CLIENT_ID: "id-ficticio", GOOGLE_CLIENT_SECRET: "secreto-ficticio" });
        e.sesion(rol ? { user: { email: perfil.email, rol } } : null);
        const modulo = await e.importar(path.join(raiz, `app/mantenedores/${nombre}/acciones.ts`));
        await assert.rejects(modulo[accion]({}, new FormData()), {
          message: rol ? "REDIRECT:/sin-permiso" : "REDIRECT:/ingresar",
        });
        assert.equal(e.consultas.length, 0);
      } finally {
        for (const n of ["NEXTAUTH_URL", "NEXTAUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]) {
          if (originales[n] === undefined) delete process.env[n]; else process.env[n] = originales[n];
        }
      }
    });
  }
}
