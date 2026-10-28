"use client";

import Link from "next/link";

export default function ErrorSedes({ reset }: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main>
      <header>
        <p>SLEP Barrancas</p>
        <h1>No fue posible cargar las sedes</h1>
      </header>
      <p>Inténtalo nuevamente en unos momentos.</p>
      <div className="acciones-catalogos">
        <button type="button" onClick={reset} className="boton-catalogos">Volver a intentar</button>
        <Link href="/mantenedores">Volver a Mantenedores</Link>
      </div>
    </main>
  );
}
