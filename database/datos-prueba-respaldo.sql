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
DO $acta_ci$
DECLARE r jsonb;envio jsonb;
BEGIN
 IF to_regclass('public.actas_documentos') IS NOT NULL THEN
  r:=public.preparar_acta_acceso('felipe.silva@slepb.gob.cl','80000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',
   jsonb_build_object('entregaNombre','Persona ficticia de entrega','entregaRun','12345678-5','entregaCargo','Unidad de prueba','entregaCorreo','',
    'recibeRun','12345678-5','recibeCargo','UTIC ficticio','recibeCorreo','persona@example.org','accesorios','Cargador ficticio','observaciones','Acta ficticia para recuperación'));
  PERFORM public.completar_pdf_acta_acceso('felipe.silva@slepb.gob.cl','80000000-0000-4000-8000-000000000001',decode('255044462d312e330a25938c8b9e205265706f72744c61622047656e6572617465642050444620646f63756d656e7420286f70656e736f75726365290a312030206f626a0a3c3c0a2f46312032203020520a3e3e0a656e646f626a0a322030206f626a0a3c3c0a2f42617365466f6e74202f48656c766574696361202f456e636f64696e67202f57696e416e7369456e636f64696e67202f4e616d65202f4631202f53756274797065202f5479706531202f54797065202f466f6e740a3e3e0a656e646f626a0a332030206f626a0a3c3c0a2f436f6e74656e7473203720302052202f4d65646961426f78205b20302030203539352e32373536203834312e38383938205d202f506172656e74203620302052202f5265736f7572636573203c3c0a2f466f6e74203120302052202f50726f63536574205b202f504446202f54657874202f496d61676542202f496d61676543202f496d61676549205d0a3e3e202f526f746174652030202f5472616e73203c3c0a0a3e3e200a20202f54797065202f506167650a3e3e0a656e646f626a0a342030206f626a0a3c3c0a2f506167654d6f6465202f5573654e6f6e65202f5061676573203620302052202f54797065202f436174616c6f670a3e3e0a656e646f626a0a352030206f626a0a3c3c0a2f417574686f722028616e6f6e796d6f757329202f4372656174696f6e446174652028443a32303236313130343135343431362b30302730302729202f43726561746f722028616e6f6e796d6f757329202f4b6579776f726473202829202f4d6f64446174652028443a32303236313130343135343431362b30302730302729202f50726f647563657220285265706f72744c616220504446204c696272617279202d205c286f70656e736f757263655c2929200a20202f5375626a6563742028756e73706563696669656429202f5469746c652028756e7469746c656429202f54726170706564202f46616c73650a3e3e0a656e646f626a0a362030206f626a0a3c3c0a2f436f756e742031202f4b696473205b203320302052205d202f54797065202f50616765730a3e3e0a656e646f626a0a372030206f626a0a3c3c0a2f46696c746572205b202f415343494938354465636f6465202f466c6174654465636f6465205d202f4c656e677468203135350a3e3e0a73747265616d0a476170404630615b743a274c5f675d60404b4a4a396b365c2e3b284b683e4a61594e2a265b445e5f5c2b27295c4f62247163343b612c706e5c3b4c382d586841707060322d4c4c4f4d4c2b3e626c2f6a73342b6743452d2b575b466a40466b305b36223f67294d5c564d48375d3a2e512d2b6b5b5430276d563f55367357376d4a6d376d4c71423d322e34726151406837704170595e2d49727e3e656e6473747265616d0a656e646f626a0a787265660a3020380a303030303030303030302036353533352066200a30303030303030303631203030303030206e200a30303030303030303932203030303030206e200a30303030303030313939203030303030206e200a30303030303030343032203030303030206e200a30303030303030343730203030303030206e200a30303030303030373331203030303030206e200a30303030303030373930203030303030206e200a747261696c65720a3c3c0a2f4944200a5b3c33396331633337343635306265303463393836343064393636383737396563643e3c33396331633337343635306265303463393836343064393636383737396563643e5d0a25205265706f72744c61622067656e6572617465642050444620646f63756d656e74202d2d2064696765737420286f70656e736f75726365290a0a2f496e666f2035203020520a2f526f6f742034203020520a2f53697a6520380a3e3e0a7374617274787265660a313033350a2525454f460a','hex'));
  envio:=public.iniciar_envio_acta_acceso('felipe.silva@slepb.gob.cl','90000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000001',ARRAY['persona@example.org'],'no-responder@slepb.gob.cl',false);
  PERFORM public.terminar_envio_acta_acceso('90000000-0000-4000-8000-000000000001',(envio->>'token')::uuid,'fallido',jsonb_build_object('codigo','SIMULADO_SIN_ENVIO'));
 END IF;
END;
$acta_ci$;

DO $acta_historica_ci$
DECLARE bien uuid;entrega uuid;r jsonb;
BEGIN
 IF to_regprocedure('public.preparar_acta_entrega_acceso(text,uuid,uuid,jsonb)') IS NOT NULL THEN
  INSERT INTO public.sedes(id,tipo,nombre,rbd) VALUES('a0000000-0000-4000-8000-000000000001','jardin_infantil','Jardín ficticio de recuperación','CI-HIST-001');
  bien:=public.guardar_equipo_acceso('felipe.silva@slepb.gob.cl',jsonb_build_object('id','','sedeId','a0000000-0000-4000-8000-000000000001','categoriaId','30000000-0000-4000-8000-000000000001','marca','Marca ficticia','modelo','Histórico ficticio','serie','CI-HIST-SERIE','inventario','CI-HIST-INV','origen','compra_utic','condicionTecnica','sin_verificar'),0,'Alta histórica ficticia');
  PERFORM public.regularizar_entregas_acceso('felipe.silva@slepb.gob.cl','b0000000-0000-4000-8000-000000000001',jsonb_build_array(jsonb_build_object('sedeId','a0000000-0000-4000-8000-000000000001','equipos',jsonb_build_array(jsonb_build_object('id',bien,'version',1)),'fecha','2026-10-26','receptora','Receptora histórica ficticia','enlaceActa','')));
  SELECT id INTO entrega FROM public.entregas_equipos WHERE lote_id='b0000000-0000-4000-8000-000000000001';
  r:=public.preparar_acta_entrega_acceso('felipe.silva@slepb.gob.cl','c0000000-0000-4000-8000-000000000001',entrega,jsonb_build_object('entregaNombre','','entregaRun','','entregaCargo','','entregaCorreo','','recibeRun','','recibeCargo','','recibeCorreo','','accesorios','','observaciones','Acta histórica ficticia para comprobar recuperación'));
  -- PDF exclusivamente ficticio de la misma batería, sin servicios ni datos reales.
  PERFORM public.completar_pdf_acta_acceso('felipe.silva@slepb.gob.cl','c0000000-0000-4000-8000-000000000001',(SELECT pdf FROM public.actas_documentos WHERE id='80000000-0000-4000-8000-000000000001'));
 END IF;
END;
$acta_historica_ci$;

DO $prestamos_ci$
DECLARE eq uuid;meta jsonb;pdf_ficticio bytea;r jsonb;
BEGIN
 IF to_regclass('public.prestamos_inventario') IS NOT NULL THEN
  SELECT pdf INTO pdf_ficticio FROM public.actas_documentos WHERE id='80000000-0000-4000-8000-000000000001';
  meta:=jsonb_build_object('entregaNombre','UTIC ficticio de recuperación','entregaRun','','entregaCargo','UTIC','entregaCorreo','','recibeRun','','recibeCargo','Receptor ficticio','recibeCorreo','persona@example.org','accesorios','','observaciones','Solo prueba de recuperación');
  eq:=public.guardar_equipo_acceso('felipe.silva@slepb.gob.cl',jsonb_build_object('id','','sedeId','10000000-0000-4000-8000-000000000001','categoriaId','30000000-0000-4000-8000-000000000001','marca','Marca ficticia','modelo','Préstamo de recuperación','serie','CI-PRESTAMO-SERIE','inventario','CI-PRESTAMO-INV','origen','compra_utic','condicionTecnica','sin_verificar','custodiaInicial','en_bodega'),0,'Préstamo ficticio para recuperación');
  PERFORM public.mover_prestamo_acceso('felipe.silva@slepb.gob.cl','d1000000-0000-4000-8000-000000000001',jsonb_build_object('tipo','equipo','bienId',eq,'accion','prestamo','destino','50000000-0000-4000-8000-000000000001','fecha','2026-11-01','fechaLimite','2026-11-08','prestamoId','','version',1,'receptor','Persona prestataria ficticia','motivo',''));
  r:=public.preparar_acta_acceso('felipe.silva@slepb.gob.cl','e1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001',meta);
  PERFORM public.completar_pdf_acta_acceso('felipe.silva@slepb.gob.cl','e1000000-0000-4000-8000-000000000001',pdf_ficticio);
  PERFORM public.guardar_celular_acceso('felipe.silva@slepb.gob.cl','e0000000-0000-4000-8000-000000000002',jsonb_build_object('sedeId','10000000-0000-4000-8000-000000000001','telefono','+56900000002','marca','Marca ficticia','modelo','Préstamo celular recuperación','imei','','inventario','CI-PRESTAMO-CEL','condicionTecnica','sin_verificar','responsable','Uso original de recuperación','observaciones','','activo',true,'custodiaInicial','en_bodega'),0,'Celular ficticio para recuperación');
  PERFORM public.mover_prestamo_acceso('felipe.silva@slepb.gob.cl','d1000000-0000-4000-8000-000000000002',jsonb_build_object('tipo','celular','bienId','e0000000-0000-4000-8000-000000000002','accion','prestamo','destino','50000000-0000-4000-8000-000000000001','fecha','2026-11-01','fechaLimite','2026-11-08','prestamoId','','version',1,'receptor','Persona prestataria ficticia','motivo',''));
  r:=public.preparar_acta_acceso('felipe.silva@slepb.gob.cl','e1000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002',meta);
  PERFORM public.completar_pdf_acta_acceso('felipe.silva@slepb.gob.cl','e1000000-0000-4000-8000-000000000002',pdf_ficticio);
  PERFORM public.mover_prestamo_acceso('felipe.silva@slepb.gob.cl','d2000000-0000-4000-8000-000000000002',jsonb_build_object('tipo','celular','bienId','e0000000-0000-4000-8000-000000000002','accion','devolucion_prestamo','destino','','fecha','2026-11-02','fechaLimite','','prestamoId','d1000000-0000-4000-8000-000000000002','version',2,'receptor','UTIC ficticio que recibe','motivo',''));
  r:=public.preparar_acta_acceso('felipe.silva@slepb.gob.cl','e2000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000002',meta);
  PERFORM public.completar_pdf_acta_acceso('felipe.silva@slepb.gob.cl','e2000000-0000-4000-8000-000000000002',pdf_ficticio);
 END IF;
END;
$prestamos_ci$;

COMMIT;
