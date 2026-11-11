-- Se ejecuta únicamente en el contenedor nuevo de la prueba de recuperación.
BEGIN READ ONLY;

DO $verificar$
DECLARE
  tabla text;
  privilegio text;
BEGIN
  IF current_user <> 'inventario_app' THEN
    RAISE EXCEPTION 'La verificación debe ejecutarse como inventario_app.';
  END IF;
  IF to_regclass('public.equipos') IS NOT NULL THEN
    FOREACH tabla IN ARRAY ARRAY['equipos','equipos_historial','cargas_equipos'] LOOP
      IF NOT has_table_privilege(current_user,format('public.%I',tabla),'SELECT')
        OR has_table_privilege(current_user,format('public.%I',tabla),'INSERT')
        OR has_table_privilege(current_user,format('public.%I',tabla),'UPDATE')
        OR has_table_privilege(current_user,format('public.%I',tabla),'DELETE')
        OR has_table_privilege(current_user,format('public.%I',tabla),'TRUNCATE') THEN
        RAISE EXCEPTION 'Permisos incorrectos en las tablas de equipos restauradas';
      END IF;
    END LOOP;
    IF NOT has_function_privilege(current_user,'public.guardar_equipo_acceso(text,jsonb,integer,text,uuid)','EXECUTE')
      OR NOT has_function_privilege(current_user,'public.cargar_equipos_acceso(text,jsonb,text,text)','EXECUTE') THEN
      RAISE EXCEPTION 'Falta una función controlada del inventario restaurado';
    END IF;
  END IF;
  IF to_regclass('public.cambios_estados_activo') IS NOT NULL THEN
    IF NOT has_table_privilege(current_user,'public.cambios_estados_activo','SELECT') OR has_table_privilege(current_user,'public.cambios_estados_activo','INSERT') OR has_table_privilege(current_user,'public.cambios_estados_activo','UPDATE') OR has_table_privilege(current_user,'public.cambios_estados_activo','DELETE') OR NOT has_function_privilege(current_user,'public.guardar_estados_activo_acceso(text,uuid,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Permisos de estados restaurados incorrectos';END IF;
    IF (SELECT count(*) FROM pg_trigger WHERE tgname IN ('equipos_proteger_estados','celulares_proteger_estados') AND NOT tgisinternal AND tgenabled='O')<>2 THEN RAISE EXCEPTION 'Faltan guardas de estados restauradas';END IF;
  END IF;
  IF to_regclass('public.imagenes_insumos') IS NOT NULL THEN
    FOREACH tabla IN ARRAY ARRAY['catalogo_insumos','stock_insumos','solicitudes_insumos','solicitudes_insumos_detalle','reservas_insumos','entregas_insumos','insumos_historial','imagenes_insumos'] LOOP
      IF NOT has_table_privilege(current_user,format('public.%I',tabla),'SELECT') OR has_table_privilege(current_user,format('public.%I',tabla),'INSERT') OR has_table_privilege(current_user,format('public.%I',tabla),'UPDATE') OR has_table_privilege(current_user,format('public.%I',tabla),'DELETE') OR has_table_privilege(current_user,format('public.%I',tabla),'TRUNCATE') THEN RAISE EXCEPTION 'Permisos de insumos restaurados incorrectos';END IF;
    END LOOP;
    IF NOT has_function_privilege(current_user,'public.guardar_producto_insumo_acceso(text,uuid,jsonb)','EXECUTE') OR NOT has_function_privilege(current_user,'public.guardar_foto_insumo_acceso(text,uuid,text,bytea)','EXECUTE') OR NOT has_function_privilege(current_user,'public.importar_foto_insumo_acceso(text,uuid,uuid,text)','EXECUTE') OR has_function_privilege(current_user,'public.autorizar_insumos_utic(text)','EXECUTE') THEN RAISE EXCEPTION 'Funciones controladas de insumos restauradas incorrectas';END IF;
  END IF;
  IF to_regclass('public.ubicaciones_bodega') IS NOT NULL THEN
    FOREACH tabla IN ARRAY ARRAY['ubicaciones_bodega','ubicaciones_bodega_historial'] LOOP
      IF NOT has_table_privilege(current_user,format('public.%I',tabla),'SELECT') OR has_table_privilege(current_user,format('public.%I',tabla),'INSERT') OR has_table_privilege(current_user,format('public.%I',tabla),'UPDATE') OR has_table_privilege(current_user,format('public.%I',tabla),'DELETE') OR has_table_privilege(current_user,format('public.%I',tabla),'TRUNCATE') THEN RAISE EXCEPTION 'Permisos incorrectos de ubicaciones restauradas';END IF;
    END LOOP;
    IF NOT has_function_privilege(current_user,'public.ubicar_bien_bodega_acceso(text,uuid,jsonb)','EXECUTE') OR has_function_privilege(current_user,'public.limpiar_ubicacion_bodega()','EXECUTE') THEN RAISE EXCEPTION 'Funciones de ubicaciones restauradas incorrectas';END IF;
    IF (SELECT count(*) FROM pg_trigger WHERE tgname IN ('equipos_limpiar_ubicacion_bodega','celulares_limpiar_ubicacion_bodega') AND NOT tgisinternal AND tgenabled='O')<>2 THEN RAISE EXCEPTION 'Faltan guardas de ubicación restauradas';END IF;
  END IF;
  IF to_regclass('public.fotografias_sedes') IS NOT NULL THEN
    IF NOT has_table_privilege(current_user,'public.fotografias_sedes','SELECT') OR has_table_privilege(current_user,'public.fotografias_sedes','INSERT') OR has_table_privilege(current_user,'public.fotografias_sedes','UPDATE') OR has_table_privilege(current_user,'public.fotografias_sedes','DELETE') OR has_table_privilege(current_user,'public.fotografias_sedes','TRUNCATE') OR NOT has_function_privilege(current_user,'public.guardar_fotografia_sede_acceso(text,uuid,uuid,integer,text,bytea)','EXECUTE') THEN RAISE EXCEPTION 'Permisos de fotografías de sedes incorrectos';END IF;
  END IF;
  IF to_regclass('public.ingresos_insumos') IS NOT NULL THEN
    FOREACH tabla IN ARRAY ARRAY['ingresos_insumos','categorias_insumos_codigos'] LOOP
      IF NOT has_table_privilege(current_user,format('public.%I',tabla),'SELECT') OR has_table_privilege(current_user,format('public.%I',tabla),'INSERT') OR has_table_privilege(current_user,format('public.%I',tabla),'UPDATE') OR has_table_privilege(current_user,format('public.%I',tabla),'DELETE') OR has_table_privilege(current_user,format('public.%I',tabla),'TRUNCATE') THEN RAISE EXCEPTION 'Permisos incorrectos de compras restauradas';END IF;
    END LOOP;
    IF NOT has_function_privilege(current_user,'public.registrar_compra_insumo_acceso(text,uuid,jsonb)','EXECUTE') OR has_function_privilege(current_user,'public.asegurar_categoria_insumo(text)','EXECUTE') OR has_function_privilege(current_user,'public.conservar_codigo_insumo()','EXECUTE') THEN RAISE EXCEPTION 'Funciones de compras restauradas incorrectas';END IF;
  END IF;
  IF to_regclass('public.actas_documentos') IS NOT NULL THEN
    FOREACH tabla IN ARRAY ARRAY['actas_contador','actas_documentos','actas_envios'] LOOP
      IF NOT has_table_privilege(current_user,format('public.%I',tabla),'SELECT') OR has_table_privilege(current_user,format('public.%I',tabla),'INSERT') OR has_table_privilege(current_user,format('public.%I',tabla),'UPDATE') OR has_table_privilege(current_user,format('public.%I',tabla),'DELETE') THEN RAISE EXCEPTION 'Permisos de actas incorrectos';END IF;
    END LOOP;
    IF NOT has_function_privilege(current_user,'public.preparar_acta_acceso(text,uuid,uuid,jsonb)','EXECUTE') OR NOT has_function_privilege(current_user,'public.completar_pdf_acta_acceso(text,uuid,bytea)','EXECUTE') OR NOT has_function_privilege(current_user,'public.iniciar_envio_acta_acceso(text,uuid,uuid,text[],text,boolean)','EXECUTE') THEN RAISE EXCEPTION 'Faltan funciones controladas de actas';END IF;
  END IF;
  IF to_regclass('public.operaciones_inventario') IS NOT NULL THEN
    FOREACH tabla IN ARRAY ARRAY['operaciones_inventario','operaciones_inventario_detalle'] LOOP
      IF NOT has_table_privilege(current_user,format('public.%I',tabla),'SELECT') OR has_table_privilege(current_user,format('public.%I',tabla),'INSERT') OR has_table_privilege(current_user,format('public.%I',tabla),'UPDATE') OR has_table_privilege(current_user,format('public.%I',tabla),'DELETE') OR has_table_privilege(current_user,format('public.%I',tabla),'TRUNCATE') THEN RAISE EXCEPTION 'Permisos de operaciones compuestas incorrectos';END IF;
    END LOOP;
    IF NOT has_function_privilege(current_user,'public.mover_operacion_acceso(text,uuid,jsonb)','EXECUTE') OR NOT has_function_privilege(current_user,'public.preparar_acta_operacion_acceso(text,uuid,uuid,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Faltan funciones controladas de operaciones';END IF;
    IF EXISTS(SELECT 1 FROM public.operaciones_inventario_detalle d JOIN public.movimientos_inventario m ON m.id=d.movimiento_id JOIN public.operaciones_inventario o ON o.id=d.operacion_id WHERE (d.grupo='devolucion' AND (o.tipo<>'cambio' OR m.accion<>'devolucion')) OR (d.grupo='entrega' AND m.accion<>CASE WHEN o.directa THEN 'traspaso' ELSE 'asignacion' END)) THEN RAISE EXCEPTION 'Detalle y ruta de operación incoherentes';END IF;
    IF EXISTS(SELECT 1 FROM public.actas_documentos a WHERE a.operacion_id IS NOT NULL AND (a.datos->>'operacionId' IS DISTINCT FROM a.operacion_id::text OR a.sha256 IS DISTINCT FROM encode(sha256(a.pdf),'hex'))) THEN RAISE EXCEPTION 'Acta compuesta no conserva fuente o PDF';END IF;
  END IF;
  IF to_regclass('public.prestamos_inventario') IS NOT NULL THEN
    IF NOT has_table_privilege(current_user,'public.prestamos_inventario','SELECT') OR has_table_privilege(current_user,'public.prestamos_inventario','INSERT') OR has_table_privilege(current_user,'public.prestamos_inventario','UPDATE') OR has_table_privilege(current_user,'public.prestamos_inventario','DELETE') OR has_table_privilege(current_user,'public.prestamos_inventario','TRUNCATE') THEN RAISE EXCEPTION 'Permisos de préstamos incorrectos';END IF;
    IF NOT has_function_privilege(current_user,'public.mover_prestamo_acceso(text,uuid,jsonb)','EXECUTE') OR has_function_privilege(current_user,'public.preparar_acta_movimiento_base(text,uuid,uuid,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Funciones controladas de préstamos incorrectas';END IF;
    IF EXISTS(SELECT 1 FROM public.prestamos_inventario p LEFT JOIN public.equipos e ON e.id=p.equipo_id LEFT JOIN public.celulares c ON c.id=p.celular_id WHERE p.estado='abierto' AND (COALESCE(e.custodia,c.custodia) IS DISTINCT FROM 'en_prestamo' OR COALESCE(e.sede_id,c.sede_id) IS DISTINCT FROM p.origen_sede_id)) THEN RAISE EXCEPTION 'Préstamo activo con custodia o pertenencia incoherente';END IF;
    IF EXISTS(SELECT 1 FROM public.equipos e WHERE e.custodia='en_prestamo' AND NOT EXISTS(SELECT 1 FROM public.prestamos_inventario p WHERE p.equipo_id=e.id AND p.estado='abierto')) OR EXISTS(SELECT 1 FROM public.celulares c WHERE c.custodia='en_prestamo' AND NOT EXISTS(SELECT 1 FROM public.prestamos_inventario p WHERE p.celular_id=c.id AND p.estado='abierto')) THEN RAISE EXCEPTION 'Bien prestado sin préstamo activo';END IF;
  END IF;
  IF to_regclass('public.movimientos_inventario') IS NOT NULL THEN
    IF NOT has_table_privilege(current_user,'public.movimientos_inventario','SELECT') OR has_table_privilege(current_user,'public.movimientos_inventario','INSERT') OR has_table_privilege(current_user,'public.movimientos_inventario','UPDATE') OR has_table_privilege(current_user,'public.movimientos_inventario','DELETE') THEN RAISE EXCEPTION 'Permisos de movimientos incorrectos';END IF;
    IF NOT has_function_privilege(current_user,'public.mover_bien_acceso(text,uuid,jsonb)','EXECUTE') OR has_function_privilege(current_user,'public.guardar_celular_ficha_base(text,uuid,jsonb,integer,text)','EXECUTE') OR has_function_privilege(current_user,'public.guardar_equipo_ficha_base(text,jsonb,integer,text,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Funciones controladas de custodia incorrectas';END IF;
  END IF;
  IF to_regclass('public.celulares') IS NOT NULL THEN
    FOREACH tabla IN ARRAY ARRAY['celulares','celulares_historial'] LOOP
      IF NOT has_table_privilege(current_user,format('public.%I',tabla),'SELECT')
       OR has_table_privilege(current_user,format('public.%I',tabla),'INSERT')
       OR has_table_privilege(current_user,format('public.%I',tabla),'UPDATE')
       OR has_table_privilege(current_user,format('public.%I',tabla),'DELETE')
       OR has_table_privilege(current_user,format('public.%I',tabla),'TRUNCATE') THEN
        RAISE EXCEPTION 'Permisos incorrectos en celulares restaurados';
      END IF;
    END LOOP;
    IF NOT has_function_privilege(current_user,'public.guardar_celular_acceso(text,uuid,jsonb,integer,text)','EXECUTE') THEN
      RAISE EXCEPTION 'Falta la función controlada de celulares restaurada';
    END IF;
  END IF;
  IF to_regclass('public.funcionarios_nc') IS NOT NULL THEN
    FOREACH tabla IN ARRAY ARRAY['funcionarios_nc','funcionarios_nc_historial'] LOOP
      IF NOT has_table_privilege(current_user,format('public.%I',tabla),'SELECT')
       OR has_table_privilege(current_user,format('public.%I',tabla),'INSERT')
       OR has_table_privilege(current_user,format('public.%I',tabla),'UPDATE')
       OR has_table_privilege(current_user,format('public.%I',tabla),'DELETE')
       OR has_table_privilege(current_user,format('public.%I',tabla),'TRUNCATE') THEN
        RAISE EXCEPTION 'Permisos incorrectos en funcionarios restaurados';
      END IF;
    END LOOP;
    IF NOT has_function_privilege(current_user,'public.guardar_funcionario_nc_acceso(text,uuid,jsonb,integer,text)','EXECUTE') THEN
      RAISE EXCEPTION 'Falta la función controlada de funcionarios restaurada';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.funcionarios_nc_historial'::regclass AND contype='f' AND convalidated AND confrelid='public.funcionarios_nc'::regclass) THEN
      RAISE EXCEPTION 'Falta la relación de funcionarios e historial';
    END IF;
  END IF;
  IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.directorio_sedes') AND attname='nombres' AND NOT attisdropped) THEN
    IF NOT has_function_privilege(current_user,'public.guardar_sede_directorio_acceso(text,uuid,jsonb,text,text)','EXECUTE') THEN
      RAISE EXCEPTION 'Falta la escritura controlada del directorio de sedes restaurado';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = current_user
      AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'El usuario de aplicación tiene privilegios administrativos.';
  END IF;
  IF has_schema_privilege(current_user, 'public', 'CREATE') THEN
    RAISE EXCEPTION 'El usuario de aplicación puede crear objetos en public.';
  END IF;
  IF has_database_privilege(current_user, current_database(), 'CREATE') THEN
    RAISE EXCEPTION 'El usuario de aplicación puede crear esquemas en la base.';
  END IF;

  IF to_regprocedure('public.guardar_sede_acceso(text,uuid,jsonb)') IS NOT NULL THEN
    -- Copia del modelo actual: los catálogos se operan solo con funciones.
    FOREACH tabla IN ARRAY ARRAY['sedes', 'dependencias', 'categorias_bienes'] LOOP
      IF to_regclass(format('public.%I', tabla)) IS NULL THEN
        RAISE EXCEPTION 'Falta una tabla del catálogo restaurado.';
      END IF;
      IF NOT has_table_privilege(current_user, format('public.%I', tabla), 'SELECT')
        OR has_table_privilege(current_user, format('public.%I', tabla), 'INSERT')
        OR has_table_privilege(current_user, format('public.%I', tabla), 'UPDATE')
        OR has_table_privilege(current_user, format('public.%I', tabla), 'DELETE')
        OR has_table_privilege(current_user, format('public.%I', tabla), 'TRUNCATE') THEN
        RAISE EXCEPTION 'Permisos de catálogos incorrectos en la copia restaurada.';
      END IF;
    END LOOP;
    IF NOT has_function_privilege(current_user, 'public.guardar_sede_acceso(text,uuid,jsonb)', 'EXECUTE')
      OR NOT has_function_privilege(current_user, 'public.guardar_dependencia_acceso(text,uuid,uuid,text,boolean)', 'EXECUTE')
      OR NOT has_function_privilege(current_user, 'public.guardar_categoria_acceso(text,uuid,text,boolean)', 'EXECUTE') THEN
      RAISE EXCEPTION 'Faltan las funciones controladas de catálogos en la copia.';
    END IF;
  ELSE
    -- Copia del formato anterior: escritura directa permitida para el usuario de aplicación.
    FOREACH tabla IN ARRAY ARRAY['sedes', 'dependencias', 'categorias_bienes'] LOOP
      IF to_regclass(format('public.%I', tabla)) IS NULL THEN
        RAISE EXCEPTION 'Falta una tabla del catálogo restaurado.';
      END IF;
      FOREACH privilegio IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE'] LOOP
        IF NOT has_table_privilege(current_user, format('public.%I', tabla), privilegio) THEN
          RAISE EXCEPTION 'Falta un permiso requerido del usuario de aplicación.';
        END IF;
      END LOOP;
      IF has_table_privilege(current_user, format('public.%I', tabla), 'DELETE')
          OR has_table_privilege(current_user, format('public.%I', tabla), 'TRUNCATE') THEN
        RAISE EXCEPTION 'El usuario de aplicación tiene permisos de borrado.';
      END IF;
    END LOOP;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.dependencias'::regclass
      AND conname = 'dependencias_sede_id_fkey' AND contype = 'f' AND convalidated
      AND confrelid = 'public.sedes'::regclass
  ) THEN
    RAISE EXCEPTION 'Falta la relación validada entre dependencias y sedes.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_index
    WHERE indexrelid = to_regclass('public.dependencias_sede_nombre_unico')
      AND indisunique AND indisvalid
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_index
    WHERE indexrelid = to_regclass('public.categorias_bienes_nombre_unico')
      AND indisunique AND indisvalid
  ) THEN
    RAISE EXCEPTION 'Falta un índice único requerido en los catálogos.';
  END IF;
END;
$verificar$;

-- En CI se comprueba también que los datos ficticios sobrevivieron a la copia.
\if :validar_datos_ci
DO $datos_ci$
BEGIN
  IF to_regprocedure('public.preparar_acta_entrega_acceso(text,uuid,uuid,jsonb)') IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.actas_documentos a JOIN public.entregas_equipos e ON e.id=a.entrega_id JOIN public.entregas_detalle d ON d.entrega_id=e.id WHERE a.id='c0000000-0000-4000-8000-000000000001' AND a.movimiento_id IS NULL AND a.datos->>'tipo'='entrega_historica' AND a.datos->>'fecha'='2026-10-26' AND a.datos->>'receptorNombre'='Receptora histórica ficticia' AND a.datos->'metadata'->>'entregaRun'='' AND a.datos->'bienes'->0->>'serie'='CI-HIST-SERIE' AND e.receptor_nombre='Receptora histórica ficticia' AND d.despues->>'serie'='CI-HIST-SERIE' AND a.sha256=encode(sha256(a.pdf),'hex')) THEN RAISE EXCEPTION 'No se recuperaron la fuente histórica, los bienes originales y el PDF conservado';END IF;
  END IF;
  IF to_regclass('public.prestamos_inventario') IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.prestamos_inventario p JOIN public.equipos e ON e.id=p.equipo_id JOIN public.actas_documentos a ON a.movimiento_id=p.id WHERE p.id='d1000000-0000-4000-8000-000000000001' AND p.estado='abierto' AND p.fecha_limite=DATE '2026-11-08' AND p.movimiento_devolucion_id IS NULL AND e.custodia='en_prestamo' AND e.sede_id='10000000-0000-4000-8000-000000000001' AND e.serie='CI-PRESTAMO-SERIE' AND a.id='e1000000-0000-4000-8000-000000000001' AND a.datos->>'tipo'='prestamo' AND a.sha256=encode(sha256(a.pdf),'hex')) THEN RAISE EXCEPTION 'No se recuperó préstamo abierto, pertenencia o acta de salida';END IF;
    IF NOT EXISTS(SELECT 1 FROM public.prestamos_inventario p JOIN public.celulares c ON c.id=p.celular_id JOIN public.actas_documentos a ON a.movimiento_id=p.id JOIN public.actas_documentos d ON d.movimiento_id=p.movimiento_devolucion_id WHERE p.id='d1000000-0000-4000-8000-000000000002' AND p.estado='devuelto' AND p.fecha_devolucion=DATE '2026-11-02' AND p.movimiento_devolucion_id='d2000000-0000-4000-8000-000000000002' AND c.custodia='en_bodega' AND c.sede_id='10000000-0000-4000-8000-000000000001' AND c.responsable='Uso original de recuperación' AND a.id='e1000000-0000-4000-8000-000000000002' AND d.id='e2000000-0000-4000-8000-000000000002' AND d.datos->>'tipo'='devolucion_prestamo' AND (d.datos->>'folioPrestamo')::bigint=a.folio AND a.sha256=encode(sha256(a.pdf),'hex') AND d.sha256=encode(sha256(d.pdf),'hex')) THEN RAISE EXCEPTION 'No se recuperó préstamo devuelto, retorno vinculado o sus dos actas';END IF;
  END IF;
  IF to_regclass('public.operaciones_inventario') IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.operaciones_inventario o JOIN public.operaciones_inventario_detalle d ON d.operacion_id=o.id JOIN public.movimientos_inventario m ON m.id=d.movimiento_id JOIN public.equipos e ON e.id=m.equipo_id JOIN public.actas_documentos a ON a.operacion_id=o.id WHERE o.id='f1000000-0000-4000-8000-000000000001' AND o.tipo='traspaso' AND o.directa AND d.grupo='entrega' AND m.accion='traspaso' AND e.serie='CI-OPERACION-SERIE' AND e.sede_id='a0000000-0000-4000-8000-000000000001' AND a.id='f3000000-0000-4000-8000-000000000001' AND a.movimiento_id IS NULL AND a.entrega_id IS NULL AND a.datos->>'tipo'='traspaso' AND a.datos->>'ruta'='directa' AND jsonb_array_length(a.datos->'bienes')=1 AND a.sha256=encode(sha256(a.pdf),'hex')) THEN RAISE EXCEPTION 'No se recuperaron operación compuesta, detalle, traspaso directo o acta compartida';END IF;
  END IF;
  IF to_regclass('public.actas_documentos') IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.actas_documentos a JOIN public.actas_envios e ON e.acta_id=a.id
      WHERE a.id='80000000-0000-4000-8000-000000000001' AND a.movimiento_id='70000000-0000-4000-8000-000000000001'
       AND a.folio=(a.datos->>'folio')::bigint AND a.version=1 AND octet_length(a.pdf)>100 AND a.sha256=encode(sha256(a.pdf),'hex')
       AND a.datos->'metadata'->>'entregaNombre'='Persona ficticia de entrega' AND a.datos->'metadata'->>'recibeCorreo'='persona@example.org'
       AND e.id='90000000-0000-4000-8000-000000000001' AND e.estado='fallido' AND e.resultado->>'codigo'='SIMULADO_SIN_ENVIO') THEN RAISE EXCEPTION 'No se recuperaron el PDF, folio, datos e historial de envío del acta ficticia';END IF;
    IF (SELECT ultimo FROM public.actas_contador)<(SELECT max(folio) FROM public.actas_documentos) THEN RAISE EXCEPTION 'El contador restaurado no conserva los folios';END IF;
  END IF;
  IF to_regclass('public.movimientos_inventario') IS NOT NULL THEN
    IF (SELECT count(*) FROM public.movimientos_inventario WHERE id IN('70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002') AND accion='devolucion' AND antes->>'custodia'='asignado' AND despues->>'custodia'='en_bodega')<>2 OR NOT EXISTS(SELECT 1 FROM public.equipos e JOIN public.equipos_historial h ON h.equipo_id=e.id WHERE h.movimiento_id='70000000-0000-4000-8000-000000000001' AND e.custodia='en_bodega' AND e.version=2) OR NOT EXISTS(SELECT 1 FROM public.celulares c JOIN public.celulares_historial h ON h.celular_id=c.id WHERE h.movimiento_id='70000000-0000-4000-8000-000000000002' AND c.custodia='en_bodega' AND c.version=2) THEN RAISE EXCEPTION 'No se recuperaron custodia, movimientos e historial de ambos tipos de bien';END IF;
  END IF;
  IF to_regclass('public.equipos') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.equipos e JOIN public.equipos_historial h ON h.equipo_id=e.id
      WHERE e.serie='CI-RECUPERACION-SERIE-001' AND e.numero_inventario='CI-RECUPERACION-INV-001'
        AND e.sede_id='10000000-0000-4000-8000-000000000001'
        AND h.actor='felipe.silva@slepb.gob.cl' AND h.antes IS NULL
        AND h.despues->>'serie'=e.serie
    ) THEN
      RAISE EXCEPTION 'No se recuperó el equipo ficticio y su historial';
    END IF;
  END IF;
  IF to_regclass('public.funcionarios_nc') IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.funcionarios_nc f JOIN public.funcionarios_nc_historial h ON h.funcionario_id=f.id
     WHERE f.id='40000000-0000-4000-8000-000000000001' AND f.nombre='Persona ficticia O''Higgins'
      AND NOT f.activo AND f.fecha_ingreso=DATE '2026-10-30' AND f.rut IS NULL AND f.correo IS NULL
      AND h.antes IS NULL AND h.despues->>'nombre'=f.nombre AND h.actor='felipe.silva@slepb.gob.cl') THEN
      RAISE EXCEPTION 'No se recuperó la ficha ficticia y su historial';
    END IF;
  END IF;
  IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.directorio_sedes') AND attname='nombres' AND NOT attisdropped) THEN
    IF NOT EXISTS(SELECT 1 FROM public.directorio_sedes d JOIN public.directorio_historial h ON h.sede_id=d.sede_id
      WHERE d.sede_id='50000000-0000-4000-8000-000000000001' AND d.nombres='Ana María' AND d.apellidos='O''Higgins de Ejemplo'
       AND d.nombre='Ana María O''Higgins de Ejemplo' AND d.situacion='subrogante' AND h.despues->>'apellidos'=d.apellidos) THEN
      RAISE EXCEPTION 'No se recuperó el directorio ficticio con nombres, apellidos e historial';
    END IF;
  END IF;
  IF to_regclass('public.celulares') IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.celulares c JOIN public.celulares_historial h ON h.celular_id=c.id
     WHERE c.id='60000000-0000-4000-8000-000000000001' AND c.telefono='+56900000001' AND c.numero_inventario='CI-CELULAR-001'
      AND c.activo AND h.antes IS NULL AND h.despues->>'telefono'=c.telefono AND h.actor='felipe.silva@slepb.gob.cl') THEN
      RAISE EXCEPTION 'No se recuperó el celular ficticio con su número e historial';
    END IF;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.sedes
    WHERE id = '10000000-0000-4000-8000-000000000001'
      AND nombre = 'Sede de prueba de recuperación' AND tipo = 'nivel_central'
      AND rbd IS NULL AND activo
  ) OR NOT EXISTS (
    SELECT 1 FROM public.dependencias
    WHERE id = '20000000-0000-4000-8000-000000000001'
      AND sede_id = '10000000-0000-4000-8000-000000000001'
      AND nombre = 'Dirección O''Higgins' AND NOT activo
  ) OR NOT EXISTS (
    SELECT 1 FROM public.categorias_bienes
    WHERE id = '30000000-0000-4000-8000-000000000001'
      AND nombre = 'Equipos de prueba de respaldo' AND activo
  ) THEN
    RAISE EXCEPTION 'Los datos ficticios no se recuperaron correctamente.';
  END IF;
  IF to_regclass('public.cambios_estados_activo') IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.equipos e JOIN public.cambios_estados_activo h ON h.equipo_id=e.id WHERE e.serie='CI-ESTADOS-SERIE' AND e.estado_administrativo='dado_de_baja' AND e.condicion_tecnica='obsoleto' AND e.fecha_baja IS NOT NULL AND h.id='f5000000-0000-4000-8000-000000000001' AND h.antes->>'condicion_tecnica'='sin_verificar' AND h.despues->>'estado_administrativo'='dado_de_baja') OR NOT EXISTS(SELECT 1 FROM public.celulares c JOIN public.cambios_estados_activo h ON h.celular_id=c.id WHERE c.id='f4000000-0000-4000-8000-000000000002' AND c.estado_administrativo='robado' AND c.condicion_tecnica='' AND h.id='f5000000-0000-4000-8000-000000000002') THEN
      RAISE EXCEPTION 'No se recuperaron estados, histórico de baja y auditoría de transición';
    END IF;
  END IF;
  IF to_regclass('public.ubicaciones_bodega') IS NOT NULL THEN
    IF (SELECT count(*) FROM public.ubicaciones_bodega)<>5 OR NOT EXISTS(SELECT 1 FROM public.equipos WHERE serie='CI-BODEGA-PERSISTENCIA' AND ubicacion_bodega_id='b0de0000-0000-4000-8000-000000000003' AND custodia='en_bodega' AND sede_id='10000000-0000-4000-8000-000000000001') OR NOT EXISTS(SELECT 1 FROM public.celulares WHERE id='bc000000-0000-4000-8000-000000000002' AND ubicacion_bodega_id='b0de0000-0000-4000-8000-000000000005' AND estado_administrativo='activo' AND condicion_tecnica='operativo') OR (SELECT count(*) FROM public.ubicaciones_bodega_historial WHERE id IN ('bb000000-0000-4000-8000-000000000001','bb000000-0000-4000-8000-000000000002') AND antes->>'ubicacion_bodega_id' IS NULL AND despues->>'ubicacion_bodega_id' IS NOT NULL)<>2 THEN RAISE EXCEPTION 'No se recuperaron las ubicaciones e historial de los bienes';END IF;
  END IF;
  IF to_regclass('public.fotografias_sedes') IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.fotografias_sedes WHERE id='be700000-0000-4000-8000-000000000002' AND sede_id='be700000-0000-4000-8000-000000000001' AND version=1 AND mime='image/png' AND actor='felipe.silva@slepb.gob.cl' AND contenido=decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jE1sAAAAASUVORK5CYII=','base64')) THEN RAISE EXCEPTION 'No se recuperó la fotografía de sede';END IF;
  END IF;
  IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.usuarios_acceso'::regclass AND conname='usuarios_acceso_rol_check' AND pg_get_constraintdef(oid) LIKE '%gestor_insumos%') AND NOT EXISTS(SELECT 1 FROM public.usuarios_acceso WHERE correo='ci-gestor-recuperacion@slepb.gob.cl' AND rol='gestor_insumos' AND sede_id IS NULL AND activo) THEN RAISE EXCEPTION 'No se recuperó el perfil gestor de insumos';END IF;
  IF to_regclass('public.ingresos_insumos') IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.ingresos_insumos WHERE id='bd000000-0000-4000-8000-000000000001' AND clase='compra' AND cantidad=2 AND oc='OC-CI-RECUPERACION' AND fecha_compra='2026-11-01' AND producto->>'codigo'='CI-INSUMO-RECUPERACION') OR NOT EXISTS(SELECT 1 FROM public.ingresos_insumos i JOIN public.catalogo_insumos c ON c.id=i.producto_id JOIN public.categorias_insumos_codigos cat ON cat.clave=c.categoria_codigo WHERE i.id='bd000000-0000-4000-8000-000000000002' AND c.codigo ~ '^PRU[0-9]*-[0-9]{6,}$' AND cat.ultimo>=1 AND i.cantidad=3 AND i.oc='OC-CI-AUTOMATICO') THEN RAISE EXCEPTION 'No se recuperaron las compras, OC y correlativos';END IF;
  END IF;
  IF to_regclass('public.imagenes_insumos') IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM public.catalogo_insumos c JOIN public.stock_insumos st ON st.producto_id=c.id WHERE c.codigo='CI-INSUMO-RECUPERACION' AND c.foto_url='/api/insumos/imagen?id=a8000000-0000-4000-8000-000000000001' AND st.existencia=CASE WHEN to_regclass('public.ingresos_insumos') IS NULL THEN 7 ELSE 9 END AND st.reservado=2) OR NOT EXISTS(SELECT 1 FROM public.imagenes_insumos WHERE id='a8000000-0000-4000-8000-000000000001' AND mime='image/png' AND octet_length(contenido)=68) OR NOT EXISTS(SELECT 1 FROM public.actas_documentos a JOIN public.entregas_insumos e ON e.id=a.entrega_insumo_id WHERE a.id='aa000000-0000-4000-8000-000000000001' AND e.acta_id=a.id AND a.datos->'bienes'->0->>'unidad'='caja' AND a.datos->'bienes'->0->>'cantidad_entregada'='3' AND a.sha256=encode(sha256(a.pdf),'hex')) THEN
      RAISE EXCEPTION 'No se recuperaron stock, foto persistente o acta de insumos';
    END IF;
  END IF;
END;
$datos_ci$;
\endif

SELECT
  (SELECT count(*) FROM public.sedes) AS sedes,
  (SELECT count(*) FROM public.dependencias) AS dependencias,
  (SELECT count(*) FROM public.categorias_bienes) AS categorias;

ROLLBACK;
