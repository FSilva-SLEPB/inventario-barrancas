export const DOMINIO_INSTITUCIONAL = "slepb.gob.cl";
export type RolAcceso = "administrador" | "consulta";

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
  return rol === "administrador" || rol === "consulta";
}

export function puedeAdministrar(rol: unknown): boolean {
  return rol === "administrador";
}
