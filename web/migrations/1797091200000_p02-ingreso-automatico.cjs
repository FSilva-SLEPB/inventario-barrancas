exports.up=pgm=>pgm.sql(String.raw`
CREATE TABLE public.p02_prefijos(categoria_id uuid PRIMARY KEY REFERENCES public.categorias_bienes(id),prefijo text NOT NULL CHECK(prefijo ~ '^[A-Z]{2,5}$'),activo boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1);
INSERT INTO public.p02_prefijos SELECT categoria_id,prefijo,activo,1 FROM public.numeracion_categorias;
CREATE TABLE public.p02_numeros(equipo_id uuid PRIMARY KEY REFERENCES public.equipos(id),numero text NOT NULL UNIQUE,prefijo text NOT NULL,anio integer NOT NULL,correlativo integer NOT NULL,actor text NOT NULL REFERENCES public.usuarios_acceso(correo),registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE public.p02_registros(solicitud uuid PRIMARY KEY,actor text NOT NULL REFERENCES public.usuarios_acceso(correo),entrada jsonb NOT NULL,equipo_id uuid NOT NULL REFERENCES public.equipos(id),registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE public.p02_config_historial(solicitud uuid PRIMARY KEY,actor text NOT NULL REFERENCES public.usuarios_acceso(correo),entrada jsonb NOT NULL,antes jsonb,despues jsonb NOT NULL,registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
ALTER TABLE public.importaciones_excel ADD COLUMN p02_numeracion jsonb;
REVOKE ALL ON public.p02_prefijos,public.p02_numeros,public.p02_registros,public.p02_config_historial FROM PUBLIC,inventario_app;
CREATE FUNCTION public.p02_anio_numeracion(p_fecha text,p_anio integer) RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $f$
DECLARE anio integer;
BEGIN
 IF COALESCE(p_fecha,'')<>'' THEN
  IF p_fecha ~ '^(19|20)[0-9]{2}$' THEN RETURN p_fecha::integer;END IF;
  IF p_fecha !~ '^(19|20)[0-9]{2}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Fecha OC inválida' USING ERRCODE='22023';END IF;
  BEGIN IF to_char(p_fecha::date,'YYYY-MM-DD')<>p_fecha THEN RAISE EXCEPTION 'Fecha OC inválida' USING ERRCODE='22023';END IF;anio:=extract(year FROM p_fecha::date)::integer;EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'Fecha OC inválida' USING ERRCODE='22023';END;
  RETURN anio;
 END IF;
 IF p_anio IS NULL OR p_anio NOT BETWEEN 1900 AND 2099 THEN RAISE EXCEPTION 'Confirma el año de numeración sin inventar una OC' USING ERRCODE='P4501';END IF;RETURN p_anio;
END;$f$;
CREATE FUNCTION public.p02_consultar_prefijos(p_actor text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
BEGIN
 IF NOT public.rbac_tiene(p_actor,'equipos.registrar') AND NOT public.rbac_tiene(p_actor,'numeracion_inventario.consultar') THEN RAISE EXCEPTION 'Sin permiso' USING ERRCODE='42501';END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.id,'nombre',c.nombre,'prefijo',p.prefijo,'activo',COALESCE(p.activo,false) AND c.activo,'version',COALESCE(p.version,0)) ORDER BY c.nombre,c.id) FROM public.categorias_bienes c LEFT JOIN public.p02_prefijos p ON p.categoria_id=c.id),'[]');
END;$f$;
CREATE FUNCTION public.p02_guardar_prefijo(p_actor text,p_solicitud uuid,p_categoria uuid,p_version integer,p_prefijo text,p_activo boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE anterior public.p02_prefijos%ROWTYPE;h public.p02_config_historial%ROWTYPE;entrada jsonb;d jsonb;
BEGIN
 PERFORM public.exigir_numeracion(p_actor,'confirmar');PERFORM public.rbac_exigir(p_actor,'categorias.editar');PERFORM pg_advisory_xact_lock(1796918400000);
 entrada:=jsonb_build_array(p_categoria,p_version,p_prefijo,p_activo);SELECT * INTO h FROM public.p02_config_historial WHERE solicitud=p_solicitud;
 IF FOUND THEN IF h.actor=p_actor AND h.entrada=entrada THEN RETURN h.despues;END IF;RAISE EXCEPTION 'Solicitud reutilizada' USING ERRCODE='P4502';END IF;
 IF p_solicitud IS NULL OR p_categoria IS NULL OR p_version IS NULL OR p_version<0 OR p_prefijo IS NULL OR p_prefijo !~ '^[A-Z]{2,5}$' OR p_activo IS NULL OR NOT EXISTS(SELECT 1 FROM public.categorias_bienes WHERE id=p_categoria AND activo) THEN RAISE EXCEPTION 'Prefijo inválido' USING ERRCODE='22023';END IF;
 SELECT * INTO anterior FROM public.p02_prefijos WHERE categoria_id=p_categoria FOR UPDATE;
 IF COALESCE(anterior.version,0)<>p_version THEN RAISE EXCEPTION 'La configuración cambió' USING ERRCODE='P4502';END IF;
 INSERT INTO public.p02_prefijos VALUES(p_categoria,p_prefijo,p_activo,1) ON CONFLICT(categoria_id) DO UPDATE SET prefijo=EXCLUDED.prefijo,activo=EXCLUDED.activo,version=p02_prefijos.version+1 RETURNING to_jsonb(p02_prefijos) INTO d;
 INSERT INTO public.p02_config_historial(solicitud,actor,entrada,antes,despues) VALUES(p_solicitud,p_actor,entrada,CASE WHEN anterior.categoria_id IS NOT NULL THEN to_jsonb(anterior) END,d);RETURN d;
END;$f$;
-- Función privada: solo se llama al crear un bien nuevo o confirmar su importación.
CREATE FUNCTION public.p02_numerar_nuevo(p_actor text,p_equipo uuid,p_anio integer,p_revisar_maximo boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE e public.equipos%ROWTYPE;p public.p02_prefijos%ROWTYPE;anio integer;aa integer;maximo integer;v_ultimo integer;numero text;antes jsonb;despues jsonb;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'equipos.registrar');PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1794268800000);PERFORM pg_advisory_xact_lock(1796918400000);
 SELECT * INTO e FROM public.equipos WHERE id=p_equipo FOR UPDATE;
 IF e.id IS NULL OR e.creado_por<>p_actor OR NOT EXISTS(SELECT 1 FROM public.sedes WHERE id=e.sede_id AND activo AND tipo IN ('establecimiento','jardin_infantil')) THEN RAISE EXCEPTION 'Solo un alta P02 autorizada' USING ERRCODE='42501';END IF;
 PERFORM public.rbac_exigir(p_actor,'equipos.registrar',e.sede_id);
 IF NULLIF(btrim(e.numero_inventario),'') IS NOT NULL THEN RETURN false;END IF;
 SELECT * INTO p FROM public.p02_prefijos WHERE categoria_id=e.categoria_id AND activo AND EXISTS(SELECT 1 FROM public.categorias_bienes WHERE id=e.categoria_id AND activo) FOR SHARE;
 IF p.categoria_id IS NULL THEN RAISE EXCEPTION 'Configura el prefijo P02 de la categoría' USING ERRCODE='P4501';END IF;
 anio:=public.p02_anio_numeracion(e.datos_compra->>'fechaOrdenCompra',p_anio);aa:=anio%100;
 IF p_revisar_maximo THEN
 SELECT COALESCE(max(right(v,4)::integer),0) INTO maximo FROM (SELECT upper(btrim(numero_inventario)) v FROM public.equipos UNION ALL SELECT upper(btrim(numero_inventario)) FROM public.celulares UNION ALL SELECT n.numero FROM public.numeracion_asignaciones n UNION ALL SELECT n.numero FROM public.p02_numeros n)x WHERE v ~ ('^'||p.prefijo||lpad(aa::text,2,'0')||'[0-9]{4}$');
 ELSE maximo:=0;END IF;
 INSERT INTO public.numeracion_secuencias VALUES(p.prefijo,aa,maximo) ON CONFLICT(prefijo,anio2) DO UPDATE SET ultimo=GREATEST(numeracion_secuencias.ultimo,EXCLUDED.ultimo) RETURNING numeracion_secuencias.ultimo INTO v_ultimo;
 v_ultimo:=v_ultimo+1;IF v_ultimo>9999 THEN RAISE EXCEPTION 'Correlativo agotado' USING ERRCODE='P4303';END IF;
 numero:=p.prefijo||lpad(aa::text,2,'0')||lpad(v_ultimo::text,4,'0');antes:=to_jsonb(e);
 UPDATE public.numeracion_secuencias SET ultimo=v_ultimo WHERE prefijo=p.prefijo AND anio2=aa;
 UPDATE public.equipos SET numero_inventario=numero,version=version+1,actualizado_en=CURRENT_TIMESTAMP,datos_compra=datos_compra||jsonb_build_object('p02AnioNumeracion',anio) WHERE id=e.id RETURNING to_jsonb(equipos) INTO despues;
 INSERT INTO public.p02_numeros(equipo_id,numero,prefijo,anio,correlativo,actor) VALUES(e.id,numero,p.prefijo,anio,v_ultimo,p_actor);
 INSERT INTO public.equipos_historial(equipo_id,actor,motivo,antes,despues) VALUES(e.id,p_actor,'Número P02 generado automáticamente al ingresar el bien',antes,despues);RETURN true;
END;$f$;
CREATE FUNCTION public.p02_numerar_nuevo(p_actor text,p_equipo uuid,p_anio integer) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
 SELECT public.p02_numerar_nuevo(p_actor,p_equipo,p_anio,true);
$f$;
CREATE FUNCTION public.p02_proteger_numero() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
BEGIN IF NEW.numero_inventario IS DISTINCT FROM OLD.numero_inventario AND EXISTS(SELECT 1 FROM public.p02_numeros WHERE equipo_id=OLD.id) THEN RAISE EXCEPTION 'El número generado es permanente' USING ERRCODE='P4502';END IF;RETURN NEW;END;$f$;
CREATE TRIGGER p02_numero_permanente BEFORE UPDATE ON public.equipos FOR EACH ROW EXECUTE FUNCTION public.p02_proteger_numero();
CREATE FUNCTION public.p02_registrar_equipo(p_actor text,p_solicitud uuid,p_datos jsonb,p_anio integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE h public.p02_registros%ROWTYPE;entrada jsonb;id_bien uuid;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'equipos.registrar',(p_datos->>'sedeId')::uuid);PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1794268800000);
 IF p_solicitud IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object' OR octet_length(p_datos::text)>32000 OR COALESCE(p_datos->>'id','')<>'' OR NOT EXISTS(SELECT 1 FROM public.sedes WHERE id=(p_datos->>'sedeId')::uuid AND activo AND tipo IN ('establecimiento','jardin_infantil')) THEN RAISE EXCEPTION 'Alta P02 inválida' USING ERRCODE='22023';END IF;
 entrada:=jsonb_build_array(p_datos,p_anio);SELECT * INTO h FROM public.p02_registros WHERE solicitud=p_solicitud;
 IF FOUND THEN IF h.actor=p_actor AND h.entrada=entrada THEN RETURN h.equipo_id;END IF;RAISE EXCEPTION 'Solicitud reutilizada' USING ERRCODE='P4502';END IF;
 id_bien:=public.guardar_equipo_acceso(p_actor,p_datos,0,'Registro inicial');PERFORM public.p02_numerar_nuevo(p_actor,id_bien,p_anio);
 INSERT INTO public.p02_registros(solicitud,actor,entrada,equipo_id) VALUES(p_solicitud,p_actor,entrada,id_bien);RETURN id_bien;
END;$f$;
CREATE FUNCTION public.p02_validar_previa(p_datos jsonb,p_anio integer,p_config jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE d jsonb;p public.p02_prefijos%ROWTYPE;
BEGIN
 IF p_anio IS NOT NULL AND p_anio NOT BETWEEN 1900 AND 2099 OR jsonb_typeof(p_config) IS DISTINCT FROM 'array' OR jsonb_array_length(p_config)>1000 THEN RAISE EXCEPTION 'Año o configuración inválidos' USING ERRCODE='22023';END IF;
 FOR d IN SELECT x->'datos' FROM jsonb_array_elements(p_datos)x WHERE NULLIF(btrim(x->'datos'->>'inventario'),'') IS NULL LOOP
  PERFORM public.p02_anio_numeracion(d->'compra'->>'fechaOrdenCompra',p_anio);
  SELECT * INTO p FROM public.p02_prefijos WHERE categoria_id=(d->>'categoriaId')::uuid AND activo AND EXISTS(SELECT 1 FROM public.categorias_bienes WHERE id=(d->>'categoriaId')::uuid AND activo) FOR SHARE;
  IF p.categoria_id IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_config)x WHERE x->>'id'=p.categoria_id::text AND x->>'prefijo'=p.prefijo AND x->>'version'=p.version::text) THEN RAISE EXCEPTION 'La configuración P02 cambió o está pendiente' USING ERRCODE='P4502';END IF;
 END LOOP;
END;$f$;
CREATE FUNCTION public.p02_preparar_importacion(p_actor text,p_archivo text,p_sha text,p_hoja text,p_datos jsonb,p_anio integer,p_config jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE id_previa uuid;
BEGIN
 PERFORM public.exigir_importacion_excel(p_actor,'establecimientos');PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1794268800000);PERFORM pg_advisory_xact_lock(1796832000000);PERFORM pg_advisory_xact_lock(1796918400000);
 PERFORM public.p02_validar_previa(p_datos,p_anio,p_config);
 id_previa:=public.preparar_importacion_excel(p_actor,p_archivo,p_sha,'establecimientos',p_hoja,p_datos);
 UPDATE public.importaciones_excel SET p02_numeracion=jsonb_build_object('anio',p_anio,'config',p_config) WHERE id=id_previa AND confirmado_en IS NULL;RETURN id_previa;
END;$f$;
ALTER FUNCTION public.confirmar_importacion_excel(text,uuid) RENAME TO confirmar_importacion_excel_v44;
REVOKE ALL ON FUNCTION public.confirmar_importacion_excel_v44(text,uuid) FROM PUBLIC,inventario_app;
CREATE FUNCTION public.confirmar_importacion_excel(p_actor text,p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE r public.importaciones_excel%ROWTYPE;d jsonb;salida jsonb;unidades integer:=0;parte integer:=0;n integer;shas text[]:='{}';e record;numerados integer:=0;anio integer;clave text;vistos text[]:='{}';
BEGIN
 PERFORM pg_advisory_xact_lock(1793404800000);PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1794268800000);PERFORM pg_advisory_xact_lock(1794009600000);PERFORM pg_advisory_xact_lock(1796832000000);
 SELECT * INTO r FROM public.importaciones_excel WHERE id=p_id AND actor=p_actor FOR UPDATE;
 IF r.p02_numeracion IS NULL OR r.confirmado_en IS NOT NULL THEN RETURN public.confirmar_importacion_excel_v44(p_actor,p_id);END IF;
 PERFORM public.exigir_importacion_excel(p_actor,'establecimientos');IF r.tipo<>'establecimientos' THEN RAISE EXCEPTION 'Modalidad incompatible' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(1796918400000);anio:=(r.p02_numeracion->>'anio')::integer;PERFORM public.p02_validar_previa(r.datos,anio,r.p02_numeracion->'config');
 FOR d IN SELECT value->'datos' FROM jsonb_array_elements(r.datos) LOOP
  n:=(d->>'cantidad')::integer;IF unidades+n>2500 THEN parte:=parte+1;shas:=array_append(shas,encode(sha256(convert_to(r.sha256||r.tipo||r.hoja||r.id::text||parte::text,'UTF8')),'hex'));unidades:=0;END IF;unidades:=unidades+n;
 END LOOP;
 IF unidades>0 THEN parte:=parte+1;shas:=array_append(shas,encode(sha256(convert_to(r.sha256||r.tipo||r.hoja||r.id::text||parte::text,'UTF8')),'hex'));END IF;
 salida:=public.confirmar_importacion_excel_v44(p_actor,p_id);
 IF salida->>'repetida'='false' THEN
  -- Bajo los mismos bloqueos, contrastar el máximo global una vez por prefijo/año.
  -- El contador transaccional incorpora todas las unidades siguientes del lote.
  FOR e IN SELECT b.id,p.prefijo,b.datos_compra->>'fechaOrdenCompra' fecha FROM public.equipos b JOIN public.cargas_equipos c ON c.id=b.carga_id LEFT JOIN public.p02_prefijos p ON p.categoria_id=b.categoria_id WHERE c.actor=p_actor AND c.sha256=ANY(shas) AND NULLIF(btrim(b.numero_inventario),'') IS NULL ORDER BY b.id LOOP
   clave:=COALESCE(e.prefijo,'')||':'||public.p02_anio_numeracion(e.fecha,anio)::text;
   IF public.p02_numerar_nuevo(p_actor,e.id,anio,NOT clave=ANY(vistos)) THEN numerados:=numerados+1;vistos:=array_append(vistos,clave);END IF;
  END LOOP;
  salida:=salida||jsonb_build_object('numeradosP02',numerados);UPDATE public.importaciones_excel SET resultado=salida WHERE id=r.id;
 END IF;RETURN salida;
END;$f$;
CREATE FUNCTION public.p02_confirmar_importacion(p_actor text,p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
BEGIN
 PERFORM public.exigir_importacion_excel(p_actor,'establecimientos');
 IF NOT EXISTS(SELECT 1 FROM public.importaciones_excel WHERE id=p_id AND actor=p_actor AND tipo='establecimientos' AND p02_numeracion IS NOT NULL) THEN RAISE EXCEPTION 'Revisión P02 ajena o incompatible' USING ERRCODE='42501';END IF;
 RETURN public.confirmar_importacion_excel(p_actor,p_id);
END;$f$;
REVOKE ALL ON FUNCTION public.p02_confirmar_importacion(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.p02_confirmar_importacion(text,uuid) TO inventario_app;
REVOKE ALL ON FUNCTION public.p02_anio_numeracion(text,integer),public.p02_numerar_nuevo(text,uuid,integer),public.p02_numerar_nuevo(text,uuid,integer,boolean),public.p02_proteger_numero(),public.p02_validar_previa(jsonb,integer,jsonb) FROM PUBLIC,inventario_app;
REVOKE ALL ON FUNCTION public.p02_consultar_prefijos(text),public.p02_guardar_prefijo(text,uuid,uuid,integer,text,boolean),public.p02_registrar_equipo(text,uuid,jsonb,integer),public.p02_preparar_importacion(text,text,text,text,jsonb,integer,jsonb),public.confirmar_importacion_excel(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.p02_consultar_prefijos(text),public.p02_guardar_prefijo(text,uuid,uuid,integer,text,boolean),public.p02_registrar_equipo(text,uuid,jsonb,integer),public.p02_preparar_importacion(text,text,text,text,jsonb,integer,jsonb),public.confirmar_importacion_excel(text,uuid) TO inventario_app;
`);
exports.down=()=>{throw new Error('Conservar números, importaciones e historial. Usar recuperación ensayada con respaldo.');};
