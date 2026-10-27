"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const enlaces = [
  { href: "/", texto: "Inicio" },
  { href: "/inventario", texto: "Inventario" },
  { href: "/mantenedores", texto: "Mantenedores" },
  { href: "/solicitudes", texto: "Solicitudes" },
];

export default function Navegacion() {
  const rutaActual = usePathname();

  return (
    <nav className="navegacion-principal" aria-label="Principal">
      <ul>
        {enlaces.map((enlace) => {
          const esPagina = rutaActual === enlace.href;
          const esSeccion = enlace.href !== "/"
            && rutaActual.startsWith(enlace.href + "/");

          return (
            <li key={enlace.href}>
              <Link
                href={enlace.href}
                aria-current={esPagina ? "page" : esSeccion ? "location" : undefined}
              >
                {enlace.texto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
