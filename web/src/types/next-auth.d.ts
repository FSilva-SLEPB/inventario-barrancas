import "next-auth";
import type { RolAcceso } from "@/lib/politica-acceso";

declare module "next-auth" {
  interface Session {
    user?: { email: string; rol: RolAcceso; permisos?:readonly string[];alcance?:'global'|'sede'|'propios';perfilId?:string|null;perfilNombre?:string;clasePerfil?:string;revisionAcceso?:string;funcionarioId?:string|null; sedeId: string | null; sedeNombre: string | null; sedeRbd: string | null };
    accesoDenegado?: boolean;
  }
  interface Profile {
    email_verified?: boolean;
    hd?: string;
  }
}
