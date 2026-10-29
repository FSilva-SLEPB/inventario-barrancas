"use client";

import { signIn, signOut } from "next-auth/react";

export function BotonIngresar({ otraCuenta = false }: { otraCuenta?: boolean }) {
  return <button className="btn btn-primary" onClick={() => signIn("google", { callbackUrl: "/" })}>
    {otraCuenta ? "Usar otra cuenta" : "Ingresar con Google Workspace"}
  </button>;
}

export function BotonSalir({ texto = "Cerrar sesión" }: { texto?: string }) {
  return <button className="btn btn-outline-primary" onClick={() => signOut({ callbackUrl: "/" })}>
    {texto}
  </button>;
}
