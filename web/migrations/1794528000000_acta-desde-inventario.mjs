export function up(pgm){pgm.sql(`
-- Datos del modelo institucional conservados al confirmar, sin modificar documentos previos.
CREATE FUNCTION public.version_modelo_acta() RETURNS integer LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS 'SELECT 2';
REVOKE ALL ON FUNCTION public.version_modelo_acta() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.version_modelo_acta() TO inventario_app;
CREATE OR REPLACE FUNCTION public.normalizar_metadata_acta(p_metadata jsonb,p_obligatorios boolean)
RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE meta jsonb:='{}';k text;v text;maximo integer;rut text;suma integer;digito integer;dv text;
BEGIN
 IF jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_metadata)t(k) WHERE t.k NOT IN ('entregaNombre','entregaRun','entregaCargo','entregaCorreo','recibeRun','recibeCargo','recibeCorreo','recibeUnidad','recibeSubdireccion','accesorios','observaciones')) THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023';END IF;
 FOREACH k IN ARRAY ARRAY['entregaNombre','entregaRun','entregaCargo','entregaCorreo','recibeRun','recibeCargo','recibeCorreo','recibeUnidad','recibeSubdireccion','accesorios','observaciones'] LOOP
  IF k IN ('recibeUnidad','recibeSubdireccion') AND NOT p_metadata?k THEN p_metadata:=p_metadata||jsonb_build_object(k,'');END IF;
  maximo:=CASE WHEN k='observaciones' THEN 2000 WHEN k='accesorios' THEN 500 WHEN k LIKE '%Correo' THEN 254 WHEN k LIKE '%Run' THEN 12 ELSE 200 END;
  IF jsonb_typeof(p_metadata->k) IS DISTINCT FROM 'string' OR length(p_metadata->>k)>maximo OR (CASE WHEN k IN ('observaciones','accesorios') THEN replace(replace(replace(p_metadata->>k,E'\\r',''),E'\\n',''),E'\\t','') ELSE p_metadata->>k END) ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Campo inválido' USING ERRCODE='22023';END IF;
  v:=normalize(btrim(p_metadata->>k),NFC);
  IF p_obligatorios AND k='entregaNombre' AND v='' THEN RAISE EXCEPTION 'Nombre requerido' USING ERRCODE='22023';END IF;
  IF k LIKE '%Run' AND (p_obligatorios OR v<>'') THEN
   rut:=upper(replace(v,'.',''));IF rut !~ '^[0-9]{7,8}-[0-9K]$' THEN RAISE EXCEPTION 'RUN inválido' USING ERRCODE='22023';END IF;
   suma:=0;FOR digito IN 1..length(split_part(rut,'-',1)) LOOP suma:=suma+substring(reverse(split_part(rut,'-',1)),digito,1)::integer*(2+(digito-1)%6);END LOOP;
   digito:=11-suma%11;dv:=CASE digito WHEN 11 THEN '0' WHEN 10 THEN 'K' ELSE digito::text END;IF split_part(rut,'-',2)<>dv THEN RAISE EXCEPTION 'RUN inválido' USING ERRCODE='22023';END IF;v:=rut;
  END IF;
  IF k LIKE '%Correo' THEN v:=lower(v);IF v<>'' AND (v !~ '^[a-z0-9._%+!-]+@[a-z0-9.-]+[.][a-z]{2,63}$' OR v LIKE '%..%') THEN RAISE EXCEPTION 'Correo inválido' USING ERRCODE='22023';END IF;END IF;
  meta:=meta||jsonb_build_object(k,v);
 END LOOP;
 RETURN meta;
END;$fn$;
REVOKE ALL ON FUNCTION public.normalizar_metadata_acta(jsonb,boolean) FROM PUBLIC,inventario_app;
CREATE OR REPLACE FUNCTION public.preparar_acta_acceso(p_actor text,p_id uuid,p_movimiento uuid,p_metadata jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE m public.movimientos_inventario%ROWTYPE;a public.actas_documentos%ROWTYPE;meta jsonb:='{}';datos jsonb;numero bigint;k text;v text;maximo integer;rut text;suma integer;digito integer;dv text;
BEGIN
 PERFORM pg_advisory_xact_lock(1794355200000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR p_movimiento IS NULL OR jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_metadata)t(k) WHERE t.k NOT IN ('entregaNombre','entregaRun','entregaCargo','entregaCorreo','recibeRun','recibeCargo','recibeCorreo','recibeUnidad','recibeSubdireccion','accesorios','observaciones')) THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023';END IF;
 meta:=public.normalizar_metadata_acta(p_metadata,true);
 SELECT * INTO a FROM public.actas_documentos WHERE id=p_id;
 IF FOUND THEN IF a.actor=p_actor AND a.movimiento_id=p_movimiento AND (a.solicitud||jsonb_build_object('recibeUnidad',COALESCE(a.solicitud->>'recibeUnidad',''),'recibeSubdireccion',COALESCE(a.solicitud->>'recibeSubdireccion','')))=meta THEN RETURN jsonb_build_object('id',a.id,'datos',a.datos,'completa',a.pdf IS NOT NULL);END IF;RAISE EXCEPTION 'Solicitud repetida con otros datos' USING ERRCODE='P2701';END IF;
 IF EXISTS(SELECT 1 FROM public.actas_documentos WHERE movimiento_id=p_movimiento) THEN RAISE EXCEPTION 'Ya existe un acta' USING ERRCODE='P2701';END IF;
 SELECT * INTO m FROM public.movimientos_inventario WHERE id=p_movimiento FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Movimiento no disponible' USING ERRCODE='P2702';END IF;
 UPDATE public.actas_contador SET ultimo=ultimo+1 WHERE id AND ultimo<999999999999 RETURNING ultimo INTO numero;
 IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo asignar folio' USING ERRCODE='P2702';END IF;
 datos:=jsonb_build_object('schema',3,'modelo','institucional-20261104','tipo',m.accion,'fecha',m.fecha::text,'emitidoEn',CURRENT_TIMESTAMP,'movimientoId',m.id,'clase',CASE WHEN m.equipo_id IS NOT NULL THEN 'equipo' ELSE 'celular' END,
 'origen',CASE WHEN m.accion='devolucion' THEN m.antes->>'sedeNombre' ELSE 'Bodega TI' END,'destino',CASE WHEN m.accion='asignacion' THEN m.despues->>'sedeNombre' ELSE 'Bodega TI' END,
 'sedeTipo',m.despues->>'sedeTipo','sedeDatos',jsonb_build_object('direccion',m.despues->>'direccion','comuna',m.despues->>'comuna','correoInstitucional',m.despues->>'correoInstitucional'),'sedeNombre',COALESCE(m.despues->>'sedeNombre',''),'rbd',COALESCE(m.despues->>'rbd',''),'receptorNombre',m.receptor,'actor',p_actor,'bienes',jsonb_build_array(m.despues),'metadata',meta,'folio',numero,'version',1);
 INSERT INTO public.actas_documentos(id,movimiento_id,folio,actor,solicitud,datos) VALUES(p_id,p_movimiento,numero,p_actor,meta,datos);
 RETURN jsonb_build_object('id',p_id,'datos',datos,'completa',false);
END;$fn$;
CREATE OR REPLACE FUNCTION public.mover_bien_acceso(p_actor text,p_id uuid,p_datos jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE anterior public.movimientos_inventario%ROWTYPE;eq public.equipos%ROWTYPE;cel public.celulares%ROWTYPE;sede public.sedes%ROWTYPE;sede_previa public.sedes%ROWTYPE;
 tipo text;accion text;id_bien uuid;destino uuid;fecha date;receptor text;motivo text;version integer;custodia text;referencia uuid;antes jsonb;despues jsonb;solicitud jsonb;ultima date;k text;actual integer;
BEGIN
 PERFORM pg_advisory_xact_lock(1793577600000);
 PERFORM pg_advisory_xact_lock(1794268800000);
 PERFORM 1 FROM public.usuarios_acceso u WHERE u.correo=p_actor AND u.activo AND u.rol IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_datos)t(k) WHERE t.k NOT IN ('tipo','bienId','accion','destino','fecha','receptor','motivo','version')) THEN RAISE EXCEPTION 'Solicitud inválida' USING ERRCODE='22023';END IF;
 FOREACH k IN ARRAY ARRAY['tipo','bienId','accion','destino','fecha','receptor','motivo'] LOOP
  IF jsonb_typeof(p_datos->k) IS DISTINCT FROM 'string' OR (p_datos->>k) ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Campo inválido' USING ERRCODE='22023';END IF;
 END LOOP;
 tipo:=p_datos->>'tipo';accion:=p_datos->>'accion';
 IF tipo NOT IN ('equipo','celular') OR accion NOT IN ('devolucion','asignacion') OR jsonb_typeof(p_datos->'version') IS DISTINCT FROM 'number' OR (p_datos->>'version') !~ '^[1-9][0-9]{0,9}$' OR (p_datos->>'version')::numeric>=2147483647 THEN RAISE EXCEPTION 'Tipo o versión inválidos' USING ERRCODE='22023';END IF;
 IF (p_datos->>'bienId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Bien inválido' USING ERRCODE='22023';END IF;
 id_bien:=(p_datos->>'bienId')::uuid;version:=(p_datos->>'version')::integer;receptor:=normalize(btrim(p_datos->>'receptor'),NFC);motivo:=normalize(btrim(p_datos->>'motivo'),NFC);
 IF length(receptor) NOT BETWEEN 1 AND 200 OR length(motivo) NOT BETWEEN 1 AND 500 OR (p_datos->>'fecha') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Receptor, motivo o fecha inválidos' USING ERRCODE='22023';END IF;
 BEGIN fecha:=(p_datos->>'fecha')::date;EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'Fecha inválida' USING ERRCODE='22023';END;
 IF fecha<DATE '1900-01-01' OR fecha>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date OR to_char(fecha,'YYYY-MM-DD')<>p_datos->>'fecha' THEN RAISE EXCEPTION 'Fecha inválida' USING ERRCODE='22023';END IF;
 IF accion='asignacion' THEN
  IF (p_datos->>'destino') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Destino inválido' USING ERRCODE='22023';END IF;
  destino:=(p_datos->>'destino')::uuid;
 ELSIF p_datos->>'destino'<>'' THEN RAISE EXCEPTION 'Una devolución tiene como destino Bodega TI' USING ERRCODE='22023';END IF;
 solicitud:=jsonb_build_object('tipo',tipo,'bienId',id_bien,'accion',accion,'destino',COALESCE(destino::text,''),'fecha',to_char(fecha,'YYYY-MM-DD'),'receptor',receptor,'motivo',motivo,'version',version);
 SELECT * INTO anterior FROM public.movimientos_inventario WHERE id=p_id;
 IF FOUND THEN
  IF anterior.actor=p_actor AND anterior.solicitud=solicitud THEN RETURN jsonb_build_object('id',p_id,'repetida',true);END IF;
  RAISE EXCEPTION 'La solicitud ya se utilizó' USING ERRCODE='P2601';
 END IF;
 IF destino IS NOT NULL THEN SELECT * INTO sede FROM public.sedes WHERE id=destino AND activo FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Destino no disponible' USING ERRCODE='P2604';END IF;END IF;
 IF tipo='equipo' THEN
  SELECT * INTO eq FROM public.equipos WHERE id=id_bien FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Bien no disponible' USING ERRCODE='P2604';END IF;
  IF EXISTS(SELECT 1 FROM public.incidentes_robos_equipos d JOIN public.incidentes_robos i ON i.id=d.incidente_id WHERE d.equipo_id=id_bien AND i.estado IN ('reportado','validado') AND d.recuperado_fecha IS NULL) THEN RAISE EXCEPTION 'Existe un incidente abierto' USING ERRCODE='P2605';END IF;
  custodia:=eq.custodia;actual:=eq.version;referencia:=eq.sede_id;antes:=to_jsonb(eq);
 ELSE
  SELECT * INTO cel FROM public.celulares WHERE id=id_bien FOR UPDATE;IF NOT FOUND OR NOT cel.activo THEN RAISE EXCEPTION 'Bien no disponible' USING ERRCODE='P2604';END IF;
  custodia:=cel.custodia;actual:=cel.version;referencia:=cel.sede_id;
  antes:=jsonb_build_object('sedeId',cel.sede_id,'telefono',cel.telefono,'marca',cel.marca,'modelo',cel.modelo,'imei',COALESCE(cel.imei,''),'inventario',COALESCE(cel.numero_inventario,''),'condicionTecnica',cel.condicion_tecnica,'responsable',cel.responsable,'observaciones',cel.observaciones,'activo',cel.activo,'custodia',cel.custodia);
 END IF;
 IF version<>actual THEN RAISE EXCEPTION 'El bien cambió' USING ERRCODE='P2601';END IF;
 IF (accion='asignacion' AND custodia<>'en_bodega') OR (accion='devolucion' AND custodia<>'asignado') THEN RAISE EXCEPTION 'El estado no permite este movimiento' USING ERRCODE='P2602';END IF;
 SELECT max(m.fecha) INTO ultima FROM public.movimientos_inventario m WHERE (tipo='equipo' AND m.equipo_id=id_bien) OR (tipo='celular' AND m.celular_id=id_bien);
 IF ultima IS NOT NULL AND fecha<ultima THEN RAISE EXCEPTION 'La fecha es anterior al último movimiento' USING ERRCODE='22023';END IF;
 SELECT * INTO sede_previa FROM public.sedes WHERE id=referencia;
 IF tipo='equipo' THEN
  IF accion='devolucion' THEN UPDATE public.equipos SET custodia='en_bodega',version=equipos.version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=id_bien RETURNING * INTO eq;
  ELSE UPDATE public.equipos SET sede_id=destino,custodia='asignado',situacion=CASE WHEN sede.tipo='nivel_central' THEN 'registrado_nc' ELSE 'recibido' END,fecha_entrega=fecha,enlace_acta=NULL,version=equipos.version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=id_bien RETURNING * INTO eq;END IF;
  despues:=to_jsonb(eq);
 ELSE
  IF accion='devolucion' THEN UPDATE public.celulares SET custodia='en_bodega',responsable='',version=celulares.version+1,actualizado_por=p_actor,actualizado_en=CURRENT_TIMESTAMP WHERE id=id_bien RETURNING * INTO cel;
  ELSE UPDATE public.celulares SET sede_id=destino,custodia='asignado',responsable=receptor,version=celulares.version+1,actualizado_por=p_actor,actualizado_en=CURRENT_TIMESTAMP WHERE id=id_bien RETURNING * INTO cel;END IF;
  despues:=jsonb_build_object('sedeId',cel.sede_id,'telefono',cel.telefono,'marca',cel.marca,'modelo',cel.modelo,'imei',COALESCE(cel.imei,''),'inventario',COALESCE(cel.numero_inventario,''),'condicionTecnica',cel.condicion_tecnica,'responsable',cel.responsable,'observaciones',cel.observaciones,'activo',cel.activo,'custodia',cel.custodia);
 END IF;
 antes:=antes||jsonb_build_object('sedeNombre',sede_previa.nombre,'rbd',sede_previa.rbd,'sedeTipo',sede_previa.tipo,'direccion',sede_previa.direccion,'comuna',sede_previa.comuna,'correoInstitucional',sede_previa.correo_institucional);
 IF accion='devolucion' THEN sede:=sede_previa;END IF;
 despues:=despues||jsonb_build_object('sedeTipo',sede.tipo,'direccion',sede.direccion,'comuna',sede.comuna,'correoInstitucional',sede.correo_institucional,'categoriaNombre',CASE WHEN tipo='equipo' THEN (SELECT c.nombre FROM public.categorias_bienes c WHERE c.id=eq.categoria_id) ELSE 'Celular' END,'sedeNombre',CASE WHEN accion='asignacion' THEN sede.nombre ELSE sede_previa.nombre END,'rbd',CASE WHEN accion='asignacion' THEN sede.rbd ELSE sede_previa.rbd END);
 INSERT INTO public.movimientos_inventario(id,equipo_id,celular_id,accion,fecha,receptor,origen_sede_id,destino_sede_id,actor,motivo,solicitud,antes,despues)
 VALUES(p_id,CASE WHEN tipo='equipo' THEN id_bien END,CASE WHEN tipo='celular' THEN id_bien END,accion,fecha,receptor,CASE WHEN accion='devolucion' THEN referencia END,destino,p_actor,motivo,solicitud,antes,despues);
 IF tipo='equipo' THEN INSERT INTO public.equipos_historial(equipo_id,actor,motivo,antes,despues,movimiento_id) VALUES(id_bien,p_actor,motivo,antes,despues,p_id);
 ELSE INSERT INTO public.celulares_historial(celular_id,actor,motivo,antes,despues,movimiento_id) VALUES(id_bien,p_actor,motivo,antes,despues,p_id);END IF;
 RETURN jsonb_build_object('id',p_id,'repetida',false);
END;$fn$;
REVOKE ALL ON FUNCTION public.mover_bien_acceso(text,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mover_bien_acceso(text,uuid,jsonb) TO inventario_app;
CREATE OR REPLACE FUNCTION public.preparar_acta_entrega_acceso(p_actor text,p_id uuid,p_entrega uuid,p_metadata jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE e public.entregas_equipos%ROWTYPE;a public.actas_documentos%ROWTYPE;meta jsonb;datos jsonb;bienes jsonb;numero bigint;
BEGIN
 PERFORM pg_advisory_xact_lock(1794355200000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR p_entrega IS NULL THEN RAISE EXCEPTION 'Fuente requerida' USING ERRCODE='22023';END IF;
 SELECT * INTO e FROM public.entregas_equipos WHERE id=p_entrega FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Entrega no disponible' USING ERRCODE='P2702';END IF;
 -- Los contactos originales se conservan aunque las reglas de ingreso actual
 -- sean más estrictas. Esto no autoriza su uso como destino SMTP.
 IF jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023';END IF;
 meta:=public.normalizar_metadata_acta(CASE WHEN COALESCE(e.receptor_datos->>'correo','')<>'' THEN p_metadata||jsonb_build_object('recibeCorreo','') ELSE p_metadata END,false);
 IF COALESCE(e.receptor_datos->>'correo','')<>'' THEN
  IF jsonb_typeof(p_metadata->'recibeCorreo') IS DISTINCT FROM 'string' OR lower(btrim(p_metadata->>'recibeCorreo')) IS DISTINCT FROM lower(e.receptor_datos->>'correo') THEN RAISE EXCEPTION 'Conservar correo registrado' USING ERRCODE='22023';END IF;
  meta:=meta||jsonb_build_object('recibeCorreo',e.receptor_datos->>'correo');
 END IF;
 -- No reemplazar a la receptora original ni enriquecerla con el directorio actual.
 IF COALESCE(e.receptor_datos->>'rut','')<>'' AND meta->>'recibeRun' IS DISTINCT FROM upper(replace(e.receptor_datos->>'rut','.','')) THEN RAISE EXCEPTION 'Conservar RUN registrado' USING ERRCODE='22023';END IF;
 meta:=meta||jsonb_build_object('recibeCargo',e.receptor_cargo);
 SELECT * INTO a FROM public.actas_documentos WHERE id=p_id;
 IF FOUND THEN IF a.actor=p_actor AND a.entrega_id=p_entrega AND (a.solicitud||jsonb_build_object('recibeUnidad',COALESCE(a.solicitud->>'recibeUnidad',''),'recibeSubdireccion',COALESCE(a.solicitud->>'recibeSubdireccion','')))=meta THEN RETURN jsonb_build_object('id',a.id,'datos',a.datos,'completa',a.pdf IS NOT NULL);END IF;RAISE EXCEPTION 'Solicitud repetida con otros datos' USING ERRCODE='P2701';END IF;
 IF EXISTS(SELECT 1 FROM public.actas_documentos WHERE entrega_id=p_entrega) THEN RAISE EXCEPTION 'Ya existe un acta' USING ERRCODE='P2701';END IF;
 SELECT jsonb_agg(d.despues ORDER BY d.equipo_id) INTO bienes FROM public.entregas_detalle d WHERE d.entrega_id=e.id;
 IF bienes IS NULL THEN RAISE EXCEPTION 'Entrega sin bienes registrados' USING ERRCODE='P2702';END IF;
 UPDATE public.actas_contador SET ultimo=ultimo+1 WHERE id AND ultimo<999999999999 RETURNING ultimo INTO numero;
 IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo asignar folio' USING ERRCODE='P2702';END IF;
 datos:=jsonb_build_object('schema',3,'modelo','institucional-20261104','sedeTipo','jardin_infantil','tipo','entrega_historica','fecha',e.fecha_entrega::text,'emitidoEn',CURRENT_TIMESTAMP,'movimientoId',NULL,'entregaId',e.id,'clase','equipo',
 'origen','No informado al registrar la entrega','destino',e.sede_nombre,'sedeNombre',e.sede_nombre,'rbd',COALESCE(e.sede_rbd,''),'comuna',e.comuna,'sedeDatos',e.sede_datos,
 'receptorNombre',e.receptor_nombre,'actor',p_actor,'bienes',bienes,'metadata',meta,'folio',numero,'version',1);
 INSERT INTO public.actas_documentos(id,entrega_id,folio,actor,solicitud,datos) VALUES(p_id,p_entrega,numero,p_actor,meta,datos);
 RETURN jsonb_build_object('id',p_id,'datos',datos,'completa',false);
END;$fn$;
REVOKE ALL ON FUNCTION public.preparar_acta_entrega_acceso(text,uuid,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preparar_acta_entrega_acceso(text,uuid,uuid,jsonb) TO inventario_app;
`);}
export const down=false;
