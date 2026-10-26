import type { Metadata } from "next";
import localFont from "next/font/local";
import Navegacion from "../components/navegacion";
import "./globals.css";

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
});

export const metadata: Metadata = {
  title: "Inventario 2.0 EE y TI | SLEP Barrancas",
  description:
    "Sistema de inventario y solicitudes de insumos para establecimientos educacionales y Nivel Central del SLEP Barrancas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CL" className={gobCl.className}>
      <body>
        <Navegacion />
        {children}
      </body>
    </html>
  );
}
