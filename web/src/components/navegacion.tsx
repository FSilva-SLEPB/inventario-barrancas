"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const trazos = {
  inicio: "M3 10 12 3l9 7M5 9v12h14V9M10 21v-7h4v7",
  inventario: "M3 5h18v15H3zM3 10h18M9 5v5M15 5v5M9 15h6",
  solicitudes: "M8 5H5v16h14V5h-3M8 3h8v4H8zM8 12h8M8 16h5",
  mantenedores: "M3 6h6m4 0h8M3 12h10m4 0h4M3 18h2m4 0h12M9 4v4m4 2v4M5 16v4",
};

const enlaces = [
  { href: "/", texto: "Inicio", icono: "inicio" },
  { href: "/inventario", texto: "Inventario", icono: "inventario" },
  { href: "/solicitudes", texto: "Solicitudes", icono: "solicitudes" },
] as const;

function Icono({ tipo }: { tipo: keyof typeof trazos }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={trazos[tipo]} />
    </svg>
  );
}

export default function Navegacion({ administrador = false }: { administrador?: boolean }) {
  const rutaActual = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const esMantenedores = rutaActual === "/mantenedores"
    || rutaActual.startsWith("/mantenedores/");
  const cerrarMenu = () => setMenuAbierto(false);

  return (
    <nav className="navegacion-principal" aria-label="Principal">
      <div className="cabecera-menu">
        <div>
          <p className="titulo-menu">Menú del sistema</p>
          <p className="subtitulo-menu">Navegación institucional</p>
        </div>
        <button
          type="button"
          className="btn btn-outline-primary menu-alternar"
          aria-expanded={menuAbierto}
          aria-controls="contenido-menu"
          onClick={() => setMenuAbierto(!menuAbierto)}
        >
          {menuAbierto ? "Cerrar" : "Menú"}
        </button>
      </div>

      <div
        id="contenido-menu"
        className={"menu-contenido" + (menuAbierto ? " abierto" : "")}
      >
        <p className="seccion-menu">Gestión</p>
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
                  onClick={cerrarMenu}
                >
                  <span className="icono-menu">
                    <Icono tipo={enlace.icono} />
                  </span>
                  <span>{enlace.texto}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="seccion-menu">Administración</p>
        <details className="grupo-mantenedores" open={esMantenedores}>
          <summary className={esMantenedores ? "grupo-activo" : undefined}>
            <span className="icono-menu">
              <Icono tipo="mantenedores" />
            </span>
            <span>Mantenedores</span>
            <span className="indicador-menu" aria-hidden="true" />
          </summary>
          <ul className="submenu">
            {administrador && <li><Link href="/mantenedores/usuarios"
              aria-current={rutaActual === "/mantenedores/usuarios" ? "page" : undefined}
              onClick={cerrarMenu}>Usuarios y perfiles</Link></li>}
            <li>
              <Link
                href="/mantenedores"
                aria-current={rutaActual === "/mantenedores" ? "page" : undefined}
                onClick={cerrarMenu}
              >
                Panel de mantenedores
              </Link>
            </li>
            <li>
              <Link
                href="/mantenedores/categorias"
                aria-current={rutaActual === "/mantenedores/categorias" ? "page" : undefined}
                onClick={cerrarMenu}
              >
                Categorías de bienes
              </Link>
            </li>
            <li>
              <Link
                href="/mantenedores/sedes"
                aria-current={rutaActual === "/mantenedores/sedes" ? "page" : undefined}
                onClick={cerrarMenu}
              >
                Sedes
              </Link>
            </li>
            <li>
              <Link
                href="/mantenedores/dependencias"
                aria-current={rutaActual === "/mantenedores/dependencias" ? "page" : undefined}
                onClick={cerrarMenu}
              >
                Dependencias
              </Link>
            </li>
          </ul>
        </details>

        <p className="pie-menu">SLEP Barrancas · UTIC</p>
      </div>
    </nav>
  );
}
