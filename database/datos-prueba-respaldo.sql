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

DO $directorio_ci$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.directorio_sedes') AND attname='nombres' AND NOT attisdropped) THEN
  INSERT INTO public.sedes(id,tipo,nombre,rbd) VALUES('50000000-0000-4000-8000-000000000001','establecimiento','Establecimiento ficticio de recuperación','CI-RECUPERACION-EE');
  PERFORM public.guardar_ficha_directorio_acceso('felipe.silva@slepb.gob.cl','50000000-0000-4000-8000-000000000001',
   jsonb_build_object('nombre','Ana María O''Higgins de Ejemplo','nombres','Ana María','apellidos','O''Higgins de Ejemplo',
    'rut','','correo','persona@example.org','situacion','subrogante','observaciones','',
    'sedeNombre','Establecimiento ficticio de recuperación','direccion','Calle ficticia','comuna','Comuna ficticia','correoInstitucional','sede@example.org'),
   0,jsonb_build_array('Establecimiento ficticio de recuperación','','','')::text,'Directorio ficticio para recuperación');
 END IF;
END;
$directorio_ci$;

DO $celular_ci$
BEGIN
 IF to_regclass('public.celulares') IS NOT NULL THEN
  PERFORM public.guardar_celular_acceso('felipe.silva@slepb.gob.cl','60000000-0000-4000-8000-000000000001',
   jsonb_build_object('sedeId','10000000-0000-4000-8000-000000000001','telefono','+56900000001','marca','Marca ficticia','modelo','Modelo ficticio','imei','','inventario','CI-CELULAR-001','condicionTecnica','sin_verificar','responsable','Uso de recuperación ficticio','observaciones','','activo',true),0,'Celular ficticio para recuperación');
 END IF;
END;
$celular_ci$;

DO $movimientos_ci$
DECLARE bien uuid;
BEGIN
 IF to_regclass('public.movimientos_inventario') IS NOT NULL THEN
  SELECT id INTO bien FROM public.equipos WHERE serie='CI-RECUPERACION-SERIE-001';
  PERFORM public.mover_bien_acceso('felipe.silva@slepb.gob.cl','70000000-0000-4000-8000-000000000001',
   jsonb_build_object('tipo','equipo','bienId',bien,'accion','devolucion','destino','','fecha','2026-11-01','receptor','UTIC ficticio','motivo','Devolución ficticia de recuperación','version',1));
  PERFORM public.mover_bien_acceso('felipe.silva@slepb.gob.cl','70000000-0000-4000-8000-000000000002',
   jsonb_build_object('tipo','celular','bienId','60000000-0000-4000-8000-000000000001','accion','devolucion','destino','','fecha','2026-11-01','receptor','UTIC ficticio','motivo','Devolución ficticia de recuperación','version',1));
 END IF;
END;
$movimientos_ci$;
COMMIT;
