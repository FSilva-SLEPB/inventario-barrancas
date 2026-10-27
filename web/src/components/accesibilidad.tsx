"use client";

import { useState } from "react";

const tamanos = [100, 125, 150] as const;

export default function Accesibilidad() {
  const [nivel, setNivel] = useState(0);
  const [altoContraste, setAltoContraste] = useState(false);

  function cambiarTamano(nuevoNivel: number) {
    const siguiente = Math.min(tamanos.length - 1, Math.max(0, nuevoNivel));
    setNivel(siguiente);

    if (siguiente === 0) {
      document.documentElement.style.removeProperty("font-size");
    } else {
      document.documentElement.style.setProperty(
        "font-size",
        `${tamanos[siguiente]}%`,
      );
    }
  }

  function cambiarContraste() {
    const siguiente = !altoContraste;
    setAltoContraste(siguiente);

    if (siguiente) {
      document.documentElement.setAttribute("data-contraste", "alto");
    } else {
      document.documentElement.removeAttribute("data-contraste");
    }
  }

  return (
    <div className="controles-accesibilidad" role="group" aria-label="Accesibilidad">
      <button
        type="button"
        aria-label="Reducir tamaño del texto"
        disabled={nivel === 0}
        onClick={() => cambiarTamano(nivel - 1)}
      >
        A−
      </button>
      <button
        type="button"
        aria-label="Aumentar tamaño del texto"
        disabled={nivel === tamanos.length - 1}
        onClick={() => cambiarTamano(nivel + 1)}
      >
        A+
      </button>
      <button
        type="button"
        aria-label="Alto contraste"
        aria-pressed={altoContraste}
        onClick={cambiarContraste}
      >
        Contraste
      </button>
      <span className="visually-hidden" role="status" aria-atomic="true">
        Tamaño del texto: {tamanos[nivel]} %.
      </span>
    </div>
  );
}
