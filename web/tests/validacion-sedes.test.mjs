import assert from "node:assert/strict";
import test from "node:test";

import {
  LIMITES_SEDE,
  validarSede,
  valoresInicialesSede,
} from "../src/lib/validacion-sedes.ts";

function formulario(cambios = {}) {
  const datos = new FormData();
  const valores = {
    ...valoresInicialesSede(),
    tipo: "establecimiento",
    nombre: "Escuela de prueba",
    ...cambios,
  };
  for (const [campo, valor] of Object.entries(valores)) {
    datos.set(campo, valor);
  }
  return datos;
}

test("Nivel Central se guarda sin RBD y con los campos opcionales nulos", () => {
  const resultado = validarSede(formulario({ tipo: "nivel_central" }));
  assert.ok(resultado.datos);
  for (const campo of ["id", "rbd", "direccion", "comuna", "correoInstitucional"]) {
    assert.equal(resultado.datos[campo], null);
  }
  assert.equal(resultado.datos.activo, true);
});

test("rechaza un RBD enviado para Nivel Central", () => {
  const resultado = validarSede(formulario({ tipo: "nivel_central", rbd: "001234" }));
  assert.equal(resultado.datos, null);
  assert.ok(resultado.errores.rbd);
});

test("el RBD conserva los ceros iniciales y guiones", () => {
  const resultado = validarSede(formulario({ rbd: " 001234-5 " }));
  assert.ok(resultado.datos);
  assert.equal(resultado.datos.rbd, "001234-5");
});

test("establecimientos y jardines pueden registrarse sin RBD", () => {
  for (const tipo of ["establecimiento", "jardin_infantil"]) {
    const resultado = validarSede(formulario({ tipo }));
    assert.ok(resultado.datos);
    assert.equal(resultado.datos.rbd, null);
  }
});

test("normaliza espacios y tildes sin rechazar nombres con apóstrofos", () => {
  const resultado = validarSede(formulario({
    nombre: "  Jardi\u0301n  O'Higgins  ",
    comuna: "  Cerro  Navia ",
  }));
  assert.ok(resultado.datos);
  assert.equal(resultado.datos.nombre, "Jardín O'Higgins");
  assert.equal(resultado.datos.comuna, "Cerro Navia");
});

test("un nombre vacío no se guarda y se conservan los otros valores", () => {
  const resultado = validarSede(formulario({ nombre: "   ", rbd: "0007", comuna: "Pudahuel" }));
  assert.equal(resultado.datos, null);
  assert.ok(resultado.errores.nombre);
  assert.equal(resultado.valores.rbd, "0007");
  assert.equal(resultado.valores.comuna, "Pudahuel");
});

test("rechaza tipos de sede no permitidos", () => {
  for (const tipo of ["", "otra", "__proto__", "toString"]) {
    const resultado = validarSede(formulario({ tipo }));
    assert.equal(resultado.datos, null);
    assert.ok(resultado.errores.tipo);
  }
});

test("la sede inactiva se conserva como false", () => {
  const resultado = validarSede(formulario({ activo: "false" }));
  assert.ok(resultado.datos);
  assert.equal(resultado.datos.activo, false);
});

test("no convierte un estado ausente o inválido en una sede inactiva", () => {
  for (const activo of ["", "on", "0", "False"]) {
    const resultado = validarSede(formulario({ activo }));
    assert.equal(resultado.datos, null);
    assert.ok(resultado.errores.activo);
  }
  const datos = formulario();
  datos.delete("activo");
  assert.equal(validarSede(datos).datos, null);
});

test("una edición conserva su UUID y rechaza identificadores inválidos", () => {
  const id = "A756F4C8-24EC-4BE9-9C84-6FF4E5E9824B";
  assert.equal(validarSede(formulario({ id })).datos?.id, id.toLowerCase());
  for (const valor of ["123", "undefined", "' OR '1'='1"]) {
    const resultado = validarSede(formulario({ id: valor }));
    assert.equal(resultado.datos, null);
    assert.ok(resultado.errores.id);
  }
});

test("valida los límites de longitud de cada campo", () => {
  for (const [campo, limite] of Object.entries(LIMITES_SEDE)) {
    const valorLimite = campo === "correoInstitucional"
      ? `${"a".repeat(limite - "@ejemplo.cl".length)}@ejemplo.cl` : "a".repeat(limite);
    assert.ok(validarSede(formulario({ [campo]: valorLimite })).datos);
    const resultado = validarSede(formulario({ [campo]: "a".repeat(limite + 1) }));
    assert.equal(resultado.datos, null);
    assert.ok(resultado.errores[campo]);
  }
});

test("acepta un correo completo y rechaza correos incompletos o con espacios", () => {
  const resultado = validarSede(formulario({ correoInstitucional: " sede@ejemplo.cl " }));
  assert.equal(resultado.datos?.correoInstitucional, "sede@ejemplo.cl");
  for (const correoInstitucional of ["sede", "sede@", "sede@dominio", "sede nombre@ejemplo.cl"]) {
    assert.equal(validarSede(formulario({ correoInstitucional })).datos, null);
  }
});

test("rechaza controles dentro de los campos de texto", () => {
  for (const campo of Object.keys(LIMITES_SEDE)) {
    const resultado = validarSede(formulario({ [campo]: "texto\u0000oculto" }));
    assert.equal(resultado.datos, null);
    assert.ok(resultado.errores[campo]);
  }
});

test("rechaza campos repetidos y archivos donde se espera texto", () => {
  for (const campo of Object.keys(valoresInicialesSede())) {
    const repetido = formulario();
    repetido.append(campo, "otro valor");
    assert.equal(validarSede(repetido).datos, null);

    const conArchivo = formulario();
    conArchivo.set(campo, new Blob(["contenido"], { type: "text/plain" }), "dato.txt");
    assert.equal(validarSede(conArchivo).datos, null);
  }
});

test("los campos internos de React no se confunden con datos de la sede", () => {
  const datos = formulario();
  datos.set("$ACTION_REF_0", "referencia");
  const resultado = validarSede(datos);
  assert.ok(resultado.datos);
  assert.equal(Object.hasOwn(resultado.datos, "$ACTION_REF_0"), false);
});
