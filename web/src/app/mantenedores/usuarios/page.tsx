/* eslint jsx-a11y/no-noninteractive-tabindex: ["error", { "roles": ["region"] }] */
import Link from "next/link";
import { exigirAdministrador } from "@/lib/acceso";
import { listarUsuarios } from "@/lib/usuarios";
import { PERFILES } from "@/lib/validacion-usuarios";
import FormularioUsuario from "@/components/formulario-usuario";

export const metadata = { title: "Usuarios y perfiles | Inventario SLEP Barrancas" };

export default async function Usuarios({ searchParams }: {
  searchParams: Promise<{ editar?: string | string[] }>;
}) {
  const actor = await exigirAdministrador();
  const usuarios = await listarUsuarios();
  const { editar } = await searchParams;
  const seleccionado = typeof editar === "string" ? usuarios.find(u => u.correo === editar) : undefined;
  const edicionInvalida = editar !== undefined && !seleccionado;
  return <main>
    <header><p>SLEP Barrancas</p><h1>Usuarios y perfiles</h1>
      <p className="descripcion-pagina">Autoriza cuentas institucionales y administra sus permisos de acceso.</p>
    </header>
    <p><Link href="/mantenedores">Volver a Mantenedores</Link></p>
    <section aria-labelledby="usuarios-listado"><h2 id="usuarios-listado">Usuarios registrados</h2>
      <div className="tabla-usuarios-contenedor" role="region" aria-labelledby="usuarios-listado" tabIndex={0}>
        <table className="tabla-catalogos">
          <caption>Cuentas autorizadas y desactivadas</caption>
          <thead><tr><th scope="col">Usuario</th><th scope="col">Perfil</th><th scope="col">Estado</th>
            <th scope="col">Acciones</th></tr></thead>
          <tbody>{usuarios.map(u => <tr key={u.correo}>
            <th scope="row">{u.nombre && <span className="usuario-nombre">{u.nombre}</span>}{u.correo}
              {u.correo === actor.email && <small className="usuario-nombre">Tu cuenta</small>}</th>
            <td>{PERFILES[u.rol]}</td><td>{u.activo ? "Activo" : "Inactivo"}</td>
            <td><Link href={`/mantenedores/usuarios?editar=${encodeURIComponent(u.correo)}#formulario-usuario`}
              aria-label={`Editar acceso de ${u.correo}`}>Editar</Link></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
    {edicionInvalida ? <p role="alert" className="error-catalogos">
      No se encontró la cuenta. Selecciona Editar desde el listado.
    </p> : <section id="formulario-usuario" className="panel-catalogos" aria-labelledby="usuario-titulo">
      <h2 id="usuario-titulo">{seleccionado ? "Editar acceso" : "Registrar usuario"}</h2>
      <p>La cuenta debe pertenecer a slepb.gob.cl. No se crean cuentas ni contraseñas de Google desde este formulario.</p>
      {seleccionado?.correo === actor.email && <p>Otro administrador deberá retirar tu permiso o desactivar tu cuenta.</p>}
      <FormularioUsuario key={seleccionado?.correo ?? "nuevo"} usuario={seleccionado} />
    </section>}
    <section aria-labelledby="perfiles-titulo" className="perfiles-ayuda">
      <h2 id="perfiles-titulo">Perfiles disponibles</h2>
      <dl><dt>Administrador</dt><dd>Consulta y modifica catálogos; registra usuarios y administra sus perfiles.</dd>
        <dt>Consulta</dt><dd>Consulta los catálogos. No modifica registros ni administra usuarios.</dd></dl>
      <p>Debe permanecer al menos un administrador activo. Los cambios de acceso quedan registrados.</p>
    </section>
  </main>;
}
