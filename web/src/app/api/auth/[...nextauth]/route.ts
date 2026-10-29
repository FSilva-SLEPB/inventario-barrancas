import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { opcionesAuth } from "@/lib/opciones-auth";
import { autenticacionConfigurada } from "@/lib/configuracion-auth";

export const runtime = "nodejs";
const handler = NextAuth(opcionesAuth);

async function autenticacion(request: NextRequest, context: { params: Promise<{ nextauth: string[] }> }) {
  if (!autenticacionConfigurada()) {
    return Response.json({ error: "El acceso institucional aún no está configurado." }, { status: 503 });
  }
  return handler(request, context);
}

export { autenticacion as GET, autenticacion as POST };
