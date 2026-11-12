exports.up=pgm=>pgm.sql(String.raw`
-- Nuevos registros únicamente: conservar las fichas, PDFs e importaciones anteriores.
CREATE OR REPLACE FUNCTION public.cargar_equipos_acceso(p_actor text,p_filas jsonb,p_archivo text,p_sha text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE carga public.cargas_equipos%ROWTYPE;fila jsonb;unidades integer;total integer:=0;n integer;id_bien uuid;admin text;datos jsonb;compra jsonb;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'equipos.registrar');
 IF public.rbac_contexto(p_actor)->>'alcance' IS DISTINCT FROM 'global' THEN RAISE EXCEPTION 'La carga completa requiere alcance global' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(1793577600000);
 IF jsonb_typeof(p_filas) IS DISTINCT FROM 'array' OR jsonb_array_length(p_filas) NOT BETWEEN 1 AND 2500 OR p_archivo IS NULL OR length(p_archivo) NOT BETWEEN 1 AND 200 OR p_archivo ~ '[[:cntrl:]]' OR p_sha IS NULL OR p_sha !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Archivo o filas inválidos' USING ERRCODE='22023';END IF;
 FOR fila IN SELECT value FROM jsonb_array_elements(p_filas) LOOP
  IF jsonb_typeof(fila) IS DISTINCT FROM 'object' OR (fila ? 'cantidad' AND (jsonb_typeof(fila->'cantidad') IS DISTINCT FROM 'number' OR fila->>'cantidad' !~ '^[1-9][0-9]{0,3}$')) THEN RAISE EXCEPTION 'Cantidad inválida' USING ERRCODE='22023';END IF;
  unidades:=COALESCE((fila->>'cantidad')::integer,1);total:=total+unidades;
  IF unidades NOT BETWEEN 1 AND 2500 OR total>2500 OR (unidades>1 AND (NULLIF(btrim(fila->>'serie'),'') IS NOT NULL OR NULLIF(btrim(fila->>'inventario'),'') IS NOT NULL)) THEN RAISE EXCEPTION 'No repitas identificadores individuales al cargar varias unidades' USING ERRCODE='22023';END IF;
  IF fila ? 'antecedentesCarga' AND (jsonb_typeof(fila->'antecedentesCarga') IS DISTINCT FROM 'object' OR octet_length((fila->'antecedentesCarga')::text)>100000) THEN RAISE EXCEPTION 'Antecedentes inválidos' USING ERRCODE='22023';END IF;
  admin:=COALESCE(fila->>'estadoAdministrativo','activo');IF admin NOT IN ('activo','robado','no_encontrado','dado_de_baja') THEN RAISE EXCEPTION 'Estado administrativo inválido' USING ERRCODE='22023';END IF;
  IF admin IN ('robado','no_encontrado') THEN PERFORM public.rbac_exigir(p_actor,'bajas.confirmar');END IF;
 END LOOP;
 SELECT * INTO carga FROM public.cargas_equipos WHERE sha256=p_sha;
 IF FOUND THEN RETURN jsonb_build_object('id',carga.id,'cantidad',carga.cantidad,'repetida',true);END IF;
 INSERT INTO public.cargas_equipos(actor,archivo,sha256,cantidad) VALUES(p_actor,p_archivo,p_sha,total) RETURNING * INTO carga;
 FOR fila IN SELECT value FROM jsonb_array_elements(p_filas) LOOP
  unidades:=COALESCE((fila->>'cantidad')::integer,1);admin:=COALESCE(fila->>'estadoAdministrativo','activo');
  FOR n IN 1..unidades LOOP
   compra:=COALESCE(fila->'compra','{}'::jsonb)-'bajaPendienteTI';
   IF fila ? 'antecedentesCarga' THEN compra:=compra||jsonb_build_object('antecedentesCarga',fila->'antecedentesCarga','cantidadCarga',unidades,'unidadCarga',n);END IF;
   datos:=fila||jsonb_build_object('compra',compra);
   id_bien:=public.guardar_equipo_acceso(p_actor,datos,0,'Carga histórica: '||p_archivo,carga.id);
   IF admin='dado_de_baja' THEN
    UPDATE public.equipos SET datos_compra=datos_compra||jsonb_build_object('bajaPendienteTI',true) WHERE id=id_bien;
    UPDATE public.equipos_historial h SET despues=h.despues||jsonb_build_object('datos_compra',(SELECT e.datos_compra FROM public.equipos e WHERE e.id=id_bien)) WHERE h.id=(SELECT max(x.id) FROM public.equipos_historial x WHERE x.equipo_id=id_bien);
   END IF;
   IF admin IN ('robado','no_encontrado') THEN PERFORM public.guardar_estados_activo_acceso(p_actor,gen_random_uuid(),jsonb_build_object('clase','equipo','id',id_bien,'version',1,'administrativo',admin,'condicion',''));END IF;
  END LOOP;
 END LOOP;
 RETURN jsonb_build_object('id',carga.id,'cantidad',total,'repetida',false);
END;$fn$;
REVOKE ALL ON FUNCTION public.cargar_equipos_acceso(text,jsonb,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cargar_equipos_acceso(text,jsonb,text,text) TO inventario_app;

CREATE FUNCTION public.proteger_baja_pendiente_carga() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF OLD.datos_compra->'bajaPendienteTI'='true'::jsonb AND (NEW.custodia IS DISTINCT FROM OLD.custodia OR NEW.sede_id IS DISTINCT FROM OLD.sede_id) THEN RAISE EXCEPTION 'La baja declarada en la carga está pendiente de validación TI' USING ERRCODE='P3005';END IF;
 RETURN NEW;
END;$fn$;
CREATE TRIGGER equipos_baja_pendiente_carga BEFORE UPDATE OF custodia,sede_id ON public.equipos FOR EACH ROW EXECUTE FUNCTION public.proteger_baja_pendiente_carga();
REVOKE ALL ON FUNCTION public.proteger_baja_pendiente_carga() FROM PUBLIC,inventario_app;
CREATE OR REPLACE FUNCTION public.guardar_estados_activo_acceso(p_actor text, p_solicitud uuid, p_datos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE clase text;id_bien uuid;admin text;condicion text;version_actual integer;sol jsonb;anterior jsonb;posterior jsonb;repetida public.cambios_estados_activo%ROWTYPE;k text;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'bajas.confirmar');

 PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1794268800000);
 PERFORM 1 FROM public.usuarios_acceso u WHERE u.correo=p_actor AND u.activo AND public.rbac_rol_motor(u.correo) IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Solo UTIC cambia estados administrativos' USING ERRCODE='42501';END IF;
 IF p_solicitud IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(p_datos))<>5 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_datos)t(k) WHERE t.k NOT IN ('clase','id','version','administrativo','condicion')) THEN RAISE EXCEPTION 'Solicitud inválida' USING ERRCODE='22023';END IF;
 FOREACH k IN ARRAY ARRAY['clase','id','administrativo','condicion'] LOOP
  IF jsonb_typeof(p_datos->k) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Campo inválido' USING ERRCODE='22023';END IF;
 END LOOP;
 clase:=p_datos->>'clase';admin:=p_datos->>'administrativo';condicion:=p_datos->>'condicion';
 IF clase NOT IN ('equipo','celular') OR admin NOT IN ('activo','robado','no_encontrado','dado_de_baja') OR (p_datos->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR jsonb_typeof(p_datos->'version') IS DISTINCT FROM 'number' OR (p_datos->>'version') !~ '^[1-9][0-9]{0,9}$' OR (p_datos->>'version')::numeric>=2147483647 THEN RAISE EXCEPTION 'Estado, bien o versión inválidos' USING ERRCODE='22023';END IF;
 id_bien:=(p_datos->>'id')::uuid;sol:=p_datos;
 SELECT * INTO repetida FROM public.cambios_estados_activo WHERE id=p_solicitud;
 IF FOUND THEN
  IF repetida.actor=p_actor AND repetida.solicitud=sol THEN RETURN jsonb_build_object('version',(repetida.despues->>'version')::integer,'fechaBaja',repetida.despues->>'fecha_baja','repetida',true);END IF;
  RAISE EXCEPTION 'Solicitud reutilizada' USING ERRCODE='P3001';
 END IF;
 IF clase='equipo' THEN SELECT to_jsonb(e) INTO anterior FROM public.equipos e WHERE e.id=id_bien FOR UPDATE;
 ELSE SELECT to_jsonb(c) INTO anterior FROM public.celulares c WHERE c.id=id_bien FOR UPDATE;END IF;
 IF anterior IS NULL THEN RAISE EXCEPTION 'Bien no disponible' USING ERRCODE='42501';END IF;
 IF anterior->>'estado_administrativo'='dado_de_baja' THEN RAISE EXCEPTION 'Registro histórico de solo lectura' USING ERRCODE='P3002';END IF;
 IF (anterior->>'version')::integer<>(p_datos->>'version')::integer THEN RAISE EXCEPTION 'El registro cambió' USING ERRCODE='P3001';END IF;
 IF anterior->>'custodia'='en_prestamo' THEN RAISE EXCEPTION 'Devuelve el préstamo antes de cambiar sus estados' USING ERRCODE='P2802';END IF;
 IF admin='activo' THEN
  IF condicion NOT IN ('','operativo','bodega_ti','mantencion','mal_estado','obsoleto') THEN RAISE EXCEPTION 'Selecciona una condición' USING ERRCODE='22023';END IF;
  IF clase='equipo' AND EXISTS(SELECT 1 FROM public.incidentes_robos_equipos d JOIN public.incidentes_robos i ON i.id=d.incidente_id WHERE d.equipo_id=id_bien AND i.estado IN ('reportado','validado') AND d.recuperado_fecha IS NULL) THEN RAISE EXCEPTION 'Resuelve el incidente antes de activar el bien' USING ERRCODE='P3004';END IF;
 ELSIF admin='dado_de_baja' THEN condicion:='obsoleto';
 ELSE condicion:='';END IF;
 IF clase='equipo' THEN
  UPDATE public.equipos SET datos_compra=datos_compra-'bajaPendienteTI',estado_administrativo=admin,condicion_tecnica=condicion,fecha_baja=CASE WHEN admin='dado_de_baja' THEN CURRENT_TIMESTAMP END,version=version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=id_bien RETURNING to_jsonb(equipos) INTO posterior;
  INSERT INTO public.equipos_historial(equipo_id,actor,motivo,antes,despues) VALUES(id_bien,p_actor,'Actualización de estados del activo',anterior,posterior);
 ELSE
  UPDATE public.celulares SET estado_administrativo=admin,condicion_tecnica=condicion,fecha_baja=CASE WHEN admin='dado_de_baja' THEN CURRENT_TIMESTAMP END,version=version+1,actualizado_por=p_actor,actualizado_en=CURRENT_TIMESTAMP WHERE id=id_bien RETURNING to_jsonb(celulares) INTO posterior;
  INSERT INTO public.celulares_historial(celular_id,actor,motivo,antes,despues) VALUES(id_bien,p_actor,'Actualización de estados del activo',
   jsonb_build_object('sedeId',anterior->>'sede_id','condicionTecnica',anterior->>'condicion_tecnica','estadoAdministrativo',anterior->>'estado_administrativo','fechaBaja',anterior->>'fecha_baja'),
   jsonb_build_object('sedeId',posterior->>'sede_id','condicionTecnica',posterior->>'condicion_tecnica','estadoAdministrativo',posterior->>'estado_administrativo','fechaBaja',posterior->>'fecha_baja'));
 END IF;
 INSERT INTO public.cambios_estados_activo(id,equipo_id,celular_id,actor,solicitud,antes,despues) VALUES(p_solicitud,CASE WHEN clase='equipo' THEN id_bien END,CASE WHEN clase='celular' THEN id_bien END,p_actor,sol,anterior,posterior);
 RETURN jsonb_build_object('version',(posterior->>'version')::integer,'fechaBaja',posterior->>'fecha_baja','repetida',false);
END;$function$;
`);
exports.down=()=>{throw new Error('Conservar las cargas e historial; restaurar un respaldo verificado para revertir.');};
