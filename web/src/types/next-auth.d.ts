import "next-auth";
import type { RolAcceso } from "@/lib/politica-acceso";

declare module "next-auth" {
  interface Session {
    user?: { email: string; rol: RolAcceso; sedeId: string | null; sedeNombre: string | null; sedeRbd: string | null };
    accesoDenegado?: boolean;
  }
  interface Profile {
    email_verified?: boolean;
    hd?: string;
  }
}
