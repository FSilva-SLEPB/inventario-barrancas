exports.up=pgm=>pgm.sql(`
CREATE TABLE public.asignaciones_funcionarios(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),solicitud uuid NOT NULL UNIQUE,solicitud_datos jsonb NOT NULL,funcionario_id uuid NOT NULL REFERENCES public.funcionarios_nc(id),equipo_id uuid REFERENCES public.equipos(id),celular_id uuid REFERENCES public.celulares(id),movimiento_id uuid REFERENCES public.movimientos_inventario(id),actor text NOT NULL REFERENCES public.usuarios_acceso(correo),motivo text NOT NULL,registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,finalizado_en timestamptz,CHECK((equipo_id IS NOT NULL)::int+(celular_id IS NOT NULL)::int=1));
CREATE UNIQUE INDEX ON public.asignaciones_funcionarios(equipo_id) WHERE finalizado_en IS NULL AND equipo_id IS NOT NULL;
CREATE UNIQUE INDEX ON public.asignaciones_funcionarios(celular_id) WHERE finalizado_en IS NULL AND celular_id IS NOT NULL;
CREATE TABLE public.correcciones_personales(id uuid PRIMARY KEY,actor text NOT NULL REFERENCES public.usuarios_acceso(correo),funcionario_id uuid NOT NULL REFERENCES public.funcionarios_nc(id),version integer NOT NULL DEFAULT 1,solicitud jsonb NOT NULL,datos_anteriores jsonb NOT NULL,estado text NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','aprobada','rechazada')),resolucion text,resuelto_por text REFERENCES public.usuarios_acceso(correo),registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,resuelto_en timestamptz);
REVOKE ALL ON public.asignaciones_funcionarios,public.correcciones_personales FROM PUBLIC,inventario_app;
GRANT SELECT ON public.asignaciones_funcionarios,public.correcciones_personales TO inventario_app;
CREATE FUNCTION public.rbac_cerrar_asignacion() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN UPDATE public.asignaciones_funcionarios SET finalizado_en=CURRENT_TIMESTAMP WHERE finalizado_en IS NULL AND (equipo_id=NEW.equipo_id OR celular_id=NEW.celular_id);RETURN NEW;END;$fn$;
CREATE TRIGGER cerrar_asignacion_funcionario AFTER INSERT ON public.movimientos_inventario FOR EACH ROW EXECUTE FUNCTION public.rbac_cerrar_asignacion();
CREATE FUNCTION public.rbac_vincular_asignacion(p_actor text,p_solicitud uuid,p_clase text,p_bien uuid,p_version integer,p_funcionario uuid,p_movimiento uuid,p_motivo text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE b jsonb;a public.asignaciones_funcionarios%ROWTYPE;fid uuid;entrada jsonb;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'funcionarios.editar');PERFORM public.rbac_exigir(p_actor,CASE WHEN p_clase='equipo' THEN 'equipos.editar' ELSE 'celulares.editar' END);
 IF public.rbac_contexto(p_actor)->>'alcance' IS DISTINCT FROM 'global' OR COALESCE(public.rbac_contexto(p_actor)->>'clasePerfil','') NOT IN ('sistema','utic') THEN RAISE EXCEPTION 'Solo UTIC global vincula asignaciones oficiales' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1794268800000);
 IF p_clase NOT IN ('equipo','celular') OR p_solicitud IS NULL OR p_bien IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Asignación inválida' USING ERRCODE='22023';END IF;
 entrada:=jsonb_build_array(p_clase,p_bien,p_version,p_funcionario,p_movimiento,p_motivo);
 SELECT * INTO a FROM public.asignaciones_funcionarios WHERE solicitud=p_solicitud;
 IF FOUND THEN IF a.actor=p_actor AND a.solicitud_datos=entrada THEN RETURN a.id;END IF;RAISE EXCEPTION 'Solicitud reutilizada' USING ERRCODE='P3501';END IF;
 IF p_clase='equipo' THEN SELECT to_jsonb(e) INTO b FROM public.equipos e WHERE id=p_bien FOR UPDATE;ELSE SELECT to_jsonb(c) INTO b FROM public.celulares c WHERE id=p_bien FOR UPDATE;END IF;
 IF b IS NULL OR (b->>'version')::int IS DISTINCT FROM p_version OR b->>'custodia'<>'asignado' OR b->>'estado_administrativo'='dado_de_baja' OR NOT EXISTS(SELECT 1 FROM public.sedes WHERE id=(b->>'sede_id')::uuid AND tipo='nivel_central') THEN RAISE EXCEPTION 'Revisa la asignación y versión del bien' USING ERRCODE='P3501';END IF;
 PERFORM 1 FROM public.funcionarios_nc WHERE id=p_funcionario AND activo FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Funcionario no disponible' USING ERRCODE='22023';END IF;
 IF p_movimiento IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.movimientos_inventario m WHERE m.id=p_movimiento AND COALESCE(m.equipo_id,m.celular_id)=p_bien AND m.accion='asignacion') THEN RAISE EXCEPTION 'Movimiento incompatible' USING ERRCODE='22023';END IF;
 UPDATE public.asignaciones_funcionarios SET finalizado_en=CURRENT_TIMESTAMP WHERE finalizado_en IS NULL AND (equipo_id=p_bien OR celular_id=p_bien);
 INSERT INTO public.asignaciones_funcionarios(solicitud,solicitud_datos,funcionario_id,equipo_id,celular_id,movimiento_id,actor,motivo) VALUES(p_solicitud,entrada,p_funcionario,CASE WHEN p_clase='equipo' THEN p_bien END,CASE WHEN p_clase='celular' THEN p_bien END,p_movimiento,p_actor,p_motivo) RETURNING id INTO fid;
 IF p_clase='equipo' THEN UPDATE public.equipos SET version=version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=p_bien;ELSE UPDATE public.celulares SET version=version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=p_bien;END IF;
 RETURN fid;
END;$fn$;
CREATE FUNCTION public.rbac_mis_datos(p_actor text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE u public.usuarios_acceso%ROWTYPE;res jsonb;
BEGIN SELECT * INTO u FROM public.usuarios_acceso WHERE correo=p_actor;PERFORM public.rbac_exigir(p_actor,'mis_datos.consultar',NULL,u.funcionario_id);
 SELECT jsonb_build_object('id',id,'nombre',nombre,'rut',rut,'correo',correo,'unidad',unidad,'subdireccion',subdireccion,'cargo',cargo,'version',version) INTO res FROM public.funcionarios_nc WHERE id=u.funcionario_id AND correo=p_actor;RETURN res;END;$fn$;
CREATE FUNCTION public.rbac_mis_asignaciones(p_actor text,p_accion text DEFAULT 'consultar') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE u public.usuarios_acceso%ROWTYPE;res jsonb;
BEGIN
 IF p_accion NOT IN ('consultar','descargar') THEN RAISE EXCEPTION 'Acción inválida' USING ERRCODE='42501';END IF;
 SELECT * INTO u FROM public.usuarios_acceso WHERE correo=p_actor;PERFORM public.rbac_exigir(p_actor,'mis_asignaciones.'||p_accion,NULL,u.funcionario_id);
 SELECT COALESCE(jsonb_agg(x),'[]'::jsonb) INTO res FROM (
 SELECT 'equipo' AS clase,e.id,e.marca,e.modelo,e.serie,e.numero_inventario AS inventario,e.estado_administrativo AS estado,e.condicion_tecnica AS condicion FROM public.asignaciones_funcionarios a JOIN public.equipos e ON e.id=a.equipo_id JOIN public.funcionarios_nc f ON f.id=a.funcionario_id WHERE a.funcionario_id=u.funcionario_id AND f.correo=p_actor AND a.finalizado_en IS NULL AND e.custodia='asignado'
 UNION ALL SELECT 'celular',c.id,c.marca,c.modelo,c.imei,c.numero_inventario,c.estado_administrativo,c.condicion_tecnica FROM public.asignaciones_funcionarios a JOIN public.celulares c ON c.id=a.celular_id JOIN public.funcionarios_nc f ON f.id=a.funcionario_id WHERE a.funcionario_id=u.funcionario_id AND f.correo=p_actor AND a.finalizado_en IS NULL AND c.custodia='asignado')x;RETURN res;
END;$fn$;
CREATE FUNCTION public.rbac_solicitar_correccion(p_actor text,p_id uuid,p_datos jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE u public.usuarios_acceso%ROWTYPE;f public.funcionarios_nc%ROWTYPE;r public.correcciones_personales%ROWTYPE;k text;
BEGIN
 SELECT * INTO u FROM public.usuarios_acceso WHERE correo=p_actor;PERFORM public.rbac_exigir(p_actor,'correcciones.registrar',NULL,u.funcionario_id);
 IF p_id IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(p_datos))<>3 OR p_datos->>'campo' NOT IN ('nombre','rut','correo','unidad','subdireccion','cargo') OR jsonb_typeof(p_datos->'valor') IS DISTINCT FROM 'string' OR length(btrim(p_datos->>'valor')) NOT BETWEEN 1 AND 254 OR length(btrim(p_datos->>'motivo')) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Solicitud inválida' USING ERRCODE='22023';END IF;
 SELECT * INTO f FROM public.funcionarios_nc WHERE id=u.funcionario_id AND correo=p_actor FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Ficha ajena' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM public.correcciones_personales WHERE id=p_id;
 IF FOUND THEN IF r.actor=p_actor AND r.solicitud=p_datos THEN RETURN p_id;END IF;RAISE EXCEPTION 'Solicitud reutilizada' USING ERRCODE='P3501';END IF;
 INSERT INTO public.correcciones_personales(id,actor,funcionario_id,solicitud,datos_anteriores) VALUES(p_id,p_actor,u.funcionario_id,p_datos,to_jsonb(f));RETURN p_id;
END;$fn$;
CREATE FUNCTION public.rbac_resolver_correccion(p_actor text,p_solicitud uuid,p_id uuid,p_version integer,p_aprobar boolean,p_motivo text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE r public.correcciones_personales%ROWTYPE;f public.funcionarios_nc%ROWTYPE;datos jsonb;h public.rbac_historial%ROWTYPE;entrada jsonb;res jsonb;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'correcciones.aprobar');
 IF public.rbac_contexto(p_actor)->>'alcance' IS DISTINCT FROM 'global' OR COALESCE(public.rbac_contexto(p_actor)->>'clasePerfil','') NOT IN ('sistema','utic') THEN RAISE EXCEPTION 'Solo UTIC global resuelve correcciones' USING ERRCODE='42501';END IF;
PERFORM public.rbac_exigir(p_actor,'funcionarios.editar');entrada:=jsonb_build_array(p_id,p_version,p_aprobar,p_motivo);
 SELECT * INTO h FROM public.rbac_historial WHERE solicitud=p_solicitud;IF FOUND THEN IF h.actor=p_actor AND h.tipo='correccion' AND h.entrada=entrada THEN RETURN h.despues;END IF;RAISE EXCEPTION 'Solicitud reutilizada' USING ERRCODE='P3501';END IF;
 SELECT * INTO r FROM public.correcciones_personales WHERE id=p_id FOR UPDATE;
 IF r.id IS NULL OR r.estado<>'pendiente' OR r.version IS DISTINCT FROM p_version OR p_aprobar IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'La solicitud cambió o faltan datos' USING ERRCODE='P3501';END IF;
 IF p_aprobar THEN
  SELECT * INTO f FROM public.funcionarios_nc WHERE id=r.funcionario_id FOR UPDATE;
  IF f.version IS DISTINCT FROM (r.datos_anteriores->>'version')::int THEN RAISE EXCEPTION 'La ficha cambió desde la solicitud; revisa y rechaza o solicita otra corrección' USING ERRCODE='P3501';END IF;
  datos:=jsonb_build_object('nombre',f.nombre,'rut',COALESCE(f.rut,''),'correo',COALESCE(f.correo,''),'unidad',f.unidad,'subdireccion',f.subdireccion,'cargo',f.cargo,'fechaIngreso',COALESCE(f.fecha_ingreso::text,''),'activo',f.activo)||jsonb_build_object(r.solicitud->>'campo',r.solicitud->>'valor');
  PERFORM public.guardar_funcionario_nc_acceso(p_actor,f.id,datos,f.version,'Corrección solicitada: '||p_motivo);
 END IF;
 UPDATE public.correcciones_personales SET estado=CASE WHEN p_aprobar THEN 'aprobada' ELSE 'rechazada' END,resolucion=p_motivo,resuelto_por=p_actor,resuelto_en=CURRENT_TIMESTAMP,version=version+1 WHERE id=p_id RETURNING to_jsonb(correcciones_personales) INTO res;
 INSERT INTO public.rbac_historial(solicitud,actor,tipo,objetivo,motivo,antes,despues,entrada) VALUES(p_solicitud,p_actor,'correccion',p_id::text,p_motivo,to_jsonb(r),res,entrada);RETURN res;
END;$fn$;
CREATE FUNCTION public.rbac_acta_autorizada(p_actor text,p_acta uuid,p_accion text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT COALESCE(EXISTS(SELECT 1 FROM public.actas_documentos a JOIN public.usuarios_acceso u ON u.correo=p_actor WHERE a.id=p_acta AND p_accion IN ('consultar','descargar','imprimir','enviar','registrar') AND public.rbac_tiene(p_actor,CASE WHEN a.solicitud_insumo_id IS NOT NULL THEN 'actas_insumos.' ELSE 'actas.' END||p_accion) AND (public.rbac_contexto(p_actor)->>'alcance'='global' OR (public.rbac_contexto(p_actor)->>'alcance'='sede' AND (EXISTS(SELECT 1 FROM public.entregas_equipos e WHERE e.id=a.entrega_id AND e.sede_id=u.sede_id) OR EXISTS(SELECT 1 FROM public.movimientos_inventario m WHERE m.id=a.movimiento_id AND u.sede_id IN(m.origen_sede_id,m.destino_sede_id)) OR EXISTS(SELECT 1 FROM public.operaciones_inventario o WHERE o.id=a.operacion_id AND u.sede_id IN(o.origen_sede_id,o.destino_sede_id)) OR EXISTS(SELECT 1 FROM public.solicitudes_insumos s WHERE s.id=a.solicitud_insumo_id AND s.sede_id=u.sede_id))))),false)
$fn$;
REVOKE ALL ON FUNCTION public.rbac_cerrar_asignacion() FROM PUBLIC,inventario_app;
REVOKE ALL ON FUNCTION public.rbac_vincular_asignacion(text,uuid,text,uuid,integer,uuid,uuid,text),public.rbac_mis_datos(text),public.rbac_mis_asignaciones(text,text),public.rbac_solicitar_correccion(text,uuid,jsonb),public.rbac_resolver_correccion(text,uuid,uuid,integer,boolean,text),public.rbac_acta_autorizada(text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rbac_vincular_asignacion(text,uuid,text,uuid,integer,uuid,uuid,text),public.rbac_mis_datos(text),public.rbac_mis_asignaciones(text,text),public.rbac_solicitar_correccion(text,uuid,jsonb),public.rbac_resolver_correccion(text,uuid,uuid,integer,boolean,text),public.rbac_acta_autorizada(text,uuid,text) TO inventario_app;
`);
exports.down=()=>{throw new Error('Conservar solicitudes, asignaciones e historial; usar procedimiento ensayado.');};
