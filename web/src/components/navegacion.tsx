"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const enlaces = [
  { href: "/", texto: "Inicio" },
  { href: "/inventario", texto: "Inventario" },
  { href: "/solicitudes", texto: "Solicitudes" },
];

export default function Navegacion() {
  const rutaActual = usePathname();

  return (
    <nav className="navegacion-principal" aria-label="Principal">
      <ul>
        {enlaces.map((enlace) => (
          <li key={enlace.href}>
            <Link
              href={enlace.href}
              aria-current={rutaActual === enlace.href ? "page" : undefined}
            >
              {enlace.texto}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
