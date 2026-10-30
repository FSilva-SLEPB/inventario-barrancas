export function etiquetaSede(sede: { nombre: string; rbd?: string | null }): string {
  return sede.rbd ? `${sede.rbd} - ${sede.nombre}` : sede.nombre;
}
