import AccionesRegistro from '@/components/acciones-registro';
import ModalFicha from '@/components/modal-ficha';
import VentanaEdicion from '@/components/ventana-edicion';
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import FormularioCategoria from "@/components/formulario-categoria";
import { listarCategorias } from "@/lib/catalogos";
import { exigirAcceso } from "@/lib/acceso";
import {tienePermiso} from "@/lib/rbac";

export const metadata: Metadata = {
  title: "Categorías de bienes | Mantenedores | Sistema Unidad TIC",
};

export const runtime = "nodejs";

export default async function Catalogos({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string | string[]; editar?: string | string[]; guardado?: string | string[]; nuevo?: string | string[] }>;
}) {
  await connection();
  const acceso = await exigirAcceso();

  const categorias = await listarCategorias();
  const parametros = await searchParams;
  const edicionHabilitada=tienePermiso(acceso,'categorias','editar');const puedeCrear=tienePermiso(acceso,'categorias','registrar');
  const categoriaEditar = categorias.find(
    (categoria) => categoria.id === parametros.editar,
  );
  const nuevo = puedeCrear && parametros.nuevo === "1";

  const consulta = typeof parametros.ver === 'string' ? categorias.find(x=>x.id===parametros.ver) : undefined;

  return (
    <main>
{consulta&&<ModalFicha titulo="Ver registro" cerrarHref="/mantenedores/categorias" focoId={consulta.id}><dl className="ficha-datos"><dt>Nombre</dt><dd>{consulta.nombre}</dd><dt>Estado</dt><dd>{consulta.activo?'Activo':'Inactivo'}</dd></dl></ModalFicha>}
      <header>
        <p>SLEP Barrancas</p>
        <h1>Categorías de bienes</h1>
      </header>

      {parametros.guardado==="1"&&<p role="status">Cambios guardados. La edición está cerrada.</p>}
      <div className="acciones-catalogos">
        <Link className="btn btn-outline-primary btn-sm" href="/mantenedores">Volver a Mantenedores</Link>
        {puedeCrear && <Link className="btn btn-primary btn-sm" scroll={false} href="/mantenedores/categorias?nuevo=1">Registrar categoría</Link>}
      </div>
      <section aria-labelledby="titulo-categorias">
        <h2 id="titulo-categorias">Listado</h2>
        <p>Administra las categorías que usarás para registrar los bienes.</p>

        {categorias.length === 0 ? (
          <p>Todavía no hay categorías registradas.</p>
        ) : (
          <table className="tabla-datos tabla-catalogos">
            <caption>Categorías registradas</caption>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Estado</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {categorias.map((categoria) => (
                <tr key={categoria.id}>
                  <th scope="row">{categoria.nombre}</th>
                  <td>{categoria.activo ? "Activa" : "Inactiva"}</td>
                  <td><AccionesRegistro id={categoria.id} nombre={categoria.nombre} verHref={`/mantenedores/categorias?ver=${categoria.id}`} editarHref={edicionHabilitada?`/mantenedores/categorias?editar=${categoria.id}`:undefined}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {(nuevo||edicionHabilitada) && parametros.guardado!=="1" && (nuevo || categoriaEditar || parametros.editar) && (
        <VentanaEdicion activa={nuevo || Boolean(categoriaEditar)} titulo={nuevo ? "Registrar categoría" : "Editar categoría"} cerrarHref="/mantenedores/categorias"><section
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
        </section></VentanaEdicion>
      )}
    </main>
  );
}
