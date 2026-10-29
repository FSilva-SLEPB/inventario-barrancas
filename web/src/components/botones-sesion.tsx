"use client";

import { signIn, signOut } from "next-auth/react";

export function BotonIngresar() {
  return <button className="btn btn-primary" onClick={() => signIn("google", { callbackUrl: "/" })}>
    Ingresar con Google Workspace
  </button>;
}

export function BotonSalir() {
  return <button className="btn btn-outline-primary" onClick={() => signOut({ callbackUrl: "/" })}>
    Cerrar sesión
  </button>;
}
