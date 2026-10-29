import "next-auth";
import type { RolAcceso } from "@/lib/politica-acceso";

declare module "next-auth" {
  interface Session {
    user?: { email: string; rol: RolAcceso };
  }
  interface Profile {
    email_verified?: boolean;
    hd?: string;
  }
}
