"use client";
import {useResultadoGuardado} from '@/components/avisos-guardado';

import Link from "next/link";
import { useActionState, useState } from "react";

import { guardarSede } from "@/app/mantenedores/sedes/acciones";
import {
  LIMITES_SEDE,
  TIPOS_SEDE,
  valoresInicialesSede,
  type ErroresSede,
  type EstadoSede,
  type Sede,
  type ValoresSede,
} from "@/lib/validacion-sedes";

const camposTexto = [
  { nombre: "nombre", etiqueta: "Nombre de la sede", tipo: "text", obligatorio: true },
  {
    nombre: "rbd", etiqueta: "RBD (opcional)", tipo: "text",
    ayuda: "Conserva los ceros iniciales y guiones. Déjalo vacío si no corresponde.",
  },
  { nombre: "direccion", etiqueta: "Dirección (opcional)", tipo: "text" },
  { nombre: "comuna", etiqueta: "Comuna (opcional)", tipo: "text" },
  {
    nombre: "correoInstitucional", etiqueta: "Correo institucional (opcional)", tipo: "email",
    ayuda: "Correo de contacto de la sede.",
  },
] as const;

function CamposSede({ valores, errores, pendiente }: {
  valores: ValoresSede;
  errores: ErroresSede;
  pendiente: boolean;
}) {
  const [tipo, setTipo] = useState(valores.tipo);
  const [rbd, setRbd] = useState(valores.rbd);

  return (
    <fieldset className="border-0 p-0 m-0" disabled={pendiente}>
      <legend className="visually-hidden">Datos de la sede</legend>
      <input type="hidden" name="id" value={valores.id} />

      <div className="campo-catalogos">
        <label htmlFor="sede-tipo">Tipo de sede</label>
        <select
          id="sede-tipo" name="tipo" required defaultValue={valores.tipo}
          onChange={(evento) => setTipo(evento.target.value)}
          aria-invalid={Boolean(errores.tipo)}
          aria-describedby={errores.tipo ? "sede-tipo-error" : undefined}
        >
          <option value="" disabled>Selecciona un tipo</option>
          {Object.entries(TIPOS_SEDE).map(([valor, texto]) => (
            <option key={valor} value={valor}>{texto}</option>
          ))}
        </select>
        {errores.tipo && <p id="sede-tipo-error" className="error-catalogos">{errores.tipo}</p>}
      </div>

      {camposTexto.map((campo) => {
        const id = `sede-${campo.nombre}`;
        const error = errores[campo.nombre];
        const sinRbd = campo.nombre === "rbd" && tipo === "nivel_central";
        const ayuda = sinRbd ? "Nivel Central se registra sin RBD."
          : "ayuda" in campo ? campo.ayuda : undefined;
        const descripcion = [ayuda ? `${id}-ayuda` : "", error ? `${id}-error` : ""]
          .filter(Boolean).join(" ") || undefined;

        return (
          <div className="campo-catalogos" key={campo.nombre}>
            <label htmlFor={id}>{campo.etiqueta}</label>
            <input
              id={id} name={campo.nombre} type={campo.tipo}
              defaultValue={campo.nombre === "rbd" ? undefined : valores[campo.nombre]}
              value={campo.nombre === "rbd" ? (sinRbd ? "" : rbd) : undefined}
              onChange={campo.nombre === "rbd" ? (evento) => setRbd(evento.target.value) : undefined}
              required={"obligatorio" in campo && campo.obligatorio}
              maxLength={LIMITES_SEDE[campo.nombre]}
              disabled={sinRbd}
              aria-invalid={Boolean(error)}
              aria-describedby={descripcion}
            />
            {ayuda && <p id={`${id}-ayuda`} className="ayuda-catalogos">{ayuda}</p>}
            {error && <p id={`${id}-error`} className="error-catalogos">{error}</p>}
          </div>
        );
      })}

      <div className="campo-catalogos">
        <label htmlFor="sede-activo">Estado de la sede</label>
        <select
          id="sede-activo" name="activo" defaultValue={valores.activo}
          required aria-invalid={Boolean(errores.activo)}
          aria-describedby={errores.activo ? "sede-activo-error" : undefined}
        >
          <option value="true">Activa</option>
          <option value="false">Inactiva</option>
        </select>
        {errores.activo && <p id="sede-activo-error" className="error-catalogos">{errores.activo}</p>}
      </div>
    </fieldset>
  );
}

export default function FormularioSede({ sede }: { sede?: Sede }) {
  const inicial: EstadoSede = {
    resultado: "inicial", mensaje: "", revision: "inicial",
    valores: valoresInicialesSede(sede), errores: {},
  };
  const [estado, accion, pendiente] = useActionState(guardarSede, inicial);
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
      {/* Conserva lo enviado cuando React reinicia el formulario después de una respuesta. */}
      <CamposSede
        key={estado.revision} valores={estado.valores}
        errores={estado.errores} pendiente={pendiente}
      />
      <div className="acciones-catalogos">
        <button type="submit" className="boton-catalogos" disabled={pendiente}>
          {pendiente ? "Guardando…" : sede ? "Guardar cambios" : "Crear sede"}
        </button>
        {sede && <Link href="/mantenedores/sedes">Finalizar edición</Link>}
      </div>
    </form>
  );
}
