"use client";

import Link from "next/link";
import { useActionState } from "react";
import { guardarUsuario } from "@/app/mantenedores/usuarios/acciones";
import { PERFILES, valoresUsuario, type UsuarioAcceso, type EstadoUsuario } from "@/lib/validacion-usuarios";

export default function FormularioUsuario({ usuario }: { usuario?: UsuarioAcceso }) {
  const inicial: EstadoUsuario = { resultado: "inicial", mensaje: "", valores: valoresUsuario(usuario),
    errores: {}, revision: "inicial" };
  const [estado, accion, pendiente] = useActionState(guardarUsuario, inicial);
  return <form action={accion} className="formulario-catalogos" aria-busy={pendiente}>
    <input type="hidden" name="version" value={estado.valores.version} />
    <div key={estado.revision}>
      <div className="campo-catalogos">
        <label htmlFor="usuario-correo">Correo institucional (obligatorio)</label>
        <input id="usuario-correo" type="email" name="correo" maxLength={254} required
          defaultValue={estado.valores.correo} readOnly={Boolean(usuario) || pendiente}
          aria-invalid={Boolean(estado.errores.correo)} aria-describedby="usuario-correo-ayuda" />
        <p id="usuario-correo-ayuda" className="ayuda-catalogos">
          {estado.errores.correo ?? (usuario ? "El correo identifica la cuenta y no se puede cambiar."
            : "La cuenta debe existir en Google Workspace. Registrarla aquí autoriza su acceso al inventario.")}
        </p>
      </div>
      <div className="campo-catalogos">
        <label htmlFor="usuario-nombre">Nombre para mostrar (opcional)</label>
        <input id="usuario-nombre" name="nombre" maxLength={120} defaultValue={estado.valores.nombre}
          readOnly={pendiente} aria-invalid={Boolean(estado.errores.nombre)}
          aria-describedby={estado.errores.nombre ? "usuario-nombre-error" : undefined} />
        {estado.errores.nombre && <p id="usuario-nombre-error" className="error-catalogos">{estado.errores.nombre}</p>}
      </div>
      <div className="campo-catalogos">
        <label htmlFor="usuario-rol">Perfil (obligatorio)</label>
        <select id="usuario-rol" name="rol" defaultValue={estado.valores.rol} disabled={pendiente}
          aria-invalid={Boolean(estado.errores.rol)} aria-describedby="usuario-perfil-ayuda">
          {Object.entries(PERFILES).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
        </select>
        <p id="usuario-perfil-ayuda" className="ayuda-catalogos">
          {estado.errores.rol ?? "Administrador gestiona catálogos y accesos. Consulta solo permite ver catálogos."}
        </p>
      </div>
      <div className="campo-catalogos">
        <label htmlFor="usuario-activo">Estado (obligatorio)</label>
        <select id="usuario-activo" name="activo" defaultValue={estado.valores.activo} disabled={pendiente}
          aria-invalid={Boolean(estado.errores.activo)} aria-describedby="usuario-estado-ayuda">
          <option value="true">Activo</option><option value="false">Inactivo</option>
        </select>
        <p id="usuario-estado-ayuda" className="ayuda-catalogos">
          {estado.errores.activo ?? "Desactivar revoca el acceso desde la próxima petición y conserva el registro."}
        </p>
      </div>
    </div>
    <p role={estado.resultado === "error" ? "alert" : "status"} aria-atomic="true"
      className={estado.resultado === "error" ? "error-catalogos" : undefined}>
      {pendiente ? "Guardando acceso…" : estado.mensaje}
    </p>
    <div className="acciones-catalogos">
      <button className="boton-catalogos" type="submit" disabled={pendiente}>
        {pendiente ? "Guardando…" : usuario ? "Guardar cambios" : "Registrar usuario"}
      </button>
      {usuario && <Link href="/mantenedores/usuarios">Finalizar edición</Link>}
    </div>
  </form>;
}
