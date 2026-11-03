export function up(pgm){pgm.sql(`
-- Conservar los nombres completos existentes sin inferir apellidos.
ALTER TABLE public.directorio_sedes ADD COLUMN nombres text, ADD COLUMN apellidos text,
 ADD CONSTRAINT directorio_nombres_separados CHECK(
  (nombres IS NULL AND apellidos IS NULL) OR
  (nombres IS NOT NULL AND apellidos IS NOT NULL AND length(nombres) BETWEEN 1 AND 100 AND length(apellidos) BETWEEN 1 AND 100
   AND nombres=btrim(nombres) AND apellidos=btrim(apellidos) AND nombres !~ '[[:cntrl:]]' AND apellidos !~ '[[:cntrl:]]'
   AND nombre=nombres||' '||apellidos));
CREATE OR REPLACE FUNCTION public.guardar_ficha_directorio_acceso(p_actor text,p_sede uuid,p_datos jsonb,p_version integer,p_sede_version text,p_motivo text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE anterior public.directorio_sedes%ROWTYPE; posterior public.directorio_sedes%ROWTYPE;
 sede public.sedes%ROWTYPE; nueva_sede public.sedes%ROWTYPE; nombre text; rut text; correo text;
 nombres text; apellidos text; situacion text; observaciones text; cargo_asignado text; k text; suma integer; digito integer; esperado text;
BEGIN
 PERFORM pg_advisory_xact_lock(1793750400000);
 PERFORM 1 FROM public.usuarios_acceso u WHERE u.correo=p_actor AND u.activo AND u.rol IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501'; END IF;
 SELECT * INTO sede FROM public.sedes WHERE id=p_sede AND activo AND tipo IN ('establecimiento','jardin_infantil') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sede no disponible' USING ERRCODE='P2202'; END IF;
 IF p_sede_version IS NULL OR p_sede_version::jsonb IS DISTINCT FROM jsonb_build_array(sede.nombre,COALESCE(sede.direccion,''),COALESCE(sede.comuna,''),COALESCE(sede.correo_institucional,'')) THEN RAISE EXCEPTION 'La sede cambió' USING ERRCODE='P2201'; END IF;
 IF p_version IS NULL OR p_version<0 OR p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 1 AND 500 OR p_motivo ~ '[[:cntrl:]]'
  OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023'; END IF;
 FOREACH k IN ARRAY ARRAY['nombre','rut','correo','situacion','observaciones','sedeNombre','direccion','comuna','correoInstitucional'] LOOP
  IF jsonb_typeof(p_datos->k) IS DISTINCT FROM 'string' OR (p_datos->>k) ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Campo inválido' USING ERRCODE='22023'; END IF;
 END LOOP;
 nombre:=NULLIF(btrim(p_datos->>'nombre'),'');rut:=NULLIF(upper(replace(btrim(p_datos->>'rut'),'.','')),'');correo:=NULLIF(lower(btrim(p_datos->>'correo')),'');
 situacion:=p_datos->>'situacion';observaciones:=btrim(p_datos->>'observaciones');
 IF situacion NOT IN ('titular','subrogante','vacante','pendiente') OR length(COALESCE(nombre,''))>200 OR length(observaciones)>2000
  OR (situacion IN ('titular','subrogante') AND nombre IS NULL) OR (situacion IN ('vacante','pendiente') AND (nombre IS NOT NULL OR rut IS NOT NULL OR correo IS NOT NULL))
  OR length(btrim(p_datos->>'sedeNombre')) NOT BETWEEN 1 AND 200 OR length(p_datos->>'direccion')>250 OR length(p_datos->>'comuna')>100
  OR (correo IS NOT NULL AND (length(correo)>254 OR correo !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'))
  OR (p_datos->>'correoInstitucional'<>'' AND (length(p_datos->>'correoInstitucional')>254 OR p_datos->>'correoInstitucional' !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')) THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023'; END IF;
 IF rut IS NOT NULL THEN
  IF rut !~ '^[0-9]{7,8}-[0-9K]$' THEN RAISE EXCEPTION 'RUN inválido' USING ERRCODE='22023'; END IF;
  suma:=0;FOR digito IN 1..length(split_part(rut,'-',1)) LOOP
   suma:=suma+substring(reverse(split_part(rut,'-',1)),digito,1)::integer*(2+(digito-1)%6);
  END LOOP;
  digito:=11-suma%11;esperado:=CASE digito WHEN 11 THEN '0' WHEN 10 THEN 'K' ELSE digito::text END;
  IF split_part(rut,'-',2)<>esperado THEN RAISE EXCEPTION 'Dígito verificador inválido' USING ERRCODE='22023'; END IF;
 END IF;
 SELECT * INTO anterior FROM public.directorio_sedes WHERE sede_id=p_sede FOR UPDATE;
 IF COALESCE(anterior.version,0)<>p_version THEN RAISE EXCEPTION 'Edición obsoleta' USING ERRCODE='P2201'; END IF;
 IF p_datos ? 'nombres' OR p_datos ? 'apellidos' THEN
  IF jsonb_typeof(p_datos->'nombres') IS DISTINCT FROM 'string' OR jsonb_typeof(p_datos->'apellidos') IS DISTINCT FROM 'string'
    OR (p_datos->>'nombres') ~ '[[:cntrl:]]' OR (p_datos->>'apellidos') ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Nombre inválido' USING ERRCODE='22023'; END IF;
  nombres:=NULLIF(normalize(regexp_replace(btrim(p_datos->>'nombres'),' +',' ','g'),NFC),'');
  apellidos:=NULLIF(normalize(regexp_replace(btrim(p_datos->>'apellidos'),' +',' ','g'),NFC),'');
  IF (nombres IS NULL)<>(apellidos IS NULL) OR length(nombres)>100 OR length(apellidos)>100
    OR (nombres IS NOT NULL AND nombre IS DISTINCT FROM nombres||' '||apellidos)
    OR (situacion IN ('vacante','pendiente') AND nombres IS NOT NULL) THEN RAISE EXCEPTION 'Nombres y apellidos inválidos' USING ERRCODE='22023'; END IF;
 ELSIF anterior.nombre IS NOT DISTINCT FROM nombre THEN
  nombres:=anterior.nombres;apellidos:=anterior.apellidos;
 END IF;
 cargo_asignado:=CASE sede.tipo WHEN 'jardin_infantil' THEN 'Directora del jardín infantil' ELSE 'Director/a del establecimiento' END;
 UPDATE public.sedes SET nombre=btrim(p_datos->>'sedeNombre'),direccion=NULLIF(btrim(p_datos->>'direccion'),''),comuna=NULLIF(btrim(p_datos->>'comuna'),''),correo_institucional=NULLIF(lower(btrim(p_datos->>'correoInstitucional')),'') WHERE id=p_sede RETURNING * INTO nueva_sede;
 IF anterior.sede_id IS NOT NULL AND anterior.nombre IS NOT DISTINCT FROM nombre AND anterior.rut IS NOT DISTINCT FROM rut AND anterior.correo IS NOT DISTINCT FROM correo
  AND anterior.nombres IS NOT DISTINCT FROM nombres AND anterior.apellidos IS NOT DISTINCT FROM apellidos
  AND anterior.situacion=situacion AND anterior.observaciones=observaciones AND anterior.cargo=cargo_asignado AND to_jsonb(sede)=to_jsonb(nueva_sede) THEN RETURN anterior.version; END IF;
 INSERT INTO public.directorio_sedes(sede_id,nombre,nombres,apellidos,rut,correo,situacion,observaciones,cargo,actualizado_por)
 VALUES(p_sede,nombre,nombres,apellidos,rut,correo,situacion,observaciones,cargo_asignado,p_actor)
 ON CONFLICT(sede_id) DO UPDATE SET nombre=EXCLUDED.nombre,nombres=EXCLUDED.nombres,apellidos=EXCLUDED.apellidos,rut=EXCLUDED.rut,correo=EXCLUDED.correo,situacion=EXCLUDED.situacion,observaciones=EXCLUDED.observaciones,cargo=EXCLUDED.cargo,version=directorio_sedes.version+1,actualizado_por=p_actor,actualizado_en=CURRENT_TIMESTAMP RETURNING * INTO posterior;
 INSERT INTO public.directorio_historial(sede_id,actor,motivo,antes,despues)
 VALUES(p_sede,p_actor,btrim(p_motivo),COALESCE(to_jsonb(anterior),'{}')||jsonb_build_object('sede',to_jsonb(sede)),to_jsonb(posterior)||jsonb_build_object('sede',to_jsonb(nueva_sede)));
 RETURN posterior.version;
END;
$fn$;
CREATE FUNCTION public.guardar_sede_directorio_acceso(p_actor text,p_sede uuid,p_datos jsonb,p_sede_version text,p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE anterior public.sedes%ROWTYPE;posterior public.sedes%ROWTYPE;director public.directorio_sedes%ROWTYPE;k text;
BEGIN
 PERFORM pg_advisory_xact_lock(1793750400000);
 PERFORM 1 FROM public.usuarios_acceso u WHERE u.correo=p_actor AND u.activo AND u.rol IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_datos) IS DISTINCT FROM 'object' OR p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 1 AND 500 OR p_motivo ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_datos) t(clave) WHERE clave NOT IN ('rbd','sedeNombre','direccion','comuna','correoInstitucional')) THEN RAISE EXCEPTION 'Campo no permitido' USING ERRCODE='22023'; END IF;
 FOREACH k IN ARRAY ARRAY['rbd','sedeNombre','direccion','comuna','correoInstitucional'] LOOP
  IF jsonb_typeof(p_datos->k) IS DISTINCT FROM 'string' OR (p_datos->>k) ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Campo inválido' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF length(btrim(p_datos->>'sedeNombre')) NOT BETWEEN 1 AND 200 OR length(p_datos->>'rbd')>30 OR length(p_datos->>'direccion')>250 OR length(p_datos->>'comuna')>100
 OR (p_datos->>'correoInstitucional'<>'' AND (length(p_datos->>'correoInstitucional')>254 OR p_datos->>'correoInstitucional' !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')) THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023'; END IF;
 SELECT * INTO anterior FROM public.sedes WHERE id=p_sede AND activo AND tipo IN ('establecimiento','jardin_infantil') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sede no disponible' USING ERRCODE='P2202'; END IF;
 IF p_sede_version IS NULL OR p_sede_version::jsonb IS DISTINCT FROM jsonb_build_array(anterior.tipo,COALESCE(anterior.rbd,''),anterior.nombre,COALESCE(anterior.direccion,''),COALESCE(anterior.comuna,''),COALESCE(anterior.correo_institucional,'')) THEN RAISE EXCEPTION 'La sede cambió' USING ERRCODE='P2201'; END IF;
 SELECT * INTO director FROM public.directorio_sedes WHERE sede_id=p_sede;
 UPDATE public.sedes SET rbd=NULLIF(btrim(p_datos->>'rbd'),''),nombre=btrim(p_datos->>'sedeNombre'),direccion=NULLIF(btrim(p_datos->>'direccion'),''),comuna=NULLIF(btrim(p_datos->>'comuna'),''),correo_institucional=NULLIF(lower(btrim(p_datos->>'correoInstitucional')),'') WHERE id=p_sede RETURNING * INTO posterior;
 IF to_jsonb(anterior)=to_jsonb(posterior) THEN RETURN; END IF;
 INSERT INTO public.directorio_historial(sede_id,actor,motivo,antes,despues)
 VALUES(p_sede,p_actor,btrim(p_motivo),COALESCE(to_jsonb(director),'{}')||jsonb_build_object('sede',to_jsonb(anterior)),COALESCE(to_jsonb(director),'{}')||jsonb_build_object('sede',to_jsonb(posterior)));
END;
$fn$;
REVOKE ALL ON FUNCTION public.guardar_sede_directorio_acceso(text,uuid,jsonb,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_sede_directorio_acceso(text,uuid,jsonb,text,text) TO inventario_app;

`);}
export const down=false;
