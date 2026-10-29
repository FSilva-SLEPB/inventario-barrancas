import Link from "next/link";
import { exigirAcceso } from "@/lib/acceso";

export default async function SinPermiso() {
  await exigirAcceso();
  return <main>
    <h1>Permiso insuficiente</h1>
    <p>Tu cuenta permite consultar los catálogos. Para modificarlos necesitas permiso de administración.</p>
    <Link href="/">Volver al inicio</Link>
  </main>;
}
