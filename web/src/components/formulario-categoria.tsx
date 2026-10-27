"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  guardarCategoria,
  type EstadoCategoria,
} from "@/app/catalogos/acciones";
import type { CategoriaBien } from "@/lib/catalogos";

export default function FormularioCategoria({
  categoria,
}: {
  categoria?: CategoriaBien;
}) {
  const inicial: EstadoCategoria = {
    resultado: "inicial",
    mensaje: "",
    nombre: categoria?.nombre ?? "",
    activo: categoria?.activo === false ? "false" : "true",
  };
  const [estado, accion, pendiente] = useActionState(guardarCategoria, inicial);

  return (
    <form action={accion} className="formulario-catalogos" aria-busy={pendiente}>
      <input type="hidden" name="id" value={categoria?.id ?? ""} />

      <div className="campo-catalogos">
        <label htmlFor="categoria-nombre">Nombre de la categoría (obligatorio)</label>
        <input
          id="categoria-nombre"
          name="nombre"
          type="text"
          defaultValue={estado.nombre}
          maxLength={100}
          required
          readOnly={pendiente}
          aria-invalid={Boolean(estado.errorNombre)}
          aria-describedby={estado.errorNombre
            ? "categoria-ayuda categoria-mensaje"
            : "categoria-ayuda"}
        />
        <p id="categoria-ayuda" className="ayuda-catalogos">
          Usa un nombre breve, por ejemplo: Notebook o Monitor.
        </p>
      </div>

      <div className="campo-catalogos">
        <label htmlFor="categoria-activo">Estado</label>
        <select
          id="categoria-activo"
          name="activo"
          defaultValue={estado.activo}
          disabled={pendiente}
          aria-describedby="categoria-estado-ayuda"
        >
          <option value="true">Activa</option>
          <option value="false">Inactiva</option>
        </select>
        <p id="categoria-estado-ayuda" className="ayuda-catalogos">
          Las categorías inactivas se conservan para mantener el historial.
        </p>
      </div>

      <p
        id="categoria-mensaje"
        role={estado.resultado === "error" ? "alert" : "status"}
        className={estado.resultado === "error" ? "error-catalogos" : undefined}
        aria-atomic="true"
      >
        {pendiente ? "Guardando cambios…" : estado.mensaje}
      </p>

      <div className="acciones-catalogos">
        <button type="submit" className="boton-catalogos" disabled={pendiente}>
          {pendiente ? "Guardando…" : categoria ? "Guardar cambios" : "Crear categoría"}
        </button>
        {categoria && <Link href="/catalogos">Finalizar edición</Link>}
      </div>
    </form>
  );
}
