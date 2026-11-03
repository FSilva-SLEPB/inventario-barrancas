/* eslint jsx-a11y/no-noninteractive-tabindex: ["error", { "roles": ["tabpanel", "region"] }] */
// El contenedor de la tabla recibe foco para permitir su desplazamiento con teclado.
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import FormularioSede from "@/components/formulario-sede";
import { listarSedes } from "@/lib/sedes";
import { exigirAcceso } from "@/lib/acceso";
import { puedeAdministrar } from "@/lib/politica-acceso";
import { esIdSede, TIPOS_SEDE } from "@/lib/validacion-sedes";
import estilos from "./sedes.module.css";
import { etiquetaSede } from "@/lib/etiqueta-sede";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Sedes | Inventario SLEP Barrancas",
};

type Propiedades = {
  searchParams: Promise<{ editar?: string | string[] }>;
};

export default async function Sedes({ searchParams }: Propiedades) {
  await connection();
  const acceso = await exigirAcceso();
  const parametros = await searchParams;
  const sedes = await listarSedes();
  const puedeEditar = puedeAdministrar(acceso.rol);
  const pideEdicion = parametros.editar !== undefined;
  const id = typeof parametros.editar === "string" && esIdSede(parametros.editar)
    ? parametros.editar.toLowerCase() : null;
  const seleccionada = id ? sedes.find((sede) => sede.id === id) : undefined;
  const edicionInvalida = pideEdicion && !seleccionada;

  return (
    <main>
      <header>
        <p>SLEP Barrancas</p>
        <h1>Sedes</h1>
        <p className="descripcion-pagina">
          Registra los datos de Nivel Central, establecimientos y jardines infantiles.
        </p>
      </header>

      <p><Link href="/mantenedores">Volver a Mantenedores</Link></p>
      {puedeEditar ? (
        <p><Link href="/mantenedores/sedes#formulario-sede">Registrar una sede</Link></p>
      ) : <p>Vista de consulta.</p>}

      {edicionInvalida && puedeEditar && (
        <p role="alert" className="error-catalogos">
          No fue posible identificar la sede. Selecciona Editar desde el listado.
        </p>
      )}

      <section aria-labelledby="titulo-listado-sedes">
        <h2 id="titulo-listado-sedes">Listado de sedes</h2>
        {sedes.length === 0 ? <p>Todavía no hay sedes registradas.</p> : (
          <div
            className={`${estilos.contenedorTabla} tabla-contenedor`} role="region"
            aria-labelledby="titulo-listado-sedes" tabIndex={0}
          >
            <table className={`tabla-datos ${estilos.tabla}`}>
              <caption>Sedes registradas: {sedes.length}</caption>
              <thead>
                <tr>
                  <th scope="col">RBD</th>
                  <th scope="col">Nombre EE/JI</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Dirección</th>
                  <th scope="col">Comuna</th>
                  {puedeEditar && <th scope="col">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {sedes.map((sede) => (
                  <tr key={sede.id}>
                    <td>{sede.rbd ?? "—"}</td>
                    <th scope="row">{sede.nombre}{!sede.activo && <small> (inactiva)</small>}</th>
                    <td>{TIPOS_SEDE[sede.tipo]}</td>
                    <td>{sede.direccion ?? "—"}</td>
                    <td>{sede.comuna ?? "—"}</td>
                    {puedeEditar && (
                      <td>
                        <Link
                          href={`/mantenedores/sedes?editar=${sede.id}#formulario-sede`}
                          aria-label={`Editar sede ${etiquetaSede(sede)}`}
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
        <section id="formulario-sede" className="panel-catalogos" aria-labelledby="titulo-formulario-sede">
          <h2 id="titulo-formulario-sede">{seleccionada ? "Editar sede" : "Registrar sede"}</h2>
          <p>El tipo y el nombre son obligatorios. El RBD y los datos de contacto son opcionales.</p>
          <FormularioSede key={seleccionada?.id ?? "nueva"} sede={seleccionada} />
        </section>
      )}
    </main>
  );
}
