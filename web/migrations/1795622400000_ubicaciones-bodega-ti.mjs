export function up(pgm){pgm.sql(`
CREATE TABLE public.ubicaciones_bodega(
 id uuid PRIMARY KEY,codigo text NOT NULL UNIQUE,nombre text NOT NULL UNIQUE,referencia text NOT NULL,activo boolean NOT NULL DEFAULT true
);
INSERT INTO public.ubicaciones_bodega(id,codigo,nombre,referencia) VALUES
 ('b0de0000-0000-4000-8000-000000000001','primer_piso','Bodega TI Primer Piso','Dependencias de SLEP Barrancas'),
 ('b0de0000-0000-4000-8000-000000000002','segundo_piso','Bodega TI Segundo Piso','Dependencias de SLEP Barrancas'),
 ('b0de0000-0000-4000-8000-000000000003','box_3','Bodega BOX 3','Dependencias de SLEP Barrancas'),
 ('b0de0000-0000-4000-8000-000000000004','box_4','Bodega BOX 4','Dependencias de SLEP Barrancas'),
 ('b0de0000-0000-4000-8000-000000000005','bicentenario','Bodega TI Bicentenario','Antiguo Liceo Bicentenario, Av. Cardenal Raúl Silva Henríquez #1185, Cerro Navia');
ALTER TABLE public.equipos ADD COLUMN ubicacion_bodega_id uuid REFERENCES public.ubicaciones_bodega(id);
ALTER TABLE public.celulares ADD COLUMN ubicacion_bodega_id uuid REFERENCES public.ubicaciones_bodega(id);
-- Los registros anteriores quedan sin ubicación confirmada; no se reclasifican bienes ni sedes.
CREATE INDEX equipos_ubicacion_bodega ON public.equipos(ubicacion_bodega_id) WHERE custodia='en_bodega';
CREATE INDEX celulares_ubicacion_bodega ON public.celulares(ubicacion_bodega_id) WHERE custodia='en_bodega';
CREATE FUNCTION public.limpiar_ubicacion_bodega() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN IF NEW.custodia<>'en_bodega' THEN NEW.ubicacion_bodega_id:=NULL;END IF;RETURN NEW;END;$fn$;
CREATE TRIGGER equipos_limpiar_ubicacion_bodega BEFORE UPDATE OF custodia ON public.equipos FOR EACH ROW EXECUTE FUNCTION public.limpiar_ubicacion_bodega();
CREATE TRIGGER celulares_limpiar_ubicacion_bodega BEFORE UPDATE OF custodia ON public.celulares FOR EACH ROW EXECUTE FUNCTION public.limpiar_ubicacion_bodega();
ALTER TABLE public.equipos ADD CONSTRAINT equipos_ubicacion_en_bodega CHECK(custodia='en_bodega' OR ubicacion_bodega_id IS NULL);
ALTER TABLE public.celulares ADD CONSTRAINT celulares_ubicacion_en_bodega CHECK(custodia='en_bodega' OR ubicacion_bodega_id IS NULL);
CREATE TABLE public.ubicaciones_bodega_historial(
 id uuid PRIMARY KEY,equipo_id uuid REFERENCES public.equipos(id),celular_id uuid REFERENCES public.celulares(id),
 actor text NOT NULL,solicitud jsonb NOT NULL,antes jsonb NOT NULL,despues jsonb NOT NULL,registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK(num_nonnulls(equipo_id,celular_id)=1)
);
CREATE INDEX ubicaciones_bodega_historial_equipo ON public.ubicaciones_bodega_historial(equipo_id,registrado_en DESC);
CREATE INDEX ubicaciones_bodega_historial_celular ON public.ubicaciones_bodega_historial(celular_id,registrado_en DESC);
REVOKE ALL ON public.ubicaciones_bodega,public.ubicaciones_bodega_historial FROM PUBLIC,inventario_app;
GRANT SELECT ON public.ubicaciones_bodega,public.ubicaciones_bodega_historial TO inventario_app;
REVOKE ALL ON FUNCTION public.limpiar_ubicacion_bodega() FROM PUBLIC,inventario_app;
CREATE FUNCTION public.ubicar_bien_bodega_acceso(p_actor text,p_solicitud uuid,p_datos jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE h public.ubicaciones_bodega_historial%ROWTYPE;tipo text;id_bien uuid;destino uuid;version_actual integer;anterior jsonb;posterior jsonb;sol jsonb;nombre_antes text;nombre_despues text;
BEGIN
 PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1794268800000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Operación reservada a UTIC' USING ERRCODE='42501';END IF;
 IF p_solicitud IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(p_datos))<>4 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_datos)t(k) WHERE t.k NOT IN ('tipo','bienId','version','ubicacion')) OR jsonb_typeof(p_datos->'tipo') IS DISTINCT FROM 'string' OR jsonb_typeof(p_datos->'bienId') IS DISTINCT FROM 'string' OR jsonb_typeof(p_datos->'ubicacion') IS DISTINCT FROM 'string' OR jsonb_typeof(p_datos->'version') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Solicitud inválida' USING ERRCODE='22023';END IF;
 tipo:=p_datos->>'tipo';
 IF tipo NOT IN ('equipo','celular') OR p_datos->>'bienId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR p_datos->>'version' !~ '^[1-9][0-9]{0,9}$' OR (p_datos->>'version')::numeric>=2147483647 OR (p_datos->>'ubicacion'<>'' AND p_datos->>'ubicacion' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') THEN RAISE EXCEPTION 'Bien, ubicación o versión inválidos' USING ERRCODE='22023';END IF;
 id_bien:=(p_datos->>'bienId')::uuid;destino:=NULLIF(p_datos->>'ubicacion','')::uuid;
 sol:=jsonb_build_object('tipo',tipo,'bienId',id_bien,'version',(p_datos->>'version')::integer,'ubicacion',COALESCE(destino::text,''));
 SELECT * INTO h FROM public.ubicaciones_bodega_historial WHERE id=p_solicitud;
 IF FOUND THEN IF h.actor=p_actor AND h.solicitud=sol THEN RETURN jsonb_build_object('version',(h.despues->>'version')::integer,'repetida',true);END IF;RAISE EXCEPTION 'Solicitud ya utilizada' USING ERRCODE='P3201';END IF;
 IF destino IS NOT NULL THEN PERFORM 1 FROM public.ubicaciones_bodega WHERE id=destino AND activo FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Ubicación no disponible' USING ERRCODE='22023';END IF;END IF;
 IF tipo='equipo' THEN SELECT to_jsonb(e) INTO anterior FROM public.equipos e WHERE id=id_bien FOR UPDATE;
 ELSE SELECT to_jsonb(c) INTO anterior FROM public.celulares c WHERE id=id_bien FOR UPDATE;END IF;
 IF anterior IS NULL THEN RAISE EXCEPTION 'Bien no disponible' USING ERRCODE='P3202';END IF;
 version_actual:=(anterior->>'version')::integer;
 IF version_actual<>(p_datos->>'version')::integer THEN RAISE EXCEPTION 'El bien cambió; recarga antes de confirmar' USING ERRCODE='P3201';END IF;
 IF anterior->>'custodia'<>'en_bodega' OR anterior->>'estado_administrativo'<>'activo' OR (tipo='celular' AND NOT (anterior->>'activo')::boolean) THEN RAISE EXCEPTION 'El estado del bien impide ubicarlo en bodega' USING ERRCODE='P3202';END IF;
 IF tipo='equipo' AND EXISTS(SELECT 1 FROM public.incidentes_robos_equipos d JOIN public.incidentes_robos i ON i.id=d.incidente_id WHERE d.equipo_id=id_bien AND i.estado IN ('reportado','validado') AND d.recuperado_fecha IS NULL) THEN RAISE EXCEPTION 'Hay un incidente abierto' USING ERRCODE='P3202';END IF;
 SELECT nombre INTO nombre_antes FROM public.ubicaciones_bodega WHERE id=(anterior->>'ubicacion_bodega_id')::uuid;
 SELECT nombre INTO nombre_despues FROM public.ubicaciones_bodega WHERE id=destino;
 IF tipo='equipo' THEN
  UPDATE public.equipos SET ubicacion_bodega_id=destino,version=version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=id_bien RETURNING to_jsonb(equipos) INTO posterior;
  INSERT INTO public.equipos_historial(equipo_id,actor,motivo,antes,despues) VALUES(id_bien,p_actor,'Confirmación de ubicación física en Bodega TI',jsonb_build_object('sede_id',anterior->>'sede_id','ubicacionBodega',nombre_antes),jsonb_build_object('sede_id',posterior->>'sede_id','ubicacionBodega',nombre_despues));
 ELSE
  UPDATE public.celulares SET ubicacion_bodega_id=destino,version=version+1,actualizado_por=p_actor,actualizado_en=CURRENT_TIMESTAMP WHERE id=id_bien RETURNING to_jsonb(celulares) INTO posterior;
  INSERT INTO public.celulares_historial(celular_id,actor,motivo,antes,despues) VALUES(id_bien,p_actor,'Confirmación de ubicación física en Bodega TI',jsonb_build_object('sedeId',anterior->>'sede_id','ubicacionBodega',nombre_antes),jsonb_build_object('sedeId',posterior->>'sede_id','ubicacionBodega',nombre_despues));
 END IF;
 INSERT INTO public.ubicaciones_bodega_historial(id,equipo_id,celular_id,actor,solicitud,antes,despues) VALUES(p_solicitud,CASE WHEN tipo='equipo' THEN id_bien END,CASE WHEN tipo='celular' THEN id_bien END,p_actor,sol,anterior,posterior);
 RETURN jsonb_build_object('version',(posterior->>'version')::integer,'repetida',false);
END;$fn$;
-- Ampliar solo las instantáneas futuras; no modificar movimientos ni PDFs emitidos.
DO $patch$
DECLARE d text;
BEGIN
 d:=pg_get_functiondef('public.mover_bien_acceso(text,uuid,jsonb)'::regprocedure);
 IF strpos(d,$s$antes:=to_jsonb(eq);$s$)=0 OR strpos(d,$s$despues:=to_jsonb(eq);$s$)=0 OR strpos(d,$s$'custodia',cel.custodia)$s$)=0 THEN RAISE EXCEPTION 'Definición de movimientos inesperada; revisar antes de migrar';END IF;
 d:=replace(d,$s$antes:=to_jsonb(eq);$s$,$s$antes:=to_jsonb(eq)||jsonb_build_object('ubicacionBodega',(SELECT nombre FROM public.ubicaciones_bodega WHERE id=eq.ubicacion_bodega_id));$s$);
 d:=replace(d,$s$despues:=to_jsonb(eq);$s$,$s$despues:=to_jsonb(eq)||jsonb_build_object('ubicacionBodega',(SELECT nombre FROM public.ubicaciones_bodega WHERE id=eq.ubicacion_bodega_id));$s$);
 d:=replace(d,$s$'custodia',cel.custodia)$s$,$s$'custodia',cel.custodia,'ubicacionBodegaId',cel.ubicacion_bodega_id,'ubicacionBodega',(SELECT nombre FROM public.ubicaciones_bodega WHERE id=cel.ubicacion_bodega_id))$s$);EXECUTE d;
 d:=pg_get_functiondef('public.regularizar_entregas_acceso(text,uuid,jsonb)'::regprocedure);
 IF strpos(d,$s$UPDATE public.equipos_historial h SET despues=h.despues||jsonb_build_object('custodia','asignado')$s$)=0 THEN RAISE EXCEPTION 'Definición de entregas inesperada; revisar antes de migrar';END IF;
 d:=replace(d,$s$UPDATE public.equipos_historial h SET despues=h.despues||jsonb_build_object('custodia','asignado')$s$,$s$
 UPDATE public.entregas_detalle x SET antes=x.antes||jsonb_build_object('ubicacionBodega',(SELECT nombre FROM public.ubicaciones_bodega WHERE id=(x.antes->>'ubicacion_bodega_id')::uuid)),despues=x.despues||jsonb_build_object('custodia','asignado','ubicacion_bodega_id',NULL,'ubicacionBodega',NULL) WHERE x.entrega_id IN(SELECT id FROM public.entregas_equipos WHERE lote_id=p_solicitud);
 UPDATE public.equipos_historial h SET antes=h.antes||jsonb_build_object('ubicacionBodega',(SELECT nombre FROM public.ubicaciones_bodega WHERE id=(h.antes->>'ubicacion_bodega_id')::uuid)),despues=h.despues||jsonb_build_object('custodia','asignado','ubicacion_bodega_id',NULL,'ubicacionBodega',NULL)$s$);EXECUTE d;
END;$patch$;
REVOKE ALL ON FUNCTION public.ubicar_bien_bodega_acceso(text,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ubicar_bien_bodega_acceso(text,uuid,jsonb) TO inventario_app;
`);}
export const down=false;
