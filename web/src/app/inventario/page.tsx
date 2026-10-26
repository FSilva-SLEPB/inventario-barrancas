import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inventario | SLEP Barrancas",
};

export default function InventarioPage() {
  return (
    <main>
      <header>
        <p>Servicio Local de Educación Pública Barrancas</p>
        <h1>Inventario</h1>
      </header>

      <p>
        Módulo en desarrollo. Aquí se incorporarán la consulta y el registro
        de bienes de los establecimientos educacionales y Nivel Central.
      </p>
    </main>
  );
}
