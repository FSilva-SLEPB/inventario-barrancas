import { redirect } from "next/navigation";
import Link from "next/link";
import { BotonIngresar } from "@/components/botones-sesion";
import { obtenerAcceso, obtenerSesion } from "@/lib/acceso";
import { autenticacionConfigurada } from "@/lib/configuracion-auth";

export const metadata = { title: "Ingresar | Sistema Unidad TIC" };

export default async function Ingresar({ searchParams }: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  if (await obtenerAcceso()) redirect("/");
  const { error } = await searchParams;
  if (error === "AccessDenied" || (await obtenerSesion())?.accesoDenegado) redirect("/acceso-denegado");
  return <main className="portal-bienvenida portal-acceso-pagina">
    <section className="portal-hero portal-hero-compacto" aria-labelledby="acceso-titulo">
      <div className="portal-hero-interior">
        <p className="portal-etiqueta">SLEP Barrancas · Unidad TIC</p>
        <h1 id="acceso-titulo">Sistema Unidad TIC</h1>
        <p className="portal-descripcion">Accede a la plataforma institucional con tu cuenta autorizada.</p>
      </div>
    </section>
    <section className="portal-seccion" aria-label="Formulario de acceso">
      <div className="portal-seccion-interior">
        <div className="portal-ingreso-tarjeta">
          <h2>Acceso institucional</h2>
          <p>Ingresa con tu cuenta de Google Workspace de SLEP Barrancas.</p>
          <p>El acceso requiere autorización previa de la administración del sistema.</p>
          {error && <p role="alert" className="portal-alerta">{error === "ServicioNoDisponible"
            ? "No pudimos comprobar tu acceso en este momento. Inténtalo nuevamente."
            : "No fue posible ingresar. Comprueba tu cuenta y solicita acceso a UTIC si corresponde."}</p>}
          {autenticacionConfigurada()
            ? <BotonIngresar />
            : <p role="status">El acceso institucional está pendiente de configuración. Contacta a UTIC.</p>}
          <p className="portal-volver"><Link href="/">Volver a la bienvenida</Link></p>
        </div>
      </div>
    </section>
  </main>;
}
