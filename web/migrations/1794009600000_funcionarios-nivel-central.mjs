export function up(pgm){
 pgm.sql(`
CREATE TABLE public.funcionarios_nc (
 id uuid PRIMARY KEY,
 nombre text NOT NULL CHECK(length(nombre) BETWEEN 1 AND 200 AND nombre=btrim(nombre) AND nombre !~ '[[:cntrl:]]'),
 rut text CHECK(rut IS NULL OR rut ~ '^[0-9]{7,8}-[0-9K]$'),
 correo text CHECK(correo IS NULL OR (length(correo)<=254 AND correo=lower(correo) AND correo ~ '^[a-z0-9._%+-]+@slepb[.]gob[.]cl$')),
 unidad text NOT NULL DEFAULT '' CHECK(length(unidad)<=120 AND unidad=btrim(unidad) AND unidad !~ '[[:cntrl:]]'),
 subdireccion text NOT NULL DEFAULT '' CHECK(length(subdireccion)<=120 AND subdireccion=btrim(subdireccion) AND subdireccion !~ '[[:cntrl:]]'),
 cargo text NOT NULL DEFAULT '' CHECK(length(cargo)<=120 AND cargo=btrim(cargo) AND cargo !~ '[[:cntrl:]]'),
 fecha_ingreso date CHECK(fecha_ingreso BETWEEN DATE '1900-01-01' AND DATE '9999-12-31'),
 activo boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 creado_por text NOT NULL,creado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 actualizado_por text NOT NULL,actualizado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX funcionarios_nc_rut_unico ON public.funcionarios_nc(rut) WHERE rut IS NOT NULL;
CREATE UNIQUE INDEX funcionarios_nc_correo_unico ON public.funcionarios_nc(correo) WHERE correo IS NOT NULL;
CREATE TABLE public.funcionarios_nc_historial (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 funcionario_id uuid NOT NULL REFERENCES public.funcionarios_nc(id),
 actor text NOT NULL,motivo text NOT NULL CHECK(length(btrim(motivo)) BETWEEN 1 AND 500),
 antes jsonb,despues jsonb NOT NULL,registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
REVOKE ALL ON public.funcionarios_nc,public.funcionarios_nc_historial FROM PUBLIC,inventario_app;
GRANT SELECT ON public.funcionarios_nc,public.funcionarios_nc_historial TO inventario_app;

CREATE FUNCTION public.guardar_funcionario_nc_acceso(p_actor text,p_id uuid,p_datos jsonb,p_version integer,p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE anterior public.funcionarios_nc%ROWTYPE;posterior public.funcionarios_nc%ROWTYPE;
 nombre text;rut text;correo text;unidad text;subdireccion text;cargo text;fecha date;activo boolean;
 k text;suma integer;digito integer;esperado text;normalizado jsonb;previo jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(1794009600000);
 PERFORM 1 FROM public.usuarios_acceso u WHERE u.correo=p_actor AND u.activo AND u.rol IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_version IS NULL OR p_version<0 OR p_version>=2147483647 OR p_motivo IS NULL
 OR length(btrim(p_motivo)) NOT BETWEEN 1 AND 500 OR p_motivo ~ '[[:cntrl:]]'
 OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_datos) t(clave) WHERE clave NOT IN ('nombre','rut','correo','unidad','subdireccion','cargo','fechaIngreso','activo')) THEN RAISE EXCEPTION 'Campo no permitido' USING ERRCODE='22023'; END IF;
 FOREACH k IN ARRAY ARRAY['nombre','rut','correo','unidad','subdireccion','cargo','fechaIngreso'] LOOP
  IF jsonb_typeof(p_datos->k) IS DISTINCT FROM 'string' OR (p_datos->>k) ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Campo inválido' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF jsonb_typeof(p_datos->'activo') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Estado inválido' USING ERRCODE='22023'; END IF;
 nombre:=normalize(regexp_replace(btrim(p_datos->>'nombre'),' +',' ','g'),NFC);
 rut:=NULLIF(upper(replace(btrim(p_datos->>'rut'),'.','')),'');correo:=NULLIF(lower(btrim(p_datos->>'correo')),'');
 unidad:=normalize(regexp_replace(btrim(p_datos->>'unidad'),' +',' ','g'),NFC);
 subdireccion:=normalize(regexp_replace(btrim(p_datos->>'subdireccion'),' +',' ','g'),NFC);
 cargo:=normalize(regexp_replace(btrim(p_datos->>'cargo'),' +',' ','g'),NFC);activo:=(p_datos->>'activo')::boolean;
 IF length(nombre) NOT BETWEEN 1 AND 200 OR length(unidad)>120 OR length(subdireccion)>120 OR length(cargo)>120
 OR (correo IS NOT NULL AND (length(correo)>254 OR correo !~ '^[a-z0-9._%+-]+@slepb[.]gob[.]cl$')) THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023'; END IF;
 IF rut IS NOT NULL THEN
  IF rut !~ '^[0-9]{7,8}-[0-9K]$' THEN RAISE EXCEPTION 'RUN inválido' USING ERRCODE='22023'; END IF;
  suma:=0;FOR digito IN 1..length(split_part(rut,'-',1)) LOOP suma:=suma+substring(reverse(split_part(rut,'-',1)),digito,1)::integer*(2+(digito-1)%6);END LOOP;
  digito:=11-suma%11;esperado:=CASE digito WHEN 11 THEN '0' WHEN 10 THEN 'K' ELSE digito::text END;
  IF split_part(rut,'-',2)<>esperado THEN RAISE EXCEPTION 'Dígito verificador inválido' USING ERRCODE='22023'; END IF;
 END IF;
 IF p_datos->>'fechaIngreso'<>'' THEN
  IF p_datos->>'fechaIngreso' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Fecha inválida' USING ERRCODE='22023'; END IF;
  BEGIN fecha:=(p_datos->>'fechaIngreso')::date;EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'Fecha inválida' USING ERRCODE='22023';END;
  IF fecha<DATE '1900-01-01' OR fecha>DATE '9999-12-31' OR to_char(fecha,'YYYY-MM-DD')<>p_datos->>'fechaIngreso' THEN RAISE EXCEPTION 'Fecha inválida' USING ERRCODE='22023'; END IF;
 END IF;
 normalizado:=jsonb_build_object('nombre',nombre,'rut',COALESCE(rut,''),'correo',COALESCE(correo,''),'unidad',unidad,'subdireccion',subdireccion,'cargo',cargo,'fechaIngreso',COALESCE(to_char(fecha,'YYYY-MM-DD'),''),'activo',activo);
 SELECT * INTO anterior FROM public.funcionarios_nc WHERE id=p_id FOR UPDATE;
 IF anterior.id IS NOT NULL THEN
  previo:=jsonb_build_object('nombre',anterior.nombre,'rut',COALESCE(anterior.rut,''),'correo',COALESCE(anterior.correo,''),'unidad',anterior.unidad,'subdireccion',anterior.subdireccion,'cargo',anterior.cargo,'fechaIngreso',COALESCE(to_char(anterior.fecha_ingreso,'YYYY-MM-DD'),''),'activo',anterior.activo);
  IF p_version=0 AND anterior.creado_por=p_actor AND previo=normalizado THEN RETURN jsonb_build_object('id',anterior.id,'version',anterior.version,'repetida',true); END IF;
  IF p_version<>anterior.version THEN RAISE EXCEPTION 'La ficha cambió' USING ERRCODE='P2401'; END IF;
  IF previo=normalizado THEN RETURN jsonb_build_object('id',anterior.id,'version',anterior.version,'repetida',true); END IF;
 ELSE
  IF p_version<>0 THEN RAISE EXCEPTION 'La ficha cambió' USING ERRCODE='P2401'; END IF;
 END IF;
 IF anterior.id IS NULL THEN
  INSERT INTO public.funcionarios_nc(id,nombre,rut,correo,unidad,subdireccion,cargo,fecha_ingreso,activo,creado_por,actualizado_por)
  VALUES(p_id,nombre,rut,correo,unidad,subdireccion,cargo,fecha,activo,p_actor,p_actor) RETURNING * INTO posterior;
 ELSE
  UPDATE public.funcionarios_nc SET nombre=normalizado->>'nombre',rut=NULLIF(normalizado->>'rut',''),correo=NULLIF(normalizado->>'correo',''),
   unidad=normalizado->>'unidad',subdireccion=normalizado->>'subdireccion',cargo=normalizado->>'cargo',fecha_ingreso=fecha,activo=(normalizado->>'activo')::boolean,
   version=funcionarios_nc.version+1,actualizado_por=p_actor,actualizado_en=CURRENT_TIMESTAMP WHERE id=p_id RETURNING * INTO posterior;
 END IF;
 INSERT INTO public.funcionarios_nc_historial(funcionario_id,actor,motivo,antes,despues)
 VALUES(p_id,p_actor,btrim(p_motivo),CASE WHEN anterior.id IS NULL THEN NULL ELSE to_jsonb(anterior) END,to_jsonb(posterior));
 RETURN jsonb_build_object('id',posterior.id,'version',posterior.version,'repetida',false);
END;
$fn$;
REVOKE ALL ON FUNCTION public.guardar_funcionario_nc_acceso(text,uuid,jsonb,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_funcionario_nc_acceso(text,uuid,jsonb,integer,text) TO inventario_app;
 `);
}
export const down=false;
