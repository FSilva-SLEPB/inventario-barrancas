import Link from "next/link";
import { redirect } from "next/navigation";
import { puedeAdministrar } from "@/lib/politica-acceso";
import { obtenerAcceso, obtenerSesion } from "@/lib/acceso";

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
  const acceso = await obtenerAcceso();
  if (!acceso && (await obtenerSesion())?.accesoDenegado) redirect("/acceso-denegado");
  if (!acceso) return <main className="portal-bienvenida">
    <section className="portal-presentacion" aria-labelledby="bienvenida-titulo">
      <p className="portal-etiqueta">SLEP Barrancas · UTIC</p>
      <h1 id="bienvenida-titulo">Bienvenido al sistema de Inventario</h1>
      <p className="portal-descripcion">Un espacio para organizar los bienes y las solicitudes
        de nuestra comunidad educativa.</p>
      <Link href="/ingresar" className="btn btn-primary portal-acceso">Acceder al sistema <span aria-hidden="true">→</span></Link>
      <p className="portal-nota">Acceso con cuenta institucional y autorización previa.</p>
    </section>
    <section aria-labelledby="comunidad-titulo" className="portal-comunidad">
      <h2 id="comunidad-titulo">Al servicio de nuestra comunidad</h2>
      <div className="portal-ambitos">
        <article><span aria-hidden="true" className="portal-numero">01</span><h3>Establecimientos educacionales</h3>
          <p>Gestión de los bienes que acompañan el aprendizaje.</p></article>
        <article><span aria-hidden="true" className="portal-numero">02</span><h3>Jardines infantiles</h3>
          <p>Organización de recursos para la educación inicial.</p></article>
        <article><span aria-hidden="true" className="portal-numero">03</span><h3>Nivel Central</h3>
          <p>Coordinación y apoyo a la gestión del servicio.</p></article>
      </div>
    </section>
  </main>;
  const accesosVisibles = puedeAdministrar(acceso.rol) ? [accesos[0], {href:"/directorio",titulo:"Directorio",descripcion:"Establecimientos, JI/SC y sus directores y directoras."}, ...accesos.slice(1)] : accesos;
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
          {accesosVisibles.map((acceso) => (
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
