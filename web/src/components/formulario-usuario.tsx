"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { guardarUsuario } from "@/app/mantenedores/usuarios/acciones";
import { PERFILES, valoresUsuario, type UsuarioAcceso, type EstadoUsuario } from "@/lib/validacion-usuarios";
import { perfilReservado, requiereSede } from "@/lib/politica-acceso";
import type { Sede } from "@/lib/validacion-sedes";
import { etiquetaSede } from "@/lib/etiqueta-sede";

export default function FormularioUsuario({ usuario, sedes, sistema }: {
  usuario?: UsuarioAcceso; sedes: Sede[]; sistema: boolean;
}) {
  const inicial: EstadoUsuario = { resultado: "inicial", mensaje: "", valores: valoresUsuario(usuario),
    errores: {}, revision: "inicial" };
  const [estado, accion, pendiente] = useActionState(guardarUsuario, inicial);
  return <form action={accion} className="formulario-catalogos" aria-busy={pendiente}>
    <input type="hidden" name="version" value={estado.valores.version} />
    <CamposUsuario key={estado.revision} estado={estado} usuario={usuario} pendiente={pendiente}
      sedes={sedes} sistema={sistema} />
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

function CamposUsuario({ estado, usuario, pendiente, sedes, sistema }: {
  estado: EstadoUsuario; usuario?: UsuarioAcceso; pendiente: boolean; sedes: Sede[]; sistema: boolean;
}) {
  const [rol, setRol] = useState(estado.valores.rol);
  const local = requiereSede(rol);
  return <div>
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
        <select id="usuario-rol" name="rol" value={rol} onChange={e => setRol(e.target.value)} disabled={pendiente}
          aria-invalid={Boolean(estado.errores.rol)} aria-describedby="usuario-perfil-ayuda">
          {Object.entries(PERFILES).filter(([valor]) => sistema || !perfilReservado(valor))
            .map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
        </select>
        <p id="usuario-perfil-ayuda" className="ayuda-catalogos">
          {estado.errores.rol ?? "Los perfiles locales se limitan a una sede. Solo el administrador del sistema concede perfiles administrativos."}
        </p>
      </div>
      {local ? <div className="campo-catalogos">
        <label htmlFor="usuario-sede">Establecimiento o jardín (obligatorio)</label>
        <select id="usuario-sede" name="sedeId" required disabled={pendiente}
          defaultValue={estado.valores.sedeId} aria-invalid={Boolean(estado.errores.sedeId)}
          aria-describedby="usuario-sede-ayuda">
          <option value="">Selecciona una sede</option>
          {sedes.filter(s => (s.activo || s.id === estado.valores.sedeId) && s.tipo !== "nivel_central")
            .map(s => <option key={s.id} value={s.id} disabled={!s.activo}>
              {etiquetaSede(s)}{!s.activo ? " (inactiva)" : ""}
            </option>)}
        </select>
        <p id="usuario-sede-ayuda" className="ayuda-catalogos">
          {estado.errores.sedeId ?? "La cuenta podrá acceder únicamente a esta sede. Se requiere una sede activa."}
        </p>
      </div> : <><input type="hidden" name="sedeId" value="" />
        {estado.errores.sedeId && <p className="error-catalogos">{estado.errores.sedeId}</p>}</>}
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
    </div>;
}
