import type { Metadata } from "next";
import { exigirAcceso } from "@/lib/acceso";

export const metadata: Metadata = {
  title: "Solicitudes | SLEP Barrancas",
};

export default async function SolicitudesPage() {
  await exigirAcceso();
  return (
    <main>
      <header>
        <p>Servicio Local de Educación Pública Barrancas</p>
        <h1>Solicitudes</h1>
      </header>

      <p>
        Módulo en desarrollo. Aquí se incorporará la gestión de solicitudes
        de insumos para establecimientos educacionales y Nivel Central.
      </p>
    </main>
  );
}
