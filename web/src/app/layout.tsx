import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inventario 2.0 EE y TI | SLEP Barrancas",
  description:
    "Sistema de inventario y solicitudes de insumos para establecimientos educacionales y Nivel Central del SLEP Barrancas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-CL">
      <body>{children}</body>
    </html>
  );
}
