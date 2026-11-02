import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";

import logoBarrancas from "../../public/identidad/barrancas-blanco.png";
import Accesibilidad from "@/components/accesibilidad";
import Navegacion from "@/components/navegacion";
import { BotonSalir } from "@/components/botones-sesion";
import { obtenerAcceso } from "@/lib/acceso";
import { PERFILES, puedeAdministrar, requiereSede } from "@/lib/politica-acceso";
import { etiquetaSede } from "@/lib/etiqueta-sede";

import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";
import "./interfaz.css";

const gobCl = localFont({
  src: [
    {
      path: "./fonts/gobCL_Regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/gobCL_Bold.otf",
      weight: "700",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-gobcl",
  fallback: ["Arial", "Helvetica", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Inventario 2.0 EE y TI | SLEP Barrancas",
  description:
    "Sistema de inventario y solicitudes de insumos para establecimientos educacionales y Nivel Central del SLEP Barrancas.",
  applicationName: "Inventario 2.0 EE y TI",
  robots: {
    index: false,
    follow: false,
  },
};

// La sesión y los permisos deben comprobarse en cada petición, también si la
// configuración OAuth se incorpora después de compilar la imagen.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const acceso = await obtenerAcceso();
  return (
    <html lang="es-CL" className={gobCl.variable}>
      <body className={gobCl.className}>
        <a className="saltar-contenido" href="#contenido-principal">
          Saltar al contenido
        </a>

        <header className="cabecera-institucional">
          <div className="interior-cabecera">
            <Link
              href="/"
              className="marca-institucional"
              aria-label="Ir al inicio de Inventario SLEP Barrancas"
            >
              <Image
                src={logoBarrancas}
                alt="SLEP Barrancas"
                className="logo-institucional"
                loading="eager"
                unoptimized
              />
            </Link>

            <div className="identidad-sistema">
              <p className="titulo-sistema">Inventario 2.0 EE y TI</p>
              <p className="subtitulo-sistema">
                Servicio Local de Educación Pública Barrancas
              </p>
            </div>

            <Accesibilidad />
          </div>
        </header>

        <div className={acceso ? "estructura-app" : "estructura-app estructura-publica"}>
          {acceso && <Navegacion administrador={puedeAdministrar(acceso.rol)} local={requiereSede(acceso.rol)} />}
          <div id="contenido-principal" className="contenido-app" tabIndex={-1}>
            {acceso && <div className="sesion-institucional">
              <span>{acceso.email} · {PERFILES[acceso.rol]}{acceso.sedeNombre
                ? ` · ${etiquetaSede({ nombre: acceso.sedeNombre, rbd: acceso.sedeRbd })}` : ""}</span>
              <BotonSalir />
            </div>}
            {children}
          </div>
        </div>

        <footer className="pie-institucional">
          <div className="interior-pie">
            <div>
              <p className="nombre-institucion">
                Servicio Local de Educación Pública Barrancas
              </p>
              <p>Inventario 2.0 EE y TI · UTIC</p>
            </div>
            <a href="https://soporteti.slepb.gob.cl/">Mesa de ayuda UTIC</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
