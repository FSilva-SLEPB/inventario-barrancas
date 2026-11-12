import {esAutorizacionRbac,tienePermiso} from '@/lib/rbac';
export const DOMINIO_INSTITUCIONAL = "slepb.gob.cl";
export const PERFILES = {
  administrador: "Administrador del sistema",
  administrador_gestion: "Administrador de gestión",
  encargado: "Encargado de EE/JI",
  gestor_insumos: "Gestor de insumos",
  consulta: "Consulta general / Auditor",
  consulta_sede: "Consulta de establecimiento",
} as const;
export type RolAcceso = keyof typeof PERFILES;

export function requiereSede(rol: unknown): boolean {
  if(rol&&typeof rol==='object'&&!esAutorizacionRbac(rol))rol=(rol as {rol?:unknown}).rol;
  return esAutorizacionRbac(rol)?rol.alcance==='sede':rol === "encargado" || rol === "consulta_sede";
}

export function puedeGestionarDependencias(rol: unknown): boolean {
  if(rol&&typeof rol==='object'&&!esAutorizacionRbac(rol))rol=(rol as {rol?:unknown}).rol;
  return esAutorizacionRbac(rol)?tienePermiso(rol,'dependencias','editar')||tienePermiso(rol,'dependencias','registrar'):puedeAdministrar(rol) || rol === "encargado";
}

export function perfilReservado(rol: unknown): boolean {
  if(rol&&typeof rol==='object'&&!esAutorizacionRbac(rol))rol=(rol as {rol?:unknown}).rol;
  return esAutorizacionRbac(rol)?['sistema','utic'].includes(rol.clasePerfil):rol === "administrador" || rol === "administrador_gestion";
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
  if(rol&&typeof rol==='object'&&!esAutorizacionRbac(rol))rol=(rol as {rol?:unknown}).rol;
  return esAutorizacionRbac(rol)?['sistema','utic'].includes(rol.clasePerfil):rol === "administrador" || rol === "administrador_gestion";
}

/** Facultad exclusiva del módulo Insumos; no concede administración del inventario. */
export function puedeGestionarInsumos(rol:unknown):boolean{if(rol&&typeof rol==='object'&&!esAutorizacionRbac(rol))rol=(rol as {rol?:unknown}).rol;return esAutorizacionRbac(rol)?tienePermiso(rol,'seguimiento_insumos','aprobar')||tienePermiso(rol,'seguimiento_insumos','confirmar'):puedeAdministrar(rol)||rol==='gestor_insumos';}
export function puedeSolicitarInsumos(rol:unknown):boolean{if(rol&&typeof rol==='object'&&!esAutorizacionRbac(rol))rol=(rol as {rol?:unknown}).rol;return esAutorizacionRbac(rol)?tienePermiso(rol,'solicitudes_insumos','registrar'):puedeGestionarDependencias(rol)||rol==='gestor_insumos';}
