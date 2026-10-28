export const TIPOS_SEDE = {
  nivel_central: "Nivel Central",
  establecimiento: "Establecimiento",
  jardin_infantil: "Jardín infantil",
} as const;

export type TipoSede = keyof typeof TIPOS_SEDE;

export const LIMITES_SEDE = {
  nombre: 200,
  rbd: 30,
  direccion: 250,
  comuna: 100,
  correoInstitucional: 254,
} as const;

export type ValoresSede = {
  id: string;
  tipo: string;
  nombre: string;
  rbd: string;
  direccion: string;
  comuna: string;
  correoInstitucional: string;
  activo: string;
};

export type ErroresSede = Partial<Record<keyof ValoresSede, string>>;

export type DatosSede = {
  id: string | null;
  tipo: TipoSede;
  nombre: string;
  rbd: string | null;
  direccion: string | null;
  comuna: string | null;
  correoInstitucional: string | null;
  activo: boolean;
};

export type Sede = Omit<DatosSede, "id"> & { id: string };

export type EstadoSede = {
  resultado: "inicial" | "error" | "guardado";
  mensaje: string;
  revision: string;
  valores: ValoresSede;
  errores: ErroresSede;
};

export function valoresInicialesSede(sede?: Sede): ValoresSede {
  return {
    id: sede?.id ?? "",
    tipo: sede?.tipo ?? "",
    nombre: sede?.nombre ?? "",
    rbd: sede?.rbd ?? "",
    direccion: sede?.direccion ?? "",
    comuna: sede?.comuna ?? "",
    correoInstitucional: sede?.correoInstitucional ?? "",
    activo: sede?.activo === false ? "false" : "true",
  };
}

export function esIdSede(valor: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);
}

function esTipoSede(valor: string): valor is TipoSede {
  return Object.hasOwn(TIPOS_SEDE, valor);
}

function tieneControles(valor: string): boolean {
  return Array.from(valor).some((caracter) => {
    const codigo = caracter.charCodeAt(0);
    return codigo < 32 || (codigo >= 127 && codigo <= 159);
  });
}

export function validarSede(formulario: FormData): {
  valores: ValoresSede;
  errores: ErroresSede;
  datos: DatosSede | null;
} {
  const errores: ErroresSede = {};

  function leer(campo: keyof ValoresSede): string {
    const entradas = formulario.getAll(campo);
    if (entradas.length > 1 || (entradas.length === 1 && typeof entradas[0] !== "string")) {
      errores[campo] = "Revisa el valor de este campo.";
      return "";
    }
    const valor = entradas[0];
    return typeof valor === "string" ? valor.normalize("NFC").trim() : "";
  }

  const valores: ValoresSede = {
    id: leer("id").toLowerCase(),
    tipo: leer("tipo"),
    nombre: leer("nombre").replace(/ +/g, " "),
    rbd: leer("rbd"),
    direccion: leer("direccion").replace(/ +/g, " "),
    comuna: leer("comuna").replace(/ +/g, " "),
    correoInstitucional: leer("correoInstitucional"),
    activo: leer("activo"),
  };

  if (valores.id && !esIdSede(valores.id)) {
    errores.id = "La sede seleccionada no es válida. Vuelve al listado.";
  }
  if (!esTipoSede(valores.tipo)) {
    errores.tipo = "Selecciona un tipo de sede.";
  }
  if (!valores.nombre) {
    errores.nombre = "Escribe el nombre de la sede.";
  }

  for (const campo of Object.keys(LIMITES_SEDE) as (keyof typeof LIMITES_SEDE)[]) {
    if (valores[campo].length > LIMITES_SEDE[campo]) {
      errores[campo] = `Usa como máximo ${LIMITES_SEDE[campo]} caracteres.`;
    } else if (tieneControles(valores[campo])) {
      errores[campo] = "Escribe el contenido en una sola línea.";
    }
  }

  if (valores.tipo === "nivel_central" && valores.rbd) {
    errores.rbd = "Nivel Central debe registrarse sin RBD.";
  }
  if (valores.correoInstitucional
      && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valores.correoInstitucional)) {
    errores.correoInstitucional = "Escribe un correo con formato nombre@dominio.cl.";
  }
  if (valores.activo !== "true" && valores.activo !== "false") {
    errores.activo = "Selecciona el estado de la sede.";
  }

  if (Object.keys(errores).length || !esTipoSede(valores.tipo)) {
    return { valores, errores, datos: null };
  }

  return {
    valores,
    errores,
    datos: {
      id: valores.id || null,
      tipo: valores.tipo,
      nombre: valores.nombre,
      rbd: valores.rbd || null,
      direccion: valores.direccion || null,
      comuna: valores.comuna || null,
      correoInstitucional: valores.correoInstitucional || null,
      activo: valores.activo === "true",
    },
  };
}
