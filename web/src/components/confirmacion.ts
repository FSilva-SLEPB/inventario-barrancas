"use client";
export async function confirmarAccion(titulo: string, texto: string, confirmar = "Confirmar", cancelar = "Cancelar") {
  const { default: Swal } = await import("sweetalert2");
  const r = await Swal.fire({
    title: titulo,
    text: texto,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: confirmar,
    cancelButtonText: cancelar,
    reverseButtons: true,
    heightAuto: false,
    buttonsStyling: false,
    customClass: { popup: "confirmacion-guardado", confirmButton: "btn btn-primary", cancelButton: "btn btn-outline-primary" },
  });
  return r.isConfirmed;
}

export async function avisarExito(titulo: string, texto?: string) {
  const { default: Swal } = await import("sweetalert2");
  await Swal.fire({
    icon: "success",
    title: titulo,
    text: texto,
    confirmButtonText: "Aceptar",
    heightAuto: false,
    buttonsStyling: false,
    customClass: { popup: "confirmacion-guardado", confirmButton: "btn btn-primary" },
  });
}

export async function avisarError(titulo: string, texto?: string) {
  const { default: Swal } = await import("sweetalert2");
  await Swal.fire({
    icon: "error",
    title: titulo,
    text: texto,
    confirmButtonText: "Entendido",
    heightAuto: false,
    buttonsStyling: false,
    customClass: { popup: "confirmacion-guardado", confirmButton: "btn btn-primary" },
  });
}
