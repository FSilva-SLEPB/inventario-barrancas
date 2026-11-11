// No asigna perfiles a cuentas existentes ni modifica stock o documentos.
export function up(pgm){pgm.sql(String.raw`
ALTER TABLE public.usuarios_acceso DROP CONSTRAINT usuarios_acceso_rol_check,
 ADD CONSTRAINT usuarios_acceso_rol_check CHECK(rol IN ('administrador','administrador_gestion','encargado','consulta','consulta_sede','gestor_insumos'));
CREATE OR REPLACE FUNCTION public.autorizar_insumos_utic(p_actor text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1795536000000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion','gestor_insumos') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Operación reservada a gestión de insumos' USING ERRCODE='42501';END IF;
END;$function$
;
CREATE OR REPLACE FUNCTION public.crear_solicitud_insumos(p_actor text, p_sede_id uuid, p_lineas jsonb, p_datos jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE actor public.usuarios_acceso%ROWTYPE;v_id uuid;elem jsonb;pid uuid;cant integer;sol jsonb;anterior public.solicitudes_insumos%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1795536000000);
 SELECT * INTO actor FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion','encargado','gestor_insumos') FOR SHARE;
 IF NOT FOUND OR (actor.rol='encargado' AND actor.sede_id IS DISTINCT FROM p_sede_id) THEN RAISE EXCEPTION 'Sin permiso para solicitar en esta sede' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.sedes WHERE id=p_sede_id AND activo FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Sede no disponible' USING ERRCODE='42501';END IF;
 IF jsonb_typeof(p_datos) IS DISTINCT FROM 'object' OR jsonb_typeof(p_lineas) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lineas) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Solicitud inválida' USING ERRCODE='22023';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_lineas)e WHERE jsonb_typeof(e) IS DISTINCT FROM 'object' OR (e->>'producto_id') IS NULL OR (e->>'cantidad') IS NULL OR (e->>'cantidad') !~ '^[1-9][0-9]{0,4}$') OR (SELECT count(DISTINCT (e->>'producto_id')::uuid) FROM jsonb_array_elements(p_lineas)e)<>jsonb_array_length(p_lineas) THEN RAISE EXCEPTION 'Líneas inválidas o repetidas' USING ERRCODE='22023';END IF;
 v_id:=COALESCE(NULLIF(p_datos->>'solicitudId','')::uuid,gen_random_uuid());sol:=jsonb_build_object('sede',p_sede_id,'datos',p_datos-'solicitudId','lineas',(SELECT jsonb_agg(e ORDER BY e->>'producto_id') FROM jsonb_array_elements(p_lineas)e));
 SELECT * INTO anterior FROM public.solicitudes_insumos WHERE id=v_id FOR UPDATE;
 IF FOUND THEN IF anterior.solicitante_correo=p_actor AND anterior.solicitud_original=sol THEN RETURN v_id;END IF;RAISE EXCEPTION 'Solicitud reutilizada' USING ERRCODE='P3101';END IF;
 FOREACH elem IN ARRAY ARRAY[p_datos] LOOP
  IF EXISTS(SELECT 1 FROM jsonb_each(elem)t(k,v) WHERE t.k NOT IN ('nombre','run','cargo','telefono','modalidad','motivo','solicitudId') OR jsonb_typeof(t.v) IS DISTINCT FROM 'string' OR length(t.v#>>'{}')>(CASE WHEN t.k='motivo' THEN 1000 ELSE 200 END) OR (t.v#>>'{}') ~ '[[:cntrl:]]') THEN RAISE EXCEPTION 'Datos del solicitante inválidos' USING ERRCODE='22023';END IF;
 END LOOP;
 INSERT INTO public.solicitudes_insumos(id,sede_id,solicitante_correo,estado,motivo,solicitante_nombre,solicitante_run,solicitante_cargo,solicitante_telefono,modalidad_entrega,solicitud_original) VALUES(v_id,p_sede_id,p_actor,'solicitada',COALESCE(p_datos->>'motivo',''),COALESCE(p_datos->>'nombre',''),COALESCE(p_datos->>'run',''),COALESCE(p_datos->>'cargo',''),COALESCE(p_datos->>'telefono',''),COALESCE(p_datos->>'modalidad',''),sol);
 FOR elem IN SELECT * FROM jsonb_array_elements(p_lineas) LOOP
  pid:=(elem->>'producto_id')::uuid;cant:=(elem->>'cantidad')::integer;
  IF cant>10000 THEN RAISE EXCEPTION 'Cantidad inválida' USING ERRCODE='22023';END IF;
  PERFORM 1 FROM public.catalogo_insumos WHERE id=pid AND activo FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Producto no disponible' USING ERRCODE='22023';END IF;
  INSERT INTO public.solicitudes_insumos_detalle(solicitud_id,producto_id,cantidad_solicitada,cantidad_aprobada,cantidad_entregada) VALUES(v_id,pid,cant,0,0);
 END LOOP;RETURN v_id;
END;$function$
;
CREATE OR REPLACE FUNCTION public.completar_pdf_acta_acceso(p_actor text, p_id uuid, p_pdf bytea)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND (rol IN ('administrador','administrador_gestion') OR (rol='gestor_insumos' AND EXISTS(SELECT 1 FROM public.actas_documentos a WHERE a.id=p_id AND a.solicitud_insumo_id IS NOT NULL AND a.entrega_insumo_id IS NOT NULL))) FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF p_pdf IS NULL OR octet_length(p_pdf) NOT BETWEEN 100 AND 8388608 OR left(encode(p_pdf,'escape'),5)<>'%PDF-' THEN RAISE EXCEPTION 'PDF inválido' USING ERRCODE='22023';END IF;
 UPDATE public.actas_documentos SET pdf=p_pdf,sha256=encode(sha256(p_pdf),'hex') WHERE id=p_id AND actor=p_actor AND pdf IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Documento no disponible' USING ERRCODE='P2701';END IF;
END;$function$
;
CREATE OR REPLACE FUNCTION public.guardar_usuario_acceso(p_actor text, p_correo text, p_nombre text, p_rol text, p_activo boolean, p_version integer, p_sede uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  actor_rol text;
  anterior public.usuarios_acceso%ROWTYPE;
  posterior public.usuarios_acceso%ROWTYPE;
  existe boolean;
BEGIN
  -- Mismo bloqueo que la versión anterior; revalidar al actor tras adquirirlo.
  PERFORM pg_advisory_xact_lock(1793404800000);
  SELECT rol INTO actor_rol FROM public.usuarios_acceso
  WHERE correo = p_actor AND activo;
  IF actor_rol IS NULL OR actor_rol NOT IN ('administrador', 'administrador_gestion') THEN
    RAISE EXCEPTION 'Actor sin autorización' USING ERRCODE = '42501';
  END IF;
  IF p_correo IS NULL OR p_nombre IS NULL OR p_activo IS NULL OR p_version IS NULL
      OR p_version < 0 OR p_rol IS NULL
      OR p_rol NOT IN ('administrador', 'administrador_gestion', 'encargado', 'consulta', 'consulta_sede', 'gestor_insumos') THEN
    RAISE EXCEPTION 'Datos de usuario inválidos' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO anterior FROM public.usuarios_acceso WHERE correo = p_correo FOR UPDATE;
  existe := FOUND;
  IF actor_rol <> 'administrador' AND (
    p_rol IN ('administrador', 'administrador_gestion')
    OR (existe AND anterior.rol IN ('administrador', 'administrador_gestion'))
  ) THEN
    RAISE EXCEPTION 'Perfil reservado al administrador del sistema' USING ERRCODE = 'P1004';
  END IF;
  IF p_rol IN ('encargado', 'consulta_sede') THEN
    PERFORM 1 FROM public.sedes WHERE id = p_sede AND activo
      AND tipo IN ('establecimiento', 'jardin_infantil') FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Se requiere una sede EE/JI activa' USING ERRCODE = 'P1005';
    END IF;
  ELSIF p_sede IS NOT NULL THEN
    RAISE EXCEPTION 'Perfil global sin sede' USING ERRCODE = 'P1005';
  END IF;
  IF p_version = 0 THEN
    IF existe THEN RAISE EXCEPTION 'Correo ya registrado' USING ERRCODE = '23505'; END IF;
    INSERT INTO public.usuarios_acceso (correo, nombre, rol, activo, sede_id)
    VALUES (p_correo, p_nombre, p_rol, p_activo, p_sede) RETURNING * INTO posterior;
  ELSE
    IF NOT existe OR anterior.version <> p_version THEN
      RAISE EXCEPTION 'La cuenta cambió; recargar' USING ERRCODE = 'P1003';
    END IF;
    IF anterior.activo AND anterior.rol = 'administrador'
        AND (NOT p_activo OR p_rol <> 'administrador') THEN
      IF (SELECT count(*) FROM public.usuarios_acceso WHERE activo AND rol = 'administrador') <= 1 THEN
        RAISE EXCEPTION 'Debe quedar un administrador del sistema activo' USING ERRCODE = 'P1001';
      END IF;
      IF p_correo = p_actor THEN
        RAISE EXCEPTION 'No puedes retirar tu propio permiso' USING ERRCODE = 'P1002';
      END IF;
    END IF;
    UPDATE public.usuarios_acceso
    SET nombre = p_nombre, rol = p_rol, activo = p_activo, sede_id = p_sede,
        version = version + 1, actualizado_en = CURRENT_TIMESTAMP
    WHERE correo = p_correo RETURNING * INTO posterior;
  END IF;
  INSERT INTO public.usuarios_acceso_historial (actor, correo, antes, despues)
  VALUES (p_actor, p_correo, CASE WHEN p_version = 0 THEN NULL ELSE to_jsonb(anterior) END,
          to_jsonb(posterior));
END;
$function$
;
CREATE OR REPLACE FUNCTION public.iniciar_envio_acta_acceso(p_actor text, p_id uuid, p_acta uuid, p_destinos text[], p_remitente text, p_revisado boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE previo public.actas_envios%ROWTYPE;token uuid;destinos text[];x text;
BEGIN
 PERFORM pg_advisory_xact_lock(1794355200000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND (rol IN ('administrador','administrador_gestion') OR (rol='gestor_insumos' AND EXISTS(SELECT 1 FROM public.actas_documentos a WHERE a.id=p_acta AND a.solicitud_insumo_id IS NOT NULL AND a.entrega_insumo_id IS NOT NULL))) FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR p_acta IS NULL OR p_revisado IS NULL OR cardinality(p_destinos) NOT BETWEEN 1 AND 5 OR p_destinos IS NULL OR p_remitente IS NULL OR p_remitente !~ '^[a-z0-9._%+!-]+@slepb[.]gob[.]cl$' THEN RAISE EXCEPTION 'Solicitud inválida' USING ERRCODE='22023';END IF;
 destinos:='{}';FOREACH x IN ARRAY p_destinos LOOP
  IF x IS NULL OR length(x)>254 OR x !~ '^[a-z0-9._%+!-]+@[a-z0-9.-]+[.][a-z]{2,63}$' OR x LIKE '%..%' OR x=ANY(destinos) THEN RAISE EXCEPTION 'Destinatario inválido' USING ERRCODE='22023';END IF;destinos:=array_append(destinos,x);
 END LOOP;
 SELECT * INTO previo FROM public.actas_envios WHERE id=p_id;
 IF FOUND THEN IF previo.actor=p_actor AND previo.acta_id=p_acta AND previo.destinatarios=destinos AND previo.remitente=p_remitente THEN RETURN jsonb_build_object('id',p_id,'repetida',true,'estado',previo.estado);END IF;RAISE EXCEPTION 'Solicitud ya utilizada' USING ERRCODE='P2701';END IF;
 PERFORM 1 FROM public.actas_documentos WHERE id=p_acta AND pdf IS NOT NULL FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Acta no disponible' USING ERRCODE='P2702';END IF;
 UPDATE public.actas_envios SET estado='no_confirmado' WHERE acta_id=p_acta AND estado='en_curso' AND creado_en<CURRENT_TIMESTAMP-INTERVAL '2 minutes';
 IF EXISTS(SELECT 1 FROM public.actas_envios WHERE acta_id=p_acta AND estado='en_curso') THEN RAISE EXCEPTION 'Ya hay un envío en curso' USING ERRCODE='P2703';END IF;
 IF NOT p_revisado AND EXISTS(SELECT 1 FROM public.actas_envios WHERE acta_id=p_acta AND estado='no_confirmado') THEN RAISE EXCEPTION 'Revisa el resultado previo antes de reenviar' USING ERRCODE='P2704';END IF;
 IF (SELECT count(*) FROM public.actas_envios WHERE acta_id=p_acta AND creado_en>CURRENT_TIMESTAMP-INTERVAL '15 minutes')>=5 THEN RAISE EXCEPTION 'Espera antes de volver a enviar' USING ERRCODE='P2705';END IF;
 token:=gen_random_uuid();INSERT INTO public.actas_envios(id,acta_id,actor,destinatarios,estado,remitente,token) VALUES(p_id,p_acta,p_actor,destinos,'en_curso',p_remitente,token);
 RETURN jsonb_build_object('id',p_id,'repetida',false,'token',token,'estado','en_curso');
END;$function$
;
CREATE OR REPLACE FUNCTION public.validar_solicitud_insumos(p_actor text, p_solicitud uuid, p_observacion text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE s public.solicitudes_insumos%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.usuarios_acceso u WHERE u.correo=p_actor AND u.activo AND u.rol IN ('administrador','administrador_gestion','gestor_insumos') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización para validar solicitudes de insumos' USING ERRCODE='42501'; END IF;
  SELECT * INTO s FROM public.solicitudes_insumos WHERE id=p_solicitud FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada' USING ERRCODE='P2604'; END IF;
  IF s.estado <> 'solicitada' THEN RAISE EXCEPTION 'Solo se puede validar una solicitud en estado solicitada' USING ERRCODE='P2602'; END IF;
  UPDATE public.solicitudes_insumos SET estado='en_validacion', validado_en=CURRENT_TIMESTAMP, validado_por=p_actor, observacion_validacion=COALESCE(trim(p_observacion),'') WHERE id=p_solicitud;
  RETURN jsonb_build_object('id',p_solicitud,'estado','en_validacion');
END;
$function$
;
`);}
export const down=false;
