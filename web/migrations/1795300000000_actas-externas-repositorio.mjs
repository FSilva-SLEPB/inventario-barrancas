export const shorthands = undefined;
export async function up(pgm) {
  pgm.sql(`
    ALTER TABLE public.actas_documentos ADD COLUMN IF NOT EXISTS solicitud_insumo_id uuid;
    ALTER TABLE public.actas_documentos ADD COLUMN IF NOT EXISTS entrega_insumo_id uuid;
    ALTER TABLE public.actas_documentos ADD COLUMN IF NOT EXISTS origen_externo boolean NOT NULL DEFAULT false;
    ALTER TABLE public.actas_documentos ADD COLUMN IF NOT EXISTS archivo_nombre text;
    ALTER TABLE public.actas_documentos DROP CONSTRAINT IF EXISTS actas_fuente_unica;
    ALTER TABLE public.actas_documentos ADD CONSTRAINT actas_fuente_unica CHECK (
      (origen_externo AND num_nonnulls(movimiento_id, entrega_id, operacion_id, entrega_insumo_id, solicitud_insumo_id) = 0)
      OR (NOT origen_externo AND movimiento_id IS NOT NULL AND num_nonnulls(entrega_id, operacion_id, entrega_insumo_id, solicitud_insumo_id) = 0)
      OR (NOT origen_externo AND entrega_id IS NOT NULL AND num_nonnulls(movimiento_id, operacion_id, entrega_insumo_id, solicitud_insumo_id) = 0)
      OR (NOT origen_externo AND operacion_id IS NOT NULL AND num_nonnulls(movimiento_id, entrega_id, entrega_insumo_id, solicitud_insumo_id) = 0)
      OR (NOT origen_externo AND solicitud_insumo_id IS NOT NULL AND num_nonnulls(movimiento_id, entrega_id, operacion_id) = 0)
      OR (NOT origen_externo AND entrega_insumo_id IS NOT NULL AND solicitud_insumo_id IS NULL AND num_nonnulls(movimiento_id, entrega_id, operacion_id) = 0)
    );
  `);
}
export async function down(pgm) {
  pgm.sql(`ALTER TABLE public.actas_documentos DROP CONSTRAINT IF EXISTS actas_fuente_unica;`);
}
