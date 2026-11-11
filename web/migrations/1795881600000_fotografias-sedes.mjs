export function up(pgm){pgm.sql(`
CREATE TABLE public.fotografias_sedes(
 id uuid PRIMARY KEY,sede_id uuid NOT NULL REFERENCES public.sedes(id),version integer NOT NULL CHECK(version>0),
 actor text NOT NULL,mime text NOT NULL,contenido bytea NOT NULL,registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(sede_id,version),
 CHECK(octet_length(contenido) BETWEEN 12 AND 5242880 AND
 ((mime='image/png' AND encode(substring(contenido FROM 1 FOR 8),'hex')='89504e470d0a1a0a') OR
 (mime='image/jpeg' AND encode(substring(contenido FROM 1 FOR 3),'hex')='ffd8ff') OR
 (mime='image/webp' AND substring(contenido FROM 1 FOR 4)=convert_to('RIFF','UTF8') AND substring(contenido FROM 9 FOR 4)=convert_to('WEBP','UTF8'))))
);
REVOKE ALL ON public.fotografias_sedes FROM PUBLIC,inventario_app;
GRANT SELECT ON public.fotografias_sedes TO inventario_app;
CREATE FUNCTION public.guardar_fotografia_sede_acceso(p_actor text,p_id uuid,p_sede uuid,p_version integer,p_mime text,p_contenido bytea) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE usuario public.usuarios_acceso%ROWTYPE;s public.sedes%ROWTYPE;anterior public.fotografias_sedes%ROWTYPE;actual integer;
BEGIN
 -- Mismo orden de bloqueo que la administración de usuarios: revalidar la cuenta.
 PERFORM pg_advisory_xact_lock(1793404800000);
 SELECT * INTO usuario FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion','encargado') FOR SHARE;
 IF NOT FOUND OR (usuario.rol='encargado' AND usuario.sede_id IS DISTINCT FROM p_sede) THEN RAISE EXCEPTION 'Sin permiso para cambiar la fotografía' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM public.sedes WHERE id=p_sede AND activo AND tipo IN ('establecimiento','jardin_infantil') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sede no disponible' USING ERRCODE='22023';END IF;
 IF p_id IS NULL OR p_version IS NULL OR p_version<0 OR p_version>=2147483647 OR p_mime IS NULL OR p_mime NOT IN ('image/png','image/jpeg','image/webp') OR p_contenido IS NULL OR octet_length(p_contenido) NOT BETWEEN 12 AND 5242880 THEN RAISE EXCEPTION 'Fotografía inválida' USING ERRCODE='22023';END IF;
 SELECT * INTO anterior FROM public.fotografias_sedes WHERE id=p_id;
 IF FOUND THEN
  IF anterior.actor=p_actor AND anterior.sede_id=p_sede AND anterior.version=p_version+1 AND anterior.mime=p_mime AND anterior.contenido=p_contenido THEN RETURN jsonb_build_object('id',anterior.id,'version',anterior.version,'repetida',true);END IF;
  RAISE EXCEPTION 'Solicitud ya utilizada' USING ERRCODE='P3401';
 END IF;
 SELECT COALESCE(max(version),0) INTO actual FROM public.fotografias_sedes WHERE sede_id=p_sede;
 IF actual<>p_version THEN RAISE EXCEPTION 'La fotografía cambió; revisa la versión actual' USING ERRCODE='P3402';END IF;
 INSERT INTO public.fotografias_sedes(id,sede_id,version,actor,mime,contenido) VALUES(p_id,p_sede,actual+1,p_actor,p_mime,p_contenido);
 RETURN jsonb_build_object('id',p_id,'version',actual+1,'repetida',false);
END;$fn$;
REVOKE ALL ON FUNCTION public.guardar_fotografia_sede_acceso(text,uuid,uuid,integer,text,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_fotografia_sede_acceso(text,uuid,uuid,integer,text,bytea) TO inventario_app;
`);}
export const down=false;
