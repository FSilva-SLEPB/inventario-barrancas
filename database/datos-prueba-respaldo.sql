-- Datos ficticios exclusivos de la base temporal de GitHub Actions.
BEGIN;

INSERT INTO public.sedes (id, tipo, nombre, activo)
VALUES (
  '10000000-0000-4000-8000-000000000001',
  'nivel_central', 'Sede de prueba de recuperación', true
);

INSERT INTO public.dependencias (id, sede_id, nombre, activo)
VALUES (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Dirección O''Higgins', false
);

INSERT INTO public.categorias_bienes (id, nombre, activo)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  'Equipos de prueba de respaldo', true
);

COMMIT;
