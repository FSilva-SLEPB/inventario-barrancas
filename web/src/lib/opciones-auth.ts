import "server-only";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { obtenerBaseDatos } from "@/lib/db";
import { correoInstitucional, rolValido, type RolAcceso } from "@/lib/politica-acceso";
import { autenticacionConfigurada } from "@/lib/configuracion-auth";

async function consultarRol(correo: string): Promise<RolAcceso | null> {
  const { rows } = await obtenerBaseDatos().query<{ rol: unknown }>(
    "SELECT rol FROM public.usuarios_acceso WHERE correo = $1 AND activo = true",
    [correo],
  );
  return rolValido(rows[0]?.rol) ? rows[0].rol : null;
}

export const opcionesAuth: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  providers: [GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    authorization: { params: {
      scope: "openid email profile", hd: "slepb.gob.cl", prompt: "select_account",
    } },
    checks: ["pkce", "state", "nonce"],
  })],
  pages: { signIn: "/ingresar", error: "/ingresar" },
  callbacks: {
    async signIn({ account, profile }) {
      if (!autenticacionConfigurada() || account?.provider !== "google" || !profile) return false;
      const correo = correoInstitucional(profile);
      if (!correo) return false;
      try {
        return (await consultarRol(correo)) !== null;
      } catch {
        console.error("No se pudo comprobar la autorización de acceso.");
        return false;
      }
    },
    async jwt({ token, account, profile }) {
      if (account) {
        const correo = account.provider === "google" && profile ? correoInstitucional(profile) : null;
        // Conservar solo identidad validada; no guardar tokens OAuth de Google.
        return correo ? { sub: String(profile?.sub), correoInstitucional: correo } : {};
      }
      // No aceptar roles ni identidades enviados mediante session.update().
      return token;
    },
    async session({ session, token }) {
      const correo = token.correoInstitucional;
      session.user = undefined;
      if (typeof correo !== "string" || !token.sub) return session;
      try {
        // Revisar el permiso actual en cada petición; una baja no espera 8 horas.
        const rol = await consultarRol(correo);
        if (rol) session.user = { email: correo, rol };
      } catch {
        console.error("No se pudo comprobar el permiso de la sesión.");
      }
      return session;
    },
    async redirect({ baseUrl }) {
      return new URL("/", baseUrl).href;
    },
  },
  logger: {
    error() { console.error("No se pudo completar la autenticación institucional."); },
    warn() { console.warn("Revisar la configuración de autenticación institucional."); },
    debug() {},
  },
  debug: false,
};
