import AccionesRegistro from '@/components/acciones-registro';
import ModalFicha from '@/components/modal-ficha';
/* eslint jsx-a11y/no-noninteractive-tabindex: ["error", { "roles": ["tabpanel", "region"] }] */
// El contenedor de la tabla recibe foco para permitir su desplazamiento con teclado.
import VentanaEdicion from '@/components/ventana-edicion';
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import FormularioSede from "@/components/formulario-sede";
import { listarSedes } from "@/lib/sedes";
import { exigirAcceso } from "@/lib/acceso";
import { puedeAdministrar } from "@/lib/politica-acceso";
import { esIdSede, TIPOS_SEDE } from "@/lib/validacion-sedes";
import estilos from "./sedes.module.css";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Sedes | Sistema Unidad TIC",
};

type Propiedades = {
  searchParams: Promise<{ ver?: string | string[]; editar?: string | string[]; guardado?: string | string[]; nuevo?: string | string[] }>;
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
  const nuevo = puedeEditar && parametros.nuevo === "1";

  const consulta = typeof parametros.ver === 'string' ? sedes.find(x=>x.id===parametros.ver) : undefined;

  return (
    <main>
{consulta&&<ModalFicha titulo="Ver registro" cerrarHref="/mantenedores/sedes" focoId={consulta.id}><dl className="ficha-datos"><dt>Nombre</dt><dd>{consulta.nombre}</dd><dt>Estado</dt><dd>{consulta.activo?'Activo':'Inactivo'}</dd><dt>RBD</dt><dd>{consulta.rbd||'Sin informar'}</dd><dt>Tipo</dt><dd>{TIPOS_SEDE[consulta.tipo]}</dd><dt>Dirección</dt><dd>{consulta.direccion||'Sin informar'}</dd><dt>Comuna</dt><dd>{consulta.comuna||'Sin informar'}</dd></dl></ModalFicha>}
      <header>
        <p>SLEP Barrancas</p>
        <h1>Sedes</h1>
        <p className="descripcion-pagina">
          Registra los datos de Nivel Central, establecimientos y jardines infantiles.
        </p>
      </header>

      <div className="acciones-catalogos">
        <Link className="btn btn-outline-primary btn-sm" href="/mantenedores">Volver a Mantenedores</Link>
        {puedeEditar && (
          <Link className="btn btn-primary btn-sm" scroll={false} href="/mantenedores/sedes?nuevo=1">Registrar una sede</Link>
        )}
      </div>
      {!puedeEditar && <p>Vista de consulta.</p>}

      {edicionInvalida && puedeEditar && (
        <p role="alert" className="error-catalogos">
          No fue posible identificar la sede. Selecciona Editar desde el listado.
        </p>
      )}

      {parametros.guardado==="1"&&<p role="status">Cambios guardados. La edición está cerrada.</p>}
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
                  <th scope="col">Acciones</th>
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
                    <td><AccionesRegistro id={sede.id} nombre={sede.nombre} verHref={`/mantenedores/sedes?ver=${sede.id}`} editarHref={puedeEditar?`/mantenedores/sedes?editar=${sede.id}`:undefined}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {puedeEditar && !edicionInvalida && parametros.guardado!=="1" && (nuevo || seleccionada) && (
        <VentanaEdicion activa={nuevo || Boolean(seleccionada)} titulo={nuevo ? "Registrar sede" : "Editar sede"} cerrarHref="/mantenedores/sedes"><section id="formulario-sede" className="panel-catalogos" aria-labelledby="titulo-formulario-sede">
          <h2 id="titulo-formulario-sede">{seleccionada ? "Editar sede" : "Registrar sede"}</h2>
          <p>El tipo y el nombre son obligatorios. El RBD y los datos de contacto son opcionales.</p>
          <FormularioSede key={seleccionada?.id ?? "nueva"} sede={seleccionada} />
        </section></VentanaEdicion>
      )}
    </main>
  );
}
