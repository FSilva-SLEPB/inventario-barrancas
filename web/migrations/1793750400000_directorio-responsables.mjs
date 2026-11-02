export function up(pgm) {
  pgm.sql(`
CREATE TABLE public.directorio_sedes (
  sede_id uuid PRIMARY KEY REFERENCES public.sedes(id) ON DELETE RESTRICT,
  nombre text NOT NULL CHECK (length(btrim(nombre)) BETWEEN 1 AND 200),
  cargo text NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  actualizado_por text NOT NULL,
  actualizado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.directorio_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id uuid NOT NULL REFERENCES public.sedes(id) ON DELETE RESTRICT,
  actor text NOT NULL,
  motivo text NOT NULL,
  antes jsonb,
  despues jsonb NOT NULL,
  registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.directorio_cargas (
  sha256 text PRIMARY KEY CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  actor text NOT NULL,
  archivo text NOT NULL,
  cantidad integer NOT NULL CHECK (cantidad BETWEEN 1 AND 1000),
  registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
REVOKE ALL ON public.directorio_sedes,public.directorio_historial,public.directorio_cargas FROM PUBLIC,inventario_app;
GRANT SELECT ON public.directorio_sedes,public.directorio_historial,public.directorio_cargas TO inventario_app;
CREATE FUNCTION public.guardar_director_acceso(p_actor text,p_sede uuid,p_nombre text,p_version integer,p_motivo text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE anterior public.directorio_sedes%ROWTYPE; posterior public.directorio_sedes%ROWTYPE; tipo_sede text; cargo_asignado text;
BEGIN
  PERFORM pg_advisory_xact_lock(1793750400000);
  PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501'; END IF;
  SELECT tipo INTO tipo_sede FROM public.sedes WHERE id=p_sede AND activo AND tipo IN ('establecimiento','jardin_infantil') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sede no disponible' USING ERRCODE='P2202'; END IF;
  IF p_nombre IS NULL OR length(btrim(p_nombre)) NOT BETWEEN 1 AND 200 OR p_nombre ~ '[[:cntrl:]]'
    OR p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 1 AND 500 OR p_version IS NULL OR p_version<0 THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023'; END IF;
  SELECT * INTO anterior FROM public.directorio_sedes WHERE sede_id=p_sede FOR UPDATE;
  IF COALESCE(anterior.version,0)<>p_version THEN RAISE EXCEPTION 'Edición obsoleta' USING ERRCODE='P2201'; END IF;
  cargo_asignado:=CASE tipo_sede WHEN 'jardin_infantil' THEN 'Directora del jardín infantil' ELSE 'Director/a del establecimiento' END;
  IF anterior.nombre=btrim(p_nombre) AND anterior.cargo=cargo_asignado THEN RETURN anterior.version; END IF;
  INSERT INTO public.directorio_sedes(sede_id,nombre,cargo,actualizado_por)
  VALUES(p_sede,btrim(p_nombre),cargo_asignado,p_actor)
  ON CONFLICT(sede_id) DO UPDATE SET nombre=EXCLUDED.nombre,cargo=EXCLUDED.cargo,version=directorio_sedes.version+1,actualizado_por=p_actor,actualizado_en=CURRENT_TIMESTAMP
  RETURNING * INTO posterior;
  INSERT INTO public.directorio_historial(sede_id,actor,motivo,antes,despues)
  VALUES(p_sede,p_actor,btrim(p_motivo),CASE WHEN anterior.sede_id IS NOT NULL THEN to_jsonb(anterior) END,to_jsonb(posterior));
  RETURN posterior.version;
END;
$fn$;
REVOKE ALL ON FUNCTION public.guardar_director_acceso(text,uuid,text,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_director_acceso(text,uuid,text,integer,text) TO inventario_app;
CREATE FUNCTION public.cargar_directorio_acceso(p_actor text,p_filas jsonb,p_sha text,p_archivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE fila jsonb; n integer; version_actual integer;
BEGIN
  PERFORM pg_advisory_xact_lock(1793750400000);
  PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_filas) IS DISTINCT FROM 'array' OR p_sha IS NULL OR p_sha !~ '^[a-f0-9]{64}$'
    OR p_archivo IS NULL OR length(p_archivo) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Carga inválida' USING ERRCODE='22023'; END IF;
  n:=jsonb_array_length(p_filas);
  IF n NOT BETWEEN 1 AND 1000 OR octet_length(p_filas::text)>1000000 THEN RAISE EXCEPTION 'Cantidad inválida' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.directorio_cargas WHERE sha256=p_sha) THEN RETURN jsonb_build_object('repetida',true,'cantidad',n); END IF;
  IF (SELECT count(DISTINCT value->>'sedeId') FROM jsonb_array_elements(p_filas))<>n THEN RAISE EXCEPTION 'Sedes repetidas' USING ERRCODE='22023'; END IF;
  FOR fila IN SELECT value FROM jsonb_array_elements(p_filas) LOOP
    IF (fila->>'version') IS NULL THEN RAISE EXCEPTION 'Versión requerida' USING ERRCODE='22023'; END IF;
    version_actual:=public.guardar_director_acceso(p_actor,(fila->>'sedeId')::uuid,fila->>'nombre',(fila->>'version')::integer,'Carga de directorio: '||p_archivo);
  END LOOP;
  INSERT INTO public.directorio_cargas(sha256,actor,archivo,cantidad) VALUES(p_sha,p_actor,p_archivo,n);
  RETURN jsonb_build_object('repetida',false,'cantidad',n);
END;
$fn$;
REVOKE ALL ON FUNCTION public.cargar_directorio_acceso(text,jsonb,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cargar_directorio_acceso(text,jsonb,text,text) TO inventario_app;
  `);
}
export const down = false;
