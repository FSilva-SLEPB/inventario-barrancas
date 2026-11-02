import VistaInventario, { type ParametrosInventario } from "@/components/vista-inventario";

export const metadata = { title: "Inventario P02 | SLEP Barrancas" };

export default async function Inventario(props: ParametrosInventario) {
  return VistaInventario({ ...props, ambito: "eeji" });
}
