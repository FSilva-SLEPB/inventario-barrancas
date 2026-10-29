"use client";

export default function ErrorUsuarios({ reset }: { reset: () => void }) {
  return <main><h1>Usuarios y perfiles</h1>
    <p role="alert">No pudimos cargar los usuarios. Inténtalo nuevamente.</p>
    <button className="btn btn-primary" onClick={reset}>Volver a intentar</button>
  </main>;
}
