import assert from "node:assert/strict";
import test from "node:test";

import {
  LIMITE_NOMBRE_DEPENDENCIA,
  validarDependencia,
  valoresInicialesDependencia,
} from "../src/lib/validacion-dependencias.ts";

const sedeId = "a756f4c8-24ec-4be9-9c84-6ff4e5e9824b";
const dependenciaId = "b654dc11-9829-412e-b955-c9547b58d842";

function formulario(cambios = {}) {
  const datos = new FormData();
  const valores = {
    ...valoresInicialesDependencia(),
    sedeId,
    nombre: "Sala de Enlaces",
    ...cambios,
  };
  for (const [campo, valor] of Object.entries(valores)) {
    datos.set(campo, valor);
  }
  return datos;
}

test("una nueva dependencia conserva la sede seleccionada y se registra activa", () => {
  assert.deepEqual(validarDependencia(formulario()).datos, {
    id: null, sedeId, nombre: "Sala de Enlaces", activo: true,
  });
});

test("la edición conserva el identificador y el estado inactivo", () => {
  const resultado = validarDependencia(formulario({ id: dependenciaId, activo: "false" }));
  assert.ok(resultado.datos);
  assert.equal(resultado.datos.id, dependenciaId);
  assert.equal(resultado.datos.activo, false);
});

test("normaliza los UUID recibidos con espacios y mayúsculas", () => {
  const resultado = validarDependencia(formulario({
    id: ` ${dependenciaId.toUpperCase()} `,
    sedeId: ` ${sedeId.toUpperCase()} `,
  }));
  assert.equal(resultado.datos?.id, dependenciaId);
  assert.equal(resultado.datos?.sedeId, sedeId);
});

test("exige una sede y rechaza identificadores de sede inválidos", () => {
  for (const valor of ["", "123", "undefined", "__proto__", "' OR '1'='1"]) {
    const resultado = validarDependencia(formulario({ sedeId: valor }));
    assert.equal(resultado.datos, null);
    assert.ok(resultado.errores.sedeId);
  }
  const datos = formulario();
  datos.delete("sedeId");
  assert.equal(validarDependencia(datos).datos, null);
});

test("un identificador de edición inválido no se convierte en un registro nuevo", () => {
  for (const id of ["123", "undefined", "' OR '1'='1"]) {
    const resultado = validarDependencia(formulario({ id }));
    assert.equal(resultado.datos, null);
    assert.ok(resultado.errores.id);
  }
});

test("el nombre es obligatorio y un error conserva la sede y el estado enviados", () => {
  const resultado = validarDependencia(formulario({ nombre: "   ", activo: "false" }));
  assert.equal(resultado.datos, null);
  assert.ok(resultado.errores.nombre);
  assert.equal(resultado.valores.sedeId, sedeId);
  assert.equal(resultado.valores.activo, "false");
});

test("normaliza espacios y tildes y permite apóstrofos en el nombre", () => {
  const resultado = validarDependencia(formulario({ nombre: "  Direccio\u0301n  O'Higgins  " }));
  assert.equal(resultado.datos?.nombre, "Dirección O'Higgins");
});

test("acepta el límite de longitud y rechaza un nombre que lo supera", () => {
  assert.ok(validarDependencia(formulario({ nombre: "a".repeat(LIMITE_NOMBRE_DEPENDENCIA) })).datos);
  const resultado = validarDependencia(formulario({ nombre: "a".repeat(LIMITE_NOMBRE_DEPENDENCIA + 1) }));
  assert.equal(resultado.datos, null);
  assert.ok(resultado.errores.nombre);
});

test("rechaza controles y saltos de línea dentro del nombre", () => {
  for (const control of ["\u0000", "\n", "\r", "\t", "\u007f", "\u0085"]) {
    const resultado = validarDependencia(formulario({ nombre: `Sala${control}Enlaces` }));
    assert.equal(resultado.datos, null);
    assert.ok(resultado.errores.nombre);
  }
});

test("un estado ausente o inválido no se convierte en inactivo", () => {
  for (const activo of ["", "on", "0", "False", "1"]) {
    const resultado = validarDependencia(formulario({ activo }));
    assert.equal(resultado.datos, null);
    assert.ok(resultado.errores.activo);
  }
  const datos = formulario();
  datos.delete("activo");
  assert.equal(validarDependencia(datos).datos, null);
});

test("rechaza campos repetidos y archivos en todos los campos del formulario", () => {
  for (const campo of Object.keys(valoresInicialesDependencia())) {
    const repetido = formulario();
    repetido.append(campo, "otro valor");
    assert.equal(validarDependencia(repetido).datos, null);

    const conArchivo = formulario();
    conArchivo.set(campo, new Blob(["contenido"], { type: "text/plain" }), "dato.txt");
    assert.equal(validarDependencia(conArchivo).datos, null);
  }
});

test("los campos internos de React no se usan como datos de la dependencia", () => {
  const datos = formulario();
  datos.set("$ACTION_REF_0", "referencia");
  assert.deepEqual(validarDependencia(datos).datos, {
    id: null, sedeId, nombre: "Sala de Enlaces", activo: true,
  });
});

test("al cargar una edición se conserva su sede y su estado inactivo", () => {
  assert.deepEqual(valoresInicialesDependencia({
    id: dependenciaId, sedeId, nombre: "Secretaría", activo: false,
  }), {
    id: dependenciaId, sedeId, nombre: "Secretaría", activo: "false",
  });
});
