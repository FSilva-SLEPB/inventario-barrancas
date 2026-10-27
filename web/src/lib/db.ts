import "server-only";

import { Pool } from "pg";

const contextoGlobal = globalThis as typeof globalThis & {
  poolInventario?: Pool;
};

export function obtenerBaseDatos(): Pool {
  if (contextoGlobal.poolInventario) {
    return contextoGlobal.poolInventario;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("Falta configurar DATABASE_URL en el servidor.");
  }

  const pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000,
    application_name: "inventario_web",
  });

  pool.on("error", () => {
    console.error("Se perdió una conexión inactiva con la base de datos.");
  });

  contextoGlobal.poolInventario = pool;
  return pool;
}
