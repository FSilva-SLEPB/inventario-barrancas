"use client";
export default function ErrorInventario({reset}:{reset:()=>void}) {
  return <main><h1>No se pudo consultar el inventario</h1><p>Inténtalo nuevamente. Si continúa, contacta a UTIC.</p><button onClick={reset}>Reintentar</button></main>;
}
