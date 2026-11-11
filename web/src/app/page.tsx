import Link from "next/link";
import { redirect } from "next/navigation";
import {modulosSistema} from "@/lib/modulos";
import AccesosModulo from "@/components/accesos-modulo";
import { obtenerAcceso, obtenerSesion } from "@/lib/acceso";

export default async function Home() {
  const acceso = await obtenerAcceso();
  if (!acceso && (await obtenerSesion())?.accesoDenegado) redirect("/acceso-denegado");
  if (!acceso) return <main className="portal-bienvenida">
    <section className="portal-hero" aria-labelledby="bienvenida-titulo">
      <div className="portal-hero-interior">
        <p className="portal-etiqueta">SLEP Barrancas · Unidad de Tecnologías de la Información y Comunicaciones</p>
        <h1 id="bienvenida-titulo">Sistema Unidad TIC</h1>
        <p className="portal-descripcion">Plataforma institucional para la gestión de inventario, solicitudes y servicios tecnológicos de nuestra comunidad educativa.</p>
        <Link href="/ingresar" className="btn btn-primary portal-acceso">Acceder al sistema <span aria-hidden="true">→</span></Link>
        <p className="portal-nota">Acceso con cuenta institucional y autorización previa.</p>
      </div>
    </section>

    <section aria-labelledby="servicios-titulo" className="portal-seccion">
      <div className="portal-seccion-interior">
        <header className="portal-seccion-cabecera">
          <h2 id="servicios-titulo">Servicios disponibles</h2>
          <p>Herramientas para apoyar la gestión tecnológica y administrativa del servicio.</p>
        </header>
        <div className="portal-servicios">
          <article className="portal-servicio"><span className="portal-servicio-icono" aria-hidden="true">01</span><h3>Inventario</h3><p>Registro y seguimiento de equipos y bienes del servicio.</p></article>
          <article className="portal-servicio"><span className="portal-servicio-icono" aria-hidden="true">02</span><h3>Solicitudes</h3><p>Gestión de solicitudes de insumos y requerimientos tecnológicos.</p></article>
          <article className="portal-servicio"><span className="portal-servicio-icono" aria-hidden="true">03</span><h3>Soporte y gestión</h3><p>Catálogos y herramientas para la operación de la Unidad TIC.</p></article>
        </div>
      </div>
    </section>

    <section aria-labelledby="nosotros-titulo" className="portal-seccion portal-nosotros">
      <div className="portal-seccion-interior portal-nosotros-grid">
        <div>
          <h2 id="nosotros-titulo">Sobre la Unidad TIC</h2>
          <p>La Unidad de Tecnologías de la Información y Comunicaciones del SLEP Barrancas apoya el funcionamiento del servicio, los establecimientos educacionales y jardines infantiles, facilitando la gestión de recursos tecnológicos y la continuidad de los procesos.</p>
          <p>Este sistema permite organizar la información, dar trazabilidad a los bienes y atender las necesidades de nuestra comunidad educativa.</p>
        </div>
        <div className="portal-nosotros-destacado" aria-hidden="true">
          <p>Al servicio de</p>
          <ul>
            <li>Establecimientos educacionales</li>
            <li>Jardines infantiles y salas cuna</li>
            <li>Nivel Central</li>
          </ul>
        </div>
      </div>
    </section>

    <section className="portal-cta" aria-labelledby="cta-titulo">
      <div className="portal-seccion-interior portal-cta-interior">
        <h2 id="cta-titulo">Accede con tu cuenta institucional</h2>
        <p>Ingresa con tu cuenta de Google Workspace autorizada para utilizar los servicios de la Unidad TIC.</p>
        <Link href="/ingresar" className="btn btn-light portal-acceso">Ingresar al sistema</Link>
      </div>
    </section>
  </main>;

  const accesosVisibles = modulosSistema(acceso.rol).map(m=>({href:m.href,titulo:m.titulo,descripcion:m.descripcion,icono:({inventario:'INV',directorio:'DIR',solicitudes:'IN',mantenedores:'ADM'})[m.id]}));
  return (
    <main>
      <header>
        <h1>Inicio</h1>
        <p className="descripcion-pagina">Sistema Unidad TIC · Gestión de inventario, solicitudes y servicios para la comunidad educativa del SLEP Barrancas.</p>
      </header>
      <AccesosModulo id="titulo-accesos" titulo="Accesos principales" accesos={accesosVisibles}/>
    </main>
  );
}
