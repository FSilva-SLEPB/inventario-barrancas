export const DOMINIO_INSTITUCIONAL = "slepb.gob.cl";
export const PERFILES = {
  administrador: "Administrador del sistema",
  administrador_gestion: "Administrador de gestión",
  encargado: "Encargado de EE/JI",
  consulta: "Consulta general / Auditor",
  consulta_sede: "Consulta de establecimiento",
} as const;
export type RolAcceso = keyof typeof PERFILES;

export function requiereSede(rol: unknown): boolean {
  return rol === "encargado" || rol === "consulta_sede";
}

export function puedeGestionarDependencias(rol: unknown): boolean {
  return puedeAdministrar(rol) || rol === "encargado";
}

export function perfilReservado(rol: unknown): boolean {
  return rol === "administrador" || rol === "administrador_gestion";
}

export function correoInstitucional(perfil: {
  email?: unknown; email_verified?: unknown; hd?: unknown; sub?: unknown;
}): string | null {
  // El sufijo del correo y el parámetro visual hd por sí solos no autentican.
  if (perfil.email_verified !== true || perfil.hd !== DOMINIO_INSTITUCIONAL
      || typeof perfil.sub !== "string" || !perfil.sub
      || typeof perfil.email !== "string") return null;
  const correo = perfil.email.toLowerCase();
  return /^[a-z0-9._%+-]+@slepb\.gob\.cl$/.test(correo) ? correo : null;
}

export function rolValido(rol: unknown): rol is RolAcceso {
  return typeof rol === "string" && Object.hasOwn(PERFILES, rol);
}

export function puedeAdministrar(rol: unknown): boolean {
  return rol === "administrador" || rol === "administrador_gestion";
}
