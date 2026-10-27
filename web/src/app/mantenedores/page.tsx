import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Mantenedores | Inventario SLEP Barrancas",
};

export default function Mantenedores() {
  return (
    <main>
      <header>
        <p>SLEP Barrancas</p>
        <h1>Mantenedores</h1>
      </header>

      <section aria-labelledby="titulo-catalogos">
        <h2 id="titulo-catalogos">Catálogos</h2>
        <p>Administra las categorías utilizadas para registrar los bienes.</p>
        <ul>
          <li>
            <Link href="/mantenedores/categorias">
              Categorías de bienes
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
