export function up(pgm){
 pgm.sql(`
ALTER TABLE public.directorio_sedes ALTER COLUMN nombre DROP NOT NULL;
ALTER TABLE public.directorio_sedes ADD COLUMN rut text, ADD COLUMN correo text,
 ADD COLUMN situacion text NOT NULL DEFAULT 'titular' CHECK(situacion IN ('titular','subrogante','vacante','pendiente')),
 ADD COLUMN observaciones text NOT NULL DEFAULT '',
 ADD CONSTRAINT directorio_persona_vigente CHECK(
  (situacion IN ('titular','subrogante') AND nombre IS NOT NULL) OR
  (situacion IN ('vacante','pendiente') AND nombre IS NULL AND rut IS NULL AND correo IS NULL));
ALTER TABLE public.entregas_equipos ADD COLUMN receptor_datos jsonb NOT NULL DEFAULT '{}', ADD COLUMN sede_datos jsonb NOT NULL DEFAULT '{}';

CREATE FUNCTION public.guardar_ficha_directorio_acceso(p_actor text,p_sede uuid,p_datos jsonb,p_version integer,p_sede_version text,p_motivo text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE anterior public.directorio_sedes%ROWTYPE; posterior public.directorio_sedes%ROWTYPE;
 sede public.sedes%ROWTYPE; nueva_sede public.sedes%ROWTYPE; nombre text; rut text; correo text;
 situacion text; observaciones text; cargo_asignado text; k text; suma integer; digito integer; esperado text;
BEGIN
 PERFORM pg_advisory_xact_lock(1793750400000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion') FOR SHARE;
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
 cargo_asignado:=CASE sede.tipo WHEN 'jardin_infantil' THEN 'Directora del jardín infantil' ELSE 'Director/a del establecimiento' END;
 UPDATE public.sedes SET nombre=btrim(p_datos->>'sedeNombre'),direccion=NULLIF(btrim(p_datos->>'direccion'),''),comuna=NULLIF(btrim(p_datos->>'comuna'),''),correo_institucional=NULLIF(lower(btrim(p_datos->>'correoInstitucional')),'') WHERE id=p_sede RETURNING * INTO nueva_sede;
 IF anterior.sede_id IS NOT NULL AND anterior.nombre IS NOT DISTINCT FROM nombre AND anterior.rut IS NOT DISTINCT FROM rut AND anterior.correo IS NOT DISTINCT FROM correo
  AND anterior.situacion=situacion AND anterior.observaciones=observaciones AND anterior.cargo=cargo_asignado AND to_jsonb(sede)=to_jsonb(nueva_sede) THEN RETURN anterior.version; END IF;
 INSERT INTO public.directorio_sedes(sede_id,nombre,rut,correo,situacion,observaciones,cargo,actualizado_por)
 VALUES(p_sede,nombre,rut,correo,situacion,observaciones,cargo_asignado,p_actor)
 ON CONFLICT(sede_id) DO UPDATE SET nombre=EXCLUDED.nombre,rut=EXCLUDED.rut,correo=EXCLUDED.correo,situacion=EXCLUDED.situacion,observaciones=EXCLUDED.observaciones,cargo=EXCLUDED.cargo,version=directorio_sedes.version+1,actualizado_por=p_actor,actualizado_en=CURRENT_TIMESTAMP RETURNING * INTO posterior;
 INSERT INTO public.directorio_historial(sede_id,actor,motivo,antes,despues)
 VALUES(p_sede,p_actor,btrim(p_motivo),COALESCE(to_jsonb(anterior),'{}')||jsonb_build_object('sede',to_jsonb(sede)),to_jsonb(posterior)||jsonb_build_object('sede',to_jsonb(nueva_sede)));
 RETURN posterior.version;
END;
$fn$;
REVOKE ALL ON FUNCTION public.guardar_ficha_directorio_acceso(text,uuid,jsonb,integer,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_ficha_directorio_acceso(text,uuid,jsonb,integer,text,text) TO inventario_app;

-- Compatibilidad con operaciones anteriores: reemplazar la persona borra sus contactos anteriores.
CREATE OR REPLACE FUNCTION public.guardar_director_acceso(p_actor text,p_sede uuid,p_nombre text,p_version integer,p_motivo text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE d public.directorio_sedes%ROWTYPE; s public.sedes%ROWTYPE; mismo boolean;
BEGIN
 PERFORM pg_advisory_xact_lock(1793750400000);
 SELECT * INTO d FROM public.directorio_sedes WHERE sede_id=p_sede;
 SELECT * INTO s FROM public.sedes WHERE id=p_sede;
 mismo:=d.nombre=btrim(p_nombre);
 RETURN public.guardar_ficha_directorio_acceso(p_actor,p_sede,jsonb_build_object('nombre',COALESCE(btrim(p_nombre),''),'rut',CASE WHEN mismo THEN COALESCE(d.rut,'') ELSE '' END,
  'correo',CASE WHEN mismo THEN COALESCE(d.correo,'') ELSE '' END,'situacion',CASE WHEN NULLIF(btrim(p_nombre),'') IS NULL THEN 'pendiente' WHEN mismo THEN d.situacion ELSE 'titular' END,
  'observaciones',CASE WHEN mismo THEN COALESCE(d.observaciones,'') ELSE '' END,'sedeNombre',s.nombre,'direccion',COALESCE(s.direccion,''),'comuna',COALESCE(s.comuna,''),'correoInstitucional',COALESCE(s.correo_institucional,'')),p_version,
  jsonb_build_array(s.nombre,COALESCE(s.direccion,''),COALESCE(s.comuna,''),COALESCE(s.correo_institucional,''))::text,p_motivo);
END;
$fn$;
CREATE OR REPLACE FUNCTION public.cargar_directorio_acceso(p_actor text,p_filas jsonb,p_sha text,p_archivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE fila jsonb;n integer;
BEGIN
 PERFORM pg_advisory_xact_lock(1793750400000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_filas) IS DISTINCT FROM 'array' OR p_sha IS NULL OR p_sha !~ '^[a-f0-9]{64}$'
  OR p_archivo IS NULL OR length(p_archivo) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Carga inválida' USING ERRCODE='22023'; END IF;
 n:=jsonb_array_length(p_filas);IF n NOT BETWEEN 1 AND 1000 OR octet_length(p_filas::text)>1000000 THEN RAISE EXCEPTION 'Cantidad inválida' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.directorio_cargas WHERE sha256=p_sha) THEN RETURN jsonb_build_object('repetida',true,'cantidad',n); END IF;
 IF (SELECT count(DISTINCT value->>'sedeId') FROM jsonb_array_elements(p_filas))<>n THEN RAISE EXCEPTION 'Sedes repetidas' USING ERRCODE='22023'; END IF;
 FOR fila IN SELECT value FROM jsonb_array_elements(p_filas) LOOP
  IF (fila->>'version') IS NULL THEN RAISE EXCEPTION 'Versión requerida' USING ERRCODE='22023'; END IF;
  IF fila ? 'sedeVersion' THEN
   PERFORM public.guardar_ficha_directorio_acceso(p_actor,(fila->>'sedeId')::uuid,fila,(fila->>'version')::integer,fila->>'sedeVersion','Carga de directorio: '||p_archivo);
  ELSE
   PERFORM public.guardar_director_acceso(p_actor,(fila->>'sedeId')::uuid,fila->>'nombre',(fila->>'version')::integer,'Carga de directorio: '||p_archivo);
  END IF;
 END LOOP;
 INSERT INTO public.directorio_cargas(sha256,actor,archivo,cantidad) VALUES(p_sha,p_actor,p_archivo,n);
 RETURN jsonb_build_object('repetida',false,'cantidad',n);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.regularizar_entregas_acceso(p_actor text,p_solicitud uuid,p_grupos jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE
  lote public.entregas_lotes%ROWTYPE;
  sede public.sedes%ROWTYPE;
  anterior public.equipos%ROWTYPE;
  posterior public.equipos%ROWTYPE;
  grupo jsonb; item jsonb; entrega uuid; fecha date;
  nombre text; enlace text; cantidad integer:=0; grupos integer:=0;
  vistos uuid[]:=ARRAY[]::uuid[];
  sedes_vistas uuid[]:=ARRAY[]::uuid[];
  equipo_uuid uuid; rut_receptora text; correo_receptora text; suma_rut integer; n_rut integer; dv_rut text;
BEGIN
  -- Mismo bloqueo que altas/correcciones/cargas: una versión no cambia entre revisión y escritura.
  PERFORM pg_advisory_xact_lock(1793577600000);
  PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo
    AND rol IN ('administrador','administrador_gestion') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501'; END IF;
  IF p_solicitud IS NULL OR jsonb_typeof(p_grupos) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Solicitud inválida' USING ERRCODE='22023'; END IF;
  IF jsonb_array_length(p_grupos) NOT BETWEEN 1 AND 2500 OR octet_length(p_grupos::text)>1000000 THEN
    RAISE EXCEPTION 'Cantidad inválida' USING ERRCODE='22023'; END IF;
  SELECT * INTO lote FROM public.entregas_lotes WHERE id=p_solicitud;
  IF FOUND THEN
    IF lote.actor<>p_actor OR lote.datos IS DISTINCT FROM p_grupos THEN
      RAISE EXCEPTION 'Solicitud reutilizada con otros datos' USING ERRCODE='P2103'; END IF;
    RETURN jsonb_build_object('loteId',lote.id,'cantidad',lote.cantidad,'repetida',true);
  END IF;
  -- La inserción es parte de la misma transacción y se cancela ante cualquier fila inválida.
  INSERT INTO public.entregas_lotes(id,actor,datos,cantidad) VALUES(p_solicitud,p_actor,p_grupos,1);
  FOR grupo IN SELECT value FROM jsonb_array_elements(p_grupos) LOOP
    IF jsonb_typeof(grupo) IS DISTINCT FROM 'object' OR jsonb_typeof(grupo->'equipos') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Grupo inválido' USING ERRCODE='22023'; END IF;
    IF jsonb_array_length(grupo->'equipos') NOT BETWEEN 1 AND 2500 THEN
      RAISE EXCEPTION 'Grupo vacío' USING ERRCODE='22023'; END IF;
    SELECT * INTO sede FROM public.sedes WHERE id=(grupo->>'sedeId')::uuid AND activo AND tipo='jardin_infantil' FOR SHARE;
    IF NOT FOUND OR sede.id=ANY(sedes_vistas) THEN
      RAISE EXCEPTION 'Se requiere un jardín activo, sin repetir grupos' USING ERRCODE='P2101'; END IF;
    sedes_vistas:=array_append(sedes_vistas,sede.id);
    IF grupo ? 'sedeVersion' AND (grupo->>'sedeVersion')::jsonb IS DISTINCT FROM jsonb_build_array(sede.nombre,COALESCE(sede.direccion,''),COALESCE(sede.comuna,''),COALESCE(sede.correo_institucional,'')) THEN RAISE EXCEPTION 'Los datos del establecimiento cambiaron' USING ERRCODE='P2102'; END IF;
    rut_receptora:=NULLIF(upper(replace(btrim(grupo->>'receptoraRut'),'.','')),'');correo_receptora:=NULLIF(lower(btrim(grupo->>'receptoraCorreo')),'');
    IF rut_receptora IS NOT NULL THEN
      IF rut_receptora !~ '^[0-9]{7,8}-[0-9K]$' THEN RAISE EXCEPTION 'RUN inválido' USING ERRCODE='22023'; END IF;
      suma_rut:=0;FOR n_rut IN 1..length(split_part(rut_receptora,'-',1)) LOOP suma_rut:=suma_rut+substring(reverse(split_part(rut_receptora,'-',1)),n_rut,1)::integer*(2+(n_rut-1)%6);END LOOP;
      n_rut:=11-suma_rut%11;dv_rut:=CASE n_rut WHEN 11 THEN '0' WHEN 10 THEN 'K' ELSE n_rut::text END;
      IF split_part(rut_receptora,'-',2)<>dv_rut THEN RAISE EXCEPTION 'RUN inválido' USING ERRCODE='22023'; END IF;
    END IF;
    IF correo_receptora IS NOT NULL AND (length(correo_receptora)>254 OR correo_receptora !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') THEN RAISE EXCEPTION 'Correo inválido' USING ERRCODE='22023'; END IF;
    nombre:=btrim(grupo->>'receptora');
    IF nombre IS NULL OR length(nombre) NOT BETWEEN 1 AND 200 OR nombre ~ '[[:cntrl:]]' THEN
      RAISE EXCEPTION 'Identificar a la directora receptora' USING ERRCODE='22023'; END IF;
    IF COALESCE(grupo->>'fecha','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
      RAISE EXCEPTION 'Fecha requerida' USING ERRCODE='22023'; END IF;
    fecha:=(grupo->>'fecha')::date;
    IF fecha<(DATE '1900-01-01') OR fecha>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date THEN
      RAISE EXCEPTION 'Fecha de entrega inválida' USING ERRCODE='22023'; END IF;
    enlace:=NULLIF(btrim(grupo->>'enlaceActa'),'');
    IF enlace IS NOT NULL AND (length(enlace)>1500 OR enlace !~ '^https?://[^[:space:]]+$') THEN
      RAISE EXCEPTION 'Enlace inválido' USING ERRCODE='22023'; END IF;
    INSERT INTO public.entregas_equipos(lote_id,sede_id,sede_nombre,sede_rbd,comuna,fecha_entrega,receptor_nombre,receptor_cargo,enlace_acta,receptor_datos,sede_datos)
    VALUES(p_solicitud,sede.id,sede.nombre,sede.rbd,sede.comuna,fecha,nombre,'Directora del jardín infantil',enlace,jsonb_strip_nulls(jsonb_build_object('rut',rut_receptora,'correo',correo_receptora)),jsonb_build_object('direccion',sede.direccion,'correoInstitucional',sede.correo_institucional)) RETURNING id INTO entrega;
    FOR item IN SELECT value FROM jsonb_array_elements(grupo->'equipos') LOOP
      equipo_uuid:=(item->>'id')::uuid;
      IF equipo_uuid IS NULL OR equipo_uuid=ANY(vistos) OR cantidad>=2500 THEN
        RAISE EXCEPTION 'Selección duplicada o inválida' USING ERRCODE='22023'; END IF;
      vistos:=array_append(vistos,equipo_uuid);
      SELECT * INTO anterior FROM public.equipos WHERE id=equipo_uuid FOR UPDATE;
      IF NOT FOUND OR anterior.sede_id<>sede.id OR anterior.situacion<>'pendiente_entrega'
        OR anterior.version IS DISTINCT FROM (item->>'version')::integer THEN
        RAISE EXCEPTION 'La selección cambió; revisar nuevamente' USING ERRCODE='P2102'; END IF;
      UPDATE public.equipos SET situacion='recibido',fecha_entrega=fecha,enlace_acta=COALESCE(enlace,enlace_acta),
        version=version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=anterior.id RETURNING * INTO posterior;
      INSERT INTO public.entregas_detalle(entrega_id,equipo_id,antes,despues) VALUES(entrega,anterior.id,to_jsonb(anterior),to_jsonb(posterior));
      INSERT INTO public.equipos_historial(equipo_id,actor,motivo,antes,despues,entrega_id)
      VALUES(anterior.id,p_actor,'Regularización de entrega a directora: '||nombre||'. Acta existente sin folio informado.',to_jsonb(anterior),to_jsonb(posterior),entrega);
      cantidad:=cantidad+1;
    END LOOP;
    grupos:=grupos+1;
  END LOOP;
  UPDATE public.entregas_lotes SET cantidad=cardinality(vistos) WHERE id=p_solicitud;
  RETURN jsonb_build_object('loteId',p_solicitud,'cantidad',cantidad,'grupos',grupos,'repetida',false);
END;
$fn$;
 `);
}
export const down=false;
