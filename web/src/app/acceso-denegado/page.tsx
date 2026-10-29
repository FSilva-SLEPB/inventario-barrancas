import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerAcceso } from "@/lib/acceso";
import { autenticacionConfigurada } from "@/lib/configuracion-auth";
import { BotonIngresar, BotonSalir } from "@/components/botones-sesion";

export const metadata = { title: "Acceso no autorizado | Inventario SLEP Barrancas" };

export default async function AccesoDenegado() {
  if (await obtenerAcceso()) redirect("/");
  return <main className="portal-ingreso portal-denegado">
    <p className="portal-etiqueta">Inventario 2.0 EE y TI</p>
    <span className="denegado-indicador" aria-hidden="true">!</span>
    <h1>No tienes acceso al sistema</h1>
    <p>Tu cuenta no tiene autorización vigente para ingresar al Inventario de SLEP Barrancas.</p>
    <p>Si necesitas acceso o crees que se trata de un error, contacta a UTIC para revisar tu autorización.</p>
    <div className="denegado-acciones">
      {autenticacionConfigurada() && <BotonIngresar otraCuenta />}
      <a className="btn btn-outline-primary" href="https://soporteti.slepb.gob.cl/">Contactar a UTIC</a>
    </div>
    <div className="portal-volver">{autenticacionConfigurada()
      ? <BotonSalir texto="Volver a la bienvenida" />
      : <Link href="/">Volver a la bienvenida</Link>}</div>
  </main>;
}
