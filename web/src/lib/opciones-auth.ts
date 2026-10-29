import "server-only";
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

import { obtenerBaseDatos } from "@/lib/db";
import { correoInstitucional, rolValido, requiereSede } from "@/lib/politica-acceso";
import { autenticacionConfigurada } from "@/lib/configuracion-auth";

async function consultarAcceso(correo: string) {
  const { rows } = await obtenerBaseDatos().query<{
    rol: unknown; sedeId: string | null; sedeNombre: string | null;
  }>(
    `SELECT u.rol, u.sede_id AS "sedeId", s.nombre AS "sedeNombre"
     FROM public.usuarios_acceso u LEFT JOIN public.sedes s ON s.id = u.sede_id
     WHERE u.correo = $1 AND u.activo
       AND (u.rol NOT IN ('encargado', 'consulta_sede')
            OR (s.activo AND s.tipo IN ('establecimiento', 'jardin_infantil')))`,
    [correo],
  );
  const fila = rows[0];
  if (!rolValido(fila?.rol) || (requiereSede(fila.rol) && !fila.sedeId)) return null;
  return { rol: fila.rol, sedeId: fila.sedeId ?? null, sedeNombre: fila.sedeNombre ?? null };
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
        return (await consultarAcceso(correo)) !== null;
      } catch {
        console.error("No se pudo comprobar la autorización de acceso.");
        return "/ingresar?error=ServicioNoDisponible";
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
      session.accesoDenegado = false;
      if (typeof correo !== "string" || !token.sub) return session;
      try {
        // Revisar el permiso actual en cada petición; una baja no espera 8 horas.
        const acceso = await consultarAcceso(correo);
        if (acceso) session.user = { email: correo, ...acceso };
        else session.accesoDenegado = true;
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
