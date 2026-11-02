import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { SourceTextModule, SyntheticModule } from "node:vm";
import test from "node:test";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const raiz = path.resolve(import.meta.dirname, "../src");
const escuela = { id: "11111111-1111-4111-8111-111111111111", tipo: "establecimiento", nombre: "Escuela de prueba", rbd: "00123" };
const jardin = { id: "22222222-2222-4222-8222-222222222222", tipo: "jardin_infantil", nombre: "Jardín de prueba", rbd: "00456" };
const central = { id: "33333333-3333-4333-8333-333333333333", tipo: "nivel_central", nombre: "Central de prueba", rbd: null };

// Renderiza página y filtros reales; solo sustituye sesión, datos y contexto Next.
async function pagina(parametros = {}, local = false, equipos = [], total = equipos.length, ruta = "p02", rol = local ? "consulta_sede" : "consulta") {
  let consulta;
  const modulos = new Map();
  const dobles = {
    "react": React,
    "react/jsx-runtime": jsx,
    "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
    "next/navigation": { useRouter: () => ({ push() {} }), redirect: destino => { throw new Error("REDIRECT:" + destino); } },
    "@/lib/acceso": {
      exigirAcceso: async () => ({ rol, sedeId: local ? escuela.id : null }),
      exigirGestionDependencias: async () => {
        if (!["administrador", "administrador_gestion", "encargado"].includes(rol)) throw new Error("REDIRECT:/sin-permiso");
        return { rol, sedeId: local ? escuela.id : null };
      },
    },
    "@/lib/sedes": { listarSedes: async () => local ? [escuela] : [escuela, jardin, central] },
    "@/lib/catalogos": { listarCategorias: async () => [] },
    "@/lib/equipos": { listarEquipos: async (...args) => { consulta = args; return { equipos, total, pagina: 1 }; } },
    "@/components/formulario-equipo": { default: () => null },
    "@/components/formulario-carga-equipos": { default: () => React.createElement("form", { "aria-label": "Carga masiva" }) },
    "./inventario.module.css": { default: {} },
    "@/app/inventario/inventario.module.css": { default: {} },
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
    const base = path.join(raiz, nombre.slice(2));
    let fuente;
    try { fuente = await readFile(base + ".ts", "utf8"); }
    catch { fuente = await readFile(base + ".tsx", "utf8"); }
    const { outputText } = ts.transpileModule(fuente, { compilerOptions: {
      module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } });
    const modulo = new SourceTextModule(outputText, { identifier: base });
    modulos.set(nombre, modulo);
    await modulo.link(cargar);
    return modulo;
  }
  const modulo = await cargar(`@/app/inventario/${ruta ? ruta + "/" : ""}page`);
  await modulo.evaluate();
  const html = renderToStaticMarkup(await modulo.namespace.default({ searchParams: Promise.resolve(parametros) }));
  return { html, consulta };
}
const opciones = html => /<form\b[\s\S]*?<\/form>/.exec(html)?.[0] ?? "";

test("P02 separa columnas y limita selectores al tipo elegido", async () => {
  const { html } = await pagina({ tipo: "jardin_infantil" });
  const filtros = opciones(html);
  assert.ok(filtros.includes(jardin.nombre)); assert.ok(filtros.includes(jardin.rbd));
  assert.ok(!filtros.includes(escuela.nombre)); assert.ok(!filtros.includes(escuela.rbd));
  assert.ok(!filtros.includes(central.nombre));
  assert.deepEqual([...html.matchAll(/<th scope="col">([^<]+)<\/th>/g)].map(x => x[1]),
    ["RBD", "Establecimiento / JISC", "Equipo", "Modelo", "N.º de serie", "N.º de inventario", "Estado", "Historial"]);
});

test("nombre, RBD y búsqueda se conservan en paginación y cambio de estado", async () => {
  const { html, consulta } = await pagina({ tipo: "establecimiento", sede: escuela.id, rbd: "00123", q: "Serie & modelo" }, false, [], 51);
  assert.deepEqual(consulta, ["eeji", "inventario", 1, "Serie & modelo", "establecimiento", escuela.id, "00123", 50]);
  const enlaces = [...html.matchAll(/href="([^"]+)"/g)].map(x => x[1].replaceAll("&amp;", "&"));
  for (const enlace of enlaces.filter(x => x.includes("pagina="))) {
    const p = new URL(enlace, "http://localhost").searchParams;
    assert.equal(p.get("sede"), escuela.id); assert.equal(p.get("rbd"), "00123");
    assert.equal(p.get("tipo"), "establecimiento"); assert.equal(p.get("q"), "Serie & modelo");
  }
  assert.ok(enlaces.some(x => x.includes("pagina=2")));
});

test("Nivel Central ignora filtros P02 y no ofrece pendientes", async () => {
  const { html, consulta } = await pagina({ ambito: "nc", tipo: "jardin_infantil", sede: jardin.id, rbd: jardin.rbd, vista: "pendientes" }, false, [], 0, "nivel-central");
  assert.deepEqual(consulta, ["nc", "inventario", 1, "", "", null, "", 50]);
  assert.ok(!opciones(html).includes('name="tipo"')); assert.ok(!opciones(html).includes('name="sede"'));
  assert.ok(!opciones(html).includes('name="vista" value="pendientes"'));
  assert.ok(!html.includes("Inventario P02"));
});

test("perfil local permanece en P02 al forzar ámbito y filtros ajenos", async () => {
  const { html, consulta } = await pagina({ ambito: "nc", sede: jardin.id, rbd: jardin.rbd, tipo: "jardin_infantil" }, true);
  assert.deepEqual(consulta, ["eeji", "inventario", 1, "", "", null, "", 50]);
  assert.ok(html.includes("Inventario de mi sede")); assert.ok(!html.includes("Inventario Nivel Central"));
  assert.ok(!html.includes(jardin.nombre));
});

test("tabla conserva identificadores y acceso directo al historial", async () => {
  const equipo = { id: escuela.id, sedeRbd: "00123", sedeNombre: escuela.nombre, categoriaNombre: "Proyector", modelo: "PowerLite", marca: "Epson", serie: "000-ABC", inventario: "INV-001", situacion: "recibido_historico", condicionTecnica: "sin_verificar" };
  const { html } = await pagina({ tipo: "establecimiento" }, false, [equipo]);
  assert.ok(html.includes('href="/inventario/' + equipo.id + '#historial"'));
  assert.ok(html.includes("000-ABC")); assert.ok(html.includes("INV-001"));
  assert.ok(html.includes("Recibido (histórico)")); assert.ok(html.includes("Condición: Sin verificar"));
});


test("la entrada ofrece dos páginas independientes y ninguna tabla combinada", async () => {
  const { html, consulta } = await pagina({}, false, [], 0, "");
  assert.equal(consulta, undefined);
  assert.ok(html.includes('href="/inventario/nivel-central"'));
  assert.ok(html.includes('href="/inventario/p02"'));
  assert.ok(!html.includes("<table"));
});

test("P02 no muestra selector de Nivel Central dentro de su contenido", async () => {
  const { html } = await pagina();
  assert.ok(!html.includes("Inventario Nivel Central"));
  assert.ok(!html.includes('aria-label="Vistas de inventario"'));
  assert.ok(!html.includes('aria-label="Estado de entrega"'));
  assert.ok(html.includes('action="/inventario/p02"'));
});

test("el acceso directo a Nivel Central se deniega al perfil local", async () => {
  await assert.rejects(pagina({}, true, [], 0, "nivel-central"), /REDIRECT:\/sin-permiso/);
});

test("enlaces anteriores conservan filtros y conducen a la nueva página", async () => {
  await assert.rejects(pagina({ ambito: "nc", q: "Epson" }, false, [], 0, ""), /REDIRECT:\/inventario\/nivel-central\?q=Epson/);
  await assert.rejects(pagina({ ambito: "nc" }, true, [], 0, ""), /REDIRECT:\/inventario\/p02/);
});


test("sin tipo los filtros de nombre y RBD están bloqueados y vacíos", async () => {
  const { html, consulta } = await pagina({ sede: jardin.id, rbd: jardin.rbd });
  const formulario = opciones(html);
  assert.match(formulario, /<select[^>]+name="sede"[^>]+disabled/);
  assert.match(formulario, /<select[^>]+name="rbd"[^>]+disabled/);
  assert.ok(!formulario.includes(jardin.nombre));
  assert.ok(!formulario.includes(jardin.rbd));
  assert.equal(consulta[5], null); assert.equal(consulta[6], "");
});

test("el tamaño de página se valida y conserva en filtros y paginación", async () => {
  for (const limite of [50, 100, 150]) {
    const { html, consulta } = await pagina({ tipo: "establecimiento", limite: String(limite), q: "Epson" }, false, [], 301);
    assert.equal(consulta[7], limite);
    assert.match(html, new RegExp('name="limite" value="' + limite + '"'));
    assert.ok(html.includes('limite=' + limite));
    assert.ok(html.includes('aria-label="Registros por página"'));
  }
  for (const limite of ["5000", "0", "-1", ["50", "150"]]) {
    const { consulta } = await pagina({ limite });
    assert.equal(consulta[7], 50);
  }
});

test("portada administrativa ofrece accesos operativos y consultas no ven gestión", async () => {
  for (const rol of ["administrador", "administrador_gestion"]) {
    const { html } = await pagina({}, false, [], 0, "", rol);
    for (const ruta of ["nivel-central", "p02", "registro", "bodega-ti", "movimientos"]) assert.ok(html.includes('href="/inventario/' + ruta + '"'));
    assert.ok(!html.includes("<table"));
  }
  const { html } = await pagina({}, false, [], 0, "", "consulta");
  assert.ok(!html.includes('href="/inventario/registro"'));
  assert.ok(!html.includes('href="/inventario/bodega-ti"'));
});

test("las consultas de inventario ya no incluyen formularios de registro o carga", async () => {
  for (const ruta of ["p02", "nivel-central"]) {
    const { html } = await pagina({}, false, [], 0, ruta, "administrador");
    assert.ok(!html.includes('id="nuevo-equipo"'));
    assert.ok(!html.includes('id="carga-masiva"'));
    assert.ok(html.includes('href="/inventario/registro"'));
  }
});

test("bodega fuerza pendientes y deniega a perfiles sin administración", async () => {
  const { html, consulta } = await pagina({ vista: "inventario" }, false, [], 0, "bodega-ti", "administrador_gestion");
  assert.equal(consulta[1], "pendientes");
  assert.ok(html.includes('<h1>Bodega TI</h1>'));
  assert.ok(!html.includes('id="filtro-vista"'));
  for (const rol of ["consulta", "encargado", "consulta_sede"]) {
    await assert.rejects(pagina({}, false, [], 0, "bodega-ti", rol), /REDIRECT:\/sin-permiso/);
  }
});

test("el registro único muestra destino y carga solo a administradores", async () => {
  const { html } = await pagina({}, false, [], 0, "registro", "administrador_gestion");
  assert.ok(html.includes('id="inventario-destino"'));
  assert.ok(html.includes('value="nc"'));
  assert.ok(html.includes('value="eeji"'));
  assert.ok(html.includes('id="carga-masiva"'));
  const propio = await pagina({}, true, [], 0, "registro", "encargado");
  assert.ok(!propio.html.includes('id="inventario-destino"'));
  assert.ok(!propio.html.includes('id="carga-masiva"'));
  await assert.rejects(pagina({}, false, [], 0, "registro", "consulta"), /REDIRECT:\/sin-permiso/);
});
