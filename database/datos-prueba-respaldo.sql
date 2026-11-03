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

-- La recuperación del módulo nuevo también debe conservar un equipo y su historia.
DO $equipo_ci$
BEGIN
  IF to_regclass('public.equipos') IS NOT NULL THEN
    PERFORM public.guardar_equipo_acceso('felipe.silva@slepb.gob.cl',jsonb_build_object(
      'id','','sedeId','10000000-0000-4000-8000-000000000001',
      'categoriaId','30000000-0000-4000-8000-000000000001',
      'marca','Marca ficticia de recuperación','modelo','Modelo ficticio de recuperación',
      'serie','CI-RECUPERACION-SERIE-001','inventario','CI-RECUPERACION-INV-001',
      'origen','compra_utic','condicionTecnica','sin_verificar'),0,'Equipo ficticio para comprobar recuperación');
  END IF;
END;
$equipo_ci$;

DO $funcionario_ci$
BEGIN
 IF to_regclass('public.funcionarios_nc') IS NOT NULL THEN
  PERFORM public.guardar_funcionario_nc_acceso('felipe.silva@slepb.gob.cl','40000000-0000-4000-8000-000000000001',
   jsonb_build_object('nombre','Persona ficticia O''Higgins','rut','','correo','','unidad','Unidad de recuperación',
    'subdireccion','Subdirección de prueba','cargo','Cargo ficticio','fechaIngreso','2026-10-30','activo',false),0,'Ficha ficticia para recuperación');
 END IF;
END;
$funcionario_ci$;

COMMIT;
