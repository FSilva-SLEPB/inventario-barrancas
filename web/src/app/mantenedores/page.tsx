import type { Metadata } from "next";
import Link from "next/link";
import { exigirAcceso } from "@/lib/acceso";

export const metadata: Metadata = {
  title: "Mantenedores | Inventario SLEP Barrancas",
};

export default async function Mantenedores() {
  await exigirAcceso();
  return (
    <main>
      <header>
        <p>SLEP Barrancas</p>
        <h1>Mantenedores</h1>
      </header>

      <section aria-labelledby="titulo-catalogos">
        <h2 id="titulo-catalogos">Catálogos</h2>
        <p>Administra las categorías de bienes, las sedes y sus dependencias.</p>
        <ul>
          <li>
            <Link href="/mantenedores/categorias">
              Categorías de bienes
            </Link>
          </li>
          <li>
            <Link href="/mantenedores/sedes">
              Sedes
            </Link>
          </li>
          <li>
            <Link href="/mantenedores/dependencias">
              Dependencias
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
