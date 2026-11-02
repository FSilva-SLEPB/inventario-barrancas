"use client";
import Link from "next/link";

export default function SeleccionEntregas({ todosHref }: { todosHref: string }) {
  function marcar(valor: boolean) {
    document.querySelectorAll<HTMLInputElement>('input[form="seleccion-entregas"][type="checkbox"]:not(:disabled)').forEach(e => { e.checked = valor; });
  }
  return <form id="seleccion-entregas" action="/inventario/movimientos/regularizar" method="get" className="seleccion-entregas">
    <p><strong>Regularizar entregas de jardines</strong> · Selecciona uno o varios equipos para revisar su entrega por jardín.</p>
    <div className="acciones-catalogos">
      <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => marcar(true)}>Seleccionar esta página</button>
      <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => marcar(false)}>Quitar selección</button>
      <button type="submit" className="btn btn-primary btn-sm">Revisar seleccionados</button>
      <Link href={todosHref}>Revisar todos los jardines filtrados</Link>
    </div>
  </form>;
}
