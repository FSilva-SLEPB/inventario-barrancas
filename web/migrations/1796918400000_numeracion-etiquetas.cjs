exports.up=pgm=>pgm.sql(String.raw`
CREATE TABLE public.numeracion_categorias(categoria_id uuid PRIMARY KEY REFERENCES public.categorias_bienes(id),prefijo text NOT NULL CHECK(prefijo ~ '^[A-Z]{2,5}$'),activo boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1);
CREATE TABLE public.numeracion_secuencias(prefijo text NOT NULL,anio2 integer NOT NULL CHECK(anio2 BETWEEN 0 AND 99),ultimo integer NOT NULL CHECK(ultimo BETWEEN 0 AND 9999),PRIMARY KEY(prefijo,anio2));
CREATE TABLE public.numeracion_lotes(id uuid PRIMARY KEY,actor text NOT NULL REFERENCES public.usuarios_acceso(correo),entrada jsonb NOT NULL,resultado jsonb NOT NULL,registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE public.numeracion_asignaciones(equipo_id uuid PRIMARY KEY REFERENCES public.equipos(id),numero text UNIQUE NOT NULL,lote_id uuid NOT NULL REFERENCES public.numeracion_lotes(id) DEFERRABLE INITIALLY DEFERRED,prefijo text NOT NULL,anio_oc integer NOT NULL,correlativo integer NOT NULL,actor text NOT NULL REFERENCES public.usuarios_acceso(correo),registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE public.numeracion_config_historial(id uuid PRIMARY KEY,actor text NOT NULL REFERENCES public.usuarios_acceso(correo),entrada jsonb NOT NULL,antes jsonb,despues jsonb NOT NULL,registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE public.etiquetas_lotes(id uuid PRIMARY KEY,actor text NOT NULL REFERENCES public.usuarios_acceso(correo),entrada jsonb NOT NULL,datos jsonb NOT NULL,opciones jsonb NOT NULL,pdf bytea NOT NULL CHECK(octet_length(pdf) BETWEEN 5 AND 20000000),estado text NOT NULL DEFAULT 'preparado' CHECK(estado IN ('preparado','confirmado','cancelado')),registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,confirmado_en timestamptz);
REVOKE ALL ON public.numeracion_categorias,public.numeracion_secuencias,public.numeracion_lotes,public.numeracion_asignaciones,public.numeracion_config_historial,public.etiquetas_lotes FROM PUBLIC,inventario_app;
-- Solo los nombres explícitos del código entregado; categorías desconocidas se configuran manualmente.
INSERT INTO public.numeracion_categorias(categoria_id,prefijo)
SELECT c.id,x.prefijo FROM public.categorias_bienes c JOIN (VALUES ('allinone','AIO'),('monitor','MON'),('proyector','PRO'),('impresora','IMP'),('notebook','LAP'),('laptop','LAP'),('pc','PC'),('computadordeescritorio','PC'),('tablet','TAB'),('servidor','SRV'),('switch','SWT'),('router','RTR'),('accesspoint','AP'),('ups','UPS'),('camara','CAM'),('escaner','ESC'),('raspberrypi','RPI'))x(nombre,prefijo) ON regexp_replace(lower(translate(c.nombre,'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNaeiouun')),'[^a-z0-9]','','g')=x.nombre;
DO $f$
DECLARE p record;actuales text[];previos text[];a jsonb;d jsonb;nuevos text[]:=ARRAY['numeracion_inventario.consultar','numeracion_inventario.confirmar','etiquetas_inventario.consultar','etiquetas_inventario.descargar','etiquetas_inventario.imprimir'];
BEGIN
 SELECT jsonb_build_object('perfiles',(SELECT jsonb_agg(to_jsonb(x)||jsonb_build_object('permisos',ARRAY(SELECT permiso FROM public.rbac_perfil_permisos WHERE perfil_id=x.id ORDER BY permiso))) FROM public.rbac_perfiles x),'anteriores',(SELECT jsonb_agg(to_jsonb(x)) FROM public.rbac_anteriores x)) INTO a;
 INSERT INTO public.rbac_permisos(codigo,recurso,accion) SELECT v,split_part(v,'.',1),split_part(v,'.',2) FROM unnest(nuevos)v;
 FOR p IN SELECT * FROM public.rbac_perfiles WHERE clase='sistema' OR codigo='gestor_tic' LOOP
  SELECT permisos INTO previos FROM public.rbac_limites_perfiles WHERE codigo=p.codigo;
  SELECT COALESCE(array_agg(permiso),'{}'::text[]) INTO actuales FROM public.rbac_perfil_permisos WHERE perfil_id=p.id;
  IF p.clase='sistema' OR (actuales<@previos AND previos<@actuales) THEN INSERT INTO public.rbac_perfil_permisos SELECT p.id,unnest(nuevos);UPDATE public.rbac_perfiles SET version=version+1 WHERE id=p.id;END IF;
 END LOOP;
 UPDATE public.rbac_limites_perfiles SET permisos=permisos||nuevos WHERE codigo IN ('sistema','gestor_tic');
 UPDATE public.rbac_anteriores SET permisos=permisos||nuevos WHERE rol IN ('administrador','administrador_gestion');
 UPDATE public.usuarios_acceso SET version=version+1 WHERE perfil_id IS NULL AND rol IN ('administrador','administrador_gestion');
 SELECT jsonb_build_object('perfiles',(SELECT jsonb_agg(to_jsonb(x)||jsonb_build_object('permisos',ARRAY(SELECT permiso FROM public.rbac_perfil_permisos WHERE perfil_id=x.id ORDER BY permiso))) FROM public.rbac_perfiles x),'anteriores',(SELECT jsonb_agg(to_jsonb(x)) FROM public.rbac_anteriores x)) INTO d;
 INSERT INTO public.rbac_cambios_migracion(nombre,actor_sql,antes,despues) VALUES('1796918400000_numeracion-etiquetas',current_user,a,d);
END;$f$;
CREATE FUNCTION public.proteger_permiso_numeracion() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
BEGIN
 IF NEW.permiso LIKE 'numeracion_inventario.%' AND NOT EXISTS(SELECT 1 FROM public.rbac_perfiles WHERE id=NEW.perfil_id AND clase IN ('sistema','utic') AND alcances=ARRAY['global']::text[]) THEN RAISE EXCEPTION 'Numeración reservada a UTIC global' USING ERRCODE='42501';END IF;RETURN NEW;
END;$f$;
CREATE TRIGGER permiso_numeracion_protegido BEFORE INSERT OR UPDATE ON public.rbac_perfil_permisos FOR EACH ROW EXECUTE FUNCTION public.proteger_permiso_numeracion();
REVOKE ALL ON FUNCTION public.proteger_permiso_numeracion() FROM PUBLIC,inventario_app;
CREATE FUNCTION public.exigir_numeracion(p_actor text,p_accion text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
BEGIN
 PERFORM public.rbac_exigir(p_actor,'numeracion_inventario.consultar');PERFORM public.rbac_exigir(p_actor,'equipos.consultar');
 IF public.rbac_contexto(p_actor)->>'alcance' IS DISTINCT FROM 'global' OR COALESCE(public.rbac_contexto(p_actor)->>'clasePerfil','') NOT IN ('sistema','utic') THEN RAISE EXCEPTION 'Solo UTIC global administra la numeración' USING ERRCODE='42501';END IF;
 IF p_accion='confirmar' THEN PERFORM public.rbac_exigir(p_actor,'numeracion_inventario.confirmar');PERFORM public.rbac_exigir(p_actor,'equipos.editar');ELSIF p_accion IS DISTINCT FROM 'consultar' THEN RAISE EXCEPTION 'Acción inválida' USING ERRCODE='22023';END IF;
END;$f$;
CREATE FUNCTION public.consultar_config_numeracion(p_actor text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE r jsonb;BEGIN PERFORM public.exigir_numeracion(p_actor,'consultar');SELECT COALESCE(jsonb_agg(jsonb_build_object('id',c.id,'nombre',c.nombre,'prefijo',n.prefijo,'activo',n.activo,'version',COALESCE(n.version,0)) ORDER BY c.nombre),'[]') INTO r FROM public.categorias_bienes c LEFT JOIN public.numeracion_categorias n ON n.categoria_id=c.id WHERE c.activo;RETURN r;END;$f$;
CREATE FUNCTION public.guardar_config_numeracion(p_actor text,p_solicitud uuid,p_categoria uuid,p_version integer,p_prefijo text,p_activo boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE n public.numeracion_categorias%ROWTYPE;h public.numeracion_config_historial%ROWTYPE;entrada jsonb;a jsonb;
BEGIN
 PERFORM public.exigir_numeracion(p_actor,'confirmar');PERFORM public.rbac_exigir(p_actor,'categorias.editar');PERFORM pg_advisory_xact_lock(1796918400000);
 entrada:=jsonb_build_array(p_categoria,p_version,p_prefijo,p_activo);SELECT * INTO h FROM public.numeracion_config_historial WHERE id=p_solicitud;
 IF FOUND THEN IF h.actor=p_actor AND h.entrada=entrada THEN RETURN h.despues;END IF;RAISE EXCEPTION 'Solicitud reutilizada' USING ERRCODE='P4301';END IF;
 IF p_solicitud IS NULL OR p_categoria IS NULL OR p_version IS NULL OR p_version<0 OR p_prefijo IS NULL OR p_prefijo !~ '^[A-Z]{2,5}$' OR p_activo IS NULL OR NOT EXISTS(SELECT 1 FROM public.categorias_bienes WHERE id=p_categoria AND activo) THEN RAISE EXCEPTION 'Código inválido' USING ERRCODE='22023';END IF;
 SELECT * INTO n FROM public.numeracion_categorias WHERE categoria_id=p_categoria FOR UPDATE;IF COALESCE(n.version,0)<>p_version THEN RAISE EXCEPTION 'La categoría cambió' USING ERRCODE='P4301';END IF;a:=CASE WHEN n.categoria_id IS NULL THEN NULL ELSE to_jsonb(n) END;
 INSERT INTO public.numeracion_categorias VALUES(p_categoria,p_prefijo,p_activo,1) ON CONFLICT(categoria_id) DO UPDATE SET prefijo=EXCLUDED.prefijo,activo=EXCLUDED.activo,version=numeracion_categorias.version+1 RETURNING * INTO n;
 INSERT INTO public.numeracion_config_historial(id,actor,entrada,antes,despues) VALUES(p_solicitud,p_actor,entrada,a,to_jsonb(n));RETURN to_jsonb(n);
END;$f$;
CREATE FUNCTION public.consultar_identificacion(p_actor text,p_filtros jsonb,p_recurso text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE ctx jsonb;q text;ambito text;v_sede uuid;pendiente text;pagina integer;limite integer;r jsonb;
BEGIN
 IF p_recurso='numeracion' THEN PERFORM public.exigir_numeracion(p_actor,'consultar');ELSIF p_recurso='etiquetas' THEN PERFORM public.rbac_exigir(p_actor,'etiquetas_inventario.consultar');PERFORM public.rbac_exigir(p_actor,'equipos.consultar');ELSE RAISE EXCEPTION 'Recurso inválido' USING ERRCODE='22023';END IF;
 IF jsonb_typeof(p_filtros) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_filtros)t(k) WHERE k NOT IN ('q','ambito','sede','pendiente','pagina','limite','equipo')) THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023';END IF;
 q:=COALESCE(p_filtros->>'q','');ambito:=COALESCE(p_filtros->>'ambito','');pendiente:=COALESCE(p_filtros->>'pendiente','');v_sede:=NULLIF(p_filtros->>'sede','')::uuid;pagina:=COALESCE((p_filtros->>'pagina')::integer,1);limite:=COALESCE((p_filtros->>'limite')::integer,50);ctx:=public.rbac_contexto(p_actor);
 IF length(q)>150 OR ambito NOT IN ('','nc','p02') OR pendiente NOT IN ('','si','no') OR pagina NOT BETWEEN 1 AND 100000 OR limite NOT IN (50,100,150) THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023';END IF;
 WITH base AS MATERIALIZED(SELECT e.*,s.nombre AS sede,s.tipo,s.rbd,c.nombre AS categoria,n.prefijo,COALESCE(n.version,0) AS prefijo_version,COALESCE(n.activo,false) AND c.activo AS prefijo_activo FROM public.equipos e JOIN public.sedes s ON s.id=e.sede_id JOIN public.categorias_bienes c ON c.id=e.categoria_id LEFT JOIN public.numeracion_categorias n ON n.categoria_id=c.id
 WHERE (ctx->>'alcance'='global' OR ctx->>'alcance'='sede' AND e.sede_id=(SELECT sede_id FROM public.usuarios_acceso WHERE correo=p_actor)) AND (ambito='' OR (ambito='nc')=(s.tipo='nivel_central')) AND (v_sede IS NULL OR e.sede_id=v_sede) AND (COALESCE(p_filtros->>'equipo','')='' OR e.id=(p_filtros->>'equipo')::uuid) AND (pendiente='' OR (pendiente='si')=(e.numero_inventario IS NULL)) AND (q='' OR e.serie ILIKE '%'||q||'%' OR e.numero_inventario ILIKE '%'||q||'%' OR e.marca ILIKE '%'||q||'%' OR e.modelo ILIKE '%'||q||'%' OR s.nombre ILIKE '%'||q||'%')),
 cuenta AS(SELECT count(*)::integer AS total FROM base), datos AS(SELECT * FROM base ORDER BY sede,categoria,marca,modelo,id LIMIT limite OFFSET (LEAST(pagina,GREATEST(1,ceil((SELECT cuenta.total FROM cuenta)::numeric/limite)::integer))-1)*limite)
 SELECT jsonb_build_object('total',(SELECT cuenta.total FROM cuenta),'filas',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'version',version,'inventario',numero_inventario,'serie',serie,'marca',marca,'modelo',modelo,'categoria',categoria,'categoriaId',categoria_id,'sede',sede,'rbd',rbd,'tipo',tipo,'estado',estado_administrativo,'fechaOC',COALESCE(datos_compra->>'fechaOrdenCompra',''),'prefijo',prefijo,'prefijoVersion',prefijo_version,'prefijoActivo',prefijo_activo)) FROM datos),'[]')) INTO r;RETURN r;
END;$f$;
CREATE FUNCTION public.generar_numeros_inventario(p_actor text,p_solicitud uuid,p_filas jsonb,p_anio integer DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE h public.numeracion_lotes%ROWTYPE;entrada jsonb;f jsonb;e public.equipos%ROWTYPE;n public.numeracion_categorias%ROWTYPE;a jsonb;d jsonb;fecha text;anio integer;aa integer;v_ultimo integer;maximo integer;numero text;resultado jsonb:='[]';
BEGIN
 PERFORM public.exigir_numeracion(p_actor,'confirmar');PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1794268800000);PERFORM pg_advisory_xact_lock(1796918400000);
 entrada:=jsonb_build_array(p_filas,p_anio);SELECT * INTO h FROM public.numeracion_lotes WHERE id=p_solicitud;
 IF FOUND THEN IF h.actor=p_actor AND h.entrada=entrada THEN RETURN h.resultado;END IF;RAISE EXCEPTION 'Solicitud reutilizada' USING ERRCODE='P4301';END IF;
 IF p_solicitud IS NULL OR jsonb_typeof(p_filas) IS DISTINCT FROM 'array' OR jsonb_array_length(p_filas) NOT BETWEEN 1 AND 150 OR (p_anio IS NOT NULL AND p_anio NOT BETWEEN 1900 AND 2099) OR (SELECT count(DISTINCT v->>'id') FROM jsonb_array_elements(p_filas)v)<>jsonb_array_length(p_filas) THEN RAISE EXCEPTION 'Selección inválida' USING ERRCODE='22023';END IF;
 FOR f IN SELECT value FROM jsonb_array_elements(p_filas) LOOP
  IF jsonb_typeof(f) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(f))<>3 OR NOT f ?& ARRAY['id','version','prefijoVersion'] THEN RAISE EXCEPTION 'Fila inválida' USING ERRCODE='22023';END IF;
  SELECT * INTO e FROM public.equipos WHERE id=(f->>'id')::uuid FOR UPDATE;
  IF e.id IS NULL OR e.version IS DISTINCT FROM (f->>'version')::integer OR e.estado_administrativo<>'activo' OR e.custodia='en_prestamo' OR e.datos_compra->'bajaPendienteTI'='true'::jsonb THEN RAISE EXCEPTION 'El equipo cambió o no está disponible' USING ERRCODE='P4301';END IF;
  IF e.numero_inventario IS NOT NULL OR NULLIF(btrim(e.serie),'') IS NULL THEN RAISE EXCEPTION 'Se requiere serie y número de inventario pendiente' USING ERRCODE='22023';END IF;
  SELECT * INTO n FROM public.numeracion_categorias WHERE categoria_id=e.categoria_id AND activo AND EXISTS(SELECT 1 FROM public.categorias_bienes WHERE id=e.categoria_id AND activo) FOR SHARE;
  IF n.categoria_id IS NULL OR n.version IS DISTINCT FROM (f->>'prefijoVersion')::integer THEN RAISE EXCEPTION 'Revisa el prefijo de la categoría' USING ERRCODE='P4301';END IF;
  fecha:=COALESCE(e.datos_compra->>'fechaOrdenCompra','');anio:=NULL;
  IF fecha ~ '^(19|20)[0-9]{2}$' THEN anio:=fecha::integer;
  ELSIF fecha ~ '^(19|20)[0-9]{2}-[0-9]{2}-[0-9]{2}$' THEN BEGIN IF to_char(fecha::date,'YYYY-MM-DD')=fecha THEN anio:=extract(year FROM fecha::date)::integer;END IF;EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN anio:=NULL;END;END IF;
  IF fecha<>'' AND anio IS NULL THEN RAISE EXCEPTION 'Fecha OC inválida: debe corregirse, no reemplazarse por una suposición' USING ERRCODE='22023';END IF;
  anio:=COALESCE(anio,p_anio);IF anio IS NULL THEN RAISE EXCEPTION 'Falta fecha OC o año OC confirmado' USING ERRCODE='22023';END IF;aa:=anio%100;
  SELECT COALESCE(max(right(v,4)::integer),0) INTO maximo FROM (SELECT upper(numero_inventario) v FROM public.equipos UNION ALL SELECT upper(numero_inventario) FROM public.celulares UNION ALL SELECT na.numero FROM public.numeracion_asignaciones na)x WHERE v ~ ('^'||n.prefijo||lpad(aa::text,2,'0')||'[0-9]{4}$');
  INSERT INTO public.numeracion_secuencias VALUES(n.prefijo,aa,maximo) ON CONFLICT(prefijo,anio2) DO UPDATE SET ultimo=GREATEST(numeracion_secuencias.ultimo,EXCLUDED.ultimo) RETURNING numeracion_secuencias.ultimo INTO v_ultimo;
  v_ultimo:=v_ultimo+1;IF v_ultimo>9999 THEN RAISE EXCEPTION 'Correlativo agotado para este prefijo y año' USING ERRCODE='P4303';END IF;
  numero:=n.prefijo||lpad(aa::text,2,'0')||lpad(v_ultimo::text,4,'0');a:=to_jsonb(e);
  UPDATE public.numeracion_secuencias SET ultimo=v_ultimo WHERE prefijo=n.prefijo AND anio2=aa;
  UPDATE public.equipos SET numero_inventario=numero,datos_compra=datos_compra||jsonb_build_object('anioOcNumeracion',anio),version=version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=e.id RETURNING to_jsonb(equipos) INTO d;
  INSERT INTO public.equipos_historial(equipo_id,actor,motivo,antes,despues) VALUES(e.id,p_actor,'Número de inventario generado · lote '||p_solicitud,a,d);
  INSERT INTO public.numeracion_asignaciones(equipo_id,numero,lote_id,prefijo,anio_oc,correlativo,actor) VALUES(e.id,numero,p_solicitud,n.prefijo,anio,v_ultimo,p_actor);
  resultado:=resultado||jsonb_build_array(jsonb_build_object('id',e.id,'numero',numero,'anioOC',anio));
 END LOOP;
 INSERT INTO public.numeracion_lotes VALUES(p_solicitud,p_actor,entrada,resultado,CURRENT_TIMESTAMP);RETURN resultado;
END;$f$;
CREATE FUNCTION public.proteger_numero_inventario() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
BEGIN
 PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1794268800000);
 IF TG_TABLE_NAME='equipos' AND TG_OP='UPDATE' AND NEW.numero_inventario IS DISTINCT FROM OLD.numero_inventario AND EXISTS(SELECT 1 FROM public.numeracion_asignaciones WHERE equipo_id=OLD.id) THEN RAISE EXCEPTION 'El número generado es permanente' USING ERRCODE='P4304';END IF;
 IF TG_OP='UPDATE' AND NEW.numero_inventario IS NOT DISTINCT FROM OLD.numero_inventario THEN RETURN NEW;END IF;
 IF NEW.numero_inventario IS NULL THEN RETURN NEW;END IF;
 IF (TG_TABLE_NAME='equipos' AND EXISTS(SELECT 1 FROM public.celulares WHERE upper(numero_inventario)=upper(NEW.numero_inventario))) OR (TG_TABLE_NAME='celulares' AND EXISTS(SELECT 1 FROM public.equipos WHERE upper(numero_inventario)=upper(NEW.numero_inventario))) OR EXISTS(SELECT 1 FROM public.numeracion_asignaciones WHERE upper(numero)=upper(NEW.numero_inventario) AND (TG_TABLE_NAME<>'equipos' OR equipo_id<>NEW.id)) THEN RAISE EXCEPTION 'Número de inventario ya utilizado' USING ERRCODE='23505';END IF;RETURN NEW;
END;$f$;
CREATE TRIGGER equipos_numero_permanente BEFORE INSERT OR UPDATE OF numero_inventario ON public.equipos FOR EACH ROW EXECUTE FUNCTION public.proteger_numero_inventario();
CREATE TRIGGER celulares_numero_global BEFORE INSERT OR UPDATE OF numero_inventario ON public.celulares FOR EACH ROW EXECUTE FUNCTION public.proteger_numero_inventario();
CREATE FUNCTION public.datos_etiquetas(p_actor text,p_filas jsonb,p_accion text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE ctx jsonb;f jsonb;e public.equipos%ROWTYPE;resultado jsonb:='[]';
BEGIN
 PERFORM public.rbac_exigir(p_actor,'etiquetas_inventario.consultar');PERFORM public.rbac_exigir(p_actor,'equipos.consultar');
 IF p_accion NOT IN ('imprimir','descargar') OR p_accion IS NULL THEN RAISE EXCEPTION 'Acción inválida' USING ERRCODE='22023';END IF;PERFORM public.rbac_exigir(p_actor,'etiquetas_inventario.'||p_accion);ctx:=public.rbac_contexto(p_actor);
 IF jsonb_typeof(p_filas) IS DISTINCT FROM 'array' OR jsonb_array_length(p_filas) NOT BETWEEN 1 AND 150 OR (SELECT count(DISTINCT v->>'id') FROM jsonb_array_elements(p_filas)v)<>jsonb_array_length(p_filas) THEN RAISE EXCEPTION 'Selección inválida' USING ERRCODE='22023';END IF;
 FOR f IN SELECT value FROM jsonb_array_elements(p_filas) LOOP
  IF jsonb_typeof(f) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(f))<>2 OR NOT f ?& ARRAY['id','version'] THEN RAISE EXCEPTION 'Selección inválida' USING ERRCODE='22023';END IF;
  SELECT * INTO e FROM public.equipos WHERE id=(f->>'id')::uuid FOR SHARE;
  IF e.id IS NULL OR ctx->>'alcance'='propios' OR (ctx->>'alcance'='sede' AND e.sede_id IS DISTINCT FROM (SELECT sede_id FROM public.usuarios_acceso WHERE correo=p_actor)) THEN RAISE EXCEPTION 'Equipo fuera de alcance' USING ERRCODE='42501';END IF;
  IF e.version IS DISTINCT FROM (f->>'version')::integer OR e.numero_inventario IS NULL THEN RAISE EXCEPTION 'El equipo cambió o no tiene inventario' USING ERRCODE='P4301';END IF;
  resultado:=resultado||jsonb_build_array((SELECT jsonb_build_object('id',e.id,'version',e.version,'inventario',e.numero_inventario,'serie',e.serie,'marca',e.marca,'modelo',e.modelo,'categoria',c.nombre,'sede',s.nombre,'rbd',s.rbd,'tipo',s.tipo) FROM public.categorias_bienes c,public.sedes s WHERE c.id=e.categoria_id AND s.id=e.sede_id));
 END LOOP;RETURN resultado;
END;$f$;
CREATE FUNCTION public.registrar_etiquetas(p_actor text,p_id uuid,p_filas jsonb,p_opciones jsonb,p_accion text,p_snapshot jsonb,p_pdf bytea) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE r public.etiquetas_lotes%ROWTYPE;datos jsonb;entrada jsonb;k text;
BEGIN
 datos:=public.datos_etiquetas(p_actor,p_filas,p_accion);IF datos IS DISTINCT FROM p_snapshot THEN RAISE EXCEPTION 'Los datos de la etiqueta cambiaron' USING ERRCODE='P4301';END IF;PERFORM pg_advisory_xact_lock(1796918400000);
 entrada:=jsonb_build_array(p_filas,p_opciones,p_accion);SELECT * INTO r FROM public.etiquetas_lotes WHERE id=p_id;
 IF FOUND THEN IF r.actor=p_actor AND r.entrada=entrada THEN RETURN r.id;END IF;RAISE EXCEPTION 'Solicitud reutilizada' USING ERRCODE='P4301';END IF;
 IF p_id IS NULL OR p_pdf IS NULL OR octet_length(p_pdf) NOT BETWEEN 5 AND 20000000 OR substring(p_pdf from 1 for 5)<>decode('255044462d','hex') OR jsonb_typeof(p_opciones) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(p_opciones))<>5 OR NOT p_opciones ?& ARRAY['posicion','copias','ajusteX','ajusteY','campos'] THEN RAISE EXCEPTION 'PDF u opciones inválidas' USING ERRCODE='22023';END IF;
 FOREACH k IN ARRAY ARRAY['posicion','copias','ajusteX','ajusteY'] LOOP IF jsonb_typeof(p_opciones->k) IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Opción numérica inválida' USING ERRCODE='22023';END IF;END LOOP;
 IF (p_opciones->>'posicion')::numeric NOT BETWEEN 1 AND 30 OR (p_opciones->>'posicion') !~ '^[0-9]+$' OR (p_opciones->>'copias')::numeric NOT BETWEEN 1 AND 10 OR (p_opciones->>'copias') !~ '^[0-9]+$' OR abs((p_opciones->>'ajusteX')::numeric)>3 OR abs((p_opciones->>'ajusteY')::numeric)>3 OR jsonb_typeof(p_opciones->'campos') IS DISTINCT FROM 'array' OR NOT (p_opciones->'campos') ? 'inventario' OR jsonb_array_length(p_opciones->'campos')>6 OR (SELECT count(DISTINCT v) FROM jsonb_array_elements_text(p_opciones->'campos')v)<>jsonb_array_length(p_opciones->'campos') OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_opciones->'campos')x WHERE x NOT IN ('inventario','categoria','marca','modelo','serie','rbd')) OR jsonb_array_length(datos)*(p_opciones->>'copias')::integer>300 THEN RAISE EXCEPTION 'Opciones de impresión inválidas' USING ERRCODE='22023';END IF;
 INSERT INTO public.etiquetas_lotes(id,actor,entrada,datos,opciones,pdf) VALUES(p_id,p_actor,entrada,datos,p_opciones,p_pdf);RETURN p_id;
END;$f$;
CREATE FUNCTION public.consultar_pdf_etiquetas(p_actor text,p_id uuid,p_accion text) RETURNS bytea LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE r public.etiquetas_lotes%ROWTYPE;filas jsonb;actual jsonb;
BEGIN
 SELECT * INTO r FROM public.etiquetas_lotes WHERE id=p_id;
 IF NOT FOUND OR r.actor<>p_actor OR r.estado='cancelado' THEN RAISE EXCEPTION 'Lote no disponible' USING ERRCODE='42501';END IF;
 SELECT jsonb_agg(jsonb_build_object('id',x->>'id','version',x->'version')) INTO filas FROM jsonb_array_elements(r.datos)x;
 actual:=public.datos_etiquetas(p_actor,filas,p_accion);IF actual IS DISTINCT FROM r.datos THEN RAISE EXCEPTION 'Los datos de la etiqueta cambiaron' USING ERRCODE='P4301';END IF;RETURN r.pdf;
END;$f$;
CREATE FUNCTION public.confirmar_impresion_etiquetas(p_actor text,p_id uuid,p_confirmar boolean) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE r public.etiquetas_lotes%ROWTYPE;filas jsonb;
BEGIN
 IF p_confirmar IS NULL THEN RAISE EXCEPTION 'Confirmación inválida' USING ERRCODE='22023';END IF;
 SELECT * INTO r FROM public.etiquetas_lotes WHERE id=p_id AND actor=p_actor FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Lote no disponible' USING ERRCODE='42501';END IF;
 SELECT jsonb_agg(jsonb_build_object('id',x->>'id','version',x->'version')) INTO filas FROM jsonb_array_elements(r.datos)x;PERFORM public.datos_etiquetas(p_actor,filas,'imprimir');
 IF r.estado='preparado' THEN UPDATE public.etiquetas_lotes SET estado=CASE WHEN p_confirmar THEN 'confirmado' ELSE 'cancelado' END,confirmado_en=CURRENT_TIMESTAMP WHERE id=p_id;RETURN CASE WHEN p_confirmar THEN 'confirmado' ELSE 'cancelado' END;END IF;
 IF (r.estado='confirmado')=p_confirmar THEN RETURN r.estado;END IF;RAISE EXCEPTION 'Lote ya resuelto' USING ERRCODE='P4301';
END;$f$;
CREATE FUNCTION public.historial_etiquetas(p_actor text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE r jsonb;ctx jsonb;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'etiquetas_inventario.consultar');PERFORM public.rbac_exigir(p_actor,'equipos.consultar');ctx:=public.rbac_contexto(p_actor);
 SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY registrado_en DESC),'[]') INTO r FROM (SELECT id,estado,registrado_en,confirmado_en,jsonb_array_length(datos)*(opciones->>'copias')::integer AS cantidad FROM public.etiquetas_lotes l WHERE actor=p_actor AND (ctx->>'alcance'='global' OR ctx->>'alcance'='sede' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(l.datos)b LEFT JOIN public.equipos e ON e.id=(b->>'id')::uuid WHERE e.id IS NULL OR e.sede_id IS DISTINCT FROM (SELECT sede_id FROM public.usuarios_acceso WHERE correo=p_actor))) ORDER BY registrado_en DESC LIMIT 30)x;RETURN r;
END;$f$;
REVOKE ALL ON FUNCTION public.exigir_numeracion(text,text),public.consultar_config_numeracion(text),public.guardar_config_numeracion(text,uuid,uuid,integer,text,boolean),public.consultar_identificacion(text,jsonb,text),public.generar_numeros_inventario(text,uuid,jsonb,integer),public.proteger_numero_inventario(),public.datos_etiquetas(text,jsonb,text),public.registrar_etiquetas(text,uuid,jsonb,jsonb,text,jsonb,bytea),public.consultar_pdf_etiquetas(text,uuid,text),public.confirmar_impresion_etiquetas(text,uuid,boolean),public.historial_etiquetas(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.proteger_numero_inventario() FROM inventario_app;
GRANT EXECUTE ON FUNCTION public.exigir_numeracion(text,text),public.consultar_config_numeracion(text),public.guardar_config_numeracion(text,uuid,uuid,integer,text,boolean),public.consultar_identificacion(text,jsonb,text),public.generar_numeros_inventario(text,uuid,jsonb,integer),public.datos_etiquetas(text,jsonb,text),public.registrar_etiquetas(text,uuid,jsonb,jsonb,text,jsonb,bytea),public.consultar_pdf_etiquetas(text,uuid,text),public.confirmar_impresion_etiquetas(text,uuid,boolean),public.historial_etiquetas(text) TO inventario_app;
`);
exports.down=()=>{throw new Error('Conservar numeración, impresiones e historial. Revertir aplicación o restaurar respaldo verificado.');};
