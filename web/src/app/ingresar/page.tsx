import { redirect } from "next/navigation";
import Link from "next/link";
import { BotonIngresar } from "@/components/botones-sesion";
import { obtenerAcceso, obtenerSesion } from "@/lib/acceso";
import { autenticacionConfigurada } from "@/lib/configuracion-auth";

export const metadata = { title: "Ingresar | Inventario SLEP Barrancas" };

export default async function Ingresar({ searchParams }: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  if (await obtenerAcceso()) redirect("/");
  const { error } = await searchParams;
  if (error === "AccessDenied" || (await obtenerSesion())?.accesoDenegado) redirect("/acceso-denegado");
  return <main className="portal-ingreso">
    <p className="portal-etiqueta">Inventario 2.0 EE y TI</p>
    <h1>Acceso institucional</h1>
    <p>Ingresa con tu cuenta de Google Workspace de SLEP Barrancas.</p>
    <p>El acceso requiere autorización previa de la administración del sistema.</p>
    {error && <p role="alert">{error === "ServicioNoDisponible"
      ? "No pudimos comprobar tu acceso en este momento. Inténtalo nuevamente."
      : "No fue posible ingresar. Comprueba tu cuenta y solicita acceso a UTIC si corresponde."}</p>}
    {autenticacionConfigurada()
      ? <BotonIngresar />
      : <p role="status">El acceso institucional está pendiente de configuración. Contacta a UTIC.</p>}
    <p className="portal-volver"><Link href="/">Volver a la bienvenida</Link></p>
  </main>;
}
