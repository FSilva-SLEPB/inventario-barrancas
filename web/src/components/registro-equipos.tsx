"use client";

import { useState } from "react";
import FormularioEquipo from "@/components/formulario-equipo";
import type { Sede } from "@/lib/validacion-sedes";
import type { CategoriaBien } from "@/lib/catalogos";

export default function RegistroEquipos({ sedes, categorias, local, volver }: {
  sedes: Sede[]; categorias: CategoriaBien[]; local: boolean; volver?:string;
}) {
  const [destino, setDestino] = useState(local ? "eeji" : "");
  const disponibles = sedes.filter(s => destino === "nc" ? s.tipo === "nivel_central" : s.tipo !== "nivel_central");
  return <section className="registro-individual" aria-labelledby="registro-individual-titulo">
    <h2 id="registro-individual-titulo">Registro individual</h2>
    {!local && <div className="campo-catalogos selector-destino">
      <label htmlFor="inventario-destino">Inventario de destino *</label>
      <select id="inventario-destino" value={destino} onChange={evento => setDestino(evento.currentTarget.value)}>
        <option value="">Selecciona el inventario</option>
        <option value="nc">Inventario Nivel Central</option>
        <option value="eeji">Inventario de establecimiento / JISC (P02)</option>
      </select>
    </div>}
    {!destino ? <p className="ayuda-catalogos">Selecciona el inventario de destino para completar los datos del equipo.</p>
      : disponibles.some(s => s.activo) && categorias.some(c => c.activo)
        ? <FormularioEquipo key={destino} sedes={disponibles} categorias={categorias} local={local} volver={volver} />
        : <p role="status">Se requiere una sede de destino y una categoría activas en los mantenedores.</p>}
  </section>;
}
