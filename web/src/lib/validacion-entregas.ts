import { esIdSede } from "@/lib/validacion-sedes";

export type ItemEntrega = { id: string; version: number };
export type GrupoEntrega = { sedeId: string; equipos: ItemEntrega[]; fecha: string; receptora: string; enlaceActa: string };
export type BaseEntrega = Pick<GrupoEntrega, "sedeId" | "equipos">;

export function fechaSugeridaEntrega(comuna: string | null): string {
  const nombre = (comuna ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
  return ({ pudahuel: "2026-10-26", "lo prado": "2026-10-27", "cerro navia": "2026-10-28" } as Record<string,string>)[nombre] ?? "";
}
export function hoyChile(): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return ["year", "month", "day"].map(k => p.find(v => v.type === k)!.value).join("-");
}
export function validarRegularizacion(f: FormData, hoy = hoyChile()): { solicitud: string; grupos: GrupoEntrega[] } {
  const leer = (campo: string, limite: number) => {
    const v = f.getAll(campo);
    if (v.length !== 1 || typeof v[0] !== "string" || v[0].length > limite) throw new Error("Formulario inválido o repetido. Revisa la selección.");
    return v[0].normalize("NFC").trim();
  };
  const solicitud = leer("solicitud", 36);
  if (!esIdSede(solicitud) || leer("confirmo", 2) !== "si") throw new Error("Confirma que revisaste los equipos, fechas y directoras receptoras.");
  let bases: unknown;
  try { bases = JSON.parse(leer("seleccion", 350000)); } catch { throw new Error("La selección no es válida. Vuelve a Bodega TI."); }
  if (!Array.isArray(bases) || !bases.length || bases.length > 2500) throw new Error("Selecciona entre 1 y 2.500 equipos.");
  const sedes = new Set<string>(), equipos = new Set<string>();
  const grupos: GrupoEntrega[] = [];
  for (const g of bases) {
    if (!g || typeof g !== "object" || typeof g.sedeId !== "string" || !esIdSede(g.sedeId) || sedes.has(g.sedeId.toLowerCase())
      || !Array.isArray(g.equipos) || !g.equipos.length) throw new Error("La agrupación por jardín no es válida.");
    sedes.add(g.sedeId.toLowerCase());
    const items: ItemEntrega[] = [];
    for (const e of g.equipos) {
      if (!e || typeof e.id !== "string" || !esIdSede(e.id) || equipos.has(e.id.toLowerCase()) || !Number.isInteger(e.version)
        || e.version < 1 || e.version > 2147483646 || equipos.size >= 2500) throw new Error("Hay equipos repetidos o versiones inválidas. Revisa la selección.");
      equipos.add(e.id.toLowerCase()); items.push({ id: e.id.toLowerCase(), version: e.version });
    }
    const fecha = leer(`fecha-${g.sedeId}`, 10);
    const instante = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? new Date(fecha + "T00:00:00Z") : null;
    if (!instante || Number.isNaN(instante.getTime()) || instante.toISOString().slice(0,10) !== fecha || fecha < "1900-01-01" || fecha > hoy)
      throw new Error("Indica la fecha real de entrega de cada jardín, sin fechas futuras.");
    const receptora = leer(`receptora-${g.sedeId}`, 200).replace(/ +/g," ");
    if (!receptora || /\p{Cc}/u.test(receptora)) throw new Error("Indica el nombre de la directora que recibió en cada jardín.");
    const enlaceActa = leer(`acta-${g.sedeId}`, 1500);
    if (enlaceActa) {
      let url: URL; try { url = new URL(enlaceActa); } catch { throw new Error("El enlace del acta no es válido."); }
      if (!["https:","http:"].includes(url.protocol) || url.username || url.password || /\s/u.test(enlaceActa)) throw new Error("Usa un enlace HTTP o HTTPS sin credenciales para el acta.");
    }
    grupos.push({ sedeId: g.sedeId.toLowerCase(), equipos: items, fecha, receptora, enlaceActa });
  }
  return { solicitud: solicitud.toLowerCase(), grupos };
}
