import Link from "next/link";
import { exigirAcceso } from "@/lib/acceso";

export default async function SinPermiso() {
  await exigirAcceso('insumos');
  return <main>
    <h1>Permiso insuficiente</h1>
    <p>Tu perfil no tiene permiso para acceder a esta pantalla o realizar esta acción.</p>
    <Link href="/">Volver al inicio</Link>
  </main>;
}
