exports.up=pgm=>pgm.sql(`
CREATE OR REPLACE FUNCTION public.guardar_fotografia_sede_acceso(p_actor text, p_id uuid, p_sede uuid, p_version integer, p_mime text, p_contenido bytea)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE usuario public.usuarios_acceso%ROWTYPE;s public.sedes%ROWTYPE;anterior public.fotografias_sedes%ROWTYPE;actual integer;
BEGIN
 -- Mismo orden de bloqueo que la administración de usuarios: revalidar la cuenta.
 PERFORM pg_advisory_xact_lock(1793404800000);
 SELECT * INTO usuario FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion') FOR SHARE;
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
END;$function$;

CREATE OR REPLACE FUNCTION public.guardar_celular_acceso(p_actor text, p_id uuid, p_datos jsonb, p_version integer, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE previo public.celulares%ROWTYPE;posterior public.celulares%ROWTYPE;rol text;sede_actor uuid;resultado jsonb;inicial text;
BEGIN
 PERFORM pg_advisory_xact_lock(1793577600000);
 PERFORM pg_advisory_xact_lock(1794268800000);
 SELECT u.rol,u.sede_id INTO rol,sede_actor FROM public.usuarios_acceso u WHERE u.correo=p_actor AND u.activo AND u.rol IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF rol='encargado' AND sede_actor IS DISTINCT FROM (p_datos->>'sedeId')::uuid THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 SELECT * INTO previo FROM public.celulares WHERE id=p_id FOR UPDATE;
 IF previo.id IS NOT NULL THEN
  IF rol='encargado' AND (previo.custodia='en_bodega' OR previo.sede_id IS DISTINCT FROM sede_actor) THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
  IF previo.sede_id IS DISTINCT FROM (p_datos->>'sedeId')::uuid THEN RAISE EXCEPTION 'Usa devolución y asignación para cambiar la sede' USING ERRCODE='P2603';END IF;
 END IF;
 IF previo.id IS NOT NULL AND previo.custodia='en_prestamo' THEN RAISE EXCEPTION 'El bien está en préstamo; devolver antes de editar o archivar' USING ERRCODE='P2802';END IF;
 IF p_datos ? 'custodiaInicial' THEN
  inicial:=p_datos->>'custodiaInicial';
  IF jsonb_typeof(p_datos->'custodiaInicial') IS DISTINCT FROM 'string' OR inicial NOT IN ('en_bodega','asignado') OR (previo.id IS NOT NULL AND NOT (p_version=0 AND previo.creado_por=p_actor AND previo.custodia=inicial)) THEN RAISE EXCEPTION 'Estado inicial inválido' USING ERRCODE='22023';END IF;
  IF rol='encargado' AND inicial<>'asignado' THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 END IF;
 resultado:=public.guardar_celular_ficha_base(p_actor,p_id,p_datos-'custodiaInicial',p_version,p_motivo);
 SELECT * INTO posterior FROM public.celulares WHERE id=p_id;
 IF previo.id IS NULL THEN
  inicial:=COALESCE(inicial,'asignado');UPDATE public.celulares SET custodia=inicial WHERE id=p_id;
 END IF;
 IF previo.id IS NULL OR posterior.version>previo.version THEN
  UPDATE public.celulares_historial h SET despues=h.despues||jsonb_build_object('custodia',COALESCE(inicial,posterior.custodia)),antes=CASE WHEN h.antes IS NULL THEN NULL ELSE h.antes||jsonb_build_object('custodia',previo.custodia) END WHERE h.id=(SELECT max(x.id) FROM public.celulares_historial x WHERE x.celular_id=p_id);
 END IF;
 RETURN resultado;
END;$function$;

ALTER TABLE public.equipos DROP CONSTRAINT equipos_identificacion_pendiente; ALTER TABLE public.equipos ADD CONSTRAINT equipos_identificacion_pendiente CHECK(serie IS NOT NULL OR length(btrim(observaciones))>0 OR length(btrim(motivo_identificacion))>0);
CREATE OR REPLACE FUNCTION public.guardar_equipo_acceso(p_actor text, p_datos jsonb, p_version integer, p_motivo text, p_carga uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE previo public.equipos%ROWTYPE;posterior public.equipos%ROWTYPE;rol text;id_bien uuid;inicial text;
BEGIN

 PERFORM pg_advisory_xact_lock(1793577600000);
 PERFORM pg_advisory_xact_lock(1794268800000);
 SELECT u.rol INTO rol FROM public.usuarios_acceso u WHERE u.correo=p_actor AND u.activo AND u.rol IN ('administrador','administrador_gestion','encargado') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF NULLIF(p_datos->>'id','') IS NOT NULL THEN SELECT * INTO previo FROM public.equipos WHERE id=(p_datos->>'id')::uuid FOR UPDATE;END IF;
 IF previo.id IS NOT NULL AND p_carga IS NULL THEN p_datos:=p_datos||jsonb_build_object('compra',previo.datos_compra,'origen',previo.origen);END IF;
 IF previo.id IS NOT NULL AND rol='encargado' AND previo.custodia='en_bodega' THEN RAISE EXCEPTION 'El bien está en Bodega TI' USING ERRCODE='42501';END IF;
 IF previo.id IS NOT NULL AND previo.custodia='en_prestamo' THEN RAISE EXCEPTION 'El bien está en préstamo; devolver antes de editar o archivar' USING ERRCODE='P2802';END IF;
 IF (previo.id IS NULL OR previo.estado_administrativo<>'dado_de_baja') AND NULLIF(btrim(p_datos->>'serie'),'') IS NULL AND NULLIF(btrim(p_datos->>'observaciones'),'') IS NULL AND p_carga IS NULL THEN RAISE EXCEPTION 'Explica la ausencia de serie en Observaciones.' USING ERRCODE='22023'; END IF;
 IF p_datos ? 'custodiaInicial' THEN
  inicial:=p_datos->>'custodiaInicial';
  IF jsonb_typeof(p_datos->'custodiaInicial') IS DISTINCT FROM 'string' OR inicial NOT IN ('en_bodega','asignado') OR previo.id IS NOT NULL OR p_carga IS NOT NULL THEN RAISE EXCEPTION 'Estado inicial inválido' USING ERRCODE='22023';END IF;
  IF rol='encargado' AND inicial<>'asignado' THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 END IF;
 id_bien:=public.guardar_equipo_ficha_base(p_actor,p_datos-'custodiaInicial',p_version,p_motivo,p_carga);
 SELECT * INTO posterior FROM public.equipos WHERE id=id_bien;
 IF previo.id IS NULL THEN
  inicial:=COALESCE(inicial,CASE WHEN posterior.situacion='pendiente_entrega' THEN 'en_bodega' ELSE 'asignado' END);
  UPDATE public.equipos SET custodia=inicial,situacion=CASE WHEN p_datos ? 'custodiaInicial' THEN CASE WHEN inicial='en_bodega' THEN 'pendiente_entrega' WHEN (SELECT tipo FROM public.sedes WHERE id=posterior.sede_id)='nivel_central' THEN 'registrado_nc' ELSE 'recibido' END ELSE posterior.situacion END WHERE id=id_bien RETURNING * INTO posterior;
  UPDATE public.equipos_historial h SET despues=h.despues||jsonb_build_object('custodia',inicial,'situacion',posterior.situacion) WHERE h.id=(SELECT max(x.id) FROM public.equipos_historial x WHERE x.equipo_id=id_bien);
 END IF;
 RETURN id_bien;
END;$function$;

`);
exports.down=()=>{throw new Error("Migración de permisos: restaurar respaldo verificado.");};
