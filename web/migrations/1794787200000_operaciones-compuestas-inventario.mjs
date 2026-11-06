export function up(pgm){pgm.sql(`
CREATE TABLE public.operaciones_inventario(
 id uuid PRIMARY KEY,tipo text NOT NULL CHECK(tipo IN ('cambio','traspaso')),
 clase text NOT NULL CHECK(clase IN ('equipo','celular')),actor text NOT NULL,
 origen_sede_id uuid NOT NULL REFERENCES public.sedes(id),destino_sede_id uuid NOT NULL REFERENCES public.sedes(id),
 directa boolean NOT NULL,solicitud jsonb NOT NULL,datos jsonb NOT NULL,
 registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.operaciones_inventario_detalle(
 operacion_id uuid NOT NULL REFERENCES public.operaciones_inventario(id),
 movimiento_id uuid PRIMARY KEY REFERENCES public.movimientos_inventario(id),
 grupo text NOT NULL CHECK(grupo IN ('devolucion','entrega'))
);
CREATE INDEX operaciones_detalle_cabecera ON public.operaciones_inventario_detalle(operacion_id);
REVOKE ALL ON public.operaciones_inventario,public.operaciones_inventario_detalle FROM PUBLIC,inventario_app;
GRANT SELECT ON public.operaciones_inventario,public.operaciones_inventario_detalle TO inventario_app;
ALTER TABLE public.actas_documentos ADD COLUMN operacion_id uuid UNIQUE REFERENCES public.operaciones_inventario(id);
ALTER TABLE public.actas_documentos DROP CONSTRAINT actas_fuente_unica;
ALTER TABLE public.actas_documentos ADD CONSTRAINT actas_fuente_unica CHECK(num_nonnulls(movimiento_id,entrega_id,operacion_id)=1);
ALTER TABLE public.movimientos_inventario DROP CONSTRAINT movimientos_accion_check;
ALTER TABLE public.movimientos_inventario DROP CONSTRAINT movimientos_origen_destino_check;
ALTER TABLE public.movimientos_inventario ADD CONSTRAINT movimientos_accion_check CHECK(accion IN ('asignacion','devolucion','prestamo','devolucion_prestamo','traspaso'));
ALTER TABLE public.movimientos_inventario ADD CONSTRAINT movimientos_origen_destino_check CHECK(
 (accion='devolucion' AND origen_sede_id IS NOT NULL AND destino_sede_id IS NULL) OR
 (accion='asignacion' AND origen_sede_id IS NULL AND destino_sede_id IS NOT NULL) OR
 (accion IN ('prestamo','devolucion_prestamo','traspaso') AND origen_sede_id IS NOT NULL AND destino_sede_id IS NOT NULL));
-- Ampliar la misma primitiva conserva las guardas de versión, préstamo, robo y fecha.
DO $m$ DECLARE d text; BEGIN
 d:=pg_get_functiondef('public.mover_bien_acceso(text,uuid,jsonb)'::regprocedure);
 IF position($s$accion NOT IN ('devolucion','asignacion')$s$ in d)=0 OR position($s$IF accion='devolucion' THEN sede:=sede_previa;END IF;$s$ in d)=0 THEN RAISE EXCEPTION 'Versión de movimientos incompatible';END IF;
 d:=replace(d,$s$accion NOT IN ('devolucion','asignacion')$s$,$s$accion NOT IN ('devolucion','asignacion','traspaso')$s$);
 d:=replace(d,$s$accion='asignacion'$s$,$s$accion IN ('asignacion','traspaso')$s$);
 d:=replace(d,$s$(accion IN ('asignacion','traspaso') AND custodia<>'en_bodega')$s$,$s$(accion='asignacion' AND custodia<>'en_bodega')$s$);
 d:=replace(d,$s$'Asignación desde Bodega TI'$s$,$s$CASE WHEN accion='traspaso' THEN 'Traspaso directo entre sedes educativas' ELSE 'Asignación desde Bodega TI' END$s$);
 d:=replace(d,$s$(accion='devolucion' AND custodia<>'asignado')$s$,$s$(accion IN ('devolucion','traspaso') AND custodia<>'asignado')$s$);
 d:=replace(d,$s$SELECT * INTO sede_previa FROM public.sedes WHERE id=referencia;$s$,$s$SELECT * INTO sede_previa FROM public.sedes WHERE id=referencia FOR SHARE;
 IF accion='traspaso' AND (sede_previa.tipo NOT IN ('establecimiento','jardin_infantil') OR sede.tipo NOT IN ('establecimiento','jardin_infantil') OR NOT sede_previa.activo OR referencia=destino) THEN RAISE EXCEPTION 'Los traspasos de Nivel Central pasan por Bodega TI' USING ERRCODE='P2901';END IF;$s$);
 d:=replace(d,$s$CASE WHEN accion='devolucion' THEN referencia END,destino$s$,$s$CASE WHEN accion IN ('devolucion','traspaso') THEN referencia END,destino$s$);
 EXECUTE d;
END;$m$;

CREATE FUNCTION public.mover_operacion_acceso(p_actor text,p_id uuid,p_datos jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE k text;g text;l jsonb;sol jsonb;lineas jsonb;canon jsonb;paso jsonb;ids uuid[]:='{}';movs uuid[]:='{}';
 anterior public.operaciones_inventario%ROWTYPE;origen public.sedes%ROWTYPE;destino public.sedes%ROWTYPE;
 referencia uuid;primera uuid;actual integer;custodia text;custodia_inicial text;directa boolean;res jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1794268800000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_datos) t(k) WHERE t.k NOT IN ('tipo','clase','destino','fecha','receptor','receptorDevolucion','motivo','devoluciones','entregas','detalleDevueltos','detalleEntregados')) THEN RAISE EXCEPTION 'Solicitud inválida' USING ERRCODE='22023';END IF;
 sol:='{}';
 FOREACH k IN ARRAY ARRAY['tipo','clase','destino','fecha','receptor','receptorDevolucion','motivo','detalleDevueltos','detalleEntregados'] LOOP
  IF jsonb_typeof(p_datos->k) IS DISTINCT FROM 'string' OR length(p_datos->>k)>(CASE WHEN k LIKE 'detalle%' THEN 1000 WHEN k='motivo' THEN 500 WHEN k IN ('receptor','receptorDevolucion') THEN 200 ELSE 50 END) OR (CASE WHEN k LIKE 'detalle%' THEN replace(replace(replace(p_datos->>k,chr(13),''),chr(10),''),chr(9),'') ELSE p_datos->>k END) ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Campo inválido' USING ERRCODE='22023';END IF;
  sol:=sol||jsonb_build_object(k,normalize(btrim(p_datos->>k),NFC));
 END LOOP;
 IF sol->>'tipo' NOT IN ('cambio','traspaso') OR sol->>'clase' NOT IN ('equipo','celular') OR sol->>'destino' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR sol->>'receptor'='' OR (sol->>'tipo'='cambio' AND sol->>'receptorDevolucion'='') THEN RAISE EXCEPTION 'Tipo o participantes inválidos' USING ERRCODE='22023';END IF;
 sol:=sol||jsonb_build_object('destino',(sol->>'destino')::uuid);
 FOREACH g IN ARRAY ARRAY['devoluciones','entregas'] LOOP
  lineas:=p_datos->g;IF jsonb_typeof(lineas) IS DISTINCT FROM 'array' OR jsonb_array_length(lineas)>100 THEN RAISE EXCEPTION 'Hasta 100 bienes por grupo' USING ERRCODE='22023';END IF;
  canon:='[]';
  FOR l IN SELECT value FROM jsonb_array_elements(lineas) LOOP
   IF jsonb_typeof(l) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Línea inválida' USING ERRCODE='22023';END IF;
   IF (SELECT array_agg(t.k ORDER BY t.k) FROM jsonb_object_keys(l)t(k)) IS DISTINCT FROM ARRAY['id','movimientoId','version'] OR jsonb_typeof(l->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(l->'movimientoId') IS DISTINCT FROM 'string' OR l->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR l->>'movimientoId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR jsonb_typeof(l->'version') IS DISTINCT FROM 'number' OR l->>'version' !~ '^[1-9][0-9]{0,9}$' OR (l->>'version')::numeric>=2147483647 THEN RAISE EXCEPTION 'Identificación o versión inválida' USING ERRCODE='22023';END IF;
   IF (l->>'id')::uuid=ANY(ids) OR (l->>'movimientoId')::uuid=ANY(movs) OR (l->>'movimientoId')::uuid=p_id THEN RAISE EXCEPTION 'Bien o movimiento repetido' USING ERRCODE='22023';END IF;
   ids:=array_append(ids,(l->>'id')::uuid);movs:=array_append(movs,(l->>'movimientoId')::uuid);
   canon:=canon||jsonb_build_array(jsonb_build_object('id',(l->>'id')::uuid,'movimientoId',(l->>'movimientoId')::uuid,'version',(l->>'version')::integer));
  END LOOP;
  SELECT COALESCE(jsonb_agg(value ORDER BY value->>'id'),'[]') INTO canon FROM jsonb_array_elements(canon);
  sol:=sol||jsonb_build_object(g,canon);
 END LOOP;
 IF jsonb_array_length(sol->'entregas')=0 OR (sol->>'tipo'='cambio' AND jsonb_array_length(sol->'devoluciones')=0) OR (sol->>'tipo'='traspaso' AND (jsonb_array_length(sol->'devoluciones')<>0 OR sol->>'receptorDevolucion'<>'' OR sol->>'detalleDevueltos'<>'')) THEN RAISE EXCEPTION 'Grupos inválidos' USING ERRCODE='22023';END IF;
 SELECT * INTO anterior FROM public.operaciones_inventario WHERE id=p_id;
 IF FOUND THEN IF anterior.actor=p_actor AND anterior.solicitud=sol THEN RETURN jsonb_build_object('id',p_id,'repetida',true);END IF;RAISE EXCEPTION 'Solicitud repetida con otros datos' USING ERRCODE='P2601';END IF;
 IF EXISTS(SELECT 1 FROM public.movimientos_inventario WHERE id=ANY(movs)) THEN RAISE EXCEPTION 'Movimiento ya utilizado' USING ERRCODE='P2601';END IF;
 SELECT * INTO destino FROM public.sedes WHERE id=(sol->>'destino')::uuid AND activo FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Destino no disponible' USING ERRCODE='P2604';END IF;
 -- Todos los bienes de un grupo de traspaso tienen igual procedencia y ruta.
 FOR l IN SELECT value FROM jsonb_array_elements(CASE WHEN sol->>'tipo'='cambio' THEN sol->'devoluciones' ELSE sol->'entregas' END) LOOP
  IF sol->>'clase'='equipo' THEN SELECT e.sede_id,e.custodia,e.version INTO referencia,custodia,actual FROM public.equipos e WHERE e.id=(l->>'id')::uuid FOR UPDATE;
  ELSE SELECT c.sede_id,c.custodia,c.version INTO referencia,custodia,actual FROM public.celulares c WHERE c.id=(l->>'id')::uuid FOR UPDATE;END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bien no disponible' USING ERRCODE='P2604';END IF;
  IF actual<>(l->>'version')::integer THEN RAISE EXCEPTION 'El bien cambió' USING ERRCODE='P2601';END IF;
  IF primera IS NULL THEN primera:=referencia;custodia_inicial:=custodia;END IF;
  IF referencia<>primera OR custodia<>custodia_inicial THEN RAISE EXCEPTION 'Selecciona bienes de una misma procedencia y ruta' USING ERRCODE='P2901';END IF;
 END LOOP;
 SELECT * INTO origen FROM public.sedes WHERE id=primera FOR SHARE;
 directa:=sol->>'tipo'='traspaso' AND custodia_inicial='asignado';
 IF sol->>'tipo'='cambio' THEN
  IF primera<>destino.id OR custodia_inicial<>'asignado' THEN RAISE EXCEPTION 'El cambio devuelve bienes asignados a la sede receptora' USING ERRCODE='P2901';END IF;
 ELSE
  IF primera=destino.id OR custodia_inicial NOT IN ('en_bodega','asignado') OR (directa AND (origen.tipo NOT IN ('establecimiento','jardin_infantil') OR destino.tipo NOT IN ('establecimiento','jardin_infantil'))) THEN RAISE EXCEPTION 'Nivel Central requiere paso por Bodega TI; entre sedes educativas se admite directo' USING ERRCODE='P2901';END IF;
 END IF;
 INSERT INTO public.operaciones_inventario(id,tipo,clase,actor,origen_sede_id,destino_sede_id,directa,solicitud,datos)
 VALUES(p_id,sol->>'tipo',sol->>'clase',p_actor,primera,destino.id,directa,sol,jsonb_build_object('origen',to_jsonb(origen),'destino',to_jsonb(destino)));
 FOREACH g IN ARRAY ARRAY['devoluciones','entregas'] LOOP
  FOR l IN SELECT value FROM jsonb_array_elements(sol->g) LOOP
   paso:=jsonb_build_object('tipo',sol->>'clase','bienId',l->>'id','accion',CASE WHEN g='devoluciones' THEN 'devolucion' WHEN directa THEN 'traspaso' ELSE 'asignacion' END,'destino',CASE WHEN g='devoluciones' THEN '' ELSE destino.id::text END,'fecha',sol->>'fecha','receptor',CASE WHEN g='devoluciones' THEN sol->>'receptorDevolucion' ELSE sol->>'receptor' END,'motivo',sol->>'motivo','version',l->'version');
   res:=public.mover_bien_acceso(p_actor,(l->>'movimientoId')::uuid,paso);
   IF COALESCE((res->>'repetida')::boolean,false) THEN RAISE EXCEPTION 'Movimiento reutilizado' USING ERRCODE='P2601';END IF;
   INSERT INTO public.operaciones_inventario_detalle(operacion_id,movimiento_id,grupo) VALUES(p_id,(l->>'movimientoId')::uuid,CASE WHEN g='devoluciones' THEN 'devolucion' ELSE 'entrega' END);
  END LOOP;
 END LOOP;
 RETURN jsonb_build_object('id',p_id,'repetida',false);
END;$fn$;
REVOKE ALL ON FUNCTION public.mover_operacion_acceso(text,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mover_operacion_acceso(text,uuid,jsonb) TO inventario_app;

CREATE FUNCTION public.preparar_acta_operacion_acceso(p_actor text,p_id uuid,p_operacion uuid,p_metadata jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE o public.operaciones_inventario%ROWTYPE;a public.actas_documentos%ROWTYPE;meta jsonb;datos jsonb;numero bigint;entregados jsonb;devueltos jsonb;s jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(1794355200000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR p_operacion IS NULL THEN RAISE EXCEPTION 'Fuente requerida' USING ERRCODE='22023';END IF;
 meta:=public.normalizar_metadata_acta(p_metadata,true);
 SELECT * INTO a FROM public.actas_documentos WHERE id=p_id;
 IF FOUND THEN IF a.actor=p_actor AND a.operacion_id=p_operacion AND a.solicitud=meta THEN RETURN jsonb_build_object('id',a.id,'datos',a.datos,'completa',a.pdf IS NOT NULL);END IF;RAISE EXCEPTION 'Solicitud de acta reutilizada' USING ERRCODE='P2701';END IF;
 IF EXISTS(SELECT 1 FROM public.actas_documentos WHERE operacion_id=p_operacion) THEN RAISE EXCEPTION 'Ya existe acta' USING ERRCODE='P2701';END IF;
 SELECT * INTO o FROM public.operaciones_inventario WHERE id=p_operacion FOR SHARE;
 IF NOT FOUND OR o.actor<>p_actor THEN RAISE EXCEPTION 'Operación no disponible' USING ERRCODE='P2702';END IF;
 IF o.tipo='cambio' AND meta->>'entregaNombre'<>o.solicitud->>'receptorDevolucion' THEN RAISE EXCEPTION 'Revisa la persona UTIC que recibe los devueltos y entrega el reemplazo' USING ERRCODE='22023';END IF;
 SELECT COALESCE(jsonb_agg(m.despues ORDER BY COALESCE(m.equipo_id,m.celular_id)) FILTER(WHERE d.grupo='entrega'),'[]'),COALESCE(jsonb_agg(m.antes ORDER BY COALESCE(m.equipo_id,m.celular_id)) FILTER(WHERE d.grupo='devolucion'),'[]') INTO entregados,devueltos FROM public.operaciones_inventario_detalle d JOIN public.movimientos_inventario m ON m.id=d.movimiento_id WHERE d.operacion_id=o.id;
 UPDATE public.actas_contador SET ultimo=ultimo+1 WHERE id AND ultimo<999999999999 RETURNING ultimo INTO numero;
 IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo asignar folio' USING ERRCODE='P2702';END IF;
 s:=o.datos->'destino';
 datos:=jsonb_build_object('schema',5,'modelo','institucional-operaciones-20261106','tipo',o.tipo,'operacionId',o.id,'movimientoId',NULL,'fecha',o.solicitud->>'fecha','emitidoEn',CURRENT_TIMESTAMP,'clase',o.clase,
 'origen',CASE WHEN o.tipo='cambio' OR NOT o.directa THEN 'Bodega TI' ELSE o.datos->'origen'->>'nombre' END,'procedencia',o.datos->'origen'->>'nombre','ruta',CASE WHEN o.directa THEN 'directa' ELSE 'bodega' END,'destino',s->>'nombre','sedeNombre',s->>'nombre','sedeTipo',s->>'tipo','rbd',COALESCE(s->>'rbd',''),'sedeDatos',jsonb_build_object('direccion',s->>'direccion','comuna',s->>'comuna','correoInstitucional',s->>'correo_institucional'),
 'receptorNombre',o.solicitud->>'receptor','actor',p_actor,'actorNombre',COALESCE((SELECT NULLIF(f.nombre,'') FROM public.funcionarios_nc f WHERE lower(f.correo)=p_actor AND f.activo ORDER BY f.id LIMIT 1),(SELECT NULLIF(u.nombre,'') FROM public.usuarios_acceso u WHERE u.correo=p_actor),''),'bienes',entregados,'bienesDevueltos',devueltos,'detalleDevueltos',o.solicitud->>'detalleDevueltos','detalleEntregados',o.solicitud->>'detalleEntregados','motivo',o.solicitud->>'motivo','metadata',meta,'folio',numero,'version',1);
 INSERT INTO public.actas_documentos(id,operacion_id,folio,actor,solicitud,datos) VALUES(p_id,o.id,numero,p_actor,meta,datos);
 RETURN jsonb_build_object('id',p_id,'datos',datos,'completa',false);
END;$fn$;
REVOKE ALL ON FUNCTION public.preparar_acta_operacion_acceso(text,uuid,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preparar_acta_operacion_acceso(text,uuid,uuid,jsonb) TO inventario_app;
-- Un movimiento incluido en una operación comparte el documento de la cabecera.
DO $m$ DECLARE d text; BEGIN
 d:=pg_get_functiondef('public.preparar_acta_acceso(text,uuid,uuid,jsonb)'::regprocedure);
 IF position($s$SELECT * INTO m FROM public.movimientos_inventario$s$ in d)=0 THEN RAISE EXCEPTION 'Versión de actas incompatible';END IF;
 d:=replace(d,$s$SELECT * INTO m FROM public.movimientos_inventario$s$,$s$IF EXISTS(SELECT 1 FROM public.operaciones_inventario_detalle WHERE movimiento_id=p_movimiento) THEN RAISE EXCEPTION 'Usar el acta compartida de la operación' USING ERRCODE='P2701';END IF;
 SELECT * INTO m FROM public.movimientos_inventario$s$);EXECUTE d;
END;$m$;
`);}
export function down(){throw new Error('Conservar operaciones, historial y documentos emitidos; no hay reversión automática.');}
