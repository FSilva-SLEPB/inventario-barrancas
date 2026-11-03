export function up(pgm){pgm.sql(`
ALTER TABLE public.equipos ADD COLUMN custodia text NOT NULL DEFAULT 'asignado' CHECK(custodia IN ('en_bodega','asignado'));
UPDATE public.equipos SET custodia='en_bodega' WHERE situacion='pendiente_entrega';
ALTER TABLE public.celulares ADD COLUMN custodia text NOT NULL DEFAULT 'asignado' CHECK(custodia IN ('en_bodega','asignado'));
CREATE TABLE public.movimientos_inventario (
 id uuid PRIMARY KEY,
 equipo_id uuid REFERENCES public.equipos(id),celular_id uuid REFERENCES public.celulares(id),
 accion text NOT NULL CHECK(accion IN ('devolucion','asignacion')),
 fecha date NOT NULL,receptor text NOT NULL CHECK(length(btrim(receptor)) BETWEEN 1 AND 200),
 origen_sede_id uuid REFERENCES public.sedes(id),destino_sede_id uuid REFERENCES public.sedes(id),
 actor text NOT NULL,motivo text NOT NULL CHECK(length(btrim(motivo)) BETWEEN 1 AND 500),
 solicitud jsonb NOT NULL,antes jsonb NOT NULL,despues jsonb NOT NULL,
 registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(num_nonnulls(equipo_id,celular_id)=1),
 CHECK((accion='devolucion' AND origen_sede_id IS NOT NULL AND destino_sede_id IS NULL) OR (accion='asignacion' AND origen_sede_id IS NULL AND destino_sede_id IS NOT NULL))
);
CREATE INDEX movimientos_inventario_equipo ON public.movimientos_inventario(equipo_id,fecha);
CREATE INDEX movimientos_inventario_celular ON public.movimientos_inventario(celular_id,fecha);
ALTER TABLE public.equipos_historial ADD COLUMN movimiento_id uuid REFERENCES public.movimientos_inventario(id);
ALTER TABLE public.celulares_historial ADD COLUMN movimiento_id uuid REFERENCES public.movimientos_inventario(id);
REVOKE ALL ON public.movimientos_inventario FROM PUBLIC,inventario_app;
GRANT SELECT ON public.movimientos_inventario TO inventario_app;

-- Las correcciones mantienen el contrato anterior; sus implementaciones quedan privadas.
ALTER FUNCTION public.guardar_equipo_acceso(text,jsonb,integer,text,uuid) RENAME TO guardar_equipo_ficha_base;
REVOKE ALL ON FUNCTION public.guardar_equipo_ficha_base(text,jsonb,integer,text,uuid) FROM PUBLIC,inventario_app;
CREATE FUNCTION public.guardar_equipo_acceso(p_actor text,p_datos jsonb,p_version integer,p_motivo text,p_carga uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE previo public.equipos%ROWTYPE;posterior public.equipos%ROWTYPE;rol text;id_bien uuid;inicial text;
BEGIN
 PERFORM pg_advisory_xact_lock(1793577600000);
 PERFORM pg_advisory_xact_lock(1794268800000);
 SELECT u.rol INTO rol FROM public.usuarios_acceso u WHERE u.correo=p_actor AND u.activo AND u.rol IN ('administrador','administrador_gestion','encargado') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF NULLIF(p_datos->>'id','') IS NOT NULL THEN SELECT * INTO previo FROM public.equipos WHERE id=(p_datos->>'id')::uuid FOR UPDATE;END IF;
 IF previo.id IS NOT NULL AND rol='encargado' AND previo.custodia='en_bodega' THEN RAISE EXCEPTION 'El bien está en Bodega TI' USING ERRCODE='42501';END IF;
 IF p_datos ? 'custodiaInicial' THEN
  inicial:=p_datos->>'custodiaInicial';
  IF jsonb_typeof(p_datos->'custodiaInicial') IS DISTINCT FROM 'string' OR inicial NOT IN ('en_bodega','asignado') OR previo.id IS NOT NULL OR p_carga IS NOT NULL THEN RAISE EXCEPTION 'Estado inicial inválido' USING ERRCODE='22023';END IF;
  IF rol='encargado' AND inicial<>'asignado' THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 END IF;
 id_bien:=public.guardar_equipo_ficha_base(p_actor,p_datos-'custodiaInicial',p_version,p_motivo,p_carga);
 SELECT * INTO posterior FROM public.equipos WHERE id=id_bien;
 IF previo.id IS NULL THEN
  inicial:=COALESCE(inicial,CASE WHEN posterior.situacion='pendiente_entrega' THEN 'en_bodega' ELSE 'asignado' END);
  UPDATE public.equipos SET custodia=inicial,situacion=CASE WHEN p_datos ? 'custodiaInicial' THEN CASE WHEN inicial='en_bodega' THEN 'pendiente_entrega' WHEN (SELECT tipo FROM public.sedes WHERE id=posterior.sede_id)='nivel_central' THEN 'registrado_nc' ELSE 'recibido' END ELSE posterior.situacion END WHERE id=id_bien RETURNING * INTO posterior;
  UPDATE public.equipos_historial h SET despues=h.despues||jsonb_build_object('custodia',inicial,'situacion',posterior.situacion) WHERE h.id=(SELECT max(x.id) FROM public.equipos_historial x WHERE x.equipo_id=id_bien);
 END IF;
 RETURN id_bien;
END;$fn$;
REVOKE ALL ON FUNCTION public.guardar_equipo_acceso(text,jsonb,integer,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_equipo_acceso(text,jsonb,integer,text,uuid) TO inventario_app;

ALTER FUNCTION public.guardar_celular_acceso(text,uuid,jsonb,integer,text) RENAME TO guardar_celular_ficha_base;
REVOKE ALL ON FUNCTION public.guardar_celular_ficha_base(text,uuid,jsonb,integer,text) FROM PUBLIC,inventario_app;
CREATE FUNCTION public.guardar_celular_acceso(p_actor text,p_id uuid,p_datos jsonb,p_version integer,p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE previo public.celulares%ROWTYPE;posterior public.celulares%ROWTYPE;rol text;sede_actor uuid;resultado jsonb;inicial text;
BEGIN
 PERFORM pg_advisory_xact_lock(1793577600000);
 PERFORM pg_advisory_xact_lock(1794268800000);
 SELECT u.rol,u.sede_id INTO rol,sede_actor FROM public.usuarios_acceso u WHERE u.correo=p_actor AND u.activo AND u.rol IN ('administrador','administrador_gestion','encargado') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF rol='encargado' AND sede_actor IS DISTINCT FROM (p_datos->>'sedeId')::uuid THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 SELECT * INTO previo FROM public.celulares WHERE id=p_id FOR UPDATE;
 IF previo.id IS NOT NULL THEN
  IF rol='encargado' AND (previo.custodia='en_bodega' OR previo.sede_id IS DISTINCT FROM sede_actor) THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
  IF previo.sede_id IS DISTINCT FROM (p_datos->>'sedeId')::uuid THEN RAISE EXCEPTION 'Usa devolución y asignación para cambiar la sede' USING ERRCODE='P2603';END IF;
 END IF;
 IF p_datos ? 'custodiaInicial' THEN
  inicial:=p_datos->>'custodiaInicial';
  IF jsonb_typeof(p_datos->'custodiaInicial') IS DISTINCT FROM 'string' OR inicial NOT IN ('en_bodega','asignado') OR (previo.id IS NOT NULL AND NOT (p_version=0 AND previo.creado_por=p_actor AND previo.custodia=inicial)) THEN RAISE EXCEPTION 'Estado inicial inválido' USING ERRCODE='22023';END IF;
  IF rol='encargado' AND inicial<>'asignado' THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 END IF;
 resultado:=public.guardar_celular_ficha_base(p_actor,p_id,p_datos-'custodiaInicial',p_version,p_motivo);
 SELECT * INTO posterior FROM public.celulares WHERE id=p_id;
 IF previo.id IS NULL THEN
  inicial:=COALESCE(inicial,'asignado');UPDATE public.celulares SET custodia=inicial WHERE id=p_id;
 END IF;
 IF previo.id IS NULL OR posterior.version>previo.version THEN
  UPDATE public.celulares_historial h SET despues=h.despues||jsonb_build_object('custodia',COALESCE(inicial,posterior.custodia)),antes=CASE WHEN h.antes IS NULL THEN NULL ELSE h.antes||jsonb_build_object('custodia',previo.custodia) END WHERE h.id=(SELECT max(x.id) FROM public.celulares_historial x WHERE x.celular_id=p_id);
 END IF;
 RETURN resultado;
END;$fn$;
REVOKE ALL ON FUNCTION public.guardar_celular_acceso(text,uuid,jsonb,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_celular_acceso(text,uuid,jsonb,integer,text) TO inventario_app;

ALTER FUNCTION public.regularizar_entregas_acceso(text,uuid,jsonb) RENAME TO regularizar_entregas_base;
REVOKE ALL ON FUNCTION public.regularizar_entregas_base(text,uuid,jsonb) FROM PUBLIC,inventario_app;
CREATE FUNCTION public.regularizar_entregas_acceso(p_actor text,p_solicitud uuid,p_grupos jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE existente boolean;resultado jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(1793577600000);
 PERFORM pg_advisory_xact_lock(1794268800000);
 existente:=EXISTS(SELECT 1 FROM public.entregas_lotes WHERE id=p_solicitud);
 resultado:=public.regularizar_entregas_base(p_actor,p_solicitud,p_grupos);
 IF NOT existente THEN
  UPDATE public.equipos e SET custodia='asignado' WHERE e.id IN(SELECT d.equipo_id FROM public.entregas_detalle d JOIN public.entregas_equipos x ON x.id=d.entrega_id WHERE x.lote_id=p_solicitud);
  UPDATE public.equipos_historial h SET despues=h.despues||jsonb_build_object('custodia','asignado') WHERE h.entrega_id IN(SELECT id FROM public.entregas_equipos WHERE lote_id=p_solicitud);
 END IF;
 RETURN resultado;
END;$fn$;
REVOKE ALL ON FUNCTION public.regularizar_entregas_acceso(text,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.regularizar_entregas_acceso(text,uuid,jsonb) TO inventario_app;

CREATE FUNCTION public.mover_bien_acceso(p_actor text,p_id uuid,p_datos jsonb)
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
 antes:=antes||jsonb_build_object('sedeNombre',sede_previa.nombre,'rbd',sede_previa.rbd);
 despues:=despues||jsonb_build_object('sedeNombre',CASE WHEN accion='asignacion' THEN sede.nombre ELSE sede_previa.nombre END,'rbd',CASE WHEN accion='asignacion' THEN sede.rbd ELSE sede_previa.rbd END);
 INSERT INTO public.movimientos_inventario(id,equipo_id,celular_id,accion,fecha,receptor,origen_sede_id,destino_sede_id,actor,motivo,solicitud,antes,despues)
 VALUES(p_id,CASE WHEN tipo='equipo' THEN id_bien END,CASE WHEN tipo='celular' THEN id_bien END,accion,fecha,receptor,CASE WHEN accion='devolucion' THEN referencia END,destino,p_actor,motivo,solicitud,antes,despues);
 IF tipo='equipo' THEN INSERT INTO public.equipos_historial(equipo_id,actor,motivo,antes,despues,movimiento_id) VALUES(id_bien,p_actor,motivo,antes,despues,p_id);
 ELSE INSERT INTO public.celulares_historial(celular_id,actor,motivo,antes,despues,movimiento_id) VALUES(id_bien,p_actor,motivo,antes,despues,p_id);END IF;
 RETURN jsonb_build_object('id',p_id,'repetida',false);
END;$fn$;
REVOKE ALL ON FUNCTION public.mover_bien_acceso(text,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mover_bien_acceso(text,uuid,jsonb) TO inventario_app;
`);}
export const down=false;
