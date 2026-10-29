import Link from "next/link";
import { exigirAcceso } from "@/lib/acceso";

const accesos = [
  {
    href: "/inventario",
    titulo: "Inventario",
    descripcion: "Equipos y bienes del servicio.",
  },
  {
    href: "/solicitudes",
    titulo: "Solicitudes",
    descripcion:
      "Solicitudes de suministros para establecimientos y Nivel Central.",
  },
  {
    href: "/mantenedores",
    titulo: "Mantenedores",
    descripcion: "Categorías de bienes y catálogos del sistema.",
  },
];

export default async function Home() {
  await exigirAcceso();
  return (
    <main>
      <header>
        <h1>Inicio</h1>
        <p className="descripcion-pagina">
          Gestión de inventario y solicitudes de insumos para establecimientos
          educacionales y Nivel Central.
        </p>
      </header>

      <section aria-labelledby="titulo-accesos">
        <h2 id="titulo-accesos">Accesos principales</h2>

        <div className="accesos-inicio">
          {accesos.map((acceso) => (
            <Link
              key={acceso.href}
              href={acceso.href}
              className="acceso-inicio"
            >
              <span className="titulo-acceso">{acceso.titulo}</span>
              <span className="descripcion-acceso">
                {acceso.descripcion}
              </span>
              <span className="enlace-acceso">
                Ir a {acceso.titulo} <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
