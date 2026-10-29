import { rolValido, type RolAcceso } from "@/lib/politica-acceso";

export const PERFILES: Record<RolAcceso, string> = {
  administrador: "Administrador", consulta: "Consulta",
};

export type UsuarioAcceso = {
  correo: string; nombre: string; rol: RolAcceso; activo: boolean; version: number;
};
export type ValoresUsuario = {
  correo: string; nombre: string; rol: string; activo: string; version: string;
};
export type EstadoUsuario = {
  resultado: "inicial" | "error" | "guardado";
  mensaje: string; valores: ValoresUsuario; errores: Partial<Record<keyof ValoresUsuario, string>>;
  revision: string;
};
export function valoresUsuario(usuario?: UsuarioAcceso): ValoresUsuario {
  return { correo: usuario?.correo ?? "", nombre: usuario?.nombre ?? "",
    rol: usuario?.rol ?? "consulta", activo: String(usuario?.activo ?? true),
    version: String(usuario?.version ?? 0) };
}

export function validarUsuario(formulario: FormData) {
  const valores = valoresUsuario();
  const errores: EstadoUsuario["errores"] = {};
  for (const campo of Object.keys(valores) as (keyof ValoresUsuario)[]) {
    const entradas = formulario.getAll(campo);
    if (entradas.length !== 1 || typeof entradas[0] !== "string") {
      errores[campo] = "El campo no es válido. Recarga la página.";
    } else valores[campo] = entradas[0];
  }
  valores.correo = valores.correo.trim().toLowerCase();
  valores.nombre = valores.nombre.normalize("NFC").trim().replace(/ +/g, " ");
  if (!/^[a-z0-9._%+-]+@slepb\.gob\.cl$/.test(valores.correo) || valores.correo.length > 254) {
    errores.correo = "Escribe un correo institucional de slepb.gob.cl.";
  }
  if (valores.nombre.length > 120 || /\p{Cc}/u.test(valores.nombre)) {
    errores.nombre = "Usa un nombre de hasta 120 caracteres, sin controles ni saltos de línea.";
  }
  if (!rolValido(valores.rol)) errores.rol = "Selecciona un perfil permitido.";
  if (!["true", "false"].includes(valores.activo)) errores.activo = "Selecciona un estado válido.";
  const version = Number(valores.version);
  if (!/^\d{1,10}$/.test(valores.version) || !Number.isSafeInteger(version) || version > 2147483646) {
    errores.version = "La versión no es válida. Recarga la página.";
  }
  const datos: UsuarioAcceso | null = Object.keys(errores).length || !rolValido(valores.rol)
    ? null : { correo: valores.correo, nombre: valores.nombre, rol: valores.rol,
      activo: valores.activo === "true", version };
  return { valores, errores, datos };
}
