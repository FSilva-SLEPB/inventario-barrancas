export function up(pgm){pgm.sql(`
-- Una fuente inmutable por documento; los PDFs anteriores no se regeneran.
ALTER TABLE public.actas_documentos ALTER COLUMN movimiento_id DROP NOT NULL;
ALTER TABLE public.actas_documentos ADD COLUMN entrega_id uuid UNIQUE REFERENCES public.entregas_equipos(id);
ALTER TABLE public.actas_documentos ADD CONSTRAINT actas_fuente_unica CHECK(num_nonnulls(movimiento_id,entrega_id)=1);
CREATE FUNCTION public.normalizar_metadata_acta(p_metadata jsonb,p_obligatorios boolean)
RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE meta jsonb:='{}';k text;v text;maximo integer;rut text;suma integer;digito integer;dv text;
BEGIN
 IF jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_metadata)t(k) WHERE t.k NOT IN ('entregaNombre','entregaRun','entregaCargo','entregaCorreo','recibeRun','recibeCargo','recibeCorreo','accesorios','observaciones')) THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023';END IF;
 FOREACH k IN ARRAY ARRAY['entregaNombre','entregaRun','entregaCargo','entregaCorreo','recibeRun','recibeCargo','recibeCorreo','accesorios','observaciones'] LOOP
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
 IF p_id IS NULL OR p_movimiento IS NULL OR jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_metadata)t(k) WHERE t.k NOT IN ('entregaNombre','entregaRun','entregaCargo','entregaCorreo','recibeRun','recibeCargo','recibeCorreo','accesorios','observaciones')) THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023';END IF;
 meta:=public.normalizar_metadata_acta(p_metadata,true);
 SELECT * INTO a FROM public.actas_documentos WHERE id=p_id;
 IF FOUND THEN IF a.actor=p_actor AND a.movimiento_id=p_movimiento AND a.solicitud=meta THEN RETURN jsonb_build_object('id',a.id,'datos',a.datos,'completa',a.pdf IS NOT NULL);END IF;RAISE EXCEPTION 'Solicitud repetida con otros datos' USING ERRCODE='P2701';END IF;
 IF EXISTS(SELECT 1 FROM public.actas_documentos WHERE movimiento_id=p_movimiento) THEN RAISE EXCEPTION 'Ya existe un acta' USING ERRCODE='P2701';END IF;
 SELECT * INTO m FROM public.movimientos_inventario WHERE id=p_movimiento FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Movimiento no disponible' USING ERRCODE='P2702';END IF;
 UPDATE public.actas_contador SET ultimo=ultimo+1 WHERE id AND ultimo<999999999999 RETURNING ultimo INTO numero;
 IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo asignar folio' USING ERRCODE='P2702';END IF;
 datos:=jsonb_build_object('schema',1,'tipo',m.accion,'fecha',m.fecha::text,'emitidoEn',CURRENT_TIMESTAMP,'movimientoId',m.id,'clase',CASE WHEN m.equipo_id IS NOT NULL THEN 'equipo' ELSE 'celular' END,
 'origen',CASE WHEN m.accion='devolucion' THEN m.antes->>'sedeNombre' ELSE 'Bodega TI' END,'destino',CASE WHEN m.accion='asignacion' THEN m.despues->>'sedeNombre' ELSE 'Bodega TI' END,
 'sedeNombre',COALESCE(m.despues->>'sedeNombre',''),'rbd',COALESCE(m.despues->>'rbd',''),'receptorNombre',m.receptor,'actor',p_actor,'bienes',jsonb_build_array(m.despues),'metadata',meta,'folio',numero,'version',1);
 INSERT INTO public.actas_documentos(id,movimiento_id,folio,actor,solicitud,datos) VALUES(p_id,p_movimiento,numero,p_actor,meta,datos);
 RETURN jsonb_build_object('id',p_id,'datos',datos,'completa',false);
END;$fn$;
CREATE FUNCTION public.preparar_acta_entrega_acceso(p_actor text,p_id uuid,p_entrega uuid,p_metadata jsonb)
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
 IF FOUND THEN IF a.actor=p_actor AND a.entrega_id=p_entrega AND a.solicitud=meta THEN RETURN jsonb_build_object('id',a.id,'datos',a.datos,'completa',a.pdf IS NOT NULL);END IF;RAISE EXCEPTION 'Solicitud repetida con otros datos' USING ERRCODE='P2701';END IF;
 IF EXISTS(SELECT 1 FROM public.actas_documentos WHERE entrega_id=p_entrega) THEN RAISE EXCEPTION 'Ya existe un acta' USING ERRCODE='P2701';END IF;
 SELECT jsonb_agg(d.despues ORDER BY d.equipo_id) INTO bienes FROM public.entregas_detalle d WHERE d.entrega_id=e.id;
 IF bienes IS NULL THEN RAISE EXCEPTION 'Entrega sin bienes registrados' USING ERRCODE='P2702';END IF;
 UPDATE public.actas_contador SET ultimo=ultimo+1 WHERE id AND ultimo<999999999999 RETURNING ultimo INTO numero;
 IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo asignar folio' USING ERRCODE='P2702';END IF;
 datos:=jsonb_build_object('schema',2,'tipo','entrega_historica','fecha',e.fecha_entrega::text,'emitidoEn',CURRENT_TIMESTAMP,'movimientoId',NULL,'entregaId',e.id,'clase','equipo',
 'origen','No informado al registrar la entrega','destino',e.sede_nombre,'sedeNombre',e.sede_nombre,'rbd',COALESCE(e.sede_rbd,''),'comuna',e.comuna,'sedeDatos',e.sede_datos,
 'receptorNombre',e.receptor_nombre,'actor',p_actor,'bienes',bienes,'metadata',meta,'folio',numero,'version',1);
 INSERT INTO public.actas_documentos(id,entrega_id,folio,actor,solicitud,datos) VALUES(p_id,p_entrega,numero,p_actor,meta,datos);
 RETURN jsonb_build_object('id',p_id,'datos',datos,'completa',false);
END;$fn$;
REVOKE ALL ON FUNCTION public.preparar_acta_entrega_acceso(text,uuid,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preparar_acta_entrega_acceso(text,uuid,uuid,jsonb) TO inventario_app;
`);}
export const down=false;
