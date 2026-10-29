import { redirect } from "next/navigation";
import { exigirAcceso } from "@/lib/acceso";

export default async function CatalogosAnterior({
  searchParams,
}: {
  searchParams: Promise<{ editar?: string | string[] }>;
}) {
  await exigirAcceso();
  const { editar } = await searchParams;
  const destino = "/mantenedores/categorias";

  if (
    typeof editar === "string"
    && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(editar)
  ) {
    redirect(
      destino + "?editar=" + encodeURIComponent(editar.toLowerCase())
      + "#formulario-categoria",
    );
  }

  redirect(destino);
}
