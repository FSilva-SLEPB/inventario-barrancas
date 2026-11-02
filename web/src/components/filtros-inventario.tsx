"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type SedeFiltro = { id: string; nombre: string; rbd: string | null };

export default function FiltrosInventario({ ambito, vista, local, tipo, sedeId, rbd, q, sedes, limite, bodega = false }: {
  ambito: string; vista: string; local: boolean; tipo: string; sedeId: string;
  rbd: string; q: string; sedes: SedeFiltro[]; limite: number; bodega?: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const ruta = bodega ? "/inventario/bodega-ti" : ambito === "nc" ? "/inventario/nivel-central" : "/inventario/p02";
  const rbds = [...new Set(sedes.flatMap(s => s.rbd ? [s.rbd] : []))]
    .sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  function actualizar(formulario: HTMLFormElement, cambiarTipo = false) {
    const parametros = new URLSearchParams();
    new FormData(formulario).forEach((valor, clave) => {
      if (typeof valor === "string") parametros.set(clave, valor);
    });
    if (cambiarTipo) {
      parametros.delete("sede");
      parametros.delete("rbd");
    }
    iniciarTransicion(() => router.push(`${ruta}?${parametros}`, { scroll: false }));
  }

  return <form action={ruta} method="get" className="filtros-inventario" aria-label="Filtrar inventario" aria-busy={pendiente}>
    <div className="titulo-filtros">Filtrar equipos</div>
    <input type="hidden" name="limite" value={limite} />
    {(ambito === "nc" || bodega) && <input type="hidden" name="vista" value={bodega ? "pendientes" : "inventario"} />}
    <fieldset disabled={pendiente}>
      <legend className="visually-hidden">Filtros de inventario</legend>
      {!local && ambito === "eeji" && <>
        <div className="filtro-inventario-tipo">
          <label htmlFor="filtro-tipo">Tipo</label>
          <select id="filtro-tipo" name="tipo" defaultValue={tipo}
            onChange={evento => actualizar(evento.currentTarget.form!, true)}>
            <option value="">Selecciona un tipo</option>
            <option value="establecimiento">Establecimientos</option>
            <option value="jardin_infantil">Jardines infantiles y salas cunas</option>
          </select>
        </div>
        <div className="filtro-inventario-sede">
          <label htmlFor="filtro-sede">Establecimiento / JISC</label>
          <select id="filtro-sede" name="sede" defaultValue={sedeId} disabled={!tipo} aria-describedby={!tipo ? "ayuda-tipo" : undefined}>
            <option value="">Todos los establecimientos / JISC</option>
            {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div className="filtro-inventario-rbd">
          <label htmlFor="filtro-rbd">RBD</label>
          <select id="filtro-rbd" name="rbd" defaultValue={rbd} disabled={!tipo} aria-describedby={!tipo ? "ayuda-tipo" : undefined}>
            <option value="">Todos</option>
            {rbds.map(valor => <option key={valor} value={valor}>{valor}</option>)}
          </select>
        </div>
      </>}
      {ambito === "eeji" && !bodega && <div className="filtro-inventario-vista">
        <label htmlFor="filtro-vista">Estado de entrega</label>
        <select id="filtro-vista" name="vista" defaultValue={vista}
          onChange={evento => actualizar(evento.currentTarget.form!)}>
          <option value="inventario">Equipos recibidos</option>
          <option value="pendientes">Pendientes de entrega</option>
        </select>
      </div>}
      <div className={`filtro-inventario-busqueda${local ? " filtro-local" : ""}`}>
        <label htmlFor="buscar-equipo">Búsqueda general</label>
        <input id="buscar-equipo" name="q" type="search" maxLength={120} defaultValue={q}
          placeholder="Buscar por equipo, marca, modelo, serie o número de inventario" />
      </div>
      <div className="filtro-inventario-acciones">
        <button className="btn btn-primary" type="submit">Buscar</button>
        <Link className="btn btn-outline-primary" href={`${ruta}?vista=${vista}&limite=${limite}`}>Limpiar</Link>
      </div>
    </fieldset>
    {!local && ambito === "eeji" && !tipo && <p className="ayuda-tipo" id="ayuda-tipo">Selecciona un tipo para habilitar los filtros de establecimiento/JISC y RBD.</p>}
    <span className="visually-hidden" role="status">{pendiente ? "Actualizando inventario…" : ""}</span>
  </form>;
}


export function RegistrosPorPagina({ ruta, limite, filtros }: {
  ruta: string; limite: number; filtros: Record<string, string>;
}) {
  return <form action={ruta} method="get" className="registros-por-pagina">
    {Object.entries(filtros).map(([nombre, valor]) => <input key={nombre} type="hidden" name={nombre} value={valor} />)}
    <label htmlFor="registros-por-pagina">Mostrar</label>
    <select id="registros-por-pagina" name="limite" aria-label="Registros por página" defaultValue={String(limite)}
      onChange={evento => evento.currentTarget.form?.requestSubmit()}>
      {[50, 100, 150].map(valor => <option key={valor} value={valor}>{valor}</option>)}
    </select><span>registros</span>
  </form>;
}
