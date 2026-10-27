import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import FormularioCategoria from "@/components/formulario-categoria";
import { listarCategorias } from "@/lib/catalogos";

export const metadata: Metadata = {
  title: "Categorías de bienes | Mantenedores | Inventario SLEP Barrancas",
};

export const runtime = "nodejs";

export default async function Catalogos({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string | string[] }>;
}) {
  await connection();

  const categorias = await listarCategorias();
  const parametros = await searchParams;
  const edicionHabilitada = process.env.NODE_ENV === "development";
  const categoriaEditar = categorias.find(
    (categoria) => categoria.id === parametros.editar,
  );

  return (
    <main>
      <header>
        <p>SLEP Barrancas</p>
        <h1>Categorías de bienes</h1>
        <p><Link href="/mantenedores">Volver a Mantenedores</Link></p>
      </header>

      <section aria-labelledby="titulo-categorias">
        <h2 id="titulo-categorias">Listado</h2>
        <p>Administra las categorías que usarás para registrar los bienes.</p>

        {categorias.length === 0 ? (
          <p>Todavía no hay categorías registradas.</p>
        ) : (
          <table className="tabla-catalogos">
            <caption>Categorías registradas</caption>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Estado</th>
                {edicionHabilitada && <th scope="col">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {categorias.map((categoria) => (
                <tr key={categoria.id}>
                  <th scope="row">{categoria.nombre}</th>
                  <td>{categoria.activo ? "Activa" : "Inactiva"}</td>
                  {edicionHabilitada && (
                    <td>
                      <Link
                        href={"/mantenedores/categorias?editar=" + categoria.id + "#formulario-categoria"}
                        aria-label={"Editar categoría " + categoria.nombre}
                      >
                        Editar
                      </Link>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {edicionHabilitada && (
        <section
          id="formulario-categoria"
          className="panel-catalogos"
          aria-labelledby="titulo-formulario"
        >
          <h2 id="titulo-formulario">
            {categoriaEditar ? "Editar categoría" : "Nueva categoría"}
          </h2>
          {parametros.editar && !categoriaEditar && (
            <p role="alert" className="error-catalogos">
              La categoría solicitada no está disponible. Puedes crear una nueva.
            </p>
          )}
          <FormularioCategoria
            key={categoriaEditar?.id ?? "nueva"}
            categoria={categoriaEditar}
          />
        </section>
      )}
    </main>
  );
}
