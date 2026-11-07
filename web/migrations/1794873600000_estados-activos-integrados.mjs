export function up(pgm){pgm.sql(`
-- Los valores antiguos se conservan; no se clasifican como operativos ni como baja.
ALTER TABLE public.equipos ADD COLUMN estado_administrativo text NOT NULL DEFAULT 'activo' CHECK(estado_administrativo IN ('activo','robado','no_encontrado','dado_de_baja'));
ALTER TABLE public.celulares ADD COLUMN estado_administrativo text NOT NULL DEFAULT 'activo' CHECK(estado_administrativo IN ('activo','robado','no_encontrado','dado_de_baja'));
ALTER TABLE public.equipos ADD COLUMN fecha_baja timestamptz;
ALTER TABLE public.celulares ADD COLUMN fecha_baja timestamptz;
ALTER TABLE public.equipos DROP CONSTRAINT equipos_condicion_tecnica_check;
ALTER TABLE public.celulares DROP CONSTRAINT celulares_condicion_tecnica_check;
ALTER TABLE public.equipos ADD CONSTRAINT equipos_condicion_tecnica_check CHECK(condicion_tecnica IN ('','sin_verificar','operativo','en_reparacion','fuera_de_servicio','bodega_ti','mantencion','mal_estado','obsoleto'));
ALTER TABLE public.celulares ADD CONSTRAINT celulares_condicion_tecnica_check CHECK(condicion_tecnica IN ('','sin_verificar','operativo','en_reparacion','fuera_de_servicio','bodega_ti','mantencion','mal_estado','obsoleto'));
ALTER TABLE public.equipos ADD CONSTRAINT equipos_estados_coherentes CHECK((estado_administrativo='activo' AND fecha_baja IS NULL) OR (estado_administrativo IN ('robado','no_encontrado') AND condicion_tecnica='' AND fecha_baja IS NULL) OR (estado_administrativo='dado_de_baja' AND condicion_tecnica='obsoleto' AND fecha_baja IS NOT NULL));
ALTER TABLE public.celulares ADD CONSTRAINT celulares_estados_coherentes CHECK((estado_administrativo='activo' AND fecha_baja IS NULL) OR (estado_administrativo IN ('robado','no_encontrado') AND condicion_tecnica='' AND fecha_baja IS NULL) OR (estado_administrativo='dado_de_baja' AND condicion_tecnica='obsoleto' AND fecha_baja IS NOT NULL));
-- El número puede reasignarse; la baja conserva el teléfono del registro histórico.
DROP INDEX public.celulares_telefono_vigente;
CREATE UNIQUE INDEX celulares_telefono_vigente ON public.celulares(telefono) WHERE activo AND estado_administrativo<>'dado_de_baja';
CREATE TABLE public.cambios_estados_activo(
 id uuid PRIMARY KEY,equipo_id uuid REFERENCES public.equipos(id),celular_id uuid REFERENCES public.celulares(id),
 actor text NOT NULL,solicitud jsonb NOT NULL,antes jsonb NOT NULL,despues jsonb NOT NULL,
 registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,CHECK(num_nonnulls(equipo_id,celular_id)=1)
);
REVOKE ALL ON public.cambios_estados_activo FROM PUBLIC,inventario_app;
GRANT SELECT ON public.cambios_estados_activo TO inventario_app;
-- Las consultas de la aplicación se autorizan por el historial del bien.
CREATE FUNCTION public.proteger_estados_activo() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF OLD.estado_administrativo='dado_de_baja' THEN RAISE EXCEPTION 'Registro histórico de solo lectura' USING ERRCODE='P3002';END IF;
 IF NEW.custodia IS DISTINCT FROM OLD.custodia OR NEW.sede_id IS DISTINCT FROM OLD.sede_id THEN
  IF OLD.estado_administrativo<>'activo' OR NEW.estado_administrativo<>'activo' THEN RAISE EXCEPTION 'El estado administrativo impide el movimiento' USING ERRCODE='P3003';END IF;
  IF NEW.custodia<>'en_bodega' AND NEW.condicion_tecnica NOT IN ('operativo','bodega_ti','sin_verificar') THEN RAISE EXCEPTION 'La condición impide entregar o prestar el bien' USING ERRCODE='P3003';END IF;
 END IF;
 RETURN NEW;
END;$fn$;
REVOKE ALL ON FUNCTION public.proteger_estados_activo() FROM PUBLIC,inventario_app;
CREATE TRIGGER equipos_proteger_estados BEFORE UPDATE ON public.equipos FOR EACH ROW EXECUTE FUNCTION public.proteger_estados_activo();
CREATE TRIGGER celulares_proteger_estados BEFORE UPDATE ON public.celulares FOR EACH ROW EXECUTE FUNCTION public.proteger_estados_activo();
-- Ampliar el validador de celulares sin modificar sus versiones ni permisos.
DO $do$ DECLARE d text;BEGIN
 SELECT pg_get_functiondef('public.guardar_celular_ficha_base(text,uuid,jsonb,integer,text)'::regprocedure) INTO d;
 IF position($s$('sin_verificar','operativo','en_reparacion','fuera_de_servicio')$s$ IN d)=0 THEN RAISE EXCEPTION 'Validador de celulares incompatible';END IF;
 d:=replace(d,$s$('sin_verificar','operativo','en_reparacion','fuera_de_servicio')$s$,$s$('','sin_verificar','operativo','en_reparacion','fuera_de_servicio','bodega_ti','mantencion','mal_estado','obsoleto')$s$);EXECUTE d;
END;$do$;
-- Los movimientos nuevos de celulares capturan ambos estados para su acta.
DO $do$ DECLARE d text;BEGIN
 SELECT pg_get_functiondef('public.mover_bien_acceso(text,uuid,jsonb)'::regprocedure) INTO d;
 IF position($s$jsonb_build_object('sedeId',cel.sede_id$s$ IN d)=0 THEN RAISE EXCEPTION 'Movimiento de celulares incompatible';END IF;
 d:=replace(d,$s$jsonb_build_object('sedeId',cel.sede_id$s$,$s$jsonb_build_object('estadoAdministrativo',cel.estado_administrativo,'fechaBaja',cel.fecha_baja,'sedeId',cel.sede_id$s$);EXECUTE d;
END;$do$;
CREATE FUNCTION public.guardar_estados_activo_acceso(p_actor text,p_solicitud uuid,p_datos jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE clase text;id_bien uuid;admin text;condicion text;version_actual integer;sol jsonb;anterior jsonb;posterior jsonb;repetida public.cambios_estados_activo%ROWTYPE;k text;
BEGIN
 PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1794268800000);
 PERFORM 1 FROM public.usuarios_acceso u WHERE u.correo=p_actor AND u.activo AND u.rol IN ('administrador','administrador_gestion') FOR SHARE;
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
  UPDATE public.equipos SET estado_administrativo=admin,condicion_tecnica=condicion,fecha_baja=CASE WHEN admin='dado_de_baja' THEN CURRENT_TIMESTAMP END,version=version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=id_bien RETURNING to_jsonb(equipos) INTO posterior;
  INSERT INTO public.equipos_historial(equipo_id,actor,motivo,antes,despues) VALUES(id_bien,p_actor,'Actualización de estados del activo',anterior,posterior);
 ELSE
  UPDATE public.celulares SET estado_administrativo=admin,condicion_tecnica=condicion,fecha_baja=CASE WHEN admin='dado_de_baja' THEN CURRENT_TIMESTAMP END,version=version+1,actualizado_por=p_actor,actualizado_en=CURRENT_TIMESTAMP WHERE id=id_bien RETURNING to_jsonb(celulares) INTO posterior;
  INSERT INTO public.celulares_historial(celular_id,actor,motivo,antes,despues) VALUES(id_bien,p_actor,'Actualización de estados del activo',
   jsonb_build_object('sedeId',anterior->>'sede_id','condicionTecnica',anterior->>'condicion_tecnica','estadoAdministrativo',anterior->>'estado_administrativo','fechaBaja',anterior->>'fecha_baja'),
   jsonb_build_object('sedeId',posterior->>'sede_id','condicionTecnica',posterior->>'condicion_tecnica','estadoAdministrativo',posterior->>'estado_administrativo','fechaBaja',posterior->>'fecha_baja'));
 END IF;
 INSERT INTO public.cambios_estados_activo(id,equipo_id,celular_id,actor,solicitud,antes,despues) VALUES(p_solicitud,CASE WHEN clase='equipo' THEN id_bien END,CASE WHEN clase='celular' THEN id_bien END,p_actor,sol,anterior,posterior);
 RETURN jsonb_build_object('version',(posterior->>'version')::integer,'fechaBaja',posterior->>'fecha_baja','repetida',false);
END;$fn$;
REVOKE ALL ON FUNCTION public.guardar_estados_activo_acceso(text,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_estados_activo_acceso(text,uuid,jsonb) TO inventario_app;
`);}
export const down=false;
