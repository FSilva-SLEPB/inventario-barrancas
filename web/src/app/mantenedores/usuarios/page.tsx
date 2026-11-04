import AccionesRegistro from '@/components/acciones-registro';
import ModalFicha from '@/components/modal-ficha';
/* eslint jsx-a11y/no-noninteractive-tabindex: ["error", { "roles": ["region"] }] */
import VentanaEdicion from '@/components/ventana-edicion';
import Link from "next/link";
import { exigirAdministrador } from "@/lib/acceso";
import { listarUsuarios } from "@/lib/usuarios";
import { PERFILES } from "@/lib/validacion-usuarios";
import FormularioUsuario from "@/components/formulario-usuario";
import { listarSedes } from "@/lib/sedes";
import { perfilReservado } from "@/lib/politica-acceso";
import { etiquetaSede } from "@/lib/etiqueta-sede";

export const metadata = { title: "Usuarios y perfiles | Inventario SLEP Barrancas" };

export default async function Usuarios({ searchParams }: {
  searchParams: Promise<{ ver?: string | string[]; editar?: string | string[]; guardado?: string | string[] }>;
}) {
  const actor = await exigirAdministrador();
  const usuarios = await listarUsuarios();
  const sedes = await listarSedes();
  const sistema = actor.rol === "administrador";
  const { editar, guardado, ver } = await searchParams;
  const seleccionado = typeof editar === "string" ? usuarios.find(u => u.correo === editar) : undefined;
  const consulta = typeof ver === 'string' ? usuarios.find(u=>u.correo===ver) : undefined;
  const edicionInvalida = editar !== undefined && !seleccionado;
  const reservado = !sistema && seleccionado && perfilReservado(seleccionado.rol);
  return <main>
{consulta&&<ModalFicha titulo="Ver registro" cerrarHref="/mantenedores/usuarios" focoId={consulta.correo}><dl className="ficha-datos"><dt>Nombre</dt><dd>{consulta.nombre||'Sin informar'}</dd><dt>Correo</dt><dd>{consulta.correo}</dd><dt>Perfil</dt><dd>{PERFILES[consulta.rol]}</dd><dt>Estado</dt><dd>{consulta.activo?'Activo':'Inactivo'}</dd></dl></ModalFicha>}
    <header><p>SLEP Barrancas</p><h1>Usuarios y perfiles</h1>
      <p className="descripcion-pagina">Autoriza cuentas institucionales y administra sus permisos de acceso.</p>
    </header>
    <p><Link href="/mantenedores">Volver a Mantenedores</Link></p>
    {guardado==="1"&&<p role="status">Cambios guardados. La edición está cerrada.</p>}
    <p><Link href="/mantenedores/usuarios#formulario-usuario">Registrar usuario</Link></p>
    <section aria-labelledby="usuarios-listado"><h2 id="usuarios-listado">Usuarios registrados</h2>
      <div className="tabla-usuarios-contenedor" role="region" aria-labelledby="usuarios-listado" tabIndex={0}>
        <table className="tabla-datos tabla-catalogos">
          <caption>Cuentas autorizadas y desactivadas</caption>
          <thead><tr><th scope="col">Usuario</th><th scope="col">Perfil</th><th scope="col">Sede / alcance</th><th scope="col">Estado</th>
            <th scope="col">Acciones</th></tr></thead>
          <tbody>{usuarios.map(u => {
            const sede = sedes.find(s => s.id === u.sedeId);
            return <tr key={u.correo}>
            <th scope="row">{u.nombre && <span className="usuario-nombre">{u.nombre}</span>}{u.correo}
              {u.correo === actor.email && <small className="usuario-nombre">Tu cuenta</small>}</th>
            <td>{PERFILES[u.rol]}</td><td>{u.sedeId ? sede ? etiquetaSede(sede) : "Sede no disponible" : "Todos los ámbitos"}</td>
            <td>{u.activo ? "Activo" : "Inactivo"}</td>
            <td><AccionesRegistro id={u.correo} nombre={u.correo} verHref={`/mantenedores/usuarios?ver=${encodeURIComponent(u.correo)}`} editarHref={sistema||!perfilReservado(u.rol)?`/mantenedores/usuarios?editar=${encodeURIComponent(u.correo)}`:undefined}/>{!sistema&&perfilReservado(u.rol)&&<small>Edición reservada al administrador del sistema</small>}</td>
          </tr>; })}</tbody>
        </table>
      </div>
    </section>
    {edicionInvalida ? <p role="alert" className="error-catalogos">
      No se encontró la cuenta. Selecciona Editar desde el listado.
    </p> : reservado ? <p role="alert">Solo el Administrador del sistema puede editar esta cuenta.</p>
      : guardado==="1" ? null : <VentanaEdicion activa={Boolean(seleccionado)} titulo="Editar acceso de usuario" cerrarHref="/mantenedores/usuarios"><section id="formulario-usuario" className="panel-catalogos" aria-labelledby="usuario-titulo">
      <h2 id="usuario-titulo">{seleccionado ? "Editar acceso" : "Registrar usuario"}</h2>
      <p>La cuenta debe pertenecer a slepb.gob.cl. No se crean cuentas ni contraseñas de Google desde este formulario.</p>
      {seleccionado?.correo === actor.email && <p>Otro administrador deberá retirar tu permiso o desactivar tu cuenta.</p>}
      <FormularioUsuario key={seleccionado?.correo ?? "nuevo"} usuario={seleccionado} sedes={sedes} sistema={sistema} />
    </section></VentanaEdicion>}
    <section aria-labelledby="perfiles-titulo" className="perfiles-ayuda">
      <h2 id="perfiles-titulo">Perfiles disponibles</h2>
      <dl><dt>Administrador del sistema</dt><dd>Administra todos los accesos, incluidos los perfiles administrativos.</dd>
        <dt>Administrador de gestión</dt><dd>Gestiona catálogos y usuarios operativos de todos los ámbitos.</dd>
        <dt>Encargado de EE/JI</dt><dd>Registra y corrige equipos recibidos y dependencias de su única sede.</dd>
        <dt>Consulta general / Auditor</dt><dd>Consulta todos los ámbitos, sin modificar registros.</dd>
        <dt>Consulta de establecimiento</dt><dd>Consulta únicamente su sede, sin modificar registros.</dd></dl>
      <p>Debe permanecer al menos un administrador del sistema activo. Los cambios de acceso y sede quedan registrados.</p>
      <p>Las entregas con actas, préstamos, incidentes y solicitudes se habilitarán en sus próximas etapas.</p>
    </section>
  </main>;
}
