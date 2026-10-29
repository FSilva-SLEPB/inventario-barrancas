/* eslint jsx-a11y/no-noninteractive-tabindex: ["error", { "roles": ["tabpanel", "region"] }] */
// El contenedor de la tabla recibe foco para permitir su desplazamiento con teclado.
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import FormularioDependencia from "@/components/formulario-dependencia";
import { listarDependencias } from "@/lib/dependencias";
import { listarSedes } from "@/lib/sedes";
import { exigirAcceso } from "@/lib/acceso";
import { puedeAdministrar } from "@/lib/politica-acceso";
import { esIdDependencia } from "@/lib/validacion-dependencias";
import { TIPOS_SEDE } from "@/lib/validacion-sedes";
import estilos from "./dependencias.module.css";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Dependencias | Inventario SLEP Barrancas",
};

type Propiedades = {
  searchParams: Promise<{ editar?: string | string[] }>;
};

export default async function Dependencias({ searchParams }: Propiedades) {
  await connection();
  const acceso = await exigirAcceso();
  const parametros = await searchParams;
  const [dependencias, sedes] = await Promise.all([listarDependencias(), listarSedes()]);
  const puedeEditar = puedeAdministrar(acceso.rol);
  const pideEdicion = parametros.editar !== undefined;
  const id = typeof parametros.editar === "string" && esIdDependencia(parametros.editar)
    ? parametros.editar.toLowerCase() : null;
  const seleccionada = id ? dependencias.find((dependencia) => dependencia.id === id) : undefined;
  const edicionInvalida = pideEdicion && !seleccionada;

  return (
    <main>
      <header>
        <p>SLEP Barrancas</p>
        <h1>Dependencias</h1>
        <p className="descripcion-pagina">
          Registra los espacios dentro de cada sede: Dirección, Secretaría, UTP o Sala de Enlaces.
        </p>
      </header>

      <p><Link href="/mantenedores">Volver a Mantenedores</Link></p>
      {puedeEditar ? (
        <p><Link href="/mantenedores/dependencias#formulario-dependencia">Registrar una dependencia</Link></p>
      ) : <p>Vista de consulta.</p>}

      {edicionInvalida && puedeEditar && (
        <p role="alert" className="error-catalogos">
          No fue posible identificar la dependencia. Selecciona Editar desde el listado.
        </p>
      )}

      <section aria-labelledby="titulo-listado-dependencias">
        <h2 id="titulo-listado-dependencias">Listado de dependencias</h2>
        {dependencias.length === 0 ? <p>Todavía no hay dependencias registradas.</p> : (
          <div
            className={estilos.contenedorTabla} role="region"
            aria-labelledby="titulo-listado-dependencias" tabIndex={0}
          >
            <table className={estilos.tabla}>
              <caption>Dependencias registradas: {dependencias.length}</caption>
              <thead>
                <tr>
                  <th scope="col">Dependencia</th>
                  <th scope="col">Sede</th>
                  <th scope="col">Estado</th>
                  {puedeEditar && <th scope="col">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {dependencias.map((dependencia) => (
                  <tr key={dependencia.id}>
                    <th scope="row">{dependencia.nombre}</th>
                    <td>
                      {dependencia.sedeNombre}
                      <small className={estilos.detalleSede}>
                        {TIPOS_SEDE[dependencia.sedeTipo]}
                        {dependencia.sedeRbd ? ` · RBD ${dependencia.sedeRbd}` : ""}
                        {dependencia.sedeActiva ? "" : " · Sede inactiva"}
                      </small>
                    </td>
                    <td>{dependencia.activo ? "Activa" : "Inactiva"}</td>
                    {puedeEditar && (
                      <td>
                        <Link
                          href={`/mantenedores/dependencias?editar=${dependencia.id}#formulario-dependencia`}
                          aria-label={`Editar dependencia ${dependencia.nombre} de ${dependencia.sedeNombre}`}
                        >
                          Editar
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {puedeEditar && !edicionInvalida && (
        <section
          id="formulario-dependencia" className="panel-catalogos"
          aria-labelledby="titulo-formulario-dependencia"
        >
          <h2 id="titulo-formulario-dependencia">
            {seleccionada ? "Editar dependencia" : "Registrar dependencia"}
          </h2>
          {sedes.length === 0 ? (
            <p>Primero debes <Link href="/mantenedores/sedes">registrar una sede</Link>.</p>
          ) : (
            <>
              <p>Selecciona la sede a la que pertenece el espacio y escribe su nombre.</p>
              <FormularioDependencia
                key={seleccionada?.id ?? "nueva"} dependencia={seleccionada} sedes={sedes}
              />
            </>
          )}
        </section>
      )}
    </main>
  );
}
