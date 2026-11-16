exports.up=pgm=>pgm.sql(String.raw`
DO $f$
DECLARE p record;previos text[];actuales text[];a jsonb;d jsonb;
BEGIN
 SELECT jsonb_agg(to_jsonb(x)) INTO a FROM public.rbac_perfil_permisos x;
 INSERT INTO public.rbac_permisos VALUES('directorio_nc.consultar','directorio_nc','consultar');
 FOR p IN SELECT * FROM public.rbac_perfiles WHERE clase='sistema' OR codigo IN ('gestor_tic','funcionario') LOOP
  SELECT permisos INTO previos FROM public.rbac_limites_perfiles WHERE codigo=p.codigo;
  SELECT COALESCE(array_agg(permiso),'{}'::text[]) INTO actuales FROM public.rbac_perfil_permisos WHERE perfil_id=p.id;
  IF p.clase='sistema' OR (actuales<@previos AND previos<@actuales) THEN
   INSERT INTO public.rbac_perfil_permisos VALUES(p.id,'directorio_nc.consultar');UPDATE public.rbac_perfiles SET version=version+1 WHERE id=p.id;
  END IF;
 END LOOP;
 UPDATE public.rbac_limites_perfiles SET permisos=permisos||ARRAY['directorio_nc.consultar'] WHERE codigo IN ('sistema','gestor_tic','funcionario');
 UPDATE public.rbac_anteriores SET permisos=permisos||ARRAY['directorio_nc.consultar'] WHERE rol IN ('administrador','administrador_gestion');
 UPDATE public.usuarios_acceso SET version=version+1 WHERE perfil_id IS NULL AND rol IN ('administrador','administrador_gestion');
 SELECT jsonb_agg(to_jsonb(x)) INTO d FROM public.rbac_perfil_permisos x;
 INSERT INTO public.rbac_cambios_migracion(nombre,actor_sql,antes,despues) VALUES('1797004800000_directorio-nc',current_user,a,d);
END;$f$;
-- La lista personal se amplía expresamente; el resto de guardas se conserva.
DO $f$
DECLARE definicion text;nueva text;
BEGIN
 SELECT pg_get_functiondef('public.rbac_guardar_perfil(text,uuid,uuid,integer,jsonb)'::regprocedure) INTO definicion;
 nueva:=replace(definicion,'''mis_datos'',''mis_asignaciones'',''correcciones'',''directorio_autorizado''','''mis_datos'',''mis_asignaciones'',''correcciones'',''directorio_autorizado'',''directorio_nc''');
 IF nueva=definicion THEN RAISE EXCEPTION 'La guarda personal cambió; revisar migración';END IF;EXECUTE nueva;
END;$f$;
CREATE FUNCTION public.directorio_nc_permitido(p_actor text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
 SELECT public.rbac_tiene(p_actor,'directorio_nc.consultar') AND (
  (public.rbac_contexto(p_actor)->>'clasePerfil' IN ('sistema','utic') AND public.rbac_contexto(p_actor)->>'alcance'='global') OR
  (public.rbac_contexto(p_actor)->>'alcance'='propios' AND EXISTS(SELECT 1 FROM public.usuarios_acceso u JOIN public.funcionarios_nc f ON f.id=u.funcionario_id WHERE u.correo=p_actor AND f.correo=p_actor AND f.activo))
 );
$f$;
CREATE FUNCTION public.directorio_funcionarios_nc(p_actor text,p_q text DEFAULT '',p_limite integer DEFAULT 50,p_pagina integer DEFAULT 1) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE total integer;pagina integer;filas jsonb;
BEGIN
 IF public.directorio_nc_permitido(p_actor) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Directorio interno de Nivel Central' USING ERRCODE='42501';END IF;
 IF p_limite NOT IN (50,100,150) OR p_limite IS NULL OR p_pagina IS NULL OR p_pagina<1 OR p_q IS NULL OR length(p_q)>150 THEN RAISE EXCEPTION 'Filtro inválido' USING ERRCODE='22023';END IF;
 SELECT count(*) INTO total FROM public.funcionarios_nc f WHERE f.activo AND concat_ws(' ',f.nombre,f.subdireccion,f.unidad,f.cargo,f.correo) ILIKE '%'||p_q||'%';
 pagina:=least(p_pagina,greatest(1,(total+p_limite-1)/p_limite));
 SELECT COALESCE(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO filas FROM (
  SELECT f.id,f.nombre,f.subdireccion,f.unidad,f.cargo,f.correo,(SELECT foto.id FROM public.fotografias_funcionarios foto WHERE foto.funcionario_id=f.id ORDER BY foto.version DESC LIMIT 1) AS foto
  FROM public.funcionarios_nc f WHERE f.activo AND concat_ws(' ',f.nombre,f.subdireccion,f.unidad,f.cargo,f.correo) ILIKE '%'||p_q||'%' ORDER BY lower(f.nombre),f.id LIMIT p_limite OFFSET (pagina-1)*p_limite
 )x;
 RETURN jsonb_build_object('filas',filas,'total',total,'pagina',pagina,'paginas',greatest(1,(total+p_limite-1)/p_limite));
END;$f$;
CREATE FUNCTION public.foto_directorio_nc(p_actor text,p_funcionario uuid,p_foto uuid) RETURNS TABLE(mime text,contenido bytea) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
 SELECT foto.mime,foto.contenido FROM public.fotografias_funcionarios foto JOIN public.funcionarios_nc f ON f.id=foto.funcionario_id WHERE public.directorio_nc_permitido(p_actor) AND f.activo AND f.id=p_funcionario AND foto.id=p_foto AND foto.version=(SELECT max(x.version) FROM public.fotografias_funcionarios x WHERE x.funcionario_id=f.id);
$f$;
REVOKE ALL ON FUNCTION public.directorio_nc_permitido(text),public.directorio_funcionarios_nc(text,text,integer,integer),public.foto_directorio_nc(text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.directorio_nc_permitido(text),public.directorio_funcionarios_nc(text,text,integer,integer),public.foto_directorio_nc(text,uuid,uuid) TO inventario_app;
CREATE FUNCTION public.historial_asignaciones_nc(p_actor text,p_q text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
BEGIN
 IF public.rbac_contexto(p_actor)->>'alcance' IS DISTINCT FROM 'global' OR NOT public.rbac_tiene(p_actor,'movimientos.consultar') OR NOT public.rbac_tiene(p_actor,'funcionarios.consultar') THEN RAISE EXCEPTION 'Sin acceso al historial de asignaciones' USING ERRCODE='42501';END IF;
 IF p_q IS NULL OR length(p_q)>150 THEN RAISE EXCEPTION 'Búsqueda inválida' USING ERRCODE='22023';END IF;
 RETURN COALESCE((SELECT jsonb_agg(to_jsonb(x)) FROM (
 SELECT a.id,COALESCE(a.equipo_id,a.celular_id) AS bien,CASE WHEN a.equipo_id IS NOT NULL THEN 'equipo' ELSE 'celular' END AS clase,
 COALESCE(e.numero_inventario,c.numero_inventario,e.serie,c.imei,e.modelo,c.modelo) AS identificador,f.nombre AS funcionario,a.registrado_en::text AS fecha,a.finalizado_en::text AS fin,COALESCE(NULLIF(u.nombre,''),'Funcionario UTIC') AS actor,a.motivo,
 (SELECT ac.id FROM public.actas_documentos ac LEFT JOIN public.operaciones_inventario_detalle d ON d.operacion_id=ac.operacion_id WHERE ac.pdf IS NOT NULL AND (ac.movimiento_id=a.movimiento_id OR d.movimiento_id=a.movimiento_id) LIMIT 1) AS acta
 FROM public.asignaciones_funcionarios a JOIN public.funcionarios_nc f ON f.id=a.funcionario_id LEFT JOIN public.equipos e ON e.id=a.equipo_id LEFT JOIN public.celulares c ON c.id=a.celular_id LEFT JOIN public.usuarios_acceso u ON u.correo=a.actor
 WHERE concat_ws(' ',f.nombre,e.numero_inventario,c.numero_inventario,e.serie,c.imei,e.modelo,c.modelo) ILIKE '%'||p_q||'%' ORDER BY a.registrado_en DESC,a.id DESC LIMIT 100
 )x),'[]'::jsonb);
END;$f$;
REVOKE ALL ON FUNCTION public.historial_asignaciones_nc(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.historial_asignaciones_nc(text,text) TO inventario_app;
`);
exports.down=()=>{throw new Error('Conservar permisos e historial: usar reversión ensayada con respaldo.');};
