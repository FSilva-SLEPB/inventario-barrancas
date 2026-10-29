import { redirect } from "next/navigation";
import { BotonIngresar, BotonSalir } from "@/components/botones-sesion";
import { obtenerAcceso } from "@/lib/acceso";
import { autenticacionConfigurada } from "@/lib/configuracion-auth";

export const metadata = { title: "Ingresar | Inventario SLEP Barrancas" };

export default async function Ingresar({ searchParams }: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  if (await obtenerAcceso()) redirect("/");
  const { error } = await searchParams;
  return <main>
    <h1>Acceso institucional</h1>
    <p>Ingresa con tu cuenta de Google Workspace de SLEP Barrancas.</p>
    <p>El acceso requiere autorización previa de la administración del sistema.</p>
    {error && <p role="alert">No fue posible ingresar. Comprueba tu cuenta y solicita acceso a UTIC si corresponde.</p>}
    {autenticacionConfigurada()
      ? <><BotonIngresar /> <BotonSalir /></>
      : <p role="status">El acceso institucional está pendiente de configuración. Contacta a UTIC.</p>}
  </main>;
}
