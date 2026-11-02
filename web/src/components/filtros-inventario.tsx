"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type SedeFiltro = { id: string; nombre: string; rbd: string | null };

export default function FiltrosInventario({ ambito, vista, local, tipo, sedeId, rbd, q, sedes }: {
  ambito: string; vista: string; local: boolean; tipo: string; sedeId: string;
  rbd: string; q: string; sedes: SedeFiltro[];
}) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const base = `/inventario?${new URLSearchParams({ ambito, vista })}`;
  const rbds = [...new Set(sedes.flatMap(s => s.rbd ? [s.rbd] : []))]
    .sort((a, b) => a.localeCompare(b, "es", { numeric: true }));

  return <form method="get" className="filtros-inventario" aria-label="Filtrar inventario" aria-busy={pendiente}>
    <input type="hidden" name="ambito" value={ambito} />
    <input type="hidden" name="vista" value={vista} />
    <fieldset disabled={pendiente}>
      <legend className="visually-hidden">Filtros de inventario</legend>
      {!local && ambito === "eeji" && <>
        <div className="filtro-inventario-tipo">
          <label htmlFor="filtro-tipo">Tipo</label>
          <select id="filtro-tipo" name="tipo" defaultValue={tipo} onChange={evento => {
            const parametros = new URLSearchParams();
            new FormData(evento.currentTarget.form!).forEach((valor, clave) => {
              if (typeof valor === "string") parametros.set(clave, valor);
            });
            // No conservar una selección perteneciente al tipo anterior.
            parametros.delete("sede");
            parametros.delete("rbd");
            iniciarTransicion(() => router.push(`/inventario?${parametros}`));
          }}>
            <option value="">Todos los tipos</option>
            <option value="establecimiento">Establecimientos</option>
            <option value="jardin_infantil">Jardines infantiles y salas cunas</option>
          </select>
        </div>
        <div className="filtro-inventario-sede">
          <label htmlFor="filtro-sede">Establecimiento / JISC</label>
          <select id="filtro-sede" name="sede" defaultValue={sedeId}>
            <option value="">Todos</option>
            {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="filtro-rbd">RBD</label>
          <select id="filtro-rbd" name="rbd" defaultValue={rbd}>
            <option value="">Todos</option>
            {rbds.map(valor => <option key={valor} value={valor}>{valor}</option>)}
          </select>
        </div>
      </>}
      <div className="filtro-inventario-busqueda">
        <label htmlFor="buscar-equipo">Búsqueda general</label>
        <input id="buscar-equipo" name="q" type="search" maxLength={120} defaultValue={q}
          placeholder="Equipo, marca, modelo, serie o inventario…" />
      </div>
      <div className="filtro-inventario-acciones">
        <button className="btn btn-primary" type="submit">Buscar</button>
        <Link href={base}>Limpiar</Link>
      </div>
    </fieldset>
    <span className="visually-hidden" role="status">{pendiente ? "Actualizando inventario…" : ""}</span>
  </form>;
}
