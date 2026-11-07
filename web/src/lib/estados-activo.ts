// Modelo del componente solicitado. La persistencia usa las operaciones del servidor.
export const ESTADOS_CONDICION_ACTIVO = {
  operativo: 'Operativo',
  bodega_ti: 'Bodega de TI',
  mantencion: 'Mantención',
  mal_estado: 'Mal estado',
  obsoleto: 'Obsoleto',
} as const;
export const ESTADOS_ADMINISTRATIVOS_ACTIVO = {
  activo: 'Activo',
  robado: 'Robado',
  no_encontrado: 'No encontrado',
  dado_de_baja: 'Dado de baja',
} as const;
export type EstadoCondicionActivo = keyof typeof ESTADOS_CONDICION_ACTIVO;
export type EstadoAdministrativoActivo = keyof typeof ESTADOS_ADMINISTRATIVOS_ACTIVO;
export type RegistroEstadoActivo = Readonly<{
  activoId: string;
  descripcion: string;
  estadoAdministrativo: EstadoAdministrativoActivo;
  estadoCondicion: EstadoCondicionActivo | '';
  observaciones: string;
  fechaBaja: string | null;
}>;
export type DatosInicialesEstadoActivo = Partial<Omit<RegistroEstadoActivo, 'activoId'>>;

export function condicionBloqueada(administrativo: EstadoAdministrativoActivo) {
  return administrativo !== 'activo';
}
export function registroSoloLectura(registro: RegistroEstadoActivo) {
  return registro.estadoAdministrativo === 'dado_de_baja';
}
export function crearRegistroEstadoActivo(activoId: string, inicial: DatosInicialesEstadoActivo = {}): RegistroEstadoActivo {
  const administrativo = inicial.estadoAdministrativo ?? 'activo';
  if (!activoId.trim() || !Object.hasOwn(ESTADOS_ADMINISTRATIVOS_ACTIVO, administrativo)) {
    throw new Error('Identificación o estado administrativo inválido.');
  }
  const condicion = inicial.estadoCondicion ?? '';
  if (condicion !== '' && !Object.hasOwn(ESTADOS_CONDICION_ACTIVO, condicion)) {
    throw new Error('Estado de condición inválido.');
  }
  return Object.freeze({
    activoId,
    descripcion: inicial.descripcion ?? '',
    estadoAdministrativo: administrativo,
    estadoCondicion: administrativo === 'dado_de_baja' ? 'obsoleto' : condicionBloqueada(administrativo) ? '' : condicion,
    observaciones: inicial.observaciones ?? '',
    // Cargar un histórico no inventa una fecha ni vuelve a ejecutar protocolos.
    fechaBaja: administrativo === 'dado_de_baja' ? inicial.fechaBaja ?? null : null,
  });
}
export function cambiarEstadoAdministrativo(
  anterior: RegistroEstadoActivo,
  siguiente: EstadoAdministrativoActivo,
  fecha = new Date().toISOString(),
) {
  if (!Object.hasOwn(ESTADOS_ADMINISTRATIVOS_ACTIVO, siguiente)) throw new Error('Estado administrativo inválido.');
  if (registroSoloLectura(anterior) || anterior.estadoAdministrativo === siguiente) {
    return {registro: anterior, protocoloSeguridad: false};
  }
  const registro: RegistroEstadoActivo = Object.freeze({
    ...anterior,
    estadoAdministrativo: siguiente,
    estadoCondicion: siguiente === 'dado_de_baja' ? 'obsoleto' : condicionBloqueada(siguiente) ? '' : anterior.estadoCondicion,
    fechaBaja: siguiente === 'dado_de_baja' ? fecha : null,
  });
  return {registro, protocoloSeguridad: siguiente === 'robado' || siguiente === 'no_encontrado'};
}
export function cambiarCondicionActivo(anterior: RegistroEstadoActivo, condicion: EstadoCondicionActivo | '') {
  if (condicion !== '' && !Object.hasOwn(ESTADOS_CONDICION_ACTIVO, condicion)) throw new Error('Estado de condición inválido.');
  if (condicionBloqueada(anterior.estadoAdministrativo) || anterior.estadoCondicion === condicion) return anterior;
  return Object.freeze({...anterior, estadoCondicion: condicion});
}
export function cambiarTextoActivo(anterior: RegistroEstadoActivo, campo: 'descripcion' | 'observaciones', valor: string) {
  if (registroSoloLectura(anterior) || anterior[campo] === valor) return anterior;
  return Object.freeze({...anterior, [campo]: valor});
}
export function ejecutarProtocoloSeguridad(activoId: string): void {
  console.info('[Simulación] ejecutarProtocoloSeguridad', activoId);
}

/** Compatibilidad de ingresos antiguos sin clasificar; no los convierte en Operativo. */
export function condicionPermiteSalida(condicion: string) {
  return ['operativo', 'bodega_ti', 'sin_verificar'].includes(condicion);
}
