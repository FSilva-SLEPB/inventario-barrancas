"use client";
import {useResultadoGuardado} from '@/components/avisos-guardado';

import Link from "next/link";
import { useActionState } from "react";

import { guardarDependencia } from "@/app/mantenedores/dependencias/acciones";
import {
  LIMITE_NOMBRE_DEPENDENCIA,
  valoresInicialesDependencia,
  type Dependencia,
  type ErroresDependencia,
  type EstadoDependencia,
  type ValoresDependencia,
} from "@/lib/validacion-dependencias";
import { TIPOS_SEDE, type Sede } from "@/lib/validacion-sedes";
import { etiquetaSede } from "@/lib/etiqueta-sede";

function CamposDependencia({ valores, errores, pendiente, sedes }: {
  valores: ValoresDependencia;
  errores: ErroresDependencia;
  pendiente: boolean;
  sedes: Sede[];
}) {
  return (
    <fieldset className="border-0 p-0 m-0" disabled={pendiente}>
      <legend className="visually-hidden">Datos de la dependencia</legend>
      <input type="hidden" name="id" value={valores.id} />

      <div className="campo-catalogos">
        <label htmlFor="dependencia-sede">Sede</label>
        <select
          id="dependencia-sede" name="sedeId" required defaultValue={valores.sedeId}
          aria-invalid={Boolean(errores.sedeId)}
          aria-describedby={errores.sedeId ? "dependencia-sede-error" : undefined}
        >
          <option value="" disabled>Selecciona una sede</option>
          {sedes.map((sede) => (
            <option key={sede.id} value={sede.id}>
              {etiquetaSede(sede)} — {TIPOS_SEDE[sede.tipo]}
              {sede.activo ? "" : " (inactiva)"}
            </option>
          ))}
        </select>
        {errores.sedeId && (
          <p id="dependencia-sede-error" className="error-catalogos">{errores.sedeId}</p>
        )}
      </div>

      <div className="campo-catalogos">
        <label htmlFor="dependencia-nombre">Nombre de la dependencia</label>
        <input
          id="dependencia-nombre" name="nombre" type="text" required
          defaultValue={valores.nombre} maxLength={LIMITE_NOMBRE_DEPENDENCIA}
          aria-invalid={Boolean(errores.nombre)}
          aria-describedby={[
            "dependencia-nombre-ayuda", errores.nombre ? "dependencia-nombre-error" : "",
          ].filter(Boolean).join(" ")}
        />
        <p id="dependencia-nombre-ayuda" className="ayuda-catalogos">
          Por ejemplo: Dirección, Secretaría, UTP o Sala de Enlaces.
          El nombre puede repetirse en sedes distintas.
        </p>
        {errores.nombre && (
          <p id="dependencia-nombre-error" className="error-catalogos">{errores.nombre}</p>
        )}
      </div>

      <div className="campo-catalogos">
        <label htmlFor="dependencia-activo">Estado de la dependencia</label>
        <select
          id="dependencia-activo" name="activo" defaultValue={valores.activo}
          required aria-invalid={Boolean(errores.activo)}
          aria-describedby={errores.activo ? "dependencia-activo-error" : undefined}
        >
          <option value="true">Activa</option>
          <option value="false">Inactiva</option>
        </select>
        {errores.activo && (
          <p id="dependencia-activo-error" className="error-catalogos">{errores.activo}</p>
        )}
      </div>
    </fieldset>
  );
}

export default function FormularioDependencia({ dependencia, sedes }: {
  dependencia?: Dependencia;
  sedes: Sede[];
}) {
  const inicial: EstadoDependencia = {
    resultado: "inicial", mensaje: "", revision: "inicial",
    valores: valoresInicialesDependencia(dependencia), errores: {},
  };
  const [estado, accion, pendiente] = useActionState(guardarDependencia, inicial);
 useResultadoGuardado(estado);

  return (
    <form action={accion} className="formulario-catalogos" autoComplete="off" aria-busy={pendiente}>
      {estado.mensaje && (
        <p
          role={estado.resultado === "error" ? "alert" : "status"}
          className={estado.resultado === "error" ? "error-catalogos" : undefined}
        >
          {estado.mensaje}
        </p>
      )}
      {/* Recupera lo enviado después del reinicio automático del formulario. */}
      <CamposDependencia
        key={estado.revision} valores={estado.valores} errores={estado.errores}
        pendiente={pendiente} sedes={sedes}
      />
      <div className="acciones-catalogos">
        <button type="submit" className="boton-catalogos" disabled={pendiente}>
          {pendiente ? "Guardando…" : dependencia ? "Guardar cambios" : "Crear dependencia"}
        </button>
        {dependencia && <Link href="/mantenedores/dependencias">Finalizar edición</Link>}
      </div>
    </form>
  );
}
