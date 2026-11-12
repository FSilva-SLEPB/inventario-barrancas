exports.up=pgm=>pgm.sql(`
CREATE TABLE public.reportes_incidentes_inventario(
 id uuid PRIMARY KEY,sede_id uuid NOT NULL REFERENCES public.sedes(id),actor text NOT NULL REFERENCES public.usuarios_acceso(correo),
 datos jsonb NOT NULL,estado text NOT NULL CHECK(estado IN ('borrador','enviado','validado','rechazado')) DEFAULT 'borrador',
 version integer NOT NULL DEFAULT 1,registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,actualizado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 validado_por text REFERENCES public.usuarios_acceso(correo),motivo_validacion text,legado_id uuid REFERENCES public.incidentes_robos(id)
);
CREATE INDEX ON public.reportes_incidentes_inventario(sede_id,registrado_en);
CREATE TABLE public.reportes_incidentes_operaciones(id uuid PRIMARY KEY,reporte_id uuid NOT NULL REFERENCES public.reportes_incidentes_inventario(id),actor text NOT NULL,solicitud jsonb NOT NULL,resultado jsonb NOT NULL,registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE public.reportes_incidentes_adjuntos(id uuid PRIMARY KEY,reporte_id uuid NOT NULL REFERENCES public.reportes_incidentes_inventario(id),actor text NOT NULL,nombre text NOT NULL CHECK(length(nombre) BETWEEN 1 AND 160),mime text NOT NULL CHECK(mime IN ('application/pdf','image/jpeg','image/png','image/webp')),contenido bytea NOT NULL CHECK(octet_length(contenido) BETWEEN 12 AND 10485760),registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
GRANT SELECT ON public.reportes_incidentes_inventario,public.reportes_incidentes_operaciones,public.reportes_incidentes_adjuntos TO inventario_app;
REVOKE ALL ON public.reportes_incidentes_inventario,public.reportes_incidentes_operaciones,public.reportes_incidentes_adjuntos FROM PUBLIC;
-- Conservar el motor histórico, sin permitir reportes nuevos que omitan el flujo de parte/borrador.
ALTER FUNCTION public.reportar_robo_acceso(text,uuid,jsonb) RENAME TO reportar_robo_historico_interno;
REVOKE ALL ON FUNCTION public.reportar_robo_historico_interno(text,uuid,jsonb) FROM PUBLIC,inventario_app;
CREATE FUNCTION public.reportar_robo_acceso(p_actor text,p_id uuid,p_datos jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF EXISTS(SELECT 1 FROM public.incidentes_robos WHERE id=p_id AND reportado_por=p_actor AND solicitud=p_datos) THEN
  PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion','encargado');
  IF FOUND THEN RETURN jsonb_build_object('id',p_id,'repetida',true);END IF;
 END IF;
 RAISE EXCEPTION 'Usa el reporte con número de parte y envío a TI' USING ERRCODE='22023';
END;$fn$;
REVOKE ALL ON FUNCTION public.reportar_robo_acceso(text,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reportar_robo_acceso(text,uuid,jsonb) TO inventario_app;

CREATE FUNCTION public.gestionar_reporte_incidente_acceso(p_actor text,p_solicitud uuid,p_id uuid,p_version integer,p_accion text,p_datos jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE u public.usuarios_acceso%ROWTYPE;r public.reportes_incidentes_inventario%ROWTYPE;op public.reportes_incidentes_operaciones%ROWTYPE;
 sol jsonb;res jsonb;b jsonb;snap jsonb;seleccion jsonb:='[]';ids jsonb:='[]';sede uuid;rut text;n integer;v integer;k text;fecha date;
BEGIN
 PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1794268800000);
 SELECT * INTO u FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion','encargado') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF p_solicitud IS NULL OR p_id IS NULL OR p_version IS NULL OR p_version<0 OR p_accion IS NULL OR p_accion NOT IN ('guardar','enviar','validar','rechazar') OR (jsonb_typeof(p_datos) IS DISTINCT FROM 'object' OR octet_length(p_datos::text)>150000) THEN RAISE EXCEPTION 'Solicitud inválida' USING ERRCODE='22023';END IF;
 sol:=jsonb_build_object('id',p_id,'version',p_version,'accion',p_accion,'datos',p_datos);
 SELECT * INTO op FROM public.reportes_incidentes_operaciones WHERE id=p_solicitud;
 IF FOUND THEN
  IF op.actor=p_actor AND op.solicitud=sol THEN RETURN op.resultado;END IF;
  RAISE EXCEPTION 'Solicitud reutilizada' USING ERRCODE='P3501';
 END IF;
 SELECT * INTO r FROM public.reportes_incidentes_inventario WHERE id=p_id FOR UPDATE;
 IF r.id IS NOT NULL AND (u.rol='encargado' AND (r.sede_id IS DISTINCT FROM u.sede_id)) THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF COALESCE(r.version,0)<>p_version THEN RAISE EXCEPTION 'El reporte cambió; vuelve a abrirlo' USING ERRCODE='P3501';END IF;
 IF p_accion='guardar' THEN
  IF r.id IS NOT NULL AND r.estado<>'borrador' THEN RAISE EXCEPTION 'Solo se edita el borrador' USING ERRCODE='22023';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_datos)t(k) WHERE t.k NOT IN ('sedeId','tipo','fecha','parte','denunciante','rut','descripcion','bienes')) OR (SELECT count(*) FROM jsonb_object_keys(p_datos))<>8 THEN RAISE EXCEPTION 'Campos inválidos' USING ERRCODE='22023';END IF;
  FOREACH k IN ARRAY ARRAY['sedeId','tipo','fecha','parte','denunciante','rut','descripcion'] LOOP
   IF jsonb_typeof(p_datos->k) IS DISTINCT FROM 'string' OR length(p_datos->>k)>2000 THEN RAISE EXCEPTION 'Campo inválido' USING ERRCODE='22023';END IF;
  END LOOP;
  sede:=(p_datos->>'sedeId')::uuid;p_datos:=jsonb_set(p_datos,'{sedeId}',to_jsonb(sede::text));
  IF u.rol='encargado' AND sede IS DISTINCT FROM u.sede_id OR (r.id IS NOT NULL AND sede<>r.sede_id) THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
  PERFORM 1 FROM public.sedes WHERE id=sede AND activo;IF NOT FOUND THEN RAISE EXCEPTION 'Sede inválida' USING ERRCODE='22023';END IF;
  fecha:=(p_datos->>'fecha')::date;
  IF fecha IS NULL OR fecha>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date OR fecha<'1900-01-01' OR p_datos->>'tipo' NOT IN ('robo','sustraccion','dano') OR length(p_datos->>'parte')>120 OR length(p_datos->>'denunciante')>200 OR length(p_datos->>'rut')>12 OR length(btrim(p_datos->>'descripcion'))=0 THEN RAISE EXCEPTION 'Revisa fecha, tipo y descripción' USING ERRCODE='22023';END IF;
  IF jsonb_typeof(p_datos->'bienes') IS DISTINCT FROM 'array' OR jsonb_array_length(p_datos->'bienes') NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Selecciona entre uno y 200 bienes' USING ERRCODE='22023';END IF;
  FOR b IN SELECT value FROM jsonb_array_elements(p_datos->'bienes') ORDER BY value->>'clase',value->>'id' LOOP
   b:=jsonb_set(b,'{id}',to_jsonb((b->>'id')::uuid::text));
   IF b->>'clase'='equipo' THEN SELECT to_jsonb(e) INTO snap FROM public.equipos e WHERE id=(b->>'id')::uuid FOR UPDATE;
   ELSIF b->>'clase'='celular' THEN SELECT to_jsonb(c) INTO snap FROM public.celulares c WHERE id=(b->>'id')::uuid FOR UPDATE;
   ELSE RAISE EXCEPTION 'Tipo de bien inválido' USING ERRCODE='22023';END IF;
   IF snap IS NULL OR snap->>'sede_id'<>sede::text OR snap->>'custodia'<>'asignado' OR snap->>'estado_administrativo'<>'activo' OR snap->>'activo'='false' THEN RAISE EXCEPTION 'Bien no disponible en esta sede' USING ERRCODE='42501';END IF;
   IF (snap->>'version')::integer IS DISTINCT FROM (b->>'version')::integer THEN RAISE EXCEPTION 'El bien cambió; revisa su selección' USING ERRCODE='P3501';END IF;
   IF b->>'clase'='equipo' AND EXISTS(SELECT 1 FROM public.incidentes_robos_equipos d JOIN public.incidentes_robos i ON i.id=d.incidente_id WHERE d.equipo_id=(b->>'id')::uuid AND i.estado IN ('reportado','validado') AND d.recuperado_fecha IS NULL) THEN RAISE EXCEPTION 'Ya existe un incidente abierto' USING ERRCODE='P3501';END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(seleccion)x WHERE x->>'id'=b->>'id' AND x->>'clase'=b->>'clase') THEN RAISE EXCEPTION 'Bien repetido' USING ERRCODE='22023';END IF;
   seleccion:=seleccion||jsonb_build_array(jsonb_build_object('id',b->>'id','clase',b->>'clase','version',(snap->>'version')::integer,'marca',snap->>'marca','modelo',snap->>'modelo','inventario',snap->>'numero_inventario','serie',COALESCE(snap->>'serie',snap->>'imei')));
  END LOOP;
  INSERT INTO public.reportes_incidentes_inventario(id,sede_id,actor,datos) VALUES(p_id,sede,p_actor,jsonb_set(p_datos,'{bienes}',seleccion))
  ON CONFLICT(id) DO UPDATE SET datos=EXCLUDED.datos,version=reportes_incidentes_inventario.version+1,actualizado_en=CURRENT_TIMESTAMP RETURNING * INTO r;
 ELSE
  IF (p_accion='enviar' AND p_datos<>'{}'::jsonb) OR (p_accion IN ('validar','rechazar') AND (jsonb_typeof(p_datos->'motivo') IS DISTINCT FROM 'string' OR (SELECT count(*) FROM jsonb_object_keys(p_datos))<>1)) THEN RAISE EXCEPTION 'Campos inválidos' USING ERRCODE='22023';END IF;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Reporte no disponible' USING ERRCODE='42501';END IF;
  IF p_accion='enviar' THEN
   IF r.estado<>'borrador' THEN RAISE EXCEPTION 'El reporte ya fue enviado' USING ERRCODE='22023';END IF;
   IF r.datos->>'tipo'<>'dano' THEN
    rut:=upper(regexp_replace(r.datos->>'rut','[. -]','','g'));
    IF length(btrim(r.datos->>'parte'))=0 OR length(btrim(r.datos->>'denunciante'))=0 OR rut!~'^[0-9]{7,8}[0-9K]$' THEN RAISE EXCEPTION 'Completa parte, denunciante y RUT' USING ERRCODE='22023';END IF;
    n:=0;v:=2;FOR k IN SELECT substr(left(rut,-1),i,1) FROM generate_series(length(rut)-1,1,-1)i LOOP n:=n+k::integer*v;v:=CASE WHEN v=7 THEN 2 ELSE v+1 END;END LOOP;
    IF right(rut,1)<>(CASE 11-n%11 WHEN 11 THEN '0' WHEN 10 THEN 'K' ELSE (11-n%11)::text END) THEN RAISE EXCEPTION 'RUT inválido' USING ERRCODE='22023';END IF;
   END IF;
  ELSE
   IF u.rol NOT IN ('administrador','administrador_gestion') THEN RAISE EXCEPTION 'Solo TI valida' USING ERRCODE='42501';END IF;
   IF r.estado<>'enviado' OR length(btrim(COALESCE(p_datos->>'motivo','')))=0 OR length(p_datos->>'motivo')>500 THEN RAISE EXCEPTION 'Indica el resultado de revisión' USING ERRCODE='22023';END IF;
  END IF;
  IF p_accion IN ('enviar','validar') THEN
   FOR b IN SELECT value FROM jsonb_array_elements(r.datos->'bienes') ORDER BY value->>'clase',value->>'id' LOOP
    IF b->>'clase'='equipo' THEN SELECT to_jsonb(e) INTO snap FROM public.equipos e WHERE id=(b->>'id')::uuid FOR UPDATE;
    ELSE SELECT to_jsonb(c) INTO snap FROM public.celulares c WHERE id=(b->>'id')::uuid FOR UPDATE;END IF;
    IF snap IS NULL OR snap->>'sede_id'<>r.sede_id::text OR snap->>'custodia'<>'asignado' OR snap->>'estado_administrativo'<>'activo' OR (snap->>'version')::integer<>(b->>'version')::integer OR snap->>'activo'='false' THEN RAISE EXCEPTION 'El bien cambió; TI debe revisar la ficha y el reporte' USING ERRCODE='P3501';END IF;
    IF b->>'clase'='equipo' AND EXISTS(SELECT 1 FROM public.incidentes_robos_equipos d JOIN public.incidentes_robos i ON i.id=d.incidente_id WHERE d.equipo_id=(b->>'id')::uuid AND i.estado IN ('reportado','validado') AND d.recuperado_fecha IS NULL) THEN RAISE EXCEPTION 'Ya existe un incidente abierto' USING ERRCODE='P3501';END IF;
    IF EXISTS(SELECT 1 FROM public.reportes_incidentes_inventario x,jsonb_array_elements(x.datos->'bienes') y WHERE x.id<>r.id AND x.estado='enviado' AND y->>'id'=b->>'id' AND y->>'clase'=b->>'clase') THEN RAISE EXCEPTION 'Ya hay un reporte pendiente para este bien' USING ERRCODE='P3501';END IF;
   END LOOP;
  END IF;
  IF p_accion='validar' THEN
   -- Cambiar estados por el motor existente, conservando su historial y guardas.
   FOR b IN SELECT value FROM jsonb_array_elements(r.datos->'bienes') ORDER BY value->>'clase',value->>'id' LOOP
    PERFORM public.guardar_estados_activo_acceso(p_actor,gen_random_uuid(),jsonb_build_object('clase',b->>'clase','id',b->>'id','version',(b->>'version')::integer,'administrativo',CASE WHEN r.datos->>'tipo'='dano' THEN 'activo' ELSE 'robado' END,'condicion',CASE WHEN r.datos->>'tipo'='dano' THEN 'mal_estado' ELSE '' END));
    IF b->>'clase'='equipo' AND r.datos->>'tipo'<>'dano' THEN ids:=ids||jsonb_build_array(jsonb_build_object('id',b->>'id','version',(b->>'version')::integer+1));END IF;
   END LOOP;
   IF jsonb_array_length(ids)>0 THEN
    PERFORM public.reportar_robo_historico_interno(p_actor,p_id,jsonb_build_object('sedeId',r.sede_id,'fecha',r.datos->>'fecha','lugar','Según reporte del establecimiento','descripcion',r.datos->>'descripcion','enlace','','equipos',ids));
    PERFORM public.resolver_robo_acceso(p_actor,p_id,1,'validado',p_datos->>'motivo');
    r.legado_id:=p_id;
   END IF;
  END IF;
  UPDATE public.reportes_incidentes_inventario SET estado=CASE p_accion WHEN 'enviar' THEN 'enviado' WHEN 'validar' THEN 'validado' ELSE 'rechazado' END,
   version=version+1,actualizado_en=CURRENT_TIMESTAMP,validado_por=CASE WHEN p_accion<>'enviar' THEN p_actor END,motivo_validacion=p_datos->>'motivo',legado_id=r.legado_id WHERE id=p_id RETURNING * INTO r;
 END IF;
 res:=jsonb_build_object('id',r.id,'version',r.version,'estado',r.estado);
 INSERT INTO public.reportes_incidentes_operaciones(id,reporte_id,actor,solicitud,resultado) VALUES(p_solicitud,p_id,p_actor,sol,res);
 RETURN res;
END;$fn$;
REVOKE ALL ON FUNCTION public.gestionar_reporte_incidente_acceso(text,uuid,uuid,integer,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gestionar_reporte_incidente_acceso(text,uuid,uuid,integer,text,jsonb) TO inventario_app;

CREATE FUNCTION public.adjuntar_reporte_incidente_acceso(p_actor text,p_id uuid,p_reporte uuid,p_nombre text,p_mime text,p_contenido bytea) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE r public.reportes_incidentes_inventario%ROWTYPE;u public.usuarios_acceso%ROWTYPE;a public.reportes_incidentes_adjuntos%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1794268800000);
 SELECT * INTO u FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion','encargado') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM public.reportes_incidentes_inventario WHERE id=p_reporte FOR UPDATE;
 IF r.id IS NULL OR (u.rol='encargado' AND u.sede_id IS DISTINCT FROM r.sede_id) THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR p_nombre IS NULL OR p_nombre~'[[:cntrl:]/\\\\]' OR length(p_nombre) NOT BETWEEN 1 AND 160 OR p_mime IS NULL OR p_mime NOT IN ('application/pdf','image/jpeg','image/png','image/webp') OR p_contenido IS NULL OR octet_length(p_contenido) NOT BETWEEN 12 AND 10485760 THEN RAISE EXCEPTION 'Archivo inválido' USING ERRCODE='22023';END IF;
 SELECT * INTO a FROM public.reportes_incidentes_adjuntos WHERE id=p_id;
 IF FOUND THEN
  IF a.actor=p_actor AND a.reporte_id=p_reporte AND a.nombre=p_nombre AND a.mime=p_mime AND a.contenido=p_contenido THEN RETURN p_id;END IF;
  RAISE EXCEPTION 'Solicitud reutilizada' USING ERRCODE='P3501';
 END IF;
 IF (SELECT count(*)>=5 OR COALESCE(sum(octet_length(contenido)),0)+octet_length(p_contenido)>26214400 FROM public.reportes_incidentes_adjuntos WHERE reporte_id=p_reporte) THEN RAISE EXCEPTION 'Máximo cinco archivos y 25 MB por reporte' USING ERRCODE='22023';END IF;
 INSERT INTO public.reportes_incidentes_adjuntos(id,reporte_id,actor,nombre,mime,contenido) VALUES(p_id,p_reporte,p_actor,p_nombre,p_mime,p_contenido);
 RETURN p_id;
END;$fn$;
REVOKE ALL ON FUNCTION public.adjuntar_reporte_incidente_acceso(text,uuid,uuid,text,text,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjuntar_reporte_incidente_acceso(text,uuid,uuid,text,text,bytea) TO inventario_app;
`);
exports.down=()=>{throw new Error('Conservar reportes y adjuntos: restaurar respaldo verificado.');};
