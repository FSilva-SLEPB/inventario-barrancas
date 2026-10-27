"use client";

export default function ErrorCatalogos({
  reset,
}: {
  reset: () => void;
}) {
  return (
    <main>
      <header>
        <p>SLEP Barrancas</p>
        <h1>Categorías de bienes</h1>
      </header>

      <p role="alert">
        No pudimos cargar las categorías. Inténtalo nuevamente.
      </p>

      <button
        type="button"
        className="boton-catalogos"
        onClick={() => reset()}
      >
        Volver a intentar
      </button>
    </main>
  );
}
