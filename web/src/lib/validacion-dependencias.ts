export const LIMITE_NOMBRE_DEPENDENCIA = 200;

export type ValoresDependencia = {
  id: string;
  sedeId: string;
  nombre: string;
  activo: string;
};

export type ErroresDependencia = Partial<Record<keyof ValoresDependencia, string>>;

export type DatosDependencia = {
  id: string | null;
  sedeId: string;
  nombre: string;
  activo: boolean;
};

export type Dependencia = Omit<DatosDependencia, "id"> & { id: string };

export type EstadoDependencia = {
  resultado: "inicial" | "error" | "guardado";
  mensaje: string;
  revision: string;
  valores: ValoresDependencia;
  errores: ErroresDependencia;
};

export function valoresInicialesDependencia(dependencia?: Dependencia): ValoresDependencia {
  return {
    id: dependencia?.id ?? "",
    sedeId: dependencia?.sedeId ?? "",
    nombre: dependencia?.nombre ?? "",
    activo: dependencia?.activo === false ? "false" : "true",
  };
}

export function esIdDependencia(valor: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);
}

export function validarDependencia(formulario: FormData): {
  valores: ValoresDependencia;
  errores: ErroresDependencia;
  datos: DatosDependencia | null;
} {
  const errores: ErroresDependencia = {};

  function leer(campo: keyof ValoresDependencia): string {
    const entradas = formulario.getAll(campo);
    if (entradas.length > 1 || (entradas.length === 1 && typeof entradas[0] !== "string")) {
      errores[campo] = "Revisa el valor de este campo.";
      return "";
    }
    const valor = entradas[0];
    return typeof valor === "string" ? valor.normalize("NFC").trim() : "";
  }

  const valores: ValoresDependencia = {
    id: leer("id").toLowerCase(),
    sedeId: leer("sedeId").toLowerCase(),
    nombre: leer("nombre").replace(/ +/g, " "),
    activo: leer("activo"),
  };

  if (valores.id && !esIdDependencia(valores.id)) {
    errores.id = "La dependencia seleccionada no es válida. Vuelve al listado.";
  }
  if (!esIdDependencia(valores.sedeId)) {
    errores.sedeId = "Selecciona una sede del listado.";
  }
  if (!valores.nombre) {
    errores.nombre = "Escribe el nombre de la dependencia.";
  } else if (valores.nombre.length > LIMITE_NOMBRE_DEPENDENCIA) {
    errores.nombre = `Usa como máximo ${LIMITE_NOMBRE_DEPENDENCIA} caracteres.`;
  } else if (Array.from(valores.nombre).some((caracter) => {
    const codigo = caracter.charCodeAt(0);
    return codigo < 32 || (codigo >= 127 && codigo <= 159);
  })) {
    errores.nombre = "Escribe el nombre en una sola línea.";
  }
  if (valores.activo !== "true" && valores.activo !== "false") {
    errores.activo = "Selecciona el estado de la dependencia.";
  }

  if (Object.keys(errores).length) {
    return { valores, errores, datos: null };
  }

  return {
    valores,
    errores,
    datos: {
      id: valores.id || null,
      sedeId: valores.sedeId,
      nombre: valores.nombre,
      activo: valores.activo === "true",
    },
  };
}
