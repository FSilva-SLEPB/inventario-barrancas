import VistaInventario, { type ParametrosInventario } from "@/components/vista-inventario";

export const metadata = { title: "Bodega TI | SLEP Barrancas" };

export default async function BodegaTI(props: ParametrosInventario) {
  return VistaInventario({ ...props, ambito: "eeji", bodega: true });
}
