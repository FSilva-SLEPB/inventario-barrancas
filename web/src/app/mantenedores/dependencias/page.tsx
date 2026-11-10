import AccionesRegistro from '@/components/acciones-registro';
import ModalFicha from '@/components/modal-ficha';
/* eslint jsx-a11y/no-noninteractive-tabindex: ["error", { "roles": ["tabpanel", "region"] }] */
// El contenedor de la tabla recibe foco para permitir su desplazamiento con teclado.
import VentanaEdicion from '@/components/ventana-edicion';
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import FormularioDependencia from "@/components/formulario-dependencia";
import { listarDependencias } from "@/lib/dependencias";
import { listarSedes } from "@/lib/sedes";
import { exigirAcceso } from "@/lib/acceso";
import { puedeGestionarDependencias } from "@/lib/politica-acceso";
import { esIdDependencia } from "@/lib/validacion-dependencias";
import { TIPOS_SEDE } from "@/lib/validacion-sedes";
import estilos from "./dependencias.module.css";
import { etiquetaSede } from "@/lib/etiqueta-sede";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Dependencias | Inventario SLEP Barrancas",
};

type Propiedades = {
  searchParams: Promise<{ ver?: string | string[]; editar?: string | string[]; guardado?: string | string[]; nuevo?: string | string[] }>;
};

export default async function Dependencias({ searchParams }: Propiedades) {
  await connection();
  const acceso = await exigirAcceso();
  const parametros = await searchParams;
  const [dependencias, sedes] = await Promise.all([listarDependencias(), listarSedes()]);
  const puedeEditar = puedeGestionarDependencias(acceso.rol);
  const pideEdicion = parametros.editar !== undefined;
  const id = typeof parametros.editar === "string" && esIdDependencia(parametros.editar)
    ? parametros.editar.toLowerCase() : null;
  const seleccionada = id ? dependencias.find((dependencia) => dependencia.id === id) : undefined;
  const edicionInvalida = pideEdicion && !seleccionada;
  const nuevo = puedeEditar && parametros.nuevo === "1";

  const consulta = typeof parametros.ver === 'string' ? dependencias.find(x=>x.id===parametros.ver) : undefined;

  return (
    <main>
{consulta&&<ModalFicha titulo="Ver registro" cerrarHref="/mantenedores/dependencias" focoId={consulta.id}><dl className="ficha-datos"><dt>Nombre</dt><dd>{consulta.nombre}</dd><dt>Estado</dt><dd>{consulta.activo?'Activo':'Inactivo'}</dd><dt>Sede</dt><dd>{consulta.sedeNombre}</dd><dt>RBD</dt><dd>{consulta.sedeRbd||'Sin informar'}</dd></dl></ModalFicha>}
      <header>
        <p>SLEP Barrancas</p>
        <h1>Dependencias</h1>
        <p className="descripcion-pagina">
          Registra los espacios dentro de cada sede: Dirección, Secretaría, UTP o Sala de Enlaces.
        </p>
      </header>

      <div className="acciones-catalogos">
        <Link className="btn btn-outline-primary btn-sm" href="/mantenedores">Volver a Mantenedores</Link>
        {puedeEditar && (
          <Link className="btn btn-primary btn-sm" scroll={false} href="/mantenedores/dependencias?nuevo=1">Registrar una dependencia</Link>
        )}
      </div>
      {!puedeEditar && <p>Vista de consulta.</p>}

      {edicionInvalida && puedeEditar && (
        <p role="alert" className="error-catalogos">
          No fue posible identificar la dependencia. Selecciona Editar desde el listado.
        </p>
      )}

      {parametros.guardado==="1"&&<p role="status">Cambios guardados. La edición está cerrada.</p>}
      <section aria-labelledby="titulo-listado-dependencias">
        <h2 id="titulo-listado-dependencias">Listado de dependencias</h2>
        {dependencias.length === 0 ? <p>Todavía no hay dependencias registradas.</p> : (
          <div
            className={`${estilos.contenedorTabla} tabla-contenedor`} role="region"
            aria-labelledby="titulo-listado-dependencias" tabIndex={0}
          >
            <table className={`tabla-datos ${estilos.tabla}`}>
              <caption>Dependencias registradas: {dependencias.length}</caption>
              <thead>
                <tr>
                  <th scope="col">Dependencia</th>
                  <th scope="col">Sede</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {dependencias.map((dependencia) => (
                  <tr key={dependencia.id}>
                    <th scope="row">{dependencia.nombre}</th>
                    <td>
                      {etiquetaSede({ nombre: dependencia.sedeNombre, rbd: dependencia.sedeRbd })}
                      <small className={estilos.detalleSede}>
                        {TIPOS_SEDE[dependencia.sedeTipo]}
                        {dependencia.sedeActiva ? "" : " · Sede inactiva"}
                      </small>
                    </td>
                    <td>{dependencia.activo ? "Activa" : "Inactiva"}</td>
                    <td><AccionesRegistro id={dependencia.id} nombre={dependencia.nombre} verHref={`/mantenedores/dependencias?ver=${dependencia.id}`} editarHref={puedeEditar?`/mantenedores/dependencias?editar=${dependencia.id}`:undefined}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {puedeEditar && !edicionInvalida && parametros.guardado!=="1" && (nuevo || seleccionada) && (
        <VentanaEdicion activa={nuevo || Boolean(seleccionada)} titulo={nuevo ? "Registrar dependencia" : "Editar dependencia"} cerrarHref="/mantenedores/dependencias"><section
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
        </section></VentanaEdicion>
      )}
    </main>
  );
}
