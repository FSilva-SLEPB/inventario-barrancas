export function up(pgm){pgm.sql(`
ALTER TABLE public.equipos DROP CONSTRAINT equipos_custodia_check;
ALTER TABLE public.equipos ADD CONSTRAINT equipos_custodia_check CHECK(custodia IN ('en_bodega','asignado','en_prestamo'));
ALTER TABLE public.celulares DROP CONSTRAINT celulares_custodia_check;
ALTER TABLE public.celulares ADD CONSTRAINT celulares_custodia_check CHECK(custodia IN ('en_bodega','asignado','en_prestamo'));
DO $m$ DECLARE c record; BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.movimientos_inventario'::regclass AND contype='c' AND position('accion' in pg_get_constraintdef(oid))>0 LOOP EXECUTE format('ALTER TABLE public.movimientos_inventario DROP CONSTRAINT %I',c.conname);END LOOP;
END;$m$;
ALTER TABLE public.movimientos_inventario ADD CONSTRAINT movimientos_accion_check CHECK(accion IN ('asignacion','devolucion','prestamo','devolucion_prestamo'));
ALTER TABLE public.movimientos_inventario ADD CONSTRAINT movimientos_origen_destino_check CHECK(
 (accion='devolucion' AND origen_sede_id IS NOT NULL AND destino_sede_id IS NULL) OR
 (accion='asignacion' AND origen_sede_id IS NULL AND destino_sede_id IS NOT NULL) OR
 (accion IN ('prestamo','devolucion_prestamo') AND origen_sede_id IS NOT NULL AND destino_sede_id IS NOT NULL));
CREATE TABLE public.prestamos_inventario(
 id uuid PRIMARY KEY REFERENCES public.movimientos_inventario(id),
 equipo_id uuid REFERENCES public.equipos(id),celular_id uuid REFERENCES public.celulares(id),
 origen_sede_id uuid NOT NULL REFERENCES public.sedes(id),destino_sede_id uuid NOT NULL REFERENCES public.sedes(id),
 fecha_salida date NOT NULL,fecha_limite date NOT NULL CHECK(fecha_limite>=fecha_salida),
 receptor text NOT NULL CHECK(length(btrim(receptor)) BETWEEN 1 AND 200),datos_destino jsonb NOT NULL,
 estado text NOT NULL DEFAULT 'abierto' CHECK(estado IN ('abierto','devuelto')),
 movimiento_devolucion_id uuid UNIQUE REFERENCES public.movimientos_inventario(id),fecha_devolucion date,
 CHECK(num_nonnulls(equipo_id,celular_id)=1),
 CHECK((estado='abierto' AND movimiento_devolucion_id IS NULL AND fecha_devolucion IS NULL) OR (estado='devuelto' AND movimiento_devolucion_id IS NOT NULL AND fecha_devolucion IS NOT NULL AND fecha_devolucion>=fecha_salida))
);
CREATE UNIQUE INDEX prestamos_equipo_activo ON public.prestamos_inventario(equipo_id) WHERE estado='abierto' AND equipo_id IS NOT NULL;
CREATE UNIQUE INDEX prestamos_celular_activo ON public.prestamos_inventario(celular_id) WHERE estado='abierto' AND celular_id IS NOT NULL;
REVOKE ALL ON public.prestamos_inventario FROM PUBLIC,inventario_app;
GRANT SELECT ON public.prestamos_inventario TO inventario_app;

-- Las rutas de edición y regularización anteriores tampoco pueden saltarse el préstamo.
DO $m$ DECLARE firma text;definicion text; BEGIN
 FOREACH firma IN ARRAY ARRAY['public.guardar_equipo_acceso(text,jsonb,integer,text,uuid)','public.guardar_celular_acceso(text,uuid,jsonb,integer,text)'] LOOP
  definicion:=pg_get_functiondef(firma::regprocedure);
  IF position($s$IF p_datos ? 'custodiaInicial' THEN$s$ in definicion)=0 THEN RAISE EXCEPTION 'Versión de ficha incompatible';END IF;
  definicion:=replace(definicion,$s$IF p_datos ? 'custodiaInicial' THEN$s$,$s$IF previo.id IS NOT NULL AND previo.custodia='en_prestamo' THEN RAISE EXCEPTION 'El bien está en préstamo; devolver antes de editar o archivar' USING ERRCODE='P2802';END IF;
 IF p_datos ? 'custodiaInicial' THEN$s$);EXECUTE definicion;
 END LOOP;
 definicion:=pg_get_functiondef('public.regularizar_entregas_acceso(text,uuid,jsonb)'::regprocedure);
 IF position('resultado:=public.regularizar_entregas_base' in definicion)=0 THEN RAISE EXCEPTION 'Versión de entrega incompatible';END IF;
 definicion:=replace(definicion,'resultado:=public.regularizar_entregas_base',$s$IF NOT existente AND jsonb_typeof(p_grupos)='array' AND EXISTS(SELECT 1 FROM jsonb_array_elements(p_grupos) g CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(g->'equipos')='array' THEN g->'equipos' ELSE '[]'::jsonb END) b JOIN public.equipos e ON e.id::text=b->>'id' WHERE e.custodia='en_prestamo') THEN RAISE EXCEPTION 'El bien está en préstamo' USING ERRCODE='P2802';END IF;
 resultado:=public.regularizar_entregas_base$s$);EXECUTE definicion;
END;$m$;

CREATE FUNCTION public.mover_prestamo_acceso(p_actor text,p_id uuid,p_datos jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE tipo text;accion text;id_bien uuid;destino uuid;fecha date;limite date;version integer;prestamo_id uuid;
 receptor text;motivo text;k text;solicitud jsonb;anterior public.movimientos_inventario%ROWTYPE;prestamo public.prestamos_inventario%ROWTYPE;
 eq public.equipos%ROWTYPE;cel public.celulares%ROWTYPE;origen public.sedes%ROWTYPE;sede public.sedes%ROWTYPE;
 antes jsonb;despues jsonb;custodia text;referencia uuid;ultima date;
BEGIN
 PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1794268800000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_datos)t(k) WHERE t.k NOT IN ('tipo','bienId','accion','destino','fecha','receptor','motivo','version','fechaLimite','prestamoId')) THEN RAISE EXCEPTION 'Solicitud inválida' USING ERRCODE='22023';END IF;
 FOREACH k IN ARRAY ARRAY['tipo','bienId','accion','destino','fecha','receptor','motivo','fechaLimite','prestamoId'] LOOP
  IF jsonb_typeof(p_datos->k) IS DISTINCT FROM 'string' OR (p_datos->>k) ~ '[[:cntrl:]]' OR length(p_datos->>k)>(CASE WHEN k='motivo' THEN 500 WHEN k='receptor' THEN 200 ELSE 50 END) THEN RAISE EXCEPTION 'Campo inválido' USING ERRCODE='22023';END IF;
 END LOOP;
 tipo:=p_datos->>'tipo';accion:=p_datos->>'accion';
 IF tipo NOT IN ('equipo','celular') OR accion NOT IN ('prestamo','devolucion_prestamo') OR jsonb_typeof(p_datos->'version') IS DISTINCT FROM 'number' OR (p_datos->>'version') !~ '^[1-9][0-9]{0,9}$' OR (p_datos->>'version')::numeric>=2147483647 THEN RAISE EXCEPTION 'Tipo o versión inválidos' USING ERRCODE='22023';END IF;
 IF (p_datos->>'bienId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Bien inválido' USING ERRCODE='22023';END IF;
 id_bien:=(p_datos->>'bienId')::uuid;version:=(p_datos->>'version')::integer;receptor:=normalize(btrim(p_datos->>'receptor'),NFC);motivo:=normalize(btrim(p_datos->>'motivo'),NFC);
 IF receptor='' OR (p_datos->>'fecha') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Receptor o fecha inválidos' USING ERRCODE='22023';END IF;
 BEGIN fecha:=(p_datos->>'fecha')::date;EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'Fecha inválida' USING ERRCODE='22023';END;
 IF fecha<DATE '1900-01-01' OR fecha>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date OR to_char(fecha,'YYYY-MM-DD')<>p_datos->>'fecha' THEN RAISE EXCEPTION 'Fecha inválida' USING ERRCODE='22023';END IF;
 IF accion='prestamo' THEN
  IF p_datos->>'prestamoId'<>'' OR (p_datos->>'destino') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR (p_datos->>'fechaLimite') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Destino o límite inválido' USING ERRCODE='22023';END IF;
  destino:=(p_datos->>'destino')::uuid;
  BEGIN limite:=(p_datos->>'fechaLimite')::date;EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'Límite inválido' USING ERRCODE='22023';END;
  IF limite<fecha OR to_char(limite,'YYYY-MM-DD')<>p_datos->>'fechaLimite' THEN RAISE EXCEPTION 'Límite inválido' USING ERRCODE='22023';END IF;
 ELSE
  IF p_datos->>'destino'<>'' OR p_datos->>'fechaLimite'<>'' OR (p_datos->>'prestamoId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Préstamo inválido' USING ERRCODE='22023';END IF;
  prestamo_id:=(p_datos->>'prestamoId')::uuid;
 END IF;
 solicitud:=jsonb_build_object('tipo',tipo,'bienId',id_bien,'accion',accion,'destino',COALESCE(destino::text,''),'fecha',to_char(fecha,'YYYY-MM-DD'),'receptor',receptor,'motivo',motivo,'version',version,'fechaLimite',COALESCE(to_char(limite,'YYYY-MM-DD'),''),'prestamoId',COALESCE(prestamo_id::text,''));
 SELECT * INTO anterior FROM public.movimientos_inventario WHERE id=p_id;
 IF FOUND THEN IF anterior.actor=p_actor AND anterior.solicitud=solicitud THEN RETURN jsonb_build_object('id',p_id,'repetida',true);END IF;RAISE EXCEPTION 'Solicitud repetida con otros datos' USING ERRCODE='P2601';END IF;
 IF tipo='equipo' THEN
  SELECT * INTO eq FROM public.equipos WHERE id=id_bien FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Bien no disponible' USING ERRCODE='P2604';END IF;
  IF eq.version<>version THEN RAISE EXCEPTION 'Versión obsoleta' USING ERRCODE='P2601';END IF;
  IF EXISTS(SELECT 1 FROM public.incidentes_robos_equipos d JOIN public.incidentes_robos i ON i.id=d.incidente_id WHERE d.equipo_id=id_bien AND i.estado IN ('reportado','validado') AND d.recuperado_fecha IS NULL) THEN RAISE EXCEPTION 'Incidente abierto' USING ERRCODE='P2605';END IF;
  custodia:=eq.custodia;referencia:=eq.sede_id;antes:=to_jsonb(eq);
 ELSE
  SELECT * INTO cel FROM public.celulares WHERE id=id_bien FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Bien no disponible' USING ERRCODE='P2604';END IF;
  IF cel.version<>version THEN RAISE EXCEPTION 'Versión obsoleta' USING ERRCODE='P2601';END IF;
  IF accion='prestamo' AND NOT cel.activo THEN RAISE EXCEPTION 'Celular archivado' USING ERRCODE='P2604';END IF;
  custodia:=cel.custodia;referencia:=cel.sede_id;antes:=to_jsonb(cel);
 END IF;
 SELECT max(m.fecha) INTO ultima FROM public.movimientos_inventario m WHERE (tipo='equipo' AND m.equipo_id=id_bien) OR (tipo='celular' AND m.celular_id=id_bien);
 IF ultima IS NOT NULL AND fecha<ultima THEN RAISE EXCEPTION 'Fecha anterior al último movimiento' USING ERRCODE='22023';END IF;
 SELECT * INTO origen FROM public.sedes WHERE id=referencia FOR SHARE;
 IF accion='prestamo' THEN
  IF NOT origen.activo THEN RAISE EXCEPTION 'Origen no disponible' USING ERRCODE='P2604';END IF;
  IF custodia<>'en_bodega' OR EXISTS(SELECT 1 FROM public.prestamos_inventario p WHERE p.estado='abierto' AND ((tipo='equipo' AND p.equipo_id=id_bien) OR (tipo='celular' AND p.celular_id=id_bien))) THEN RAISE EXCEPTION 'Solo se presta desde Bodega TI' USING ERRCODE='P2802';END IF;
  SELECT * INTO sede FROM public.sedes WHERE id=destino AND activo FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Destino no disponible' USING ERRCODE='P2604';END IF;
 ELSE
  SELECT * INTO prestamo FROM public.prestamos_inventario WHERE id=prestamo_id FOR UPDATE;
  IF NOT FOUND OR prestamo.estado<>'abierto' OR prestamo.origen_sede_id<>referencia OR (tipo='equipo' AND prestamo.equipo_id IS DISTINCT FROM id_bien) OR (tipo='celular' AND prestamo.celular_id IS DISTINCT FROM id_bien) OR custodia<>'en_prestamo' OR fecha<prestamo.fecha_salida THEN RAISE EXCEPTION 'Préstamo no corresponde al bien o ya está cerrado' USING ERRCODE='P2801';END IF;
 END IF;
 IF tipo='equipo' THEN UPDATE public.equipos SET custodia=CASE WHEN accion='prestamo' THEN 'en_prestamo' ELSE 'en_bodega' END,version=equipos.version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=id_bien RETURNING * INTO eq;despues:=to_jsonb(eq);
 ELSE UPDATE public.celulares SET custodia=CASE WHEN accion='prestamo' THEN 'en_prestamo' ELSE 'en_bodega' END,version=celulares.version+1,actualizado_por=p_actor,actualizado_en=CURRENT_TIMESTAMP WHERE id=id_bien RETURNING * INTO cel;despues:=to_jsonb(cel);END IF;
 antes:=antes||jsonb_build_object('sedeId',referencia,'sedeNombre',origen.nombre,'rbd',origen.rbd,'sedeTipo',origen.tipo);
 despues:=despues||jsonb_build_object('sedeId',referencia,'sedeNombre',origen.nombre,'rbd',origen.rbd,'sedeTipo',origen.tipo,'categoriaNombre',CASE WHEN tipo='equipo' THEN (SELECT nombre FROM public.categorias_bienes WHERE id=eq.categoria_id) ELSE 'Celular' END,'prestamoId',CASE WHEN accion='prestamo' THEN p_id ELSE prestamo.id END,'destinoPrestamoNombre',CASE WHEN accion='prestamo' THEN sede.nombre ELSE prestamo.datos_destino->>'nombre' END);
 INSERT INTO public.movimientos_inventario(id,equipo_id,celular_id,accion,fecha,receptor,origen_sede_id,destino_sede_id,actor,motivo,solicitud,antes,despues)
 VALUES(p_id,CASE WHEN tipo='equipo' THEN id_bien END,CASE WHEN tipo='celular' THEN id_bien END,accion,fecha,receptor,CASE WHEN accion='prestamo' THEN referencia ELSE prestamo.destino_sede_id END,CASE WHEN accion='prestamo' THEN destino ELSE referencia END,p_actor,motivo,solicitud,antes,despues);
 IF accion='prestamo' THEN INSERT INTO public.prestamos_inventario(id,equipo_id,celular_id,origen_sede_id,destino_sede_id,fecha_salida,fecha_limite,receptor,datos_destino)
 VALUES(p_id,CASE WHEN tipo='equipo' THEN id_bien END,CASE WHEN tipo='celular' THEN id_bien END,referencia,destino,fecha,limite,receptor,to_jsonb(sede));
 ELSE UPDATE public.prestamos_inventario SET estado='devuelto',movimiento_devolucion_id=p_id,fecha_devolucion=fecha WHERE id=prestamo.id;END IF;
 IF tipo='equipo' THEN INSERT INTO public.equipos_historial(equipo_id,actor,motivo,antes,despues,movimiento_id) VALUES(id_bien,p_actor,COALESCE(NULLIF(motivo,''),CASE WHEN accion='prestamo' THEN 'Préstamo temporal desde Bodega TI' ELSE 'Devolución del préstamo a Bodega TI' END),antes,despues,p_id);
 ELSE INSERT INTO public.celulares_historial(celular_id,actor,motivo,antes,despues,movimiento_id) VALUES(id_bien,p_actor,COALESCE(NULLIF(motivo,''),CASE WHEN accion='prestamo' THEN 'Préstamo temporal desde Bodega TI' ELSE 'Devolución del préstamo a Bodega TI' END),antes,despues,p_id);END IF;
 RETURN jsonb_build_object('id',p_id,'repetida',false);
END;$fn$;
REVOKE ALL ON FUNCTION public.mover_prestamo_acceso(text,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mover_prestamo_acceso(text,uuid,jsonb) TO inventario_app;

ALTER FUNCTION public.preparar_acta_acceso(text,uuid,uuid,jsonb) RENAME TO preparar_acta_movimiento_base;
REVOKE ALL ON FUNCTION public.preparar_acta_movimiento_base(text,uuid,uuid,jsonb) FROM PUBLIC,inventario_app;
CREATE FUNCTION public.preparar_acta_acceso(p_actor text,p_id uuid,p_movimiento uuid,p_metadata jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE m public.movimientos_inventario%ROWTYPE;p public.prestamos_inventario%ROWTYPE;a public.actas_documentos%ROWTYPE;meta jsonb;datos jsonb;numero bigint;
BEGIN
 PERFORM pg_advisory_xact_lock(1794355200000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 SELECT * INTO m FROM public.movimientos_inventario WHERE id=p_movimiento FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Movimiento no disponible' USING ERRCODE='P2702';END IF;
 IF m.accion NOT IN ('prestamo','devolucion_prestamo') THEN RETURN public.preparar_acta_movimiento_base(p_actor,p_id,p_movimiento,p_metadata);END IF;
 IF p_id IS NULL THEN RAISE EXCEPTION 'Solicitud inválida' USING ERRCODE='22023';END IF;
 meta:=public.normalizar_metadata_acta(p_metadata,true);
 SELECT * INTO a FROM public.actas_documentos WHERE id=p_id;
 IF FOUND THEN IF a.actor=p_actor AND a.movimiento_id=p_movimiento AND a.solicitud=meta THEN RETURN jsonb_build_object('id',a.id,'datos',a.datos,'completa',a.pdf IS NOT NULL);END IF;RAISE EXCEPTION 'Solicitud repetida con otros datos' USING ERRCODE='P2701';END IF;
 IF EXISTS(SELECT 1 FROM public.actas_documentos WHERE movimiento_id=p_movimiento) THEN RAISE EXCEPTION 'Ya existe acta' USING ERRCODE='P2701';END IF;
 SELECT * INTO p FROM public.prestamos_inventario WHERE id=p_movimiento OR movimiento_devolucion_id=p_movimiento;
 IF NOT FOUND THEN RAISE EXCEPTION 'Préstamo no disponible' USING ERRCODE='P2702';END IF;
 UPDATE public.actas_contador SET ultimo=ultimo+1 WHERE id AND ultimo<999999999999 RETURNING ultimo INTO numero;
 IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo asignar folio' USING ERRCODE='P2702';END IF;
 datos:=jsonb_build_object('schema',4,'modelo','institucional-prestamos-20261105','tipo',m.accion,'fecha',m.fecha::text,'emitidoEn',CURRENT_TIMESTAMP,'movimientoId',m.id,'prestamoId',p.id,'fechaLimite',p.fecha_limite::text,'folioPrestamo',CASE WHEN m.accion='prestamo' THEN numero ELSE (SELECT folio FROM public.actas_documentos WHERE movimiento_id=p.id AND pdf IS NOT NULL) END,
 'clase',CASE WHEN m.equipo_id IS NOT NULL THEN 'equipo' ELSE 'celular' END,'origen',CASE WHEN m.accion='prestamo' THEN 'Bodega TI' ELSE p.datos_destino->>'nombre' END,'destino',CASE WHEN m.accion='prestamo' THEN p.datos_destino->>'nombre' ELSE 'Bodega TI' END,
 'sedeTipo',p.datos_destino->>'tipo','sedeNombre',p.datos_destino->>'nombre','rbd',COALESCE(p.datos_destino->>'rbd',''),'sedeDatos',jsonb_build_object('direccion',p.datos_destino->>'direccion','comuna',p.datos_destino->>'comuna','correoInstitucional',p.datos_destino->>'correo_institucional'),
 'receptorNombre',m.receptor,'actor',p_actor,'actorNombre',COALESCE((SELECT NULLIF(f.nombre,'') FROM public.funcionarios_nc f WHERE lower(f.correo)=p_actor AND f.activo ORDER BY f.id LIMIT 1),(SELECT NULLIF(u.nombre,'') FROM public.usuarios_acceso u WHERE u.correo=p_actor),''),'bienes',jsonb_build_array(m.despues),'metadata',meta,'folio',numero,'version',1);
 INSERT INTO public.actas_documentos(id,movimiento_id,folio,actor,solicitud,datos) VALUES(p_id,p_movimiento,numero,p_actor,meta,datos);
 RETURN jsonb_build_object('id',p_id,'datos',datos,'completa',false);
END;$fn$;
REVOKE ALL ON FUNCTION public.preparar_acta_acceso(text,uuid,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preparar_acta_acceso(text,uuid,uuid,jsonb) TO inventario_app;
`);}
export function down(){throw new Error('Conservar préstamos, movimientos y actas; no hay reversión automática.');}
