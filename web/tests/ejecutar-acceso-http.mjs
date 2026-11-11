import {iniciarSMTPPrueba} from './smtp-prueba.mjs';
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { setTimeout as esperar } from "node:timers/promises";
import assert from "node:assert/strict";

assert.ok(process.env.TEST_ADMIN_DATABASE_URL && process.env.DATABASE_URL,
  "Usar solo una base de prueba con conexiones administrativa y de aplicación.");
const smtpActas=await iniciarSMTPPrueba();
const entornoServidor = { ...process.env,...smtpActas.env,
  NEXTAUTH_URL: "http://localhost:3100", NEXTAUTH_SECRET: randomBytes(32).toString("hex"),
  GOOGLE_CLIENT_ID: "id-ficticio", GOOGLE_CLIENT_SECRET: "secreto-ficticio",
  NEXT_TELEMETRY_DISABLED: "1", REVISION_SIN_OAUTH: "1",
};
delete entornoServidor.TEST_ADMIN_DATABASE_URL;
const servidor = spawn(process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3100"],
  { env: entornoServidor, stdio: "inherit" });
const finServidor = new Promise((resolve) => servidor.once("exit", resolve));
try {
  let listo = false;
  for (let intento = 0; intento < 100; intento++) {
    if (servidor.exitCode !== null) throw new Error("El servidor de prueba terminó antes de iniciar.");
    try {
      listo = (await fetch("http://127.0.0.1:3100/ingresar")).status === 200;
    } catch { /* Esperar el arranque, sin ignorar un fallo definitivo. */ }
    if (listo) break;
    await esperar(200);
  }
  assert.ok(listo, "El servidor de prueba no quedó listo.");
  for (const archivo of ["tests/acceso-http.mjs", "tests/perfiles-http.mjs", "tests/equipos-http.mjs", "tests/entregas-http.mjs", "tests/directorio-http.mjs", "tests/directorio-completo-http.mjs", "tests/robos-http.mjs", "tests/experiencia-http.mjs", "tests/funcionarios-http.mjs", "tests/produccion-http.mjs", "tests/seguridad-http.mjs", "tests/directorios-separados-http.mjs", "tests/celulares-http.mjs", "tests/movimientos-inventario-http.mjs", "tests/actas-http.mjs", "tests/actas-historicas-http.mjs", "tests/operacion-acta-http.mjs", "tests/prestamos-http.mjs", "tests/operaciones-inventario-http.mjs", "tests/estados-inventario-http.mjs", "tests/insumos-http.mjs", "tests/ubicaciones-bodega-http.mjs", "tests/compras-insumos-http.mjs"]) {
    const pruebas = spawn(process.execPath, [archivo], { stdio: "inherit", env: {
      ...entornoServidor, TEST_ADMIN_DATABASE_URL: process.env.TEST_ADMIN_DATABASE_URL,
      ACCESO_HTTP_URL: "http://127.0.0.1:3100",
    } });
    const codigo = await new Promise((resolve) => pruebas.once("exit", resolve));
    assert.equal(codigo, 0, "Fallaron las comprobaciones HTTP: " + archivo);
  }
} finally {
  servidor.kill("SIGTERM");
  const limite = setTimeout(() => servidor.kill("SIGKILL"), 5000);
  await finServidor;
  clearTimeout(limite);
  await smtpActas.cerrar();
}
