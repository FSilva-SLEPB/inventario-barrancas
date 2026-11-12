exports.up=pgm=>pgm.sql(String.raw`

CREATE FUNCTION public.rbac_validar_usuario(p_actor text,p_correo text,p_rol text,p_activo boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF public.rbac_contexto(p_actor)->>'clasePerfil'<>'sistema' AND (p_actor=p_correo OR p_rol IN ('administrador','administrador_gestion') OR EXISTS(SELECT 1 FROM public.usuarios_acceso u LEFT JOIN public.rbac_perfiles p ON p.id=u.perfil_id WHERE u.correo=p_correo AND (u.rol IN ('administrador','administrador_gestion') OR p.clase IN ('sistema','utic') OR EXISTS(SELECT 1 FROM public.rbac_perfil_permisos x WHERE x.perfil_id=p.id AND NOT public.rbac_tiene(p_actor,x.permiso))))) THEN RAISE EXCEPTION 'Cuenta o facultad protegida' USING ERRCODE='42501';END IF;
 IF public.rbac_contexto(p_actor)->>'clasePerfil'<>'sistema' AND EXISTS(SELECT 1 FROM public.rbac_anteriores a,unnest(a.permisos)x WHERE a.rol=p_rol AND NOT public.rbac_tiene(p_actor,x)) THEN RAISE EXCEPTION 'No puedes asignar privilegios superiores mediante un rol anterior' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM public.usuarios_acceso WHERE correo=p_correo AND perfil_id IS NOT NULL) THEN RAISE EXCEPTION 'Utiliza la asignación RBAC para cambiar una cuenta migrada' USING ERRCODE='42501';END IF;
END;$fn$;
REVOKE ALL ON FUNCTION public.rbac_validar_usuario(text,text,text,boolean) FROM PUBLIC,inventario_app;
CREATE OR REPLACE FUNCTION public.adjuntar_reporte_incidente_acceso(p_actor text, p_id uuid, p_reporte uuid, p_nombre text, p_mime text, p_contenido bytea)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE r public.reportes_incidentes_inventario%ROWTYPE;u public.usuarios_acceso%ROWTYPE;a public.reportes_incidentes_adjuntos%ROWTYPE;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'incidentes.editar');

 PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1794268800000);
 SELECT * INTO u FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND public.rbac_rol_motor(correo) IN ('administrador','administrador_gestion','encargado') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM public.reportes_incidentes_inventario WHERE id=p_reporte FOR UPDATE;
 IF r.id IS NULL OR (public.rbac_rol_motor(u.correo)='encargado' AND u.sede_id IS DISTINCT FROM r.sede_id) THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR p_nombre IS NULL OR p_nombre~'[[:cntrl:]/\\]' OR length(p_nombre) NOT BETWEEN 1 AND 160 OR p_mime IS NULL OR p_mime NOT IN ('application/pdf','image/jpeg','image/png','image/webp') OR p_contenido IS NULL OR octet_length(p_contenido) NOT BETWEEN 12 AND 10485760 THEN RAISE EXCEPTION 'Archivo inválido' USING ERRCODE='22023';END IF;
 SELECT * INTO a FROM public.reportes_incidentes_adjuntos WHERE id=p_id;
 IF FOUND THEN
  IF a.actor=p_actor AND a.reporte_id=p_reporte AND a.nombre=p_nombre AND a.mime=p_mime AND a.contenido=p_contenido THEN RETURN p_id;END IF;
  RAISE EXCEPTION 'Solicitud reutilizada' USING ERRCODE='P3501';
 END IF;
 IF (SELECT count(*)>=5 OR COALESCE(sum(octet_length(contenido)),0)+octet_length(p_contenido)>26214400 FROM public.reportes_incidentes_adjuntos WHERE reporte_id=p_reporte) THEN RAISE EXCEPTION 'Máximo cinco archivos y 25 MB por reporte' USING ERRCODE='22023';END IF;
 INSERT INTO public.reportes_incidentes_adjuntos(id,reporte_id,actor,nombre,mime,contenido) VALUES(p_id,p_reporte,p_actor,p_nombre,p_mime,p_contenido);
 RETURN p_id;
END;$function$;
CREATE OR REPLACE FUNCTION public.aprobar_solicitud_insumos(p_actor text, p_solicitud uuid, p_datos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE s public.solicitudes_insumos%ROWTYPE;e jsonb;d public.solicitudes_insumos_detalle%ROWTYPE;st public.stock_insumos%ROWTYPE;cantidad integer;sol jsonb;total integer:=0;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'seguimiento_insumos.aprobar');

 PERFORM public.autorizar_insumos_utic(p_actor);
 IF jsonb_typeof(p_datos) IS DISTINCT FROM 'object' OR jsonb_typeof(p_datos->'lineas') IS DISTINCT FROM 'array' OR jsonb_array_length(p_datos->'lineas') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Aprobación inválida' USING ERRCODE='22023';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_datos->'lineas')l WHERE (l->>'cantidad_aprobada') IS NULL OR (l->>'cantidad_aprobada') !~ '^(0|[1-9][0-9]{0,4})$') OR (SELECT count(DISTINCT (l->>'producto_id')::uuid) FROM jsonb_array_elements(p_datos->'lineas')l)<>jsonb_array_length(p_datos->'lineas') THEN RAISE EXCEPTION 'Líneas inválidas o repetidas' USING ERRCODE='22023';END IF;
 SELECT * INTO s FROM public.solicitudes_insumos WHERE id=p_solicitud FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no disponible' USING ERRCODE='P2604';END IF;
 sol:=jsonb_build_object('motivo',COALESCE(p_datos->>'motivo',''),'lineas',(SELECT jsonb_agg(l ORDER BY l->>'producto_id') FROM jsonb_array_elements(p_datos->'lineas')l));
 IF s.estado='aprobada' AND s.aprobado_por=p_actor AND s.solicitud_aprobacion=sol THEN RETURN jsonb_build_object('repetida',true);END IF;
 IF s.estado<>'en_validacion' THEN RAISE EXCEPTION 'La solicitud no está en validación' USING ERRCODE='P2602';END IF;
 IF jsonb_array_length(p_datos->'lineas')<>(SELECT count(*) FROM public.solicitudes_insumos_detalle WHERE solicitud_id=p_solicitud) THEN RAISE EXCEPTION 'Revisa todas las líneas solicitadas' USING ERRCODE='22023';END IF;
 FOR e IN SELECT l FROM jsonb_array_elements(p_datos->'lineas')l ORDER BY l->>'producto_id' LOOP
  SELECT * INTO d FROM public.solicitudes_insumos_detalle WHERE solicitud_id=p_solicitud AND producto_id=(e->>'producto_id')::uuid FOR UPDATE;
  cantidad:=(e->>'cantidad_aprobada')::integer;
  IF NOT FOUND OR cantidad>d.cantidad_solicitada OR cantidad>10000 THEN RAISE EXCEPTION 'Producto o cantidad no corresponde a la solicitud' USING ERRCODE='22023';END IF;
  IF cantidad<d.cantidad_solicitada AND NULLIF(btrim(e->>'motivo_reduccion'),'') IS NULL THEN RAISE EXCEPTION 'Indica motivo de la reducción' USING ERRCODE='22023';END IF;
  IF cantidad>0 THEN
   PERFORM 1 FROM public.catalogo_insumos WHERE id=d.producto_id AND activo FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Producto no disponible' USING ERRCODE='P3102';END IF;
   SELECT * INTO st FROM public.stock_insumos WHERE producto_id=d.producto_id FOR UPDATE;
   IF NOT FOUND OR st.existencia-st.reservado<cantidad THEN RAISE EXCEPTION 'Stock insuficiente' USING ERRCODE='P3103';END IF;
   UPDATE public.stock_insumos SET reservado=reservado+cantidad,actualizado_en=CURRENT_TIMESTAMP WHERE producto_id=d.producto_id;
   INSERT INTO public.reservas_insumos(solicitud_id,producto_id,cantidad_reservada) VALUES(p_solicitud,d.producto_id,cantidad);total:=total+cantidad;
  END IF;
  UPDATE public.solicitudes_insumos_detalle SET cantidad_aprobada=cantidad,motivo_reduccion=COALESCE(e->>'motivo_reduccion','') WHERE id=d.id;
 END LOOP;
 IF total=0 THEN RAISE EXCEPTION 'No hay productos aprobados; cancela la solicitud' USING ERRCODE='22023';END IF;
 UPDATE public.solicitudes_insumos SET estado='aprobada',aprobado_por=p_actor,aprobado_en=CURRENT_TIMESTAMP,solicitud_aprobacion=sol WHERE id=p_solicitud;RETURN jsonb_build_object('repetida',false);
END;$function$;
CREATE OR REPLACE FUNCTION public.asignar_foto_insumo_acceso(p_actor text, p_producto uuid, p_imagen uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE anterior jsonb;posterior jsonb;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'catalogo_insumos.editar');

 PERFORM public.autorizar_insumos_utic(p_actor);PERFORM 1 FROM public.imagenes_insumos WHERE id=p_imagen FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Imagen no disponible' USING ERRCODE='22023';END IF;
 SELECT to_jsonb(c) INTO anterior FROM public.catalogo_insumos c WHERE id=p_producto FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Producto no disponible' USING ERRCODE='P3102';END IF;
 IF anterior->>'foto_url'='/api/insumos/imagen?id='||p_imagen::text THEN RETURN;END IF;
 UPDATE public.catalogo_insumos SET foto_url='/api/insumos/imagen?id='||p_imagen::text,version=version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=p_producto RETURNING to_jsonb(catalogo_insumos) INTO posterior;
 INSERT INTO public.insumos_historial(id,producto_id,actor,accion,solicitud,antes,despues) VALUES(gen_random_uuid(),p_producto,p_actor,'foto',jsonb_build_object('imagen',p_imagen),anterior,posterior);
END;$function$;
CREATE OR REPLACE FUNCTION public.autorizar_insumos_utic(p_actor text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1795536000000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND public.rbac_rol_motor(correo) IN ('administrador','administrador_gestion','gestor_insumos') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Operación reservada a gestión de insumos' USING ERRCODE='42501';END IF;
END;$function$;
CREATE OR REPLACE FUNCTION public.cancelar_solicitud_insumos(p_actor text, p_solicitud uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE s public.solicitudes_insumos%ROWTYPE;r public.reservas_insumos%ROWTYPE;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'seguimiento_insumos.confirmar');

 PERFORM public.autorizar_insumos_utic(p_actor);
 IF p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Indica motivo de cancelación' USING ERRCODE='22023';END IF;
 SELECT * INTO s FROM public.solicitudes_insumos WHERE id=p_solicitud FOR UPDATE;
 IF NOT FOUND OR s.estado NOT IN ('solicitada','en_validacion','aprobada') THEN RAISE EXCEPTION 'La solicitud no permite cancelación' USING ERRCODE='P2602';END IF;
 FOR r IN SELECT * FROM public.reservas_insumos WHERE solicitud_id=p_solicitud AND consumida_en IS NULL AND liberada_en IS NULL ORDER BY producto_id FOR UPDATE LOOP
  UPDATE public.stock_insumos SET reservado=reservado-r.cantidad_reservada,actualizado_en=CURRENT_TIMESTAMP WHERE producto_id=r.producto_id AND reservado>=r.cantidad_reservada;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserva incoherente; requiere revisión' USING ERRCODE='P3103';END IF;
  UPDATE public.reservas_insumos SET liberada_en=CURRENT_TIMESTAMP WHERE id=r.id;
 END LOOP;
 UPDATE public.solicitudes_insumos SET estado='cancelada',cancelado_en=CURRENT_TIMESTAMP,cancelado_por=p_actor,cancelado_motivo=p_motivo WHERE id=p_solicitud;
END;$function$;
CREATE OR REPLACE FUNCTION public.cargar_directorio_acceso(p_actor text, p_filas jsonb, p_sha text, p_archivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE fila jsonb;n integer;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'directorio_institucional.registrar');

 PERFORM pg_advisory_xact_lock(1793750400000);
 PERFORM 1 FROM public.usuarios_acceso u WHERE u.correo=p_actor AND u.activo AND public.rbac_rol_motor(u.correo) IN ('administrador','administrador_gestion') FOR SHARE;
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
$function$;
CREATE OR REPLACE FUNCTION public.cargar_equipos_acceso(p_actor text, p_filas jsonb, p_archivo text, p_sha text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE carga public.cargas_equipos%ROWTYPE; fila jsonb;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'equipos.registrar');

  PERFORM pg_advisory_xact_lock(1793577600000);
  PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND public.rbac_rol_motor(correo) IN ('administrador','administrador_gestion') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Carga sin autorización' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_filas)<>'array' OR jsonb_array_length(p_filas) NOT BETWEEN 1 AND 2500 THEN
    RAISE EXCEPTION 'Cantidad de filas inválida' USING ERRCODE='22023';
  END IF;
  SELECT * INTO carga FROM public.cargas_equipos WHERE sha256=p_sha;
  IF FOUND THEN RETURN jsonb_build_object('id',carga.id,'cantidad',carga.cantidad,'repetida',true); END IF;
  INSERT INTO public.cargas_equipos(actor,archivo,sha256,cantidad)
  VALUES(p_actor,p_archivo,p_sha,jsonb_array_length(p_filas)) RETURNING * INTO carga;
  FOR fila IN SELECT value FROM jsonb_array_elements(p_filas) LOOP
    PERFORM public.guardar_equipo_acceso(p_actor,fila,0,'Carga histórica: ' || p_archivo,carga.id);
  END LOOP;
  RETURN jsonb_build_object('id',carga.id,'cantidad',carga.cantidad,'repetida',false);
END;
$function$;
CREATE OR REPLACE FUNCTION public.completar_pdf_acta_acceso(p_actor text, p_id uuid, p_pdf bytea)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 IF NOT public.rbac_acta_autorizada(p_actor,p_id,'registrar') THEN RAISE EXCEPTION 'Documento fuera del alcance autorizado' USING ERRCODE='42501';END IF;

 PERFORM public.rbac_exigir(p_actor,CASE WHEN EXISTS(SELECT 1 FROM public.actas_documentos WHERE id=p_id AND solicitud_insumo_id IS NOT NULL) THEN 'actas_insumos.registrar' ELSE 'actas.registrar' END);

 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND (public.rbac_rol_motor(correo) IN ('administrador','administrador_gestion') OR (public.rbac_rol_motor(correo)='gestor_insumos' AND EXISTS(SELECT 1 FROM public.actas_documentos a WHERE a.id=p_id AND a.solicitud_insumo_id IS NOT NULL AND a.entrega_insumo_id IS NOT NULL))) FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF p_pdf IS NULL OR octet_length(p_pdf) NOT BETWEEN 100 AND 8388608 OR left(encode(p_pdf,'escape'),5)<>'%PDF-' THEN RAISE EXCEPTION 'PDF inválido' USING ERRCODE='22023';END IF;
 UPDATE public.actas_documentos SET pdf=p_pdf,sha256=encode(sha256(p_pdf),'hex') WHERE id=p_id AND actor=p_actor AND pdf IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Documento no disponible' USING ERRCODE='P2701';END IF;
END;$function$;
CREATE OR REPLACE FUNCTION public.crear_solicitud_insumos(p_actor text, p_sede_id uuid, p_lineas jsonb, p_datos jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE actor public.usuarios_acceso%ROWTYPE;v_id uuid;elem jsonb;pid uuid;cant integer;sol jsonb;anterior public.solicitudes_insumos%ROWTYPE;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'solicitudes_insumos.registrar');

 PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1795536000000);
 SELECT * INTO actor FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND public.rbac_rol_motor(correo) IN ('administrador','administrador_gestion','encargado','gestor_insumos') FOR SHARE;
 IF NOT FOUND OR (public.rbac_rol_motor(actor.correo)='encargado' AND actor.sede_id IS DISTINCT FROM p_sede_id) THEN RAISE EXCEPTION 'Sin permiso para solicitar en esta sede' USING ERRCODE='42501';END IF;
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
END;$function$;
CREATE OR REPLACE FUNCTION public.entregar_solicitud_insumos(p_actor text, p_solicitud uuid, p_datos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE s public.solicitudes_insumos%ROWTYPE;ent public.entregas_insumos%ROWTYPE;e jsonb;d public.solicitudes_insumos_detalle%ROWTYPE;r public.reservas_insumos%ROWTYPE;cantidad integer;sol jsonb;fecha date;total integer:=0;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'seguimiento_insumos.confirmar');

 PERFORM public.autorizar_insumos_utic(p_actor);
 IF jsonb_typeof(p_datos) IS DISTINCT FROM 'object' OR jsonb_typeof(p_datos->'lineas') IS DISTINCT FROM 'array' OR jsonb_array_length(p_datos->'lineas') NOT BETWEEN 1 AND 100 OR NULLIF(p_datos->>'acta_id','') IS NOT NULL THEN RAISE EXCEPTION 'Entrega inválida; el acta se vincula en su operación autorizada' USING ERRCODE='22023';END IF;
 IF COALESCE(btrim(p_datos->>'receptor'),'')='' OR length(p_datos->>'receptor')>200 OR COALESCE(btrim(p_datos->>'responsable_ti'),'')='' OR length(p_datos->>'responsable_ti')>200 OR (p_datos->>'fecha_entrega') IS NULL OR (p_datos->>'fecha_entrega') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Participantes o fecha inválidos' USING ERRCODE='22023';END IF;
 fecha:=(p_datos->>'fecha_entrega')::date;IF fecha> (CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date OR fecha<DATE '1900-01-01' THEN RAISE EXCEPTION 'Fecha inválida' USING ERRCODE='22023';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_datos->'lineas')l WHERE (l->>'cantidad_entregada') IS NULL OR (l->>'cantidad_entregada') !~ '^(0|[1-9][0-9]{0,4})$') OR (SELECT count(DISTINCT (l->>'producto_id')::uuid) FROM jsonb_array_elements(p_datos->'lineas')l)<>jsonb_array_length(p_datos->'lineas') THEN RAISE EXCEPTION 'Líneas inválidas o repetidas' USING ERRCODE='22023';END IF;
 SELECT * INTO s FROM public.solicitudes_insumos WHERE id=p_solicitud FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no disponible' USING ERRCODE='P2604';END IF;
 sol:=(p_datos-'acta_id')||jsonb_build_object('lineas',(SELECT jsonb_agg(l ORDER BY l->>'producto_id') FROM jsonb_array_elements(p_datos->'lineas')l));
 SELECT * INTO ent FROM public.entregas_insumos WHERE solicitud_id=p_solicitud;
 IF FOUND THEN IF ent.actor=p_actor AND ent.solicitud_original=sol THEN RETURN jsonb_build_object('entrega_id',ent.id,'repetida',true);END IF;RAISE EXCEPTION 'Entrega ya registrada con otros datos' USING ERRCODE='P3101';END IF;
 IF s.estado<>'aprobada' THEN RAISE EXCEPTION 'La solicitud no está aprobada' USING ERRCODE='P2602';END IF;
 FOR e IN SELECT * FROM jsonb_array_elements(p_datos->'lineas') LOOP
  SELECT * INTO d FROM public.solicitudes_insumos_detalle WHERE solicitud_id=p_solicitud AND producto_id=(e->>'producto_id')::uuid;
  IF NOT FOUND OR (e->>'cantidad_entregada')::integer>d.cantidad_aprobada THEN RAISE EXCEPTION 'Producto o cantidad no aprobado' USING ERRCODE='22023';END IF;
  total:=total+(e->>'cantidad_entregada')::integer;
 END LOOP;
 IF total=0 THEN RAISE EXCEPTION 'La entrega debe incluir productos' USING ERRCODE='22023';END IF;
 INSERT INTO public.entregas_insumos(solicitud_id,responsable_ti,receptor,fecha_entrega,observaciones,solicitud_original,actor) VALUES(p_solicitud,p_datos->>'responsable_ti',p_datos->>'receptor',fecha,COALESCE(p_datos->>'observaciones',''),sol,p_actor) RETURNING * INTO ent;
 FOR d IN SELECT * FROM public.solicitudes_insumos_detalle WHERE solicitud_id=p_solicitud ORDER BY producto_id LOOP
  SELECT COALESCE((l->>'cantidad_entregada')::integer,0) INTO cantidad FROM jsonb_array_elements(p_datos->'lineas')l WHERE (l->>'producto_id')::uuid=d.producto_id;cantidad:=COALESCE(cantidad,0);
  SELECT * INTO r FROM public.reservas_insumos WHERE solicitud_id=p_solicitud AND producto_id=d.producto_id AND consumida_en IS NULL AND liberada_en IS NULL FOR UPDATE;
  IF cantidad>0 AND (NOT FOUND OR cantidad>r.cantidad_reservada) THEN RAISE EXCEPTION 'Reserva no disponible' USING ERRCODE='P3103';END IF;
  IF r.id IS NOT NULL THEN
   PERFORM 1 FROM public.stock_insumos WHERE producto_id=d.producto_id AND reservado>=r.cantidad_reservada AND existencia>=cantidad FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Stock o reserva incoherente' USING ERRCODE='P3103';END IF;
   UPDATE public.stock_insumos SET existencia=existencia-cantidad,reservado=reservado-r.cantidad_reservada,actualizado_en=CURRENT_TIMESTAMP WHERE producto_id=d.producto_id;
   UPDATE public.reservas_insumos SET consumida_en=CASE WHEN cantidad>0 THEN CURRENT_TIMESTAMP END,liberada_en=CASE WHEN cantidad<r.cantidad_reservada THEN CURRENT_TIMESTAMP END WHERE id=r.id;
  END IF;
  UPDATE public.solicitudes_insumos_detalle SET cantidad_entregada=cantidad WHERE id=d.id;
  IF cantidad>0 THEN INSERT INTO public.entregas_insumos_detalle(entrega_id,producto_id,cantidad_entregada) VALUES(ent.id,d.producto_id,cantidad);END IF;
 END LOOP;
 UPDATE public.solicitudes_insumos SET estado='entregada',entregado_en=CURRENT_TIMESTAMP WHERE id=p_solicitud;RETURN jsonb_build_object('entrega_id',ent.id,'repetida',false);
END;$function$;
CREATE OR REPLACE FUNCTION public.gestionar_reporte_incidente_acceso(p_actor text, p_solicitud uuid, p_id uuid, p_version integer, p_accion text, p_datos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE u public.usuarios_acceso%ROWTYPE;r public.reportes_incidentes_inventario%ROWTYPE;op public.reportes_incidentes_operaciones%ROWTYPE;
 sol jsonb;res jsonb;b jsonb;snap jsonb;seleccion jsonb:='[]';ids jsonb:='[]';sede uuid;rut text;n integer;v integer;k text;fecha date;
BEGIN
 PERFORM public.rbac_exigir(p_actor,CASE WHEN p_accion IN ('validar','rechazar') THEN 'incidentes.aprobar' WHEN p_accion='guardar' AND p_version=0 THEN 'incidentes.registrar' ELSE 'incidentes.editar' END);

 PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1794268800000);
 SELECT * INTO u FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND public.rbac_rol_motor(correo) IN ('administrador','administrador_gestion','encargado') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF p_solicitud IS NULL OR p_id IS NULL OR p_version IS NULL OR p_version<0 OR p_accion IS NULL OR p_accion NOT IN ('guardar','enviar','validar','rechazar') OR (jsonb_typeof(p_datos) IS DISTINCT FROM 'object' OR octet_length(p_datos::text)>150000) THEN RAISE EXCEPTION 'Solicitud inválida' USING ERRCODE='22023';END IF;
 sol:=jsonb_build_object('id',p_id,'version',p_version,'accion',p_accion,'datos',p_datos);
 SELECT * INTO op FROM public.reportes_incidentes_operaciones WHERE id=p_solicitud;
 IF FOUND THEN
  IF op.actor=p_actor AND op.solicitud=sol THEN RETURN op.resultado;END IF;
  RAISE EXCEPTION 'Solicitud reutilizada' USING ERRCODE='P3501';
 END IF;
 SELECT * INTO r FROM public.reportes_incidentes_inventario WHERE id=p_id FOR UPDATE;
 IF r.id IS NOT NULL AND (public.rbac_rol_motor(u.correo)='encargado' AND (r.sede_id IS DISTINCT FROM u.sede_id)) THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF COALESCE(r.version,0)<>p_version THEN RAISE EXCEPTION 'El reporte cambió; vuelve a abrirlo' USING ERRCODE='P3501';END IF;
 IF p_accion='guardar' THEN
  IF r.id IS NOT NULL AND r.estado<>'borrador' THEN RAISE EXCEPTION 'Solo se edita el borrador' USING ERRCODE='22023';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_datos)t(k) WHERE t.k NOT IN ('sedeId','tipo','fecha','parte','denunciante','rut','descripcion','bienes')) OR (SELECT count(*) FROM jsonb_object_keys(p_datos))<>8 THEN RAISE EXCEPTION 'Campos inválidos' USING ERRCODE='22023';END IF;
  FOREACH k IN ARRAY ARRAY['sedeId','tipo','fecha','parte','denunciante','rut','descripcion'] LOOP
   IF jsonb_typeof(p_datos->k) IS DISTINCT FROM 'string' OR length(p_datos->>k)>2000 THEN RAISE EXCEPTION 'Campo inválido' USING ERRCODE='22023';END IF;
  END LOOP;
  sede:=(p_datos->>'sedeId')::uuid;p_datos:=jsonb_set(p_datos,'{sedeId}',to_jsonb(sede::text));
  IF public.rbac_rol_motor(u.correo)='encargado' AND sede IS DISTINCT FROM u.sede_id OR (r.id IS NOT NULL AND sede<>r.sede_id) THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
  PERFORM 1 FROM public.sedes WHERE id=sede AND activo;IF NOT FOUND THEN RAISE EXCEPTION 'Sede inválida' USING ERRCODE='22023';END IF;
  fecha:=(p_datos->>'fecha')::date;
  IF fecha IS NULL OR fecha>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date OR fecha<'1900-01-01' OR p_datos->>'tipo' NOT IN ('robo','sustraccion','dano') OR length(p_datos->>'parte')>120 OR length(p_datos->>'denunciante')>200 OR length(p_datos->>'rut')>12 OR length(btrim(p_datos->>'descripcion'))=0 THEN RAISE EXCEPTION 'Revisa fecha, tipo y descripción' USING ERRCODE='22023';END IF;
  IF jsonb_typeof(p_datos->'bienes') IS DISTINCT FROM 'array' OR jsonb_array_length(p_datos->'bienes') NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Selecciona entre uno y 200 bienes' USING ERRCODE='22023';END IF;
  FOR b IN SELECT value FROM jsonb_array_elements(p_datos->'bienes') ORDER BY value->>'clase',value->>'id' LOOP
   b:=jsonb_set(b,'{id}',to_jsonb((b->>'id')::uuid::text));
   IF b->>'clase'='equipo' THEN SELECT to_jsonb(e) INTO snap FROM public.equipos e WHERE id=(b->>'id')::uuid FOR UPDATE;
   ELSIF b->>'clase'='celular' THEN SELECT to_jsonb(c) INTO snap FROM public.celulares c WHERE id=(b->>'id')::uuid FOR UPDATE;
   ELSE RAISE EXCEPTION 'Tipo de bien inválido' USING ERRCODE='22023';END IF;
   IF snap IS NULL OR snap->>'sede_id'<>sede::text OR snap->>'custodia'<>'asignado' OR snap->>'estado_administrativo'<>'activo' OR snap->>'activo'='false' THEN RAISE EXCEPTION 'Bien no disponible en esta sede' USING ERRCODE='42501';END IF;
   IF (snap->>'version')::integer IS DISTINCT FROM (b->>'version')::integer THEN RAISE EXCEPTION 'El bien cambió; revisa su selección' USING ERRCODE='P3501';END IF;
   IF b->>'clase'='equipo' AND EXISTS(SELECT 1 FROM public.incidentes_robos_equipos d JOIN public.incidentes_robos i ON i.id=d.incidente_id WHERE d.equipo_id=(b->>'id')::uuid AND i.estado IN ('reportado','validado') AND d.recuperado_fecha IS NULL) THEN RAISE EXCEPTION 'Ya existe un incidente abierto' USING ERRCODE='P3501';END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(seleccion)x WHERE x->>'id'=b->>'id' AND x->>'clase'=b->>'clase') THEN RAISE EXCEPTION 'Bien repetido' USING ERRCODE='22023';END IF;
   seleccion:=seleccion||jsonb_build_array(jsonb_build_object('id',b->>'id','clase',b->>'clase','version',(snap->>'version')::integer,'marca',snap->>'marca','modelo',snap->>'modelo','inventario',snap->>'numero_inventario','serie',COALESCE(snap->>'serie',snap->>'imei')));
  END LOOP;
  INSERT INTO public.reportes_incidentes_inventario(id,sede_id,actor,datos) VALUES(p_id,sede,p_actor,jsonb_set(p_datos,'{bienes}',seleccion))
  ON CONFLICT(id) DO UPDATE SET datos=EXCLUDED.datos,version=reportes_incidentes_inventario.version+1,actualizado_en=CURRENT_TIMESTAMP RETURNING * INTO r;
 ELSE
  IF (p_accion='enviar' AND p_datos<>'{}'::jsonb) OR (p_accion IN ('validar','rechazar') AND (jsonb_typeof(p_datos->'motivo') IS DISTINCT FROM 'string' OR (SELECT count(*) FROM jsonb_object_keys(p_datos))<>1)) THEN RAISE EXCEPTION 'Campos inválidos' USING ERRCODE='22023';END IF;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Reporte no disponible' USING ERRCODE='42501';END IF;
  IF p_accion='enviar' THEN
   IF r.estado<>'borrador' THEN RAISE EXCEPTION 'El reporte ya fue enviado' USING ERRCODE='22023';END IF;
   IF r.datos->>'tipo'<>'dano' THEN
    rut:=upper(regexp_replace(r.datos->>'rut','[. -]','','g'));
    IF length(btrim(r.datos->>'parte'))=0 OR length(btrim(r.datos->>'denunciante'))=0 OR rut!~'^[0-9]{7,8}[0-9K]$' THEN RAISE EXCEPTION 'Completa parte, denunciante y RUT' USING ERRCODE='22023';END IF;
    n:=0;v:=2;FOR k IN SELECT substr(left(rut,-1),i,1) FROM generate_series(length(rut)-1,1,-1)i LOOP n:=n+k::integer*v;v:=CASE WHEN v=7 THEN 2 ELSE v+1 END;END LOOP;
    IF right(rut,1)<>(CASE 11-n%11 WHEN 11 THEN '0' WHEN 10 THEN 'K' ELSE (11-n%11)::text END) THEN RAISE EXCEPTION 'RUT inválido' USING ERRCODE='22023';END IF;
   END IF;
  ELSE
   IF public.rbac_rol_motor(u.correo) NOT IN ('administrador','administrador_gestion') THEN RAISE EXCEPTION 'Solo TI valida' USING ERRCODE='42501';END IF;
   IF r.estado<>'enviado' OR length(btrim(COALESCE(p_datos->>'motivo','')))=0 OR length(p_datos->>'motivo')>500 THEN RAISE EXCEPTION 'Indica el resultado de revisión' USING ERRCODE='22023';END IF;
  END IF;
  IF p_accion IN ('enviar','validar') THEN
   FOR b IN SELECT value FROM jsonb_array_elements(r.datos->'bienes') ORDER BY value->>'clase',value->>'id' LOOP
    IF b->>'clase'='equipo' THEN SELECT to_jsonb(e) INTO snap FROM public.equipos e WHERE id=(b->>'id')::uuid FOR UPDATE;
    ELSE SELECT to_jsonb(c) INTO snap FROM public.celulares c WHERE id=(b->>'id')::uuid FOR UPDATE;END IF;
    IF snap IS NULL OR snap->>'sede_id'<>r.sede_id::text OR snap->>'custodia'<>'asignado' OR snap->>'estado_administrativo'<>'activo' OR (snap->>'version')::integer<>(b->>'version')::integer OR snap->>'activo'='false' THEN RAISE EXCEPTION 'El bien cambió; TI debe revisar la ficha y el reporte' USING ERRCODE='P3501';END IF;
    IF b->>'clase'='equipo' AND EXISTS(SELECT 1 FROM public.incidentes_robos_equipos d JOIN public.incidentes_robos i ON i.id=d.incidente_id WHERE d.equipo_id=(b->>'id')::uuid AND i.estado IN ('reportado','validado') AND d.recuperado_fecha IS NULL) THEN RAISE EXCEPTION 'Ya existe un incidente abierto' USING ERRCODE='P3501';END IF;
    IF EXISTS(SELECT 1 FROM public.reportes_incidentes_inventario x,jsonb_array_elements(x.datos->'bienes') y WHERE x.id<>r.id AND x.estado='enviado' AND y->>'id'=b->>'id' AND y->>'clase'=b->>'clase') THEN RAISE EXCEPTION 'Ya hay un reporte pendiente para este bien' USING ERRCODE='P3501';END IF;
   END LOOP;
  END IF;
  IF p_accion='validar' THEN
   -- Cambiar estados por el motor existente, conservando su historial y guardas.
   FOR b IN SELECT value FROM jsonb_array_elements(r.datos->'bienes') ORDER BY value->>'clase',value->>'id' LOOP
    PERFORM public.guardar_estados_activo_acceso(p_actor,gen_random_uuid(),jsonb_build_object('clase',b->>'clase','id',b->>'id','version',(b->>'version')::integer,'administrativo',CASE WHEN r.datos->>'tipo'='dano' THEN 'activo' ELSE 'robado' END,'condicion',CASE WHEN r.datos->>'tipo'='dano' THEN 'mal_estado' ELSE '' END));
    IF b->>'clase'='equipo' AND r.datos->>'tipo'<>'dano' THEN ids:=ids||jsonb_build_array(jsonb_build_object('id',b->>'id','version',(b->>'version')::integer+1));END IF;
   END LOOP;
   IF jsonb_array_length(ids)>0 THEN
    PERFORM public.reportar_robo_historico_interno(p_actor,p_id,jsonb_build_object('sedeId',r.sede_id,'fecha',r.datos->>'fecha','lugar','Según reporte del establecimiento','descripcion',r.datos->>'descripcion','enlace','','equipos',ids));
    PERFORM public.resolver_robo_acceso(p_actor,p_id,1,'validado',p_datos->>'motivo');
    r.legado_id:=p_id;
   END IF;
  END IF;
  UPDATE public.reportes_incidentes_inventario SET estado=CASE p_accion WHEN 'enviar' THEN 'enviado' WHEN 'validar' THEN 'validado' ELSE 'rechazado' END,
   version=version+1,actualizado_en=CURRENT_TIMESTAMP,validado_por=CASE WHEN p_accion<>'enviar' THEN p_actor END,motivo_validacion=p_datos->>'motivo',legado_id=r.legado_id WHERE id=p_id RETURNING * INTO r;
 END IF;
 res:=jsonb_build_object('id',r.id,'version',r.version,'estado',r.estado);
 INSERT INTO public.reportes_incidentes_operaciones(id,reporte_id,actor,solicitud,resultado) VALUES(p_solicitud,p_id,p_actor,sol,res);
 RETURN res;
END;$function$;
CREATE OR REPLACE FUNCTION public.guardar_categoria_acceso(p_actor text, p_id uuid, p_nombre text, p_activo boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  actor public.usuarios_acceso%ROWTYPE;
  nuevo_id uuid;
BEGIN
 PERFORM public.rbac_exigir(p_actor,CASE WHEN p_id IS NULL THEN 'categorias.registrar' ELSE 'categorias.editar' END);

  PERFORM pg_advisory_xact_lock(1793059200000);
  SELECT * INTO actor FROM public.usuarios_acceso WHERE correo = p_actor AND activo FOR SHARE;
  IF NOT FOUND OR public.rbac_rol_motor(actor.correo) NOT IN ('administrador', 'administrador_gestion') THEN
    RAISE EXCEPTION 'Actor sin autorización' USING ERRCODE = '42501';
  END IF;
  IF p_activo IS NULL OR p_nombre IS NULL OR length(p_nombre) NOT BETWEEN 1 AND 100
      OR p_nombre <> btrim(p_nombre) OR p_nombre ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE = '22023';
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.categorias_bienes (nombre, activo) VALUES (p_nombre, p_activo) RETURNING id INTO nuevo_id;
    RETURN jsonb_build_object('id', nuevo_id, 'creada', true);
  END IF;
  UPDATE public.categorias_bienes SET nombre = p_nombre, activo = p_activo WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Categoría no disponible' USING ERRCODE = 'P1006';
  END IF;
  RETURN jsonb_build_object('id', p_id, 'creada', false);
END;
$function$;
CREATE OR REPLACE FUNCTION public.guardar_celular_acceso(p_actor text, p_id uuid, p_datos jsonb, p_version integer, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE previo public.celulares%ROWTYPE;posterior public.celulares%ROWTYPE;rol text;sede_actor uuid;resultado jsonb;inicial text;
BEGIN
 PERFORM public.rbac_exigir(p_actor,CASE WHEN p_version=0 THEN 'celulares.registrar' ELSE 'celulares.editar' END);

 PERFORM pg_advisory_xact_lock(1793577600000);
 PERFORM pg_advisory_xact_lock(1794268800000);
 SELECT public.rbac_rol_motor(u.correo),u.sede_id INTO rol,sede_actor FROM public.usuarios_acceso u WHERE u.correo=p_actor AND u.activo AND public.rbac_rol_motor(u.correo) IN ('administrador','administrador_gestion') FOR SHARE;
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
CREATE OR REPLACE FUNCTION public.guardar_celular_ficha_base(p_actor text, p_id uuid, p_datos jsonb, p_version integer, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE anterior public.celulares%ROWTYPE;posterior public.celulares%ROWTYPE;actor public.usuarios_acceso%ROWTYPE;sede public.sedes%ROWTYPE;sede_anterior public.sedes%ROWTYPE;
 sede_id uuid;telefono text;marca text;modelo text;imei text;inventario text;condicion text;responsable text;observaciones text;activo boolean;
 normalizado jsonb;previo jsonb;k text;suma integer;digito integer;i integer;
BEGIN
 PERFORM pg_advisory_xact_lock(1794182400000);
 SELECT * INTO actor FROM public.usuarios_acceso u WHERE u.correo=p_actor AND u.activo AND public.rbac_rol_motor(u.correo) IN ('administrador','administrador_gestion','encargado') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR p_version IS NULL OR p_version<0 OR p_version>=2147483647 OR p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 1 AND 500 OR p_motivo ~ '[[:cntrl:]]' OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_datos) t(k) WHERE t.k NOT IN ('sedeId','telefono','marca','modelo','imei','inventario','condicionTecnica','responsable','observaciones','activo')) THEN RAISE EXCEPTION 'Campo no permitido' USING ERRCODE='22023';END IF;
 FOREACH k IN ARRAY ARRAY['sedeId','telefono','marca','modelo','imei','inventario','condicionTecnica','responsable','observaciones'] LOOP
  IF jsonb_typeof(p_datos->k) IS DISTINCT FROM 'string' OR regexp_replace(p_datos->>k,CASE WHEN k='observaciones' THEN E'[\r\n\t]' ELSE '$^' END,'','g') ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Campo inválido' USING ERRCODE='22023';END IF;
 END LOOP;
 IF jsonb_typeof(p_datos->'activo') IS DISTINCT FROM 'boolean' OR p_datos->>'sedeId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Sede o vigencia inválida' USING ERRCODE='22023';END IF;
 sede_id:=(p_datos->>'sedeId')::uuid;telefono:=btrim(p_datos->>'telefono');
 marca:=normalize(btrim(p_datos->>'marca'),NFC);modelo:=normalize(btrim(p_datos->>'modelo'),NFC);
 imei:=NULLIF(btrim(p_datos->>'imei'),'');inventario:=NULLIF(normalize(btrim(p_datos->>'inventario'),NFC),'');
 condicion:=p_datos->>'condicionTecnica';responsable:=normalize(btrim(p_datos->>'responsable'),NFC);observaciones:=normalize(btrim(p_datos->>'observaciones'),NFC);activo:=(p_datos->>'activo')::boolean;
 IF telefono !~ '^[+]569[0-9]{8}$' OR length(marca)>120 OR length(modelo)>200 OR length(inventario)>120 OR length(responsable)>200 OR length(observaciones)>2000 OR condicion NOT IN ('','sin_verificar','operativo','en_reparacion','fuera_de_servicio','bodega_ti','mantencion','mal_estado','obsoleto') THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023';END IF;
 IF imei IS NOT NULL THEN
  IF imei !~ '^[0-9]{15}$' THEN RAISE EXCEPTION 'IMEI inválido' USING ERRCODE='22023';END IF;
  suma:=0;FOR i IN 1..15 LOOP digito:=substring(imei,i,1)::integer;IF i%2=0 THEN digito:=digito*2;IF digito>9 THEN digito:=digito-9;END IF;END IF;suma:=suma+digito;END LOOP;
  IF suma%10<>0 THEN RAISE EXCEPTION 'Dígito IMEI inválido' USING ERRCODE='22023';END IF;
 END IF;
 SELECT * INTO anterior FROM public.celulares WHERE id=p_id FOR UPDATE;
 IF public.rbac_rol_motor(actor.correo)='encargado' AND (actor.sede_id IS NULL OR sede_id<>actor.sede_id OR (anterior.id IS NOT NULL AND anterior.sede_id<>actor.sede_id)) THEN RAISE EXCEPTION 'Sin autorización para esta sede' USING ERRCODE='42501';END IF;
 SELECT * INTO sede FROM public.sedes s WHERE s.id=sede_id FOR SHARE;
 IF NOT FOUND OR (NOT sede.activo AND (anterior.id IS NULL OR anterior.sede_id<>sede_id)) THEN RAISE EXCEPTION 'Sede no disponible' USING ERRCODE='P2502';END IF;
 normalizado:=jsonb_build_object('sedeId',sede_id,'telefono',telefono,'marca',marca,'modelo',modelo,'imei',COALESCE(imei,''),'inventario',COALESCE(inventario,''),'condicionTecnica',condicion,'responsable',responsable,'observaciones',observaciones,'activo',activo);
 IF anterior.id IS NOT NULL THEN
  previo:=jsonb_build_object('sedeId',anterior.sede_id,'telefono',anterior.telefono,'marca',anterior.marca,'modelo',anterior.modelo,'imei',COALESCE(anterior.imei,''),'inventario',COALESCE(anterior.numero_inventario,''),'condicionTecnica',anterior.condicion_tecnica,'responsable',anterior.responsable,'observaciones',anterior.observaciones,'activo',anterior.activo);
  IF p_version=0 AND anterior.creado_por=p_actor AND normalizado=previo THEN RETURN jsonb_build_object('id',p_id,'version',anterior.version,'repetida',true);END IF;
  IF p_version<>anterior.version THEN RAISE EXCEPTION 'La ficha cambió' USING ERRCODE='P2501';END IF;
  IF normalizado=previo THEN RETURN jsonb_build_object('id',p_id,'version',anterior.version,'repetida',true);END IF;
 ELSE
  IF p_version<>0 THEN RAISE EXCEPTION 'La ficha cambió' USING ERRCODE='P2501';END IF;
 END IF;
 IF anterior.id IS NULL THEN
  INSERT INTO public.celulares(id,sede_id,telefono,marca,modelo,imei,numero_inventario,condicion_tecnica,responsable,observaciones,activo,creado_por,actualizado_por)
  VALUES(p_id,sede_id,telefono,marca,modelo,imei,inventario,condicion,responsable,observaciones,activo,p_actor,p_actor) RETURNING * INTO posterior;
 ELSE
  UPDATE public.celulares c SET sede_id=(normalizado->>'sedeId')::uuid,telefono=normalizado->>'telefono',marca=normalizado->>'marca',modelo=normalizado->>'modelo',imei=NULLIF(normalizado->>'imei',''),numero_inventario=NULLIF(normalizado->>'inventario',''),condicion_tecnica=normalizado->>'condicionTecnica',responsable=normalizado->>'responsable',observaciones=normalizado->>'observaciones',activo=(normalizado->>'activo')::boolean,version=c.version+1,actualizado_por=p_actor,actualizado_en=CURRENT_TIMESTAMP WHERE c.id=p_id RETURNING * INTO posterior;
 END IF;
 IF anterior.id IS NOT NULL THEN SELECT * INTO sede_anterior FROM public.sedes s WHERE s.id=anterior.sede_id;previo:=previo||jsonb_build_object('sedeNombre',sede_anterior.nombre,'rbd',sede_anterior.rbd);END IF;
 INSERT INTO public.celulares_historial(celular_id,actor,motivo,antes,despues) VALUES(p_id,p_actor,btrim(p_motivo),previo,normalizado||jsonb_build_object('sedeNombre',sede.nombre,'rbd',sede.rbd));
 RETURN jsonb_build_object('id',p_id,'version',posterior.version,'repetida',false);
END;$function$;
CREATE OR REPLACE FUNCTION public.guardar_dependencia_acceso(p_actor text, p_id uuid, p_sede uuid, p_nombre text, p_activo boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  actor public.usuarios_acceso%ROWTYPE;
  sede_anterior uuid;
BEGIN
 PERFORM public.rbac_exigir(p_actor,CASE WHEN p_id IS NULL THEN 'dependencias.registrar' ELSE 'dependencias.editar' END);

  SELECT * INTO actor FROM public.usuarios_acceso WHERE correo = p_actor AND activo FOR SHARE;
  IF NOT FOUND OR public.rbac_rol_motor(actor.correo) NOT IN ('administrador', 'administrador_gestion', 'encargado') THEN
    RAISE EXCEPTION 'Actor sin autorización' USING ERRCODE = '42501';
  END IF;
  IF p_activo IS NULL OR p_nombre IS NULL OR length(p_nombre) NOT BETWEEN 1 AND 200
      OR p_nombre <> btrim(p_nombre) OR p_nombre ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE = '22023';
  END IF;
  IF public.rbac_rol_motor(actor.correo) = 'encargado' THEN
    PERFORM 1 FROM public.sedes WHERE id = actor.sede_id AND activo
      AND tipo IN ('establecimiento', 'jardin_infantil') FOR SHARE;
    IF NOT FOUND OR p_sede IS DISTINCT FROM actor.sede_id THEN
      RAISE EXCEPTION 'Sede fuera del alcance' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.dependencias (sede_id, nombre, activo) VALUES (p_sede, p_nombre, p_activo);
  ELSE
    SELECT sede_id INTO sede_anterior FROM public.dependencias WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Dependencia no disponible' USING ERRCODE = 'P1006'; END IF;
    IF public.rbac_rol_motor(actor.correo) = 'encargado' AND sede_anterior IS DISTINCT FROM actor.sede_id THEN
      RAISE EXCEPTION 'Dependencia fuera del alcance' USING ERRCODE = '42501';
    END IF;
    UPDATE public.dependencias SET sede_id = p_sede, nombre = p_nombre, activo = p_activo WHERE id = p_id;
  END IF;
END;
$function$;
CREATE OR REPLACE FUNCTION public.guardar_director_acceso(p_actor text, p_sede uuid, p_nombre text, p_version integer, p_motivo text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE d public.directorio_sedes%ROWTYPE; s public.sedes%ROWTYPE; mismo boolean;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'directorio_personas.editar');

 PERFORM pg_advisory_xact_lock(1793750400000);
 SELECT * INTO d FROM public.directorio_sedes WHERE sede_id=p_sede;
 SELECT * INTO s FROM public.sedes WHERE id=p_sede;
 mismo:=d.nombre=btrim(p_nombre);
 RETURN public.guardar_ficha_directorio_acceso(p_actor,p_sede,jsonb_build_object('nombre',COALESCE(btrim(p_nombre),''),'rut',CASE WHEN mismo THEN COALESCE(d.rut,'') ELSE '' END,
  'correo',CASE WHEN mismo THEN COALESCE(d.correo,'') ELSE '' END,'situacion',CASE WHEN NULLIF(btrim(p_nombre),'') IS NULL THEN 'pendiente' WHEN mismo THEN d.situacion ELSE 'titular' END,
  'observaciones',CASE WHEN mismo THEN COALESCE(d.observaciones,'') ELSE '' END,'sedeNombre',s.nombre,'direccion',COALESCE(s.direccion,''),'comuna',COALESCE(s.comuna,''),'correoInstitucional',COALESCE(s.correo_institucional,'')),p_version,
  jsonb_build_array(s.nombre,COALESCE(s.direccion,''),COALESCE(s.comuna,''),COALESCE(s.correo_institucional,''))::text,p_motivo);
END;
$function$;
CREATE OR REPLACE FUNCTION public.guardar_equipo_acceso(p_actor text, p_datos jsonb, p_version integer, p_motivo text, p_carga uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE previo public.equipos%ROWTYPE;posterior public.equipos%ROWTYPE;rol text;id_bien uuid;inicial text;
BEGIN
 PERFORM public.rbac_exigir(p_actor,CASE WHEN p_version=0 THEN 'equipos.registrar' ELSE 'equipos.editar' END);


 PERFORM pg_advisory_xact_lock(1793577600000);
 PERFORM pg_advisory_xact_lock(1794268800000);
 SELECT public.rbac_rol_motor(u.correo) INTO rol FROM public.usuarios_acceso u WHERE u.correo=p_actor AND u.activo AND public.rbac_rol_motor(u.correo) IN ('administrador','administrador_gestion','encargado') FOR SHARE;
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
CREATE OR REPLACE FUNCTION public.guardar_equipo_ficha_base(p_actor text, p_datos jsonb, p_version integer, p_motivo text, p_carga uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  actor public.usuarios_acceso%ROWTYPE;
  anterior public.equipos%ROWTYPE;
  posterior public.equipos%ROWTYPE;
  sede public.sedes%ROWTYPE;
  equipo_id uuid := NULLIF(p_datos->>'id','')::uuid;
  sede_id uuid := (p_datos->>'sedeId')::uuid;
  categoria uuid := (p_datos->>'categoriaId')::uuid;
  situacion text;
BEGIN
  PERFORM pg_advisory_xact_lock(1793577600000);
  SELECT * INTO actor FROM public.usuarios_acceso WHERE correo=p_actor AND activo FOR SHARE;
  IF NOT FOUND OR public.rbac_rol_motor(actor.correo) NOT IN ('administrador','administrador_gestion','encargado') THEN
    RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';
  END IF;
  SELECT * INTO sede FROM public.sedes WHERE id=sede_id AND activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sede no disponible' USING ERRCODE='P2001'; END IF;
  IF public.rbac_rol_motor(actor.correo)='encargado' AND (actor.sede_id IS DISTINCT FROM sede_id OR sede.tipo='nivel_central') THEN
    RAISE EXCEPTION 'Sede fuera del alcance' USING ERRCODE='42501';
  END IF;
  IF p_version IS NULL OR p_version<0 OR p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 1 AND 500
    OR p_datos->>'origen' IS NULL OR p_datos->>'condicionTecnica' IS NULL THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023';
  END IF;
  IF p_carga IS NOT NULL AND (public.rbac_rol_motor(actor.correo)='encargado' OR equipo_id IS NOT NULL OR NOT EXISTS(
      SELECT 1 FROM public.cargas_equipos c WHERE c.id=p_carga AND c.actor=p_actor)) THEN
    RAISE EXCEPTION 'Carga no autorizada' USING ERRCODE='42501';
  END IF;
  IF equipo_id IS NULL THEN
    IF p_version<>0 THEN RAISE EXCEPTION 'Versión inválida' USING ERRCODE='P2002'; END IF;
    IF public.rbac_rol_motor(actor.correo)='encargado' AND p_datos->>'origen'='compra_utic' THEN
      RAISE EXCEPTION 'La entrega de UTIC se confirma mediante su procedimiento' USING ERRCODE='42501';
    END IF;
    PERFORM 1 FROM public.categorias_bienes WHERE id=categoria AND activo FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Categoría no disponible' USING ERRCODE='P2001'; END IF;
    IF sede.tipo='nivel_central' THEN situacion:='registrado_nc';
    ELSIF p_carga IS NOT NULL THEN
      IF p_datos->>'estadoHistorico'='Activo' THEN situacion:='recibido_historico';
      ELSIF p_datos->>'estadoHistorico'='En Bodega del SLEP' THEN situacion:='pendiente_entrega';
      ELSE RAISE EXCEPTION 'Estado histórico no reconocido' USING ERRCODE='22023'; END IF;
    ELSIF p_datos->>'origen'='compra_utic' THEN situacion:='pendiente_entrega';
    ELSE situacion:='recibido'; END IF;
    INSERT INTO public.equipos(sede_id,categoria_id,marca,modelo,serie,numero_inventario,
      motivo_identificacion,origen,situacion,condicion_tecnica,datos_compra,observaciones,
      fecha_entrega,enlace_acta,carga_id,fila_origen,creado_por)
    VALUES(sede_id,categoria,p_datos->>'marca',p_datos->>'modelo',NULLIF(p_datos->>'serie',''),NULLIF(p_datos->>'inventario',''),
      COALESCE(p_datos->>'motivoIdentificacion',''),p_datos->>'origen',situacion,p_datos->>'condicionTecnica',
      COALESCE(p_datos->'compra','{}'::jsonb),COALESCE(p_datos->>'observaciones',''),
      CASE WHEN p_carga IS NOT NULL THEN NULLIF(p_datos->>'fechaEntrega','')::date END,
      CASE WHEN p_carga IS NOT NULL THEN NULLIF(p_datos->>'enlaceActa','') END,
      p_carga,CASE WHEN p_carga IS NOT NULL THEN (p_datos->>'filaOrigen')::integer END,p_actor)
    RETURNING * INTO posterior;
  ELSE
    SELECT * INTO anterior FROM public.equipos WHERE id=equipo_id FOR UPDATE;
    IF NOT FOUND OR (public.rbac_rol_motor(actor.correo)='encargado' AND (anterior.sede_id IS DISTINCT FROM actor.sede_id OR anterior.situacion='pendiente_entrega')) THEN
      RAISE EXCEPTION 'Equipo no disponible para edición' USING ERRCODE='42501';
    END IF;
    IF anterior.sede_id IS DISTINCT FROM sede_id THEN
      RAISE EXCEPTION 'El cambio de inventario requiere un traspaso documentado' USING ERRCODE='P2003';
    END IF;
    IF anterior.version<>p_version THEN RAISE EXCEPTION 'Edición obsoleta' USING ERRCODE='P2002'; END IF;
    IF categoria<>anterior.categoria_id THEN
      PERFORM 1 FROM public.categorias_bienes WHERE id=categoria AND activo FOR SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Categoría no disponible' USING ERRCODE='P2001'; END IF;
    END IF;
    UPDATE public.equipos SET categoria_id=categoria,marca=p_datos->>'marca',modelo=p_datos->>'modelo',
      serie=NULLIF(p_datos->>'serie',''),numero_inventario=NULLIF(p_datos->>'inventario',''),
      motivo_identificacion=COALESCE(p_datos->>'motivoIdentificacion',''),
      condicion_tecnica=p_datos->>'condicionTecnica',datos_compra=COALESCE(p_datos->'compra','{}'::jsonb),
      observaciones=COALESCE(p_datos->>'observaciones',''),version=version+1,actualizado_en=CURRENT_TIMESTAMP
    WHERE id=equipo_id RETURNING * INTO posterior;
    -- Origen, pertenencia, situación y entrega no se reescriben al corregir datos.
  END IF;
  INSERT INTO public.equipos_historial(equipo_id,actor,motivo,antes,despues)
  VALUES(posterior.id,p_actor,btrim(p_motivo),CASE WHEN equipo_id IS NULL THEN NULL ELSE to_jsonb(anterior) END,to_jsonb(posterior));
  RETURN posterior.id;
END;
$function$;
CREATE OR REPLACE FUNCTION public.guardar_estados_activo_acceso(p_actor text, p_solicitud uuid, p_datos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE clase text;id_bien uuid;admin text;condicion text;version_actual integer;sol jsonb;anterior jsonb;posterior jsonb;repetida public.cambios_estados_activo%ROWTYPE;k text;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'bajas.confirmar');

 PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1794268800000);
 PERFORM 1 FROM public.usuarios_acceso u WHERE u.correo=p_actor AND u.activo AND public.rbac_rol_motor(u.correo) IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Solo UTIC cambia estados administrativos' USING ERRCODE='42501';END IF;
 IF p_solicitud IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(p_datos))<>5 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_datos)t(k) WHERE t.k NOT IN ('clase','id','version','administrativo','condicion')) THEN RAISE EXCEPTION 'Solicitud inválida' USING ERRCODE='22023';END IF;
 FOREACH k IN ARRAY ARRAY['clase','id','administrativo','condicion'] LOOP
  IF jsonb_typeof(p_datos->k) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Campo inválido' USING ERRCODE='22023';END IF;
 END LOOP;
 clase:=p_datos->>'clase';admin:=p_datos->>'administrativo';condicion:=p_datos->>'condicion';
 IF clase NOT IN ('equipo','celular') OR admin NOT IN ('activo','robado','no_encontrado','dado_de_baja') OR (p_datos->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR jsonb_typeof(p_datos->'version') IS DISTINCT FROM 'number' OR (p_datos->>'version') !~ '^[1-9][0-9]{0,9}$' OR (p_datos->>'version')::numeric>=2147483647 THEN RAISE EXCEPTION 'Estado, bien o versión inválidos' USING ERRCODE='22023';END IF;
 id_bien:=(p_datos->>'id')::uuid;sol:=p_datos;
 SELECT * INTO repetida FROM public.cambios_estados_activo WHERE id=p_solicitud;
 IF FOUND THEN
  IF repetida.actor=p_actor AND repetida.solicitud=sol THEN RETURN jsonb_build_object('version',(repetida.despues->>'version')::integer,'fechaBaja',repetida.despues->>'fecha_baja','repetida',true);END IF;
  RAISE EXCEPTION 'Solicitud reutilizada' USING ERRCODE='P3001';
 END IF;
 IF clase='equipo' THEN SELECT to_jsonb(e) INTO anterior FROM public.equipos e WHERE e.id=id_bien FOR UPDATE;
 ELSE SELECT to_jsonb(c) INTO anterior FROM public.celulares c WHERE c.id=id_bien FOR UPDATE;END IF;
 IF anterior IS NULL THEN RAISE EXCEPTION 'Bien no disponible' USING ERRCODE='42501';END IF;
 IF anterior->>'estado_administrativo'='dado_de_baja' THEN RAISE EXCEPTION 'Registro histórico de solo lectura' USING ERRCODE='P3002';END IF;
 IF (anterior->>'version')::integer<>(p_datos->>'version')::integer THEN RAISE EXCEPTION 'El registro cambió' USING ERRCODE='P3001';END IF;
 IF anterior->>'custodia'='en_prestamo' THEN RAISE EXCEPTION 'Devuelve el préstamo antes de cambiar sus estados' USING ERRCODE='P2802';END IF;
 IF admin='activo' THEN
  IF condicion NOT IN ('','operativo','bodega_ti','mantencion','mal_estado','obsoleto') THEN RAISE EXCEPTION 'Selecciona una condición' USING ERRCODE='22023';END IF;
  IF clase='equipo' AND EXISTS(SELECT 1 FROM public.incidentes_robos_equipos d JOIN public.incidentes_robos i ON i.id=d.incidente_id WHERE d.equipo_id=id_bien AND i.estado IN ('reportado','validado') AND d.recuperado_fecha IS NULL) THEN RAISE EXCEPTION 'Resuelve el incidente antes de activar el bien' USING ERRCODE='P3004';END IF;
 ELSIF admin='dado_de_baja' THEN condicion:='obsoleto';
 ELSE condicion:='';END IF;
 IF clase='equipo' THEN
  UPDATE public.equipos SET estado_administrativo=admin,condicion_tecnica=condicion,fecha_baja=CASE WHEN admin='dado_de_baja' THEN CURRENT_TIMESTAMP END,version=version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=id_bien RETURNING to_jsonb(equipos) INTO posterior;
  INSERT INTO public.equipos_historial(equipo_id,actor,motivo,antes,despues) VALUES(id_bien,p_actor,'Actualización de estados del activo',anterior,posterior);
 ELSE
  UPDATE public.celulares SET estado_administrativo=admin,condicion_tecnica=condicion,fecha_baja=CASE WHEN admin='dado_de_baja' THEN CURRENT_TIMESTAMP END,version=version+1,actualizado_por=p_actor,actualizado_en=CURRENT_TIMESTAMP WHERE id=id_bien RETURNING to_jsonb(celulares) INTO posterior;
  INSERT INTO public.celulares_historial(celular_id,actor,motivo,antes,despues) VALUES(id_bien,p_actor,'Actualización de estados del activo',
   jsonb_build_object('sedeId',anterior->>'sede_id','condicionTecnica',anterior->>'condicion_tecnica','estadoAdministrativo',anterior->>'estado_administrativo','fechaBaja',anterior->>'fecha_baja'),
   jsonb_build_object('sedeId',posterior->>'sede_id','condicionTecnica',posterior->>'condicion_tecnica','estadoAdministrativo',posterior->>'estado_administrativo','fechaBaja',posterior->>'fecha_baja'));
 END IF;
 INSERT INTO public.cambios_estados_activo(id,equipo_id,celular_id,actor,solicitud,antes,despues) VALUES(p_solicitud,CASE WHEN clase='equipo' THEN id_bien END,CASE WHEN clase='celular' THEN id_bien END,p_actor,sol,anterior,posterior);
 RETURN jsonb_build_object('version',(posterior->>'version')::integer,'fechaBaja',posterior->>'fecha_baja','repetida',false);
END;$function$;
CREATE OR REPLACE FUNCTION public.guardar_ficha_directorio_acceso(p_actor text, p_sede uuid, p_datos jsonb, p_version integer, p_sede_version text, p_motivo text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE anterior public.directorio_sedes%ROWTYPE; posterior public.directorio_sedes%ROWTYPE;
 sede public.sedes%ROWTYPE; nueva_sede public.sedes%ROWTYPE; nombre text; rut text; correo text;
 nombres text; apellidos text; situacion text; observaciones text; cargo_asignado text; k text; suma integer; digito integer; esperado text;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'directorio_personas.editar');

 PERFORM pg_advisory_xact_lock(1793750400000);
 PERFORM 1 FROM public.usuarios_acceso u WHERE u.correo=p_actor AND u.activo AND public.rbac_rol_motor(u.correo) IN ('administrador','administrador_gestion') FOR SHARE;
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
$function$;
CREATE OR REPLACE FUNCTION public.guardar_foto_insumo_acceso(p_actor text, p_id uuid, p_mime text, p_contenido bytea)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 PERFORM public.rbac_exigir(p_actor,'catalogo_insumos.editar');

 PERFORM public.autorizar_insumos_utic(p_actor);
 IF p_id IS NULL OR p_mime NOT IN ('image/png','image/jpeg','image/webp') OR p_contenido IS NULL OR octet_length(p_contenido) NOT BETWEEN 12 AND 5242880 OR NOT ((p_mime='image/png' AND encode(substring(p_contenido FROM 1 FOR 8),'hex')='89504e470d0a1a0a') OR (p_mime='image/jpeg' AND encode(substring(p_contenido FROM 1 FOR 3),'hex')='ffd8ff') OR (p_mime='image/webp' AND substring(p_contenido FROM 1 FOR 4)=convert_to('RIFF','UTF8') AND substring(p_contenido FROM 9 FOR 4)=convert_to('WEBP','UTF8'))) THEN RAISE EXCEPTION 'Imagen inválida' USING ERRCODE='22023';END IF;
 INSERT INTO public.imagenes_insumos(id,mime,contenido,creado_por) VALUES(p_id,p_mime,p_contenido,p_actor);RETURN p_id;
END;$function$;
CREATE OR REPLACE FUNCTION public.guardar_fotografia_sede_acceso(p_actor text, p_id uuid, p_sede uuid, p_version integer, p_mime text, p_contenido bytea)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE usuario public.usuarios_acceso%ROWTYPE;s public.sedes%ROWTYPE;anterior public.fotografias_sedes%ROWTYPE;actual integer;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'fotos_sedes.editar');

 -- Mismo orden de bloqueo que la administración de usuarios: revalidar la cuenta.
 PERFORM pg_advisory_xact_lock(1793404800000);
 SELECT * INTO usuario FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND public.rbac_rol_motor(correo) IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND OR (public.rbac_rol_motor(usuario.correo)='encargado' AND usuario.sede_id IS DISTINCT FROM p_sede) THEN RAISE EXCEPTION 'Sin permiso para cambiar la fotografía' USING ERRCODE='42501';END IF;
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
CREATE OR REPLACE FUNCTION public.guardar_funcionario_nc_acceso(p_actor text, p_id uuid, p_datos jsonb, p_version integer, p_motivo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE anterior public.funcionarios_nc%ROWTYPE;posterior public.funcionarios_nc%ROWTYPE;
 nombre text;rut text;correo text;unidad text;subdireccion text;cargo text;fecha date;activo boolean;
 k text;suma integer;digito integer;esperado text;normalizado jsonb;previo jsonb;
BEGIN
 PERFORM public.rbac_exigir(p_actor,CASE WHEN p_version=0 THEN 'funcionarios.registrar' ELSE 'funcionarios.editar' END);

 PERFORM pg_advisory_xact_lock(1794009600000);
 PERFORM 1 FROM public.usuarios_acceso u WHERE u.correo=p_actor AND u.activo AND public.rbac_rol_motor(u.correo) IN ('administrador','administrador_gestion') FOR SHARE;
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
$function$;
CREATE OR REPLACE FUNCTION public.guardar_producto_insumo_acceso(p_actor text, p_solicitud uuid, p_datos jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE anterior public.catalogo_insumos%ROWTYPE;posterior public.catalogo_insumos%ROWTYPE;h public.insumos_historial%ROWTYPE;v_id uuid;k text;
BEGIN
 PERFORM public.rbac_exigir(p_actor,CASE WHEN COALESCE(p_datos->>'id','')='' THEN 'catalogo_insumos.registrar' ELSE 'catalogo_insumos.editar' END);

 PERFORM public.autorizar_insumos_utic(p_actor);
 IF p_solicitud IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_datos)t(k) WHERE t.k NOT IN ('id','codigo','nombre','categoria','unidad','activo','version')) THEN RAISE EXCEPTION 'Producto inválido' USING ERRCODE='22023';END IF;
 FOREACH k IN ARRAY ARRAY['codigo','nombre','categoria','unidad'] LOOP
  IF jsonb_typeof(p_datos->k) IS DISTINCT FROM 'string' OR length(btrim(p_datos->>k)) NOT BETWEEN 1 AND (CASE WHEN k='nombre' THEN 200 WHEN k='categoria' THEN 120 ELSE 60 END) OR (p_datos->>k) ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Datos de producto inválidos' USING ERRCODE='22023';END IF;
 END LOOP;
 IF jsonb_typeof(p_datos->'activo') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Estado inválido' USING ERRCODE='22023';END IF;
 SELECT * INTO h FROM public.insumos_historial WHERE id=p_solicitud;
 IF FOUND THEN IF h.actor=p_actor AND h.accion='producto' AND h.solicitud=p_datos THEN RETURN h.producto_id;END IF;RAISE EXCEPTION 'Solicitud reutilizada' USING ERRCODE='P3101';END IF;
 IF COALESCE(p_datos->>'id','')<>'' THEN
  v_id:=(p_datos->>'id')::uuid;SELECT * INTO anterior FROM public.catalogo_insumos WHERE id=v_id FOR UPDATE;
  IF NOT FOUND OR jsonb_typeof(p_datos->'version') IS DISTINCT FROM 'number' OR anterior.version<>(p_datos->>'version')::integer THEN RAISE EXCEPTION 'Producto cambió; recarga antes de editar' USING ERRCODE='P3101';END IF;
  IF anterior.unidad IS DISTINCT FROM btrim(p_datos->>'unidad') AND (EXISTS(SELECT 1 FROM public.stock_insumos WHERE producto_id=v_id AND (existencia<>0 OR reservado<>0)) OR EXISTS(SELECT 1 FROM public.solicitudes_insumos_detalle d JOIN public.solicitudes_insumos si ON si.id=d.solicitud_id WHERE d.producto_id=v_id AND si.estado IN ('solicitada','en_validacion','aprobada'))) THEN RAISE EXCEPTION 'La unidad no puede cambiar con stock o solicitudes en curso' USING ERRCODE='22023';END IF;
  UPDATE public.catalogo_insumos SET codigo=btrim(p_datos->>'codigo'),nombre=btrim(p_datos->>'nombre'),categoria=btrim(p_datos->>'categoria'),unidad=btrim(p_datos->>'unidad'),activo=(p_datos->>'activo')::boolean,version=version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=v_id RETURNING * INTO posterior;
 ELSE
  INSERT INTO public.catalogo_insumos(codigo,nombre,categoria,unidad,activo) VALUES(btrim(p_datos->>'codigo'),btrim(p_datos->>'nombre'),btrim(p_datos->>'categoria'),btrim(p_datos->>'unidad'),(p_datos->>'activo')::boolean) RETURNING * INTO posterior;v_id:=posterior.id;
 END IF;
 INSERT INTO public.stock_insumos(producto_id) VALUES(v_id) ON CONFLICT DO NOTHING;
 INSERT INTO public.insumos_historial(id,producto_id,actor,accion,solicitud,antes,despues) VALUES(p_solicitud,v_id,p_actor,'producto',p_datos,CASE WHEN anterior.id IS NOT NULL THEN to_jsonb(anterior) END,to_jsonb(posterior));RETURN v_id;
END;$function$;
CREATE OR REPLACE FUNCTION public.guardar_sede_acceso(p_actor text, p_id uuid, p_datos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  actor public.usuarios_acceso%ROWTYPE;
  anterior public.sedes%ROWTYPE;
  nuevo_id uuid;
  v_tipo text := p_datos->>'tipo';
  v_nombre text := p_datos->>'nombre';
  v_rbd text := p_datos->>'rbd';
  v_direccion text := p_datos->>'direccion';
  v_comuna text := p_datos->>'comuna';
  v_correo text := p_datos->>'correoInstitucional';
  v_activo text := p_datos->>'activo';
BEGIN
 PERFORM public.rbac_exigir(p_actor,CASE WHEN p_id IS NULL THEN 'sedes.registrar' ELSE 'sedes.editar' END);

  PERFORM pg_advisory_xact_lock(1793059200000);
  SELECT * INTO actor FROM public.usuarios_acceso WHERE correo = p_actor AND activo FOR SHARE;
  IF NOT FOUND OR public.rbac_rol_motor(actor.correo) NOT IN ('administrador', 'administrador_gestion') THEN
    RAISE EXCEPTION 'Actor sin autorización' USING ERRCODE = '42501';
  END IF;
  IF p_datos IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object'
     OR v_tipo IS NULL OR v_nombre IS NULL OR v_activo IS NULL THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE = '22023';
  END IF;
  IF length(v_nombre) > 200 OR btrim(v_nombre) <> v_nombre OR v_nombre ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE = '22023';
  END IF;
  IF v_tipo NOT IN ('nivel_central', 'establecimiento', 'jardin_infantil') THEN
    RAISE EXCEPTION 'Tipo de sede no reconocido' USING ERRCODE = '22023';
  END IF;
  IF v_tipo = 'nivel_central' AND v_rbd IS NOT NULL THEN
    RAISE EXCEPTION 'Nivel Central debe registrarse sin RBD' USING ERRCODE = '22023';
  END IF;
  IF v_rbd IS NOT NULL AND (length(v_rbd) > 30 OR btrim(v_rbd) <> v_rbd OR v_rbd ~ '[[:cntrl:]]' OR v_rbd = '') THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE = '22023';
  END IF;
  IF v_direccion IS NOT NULL AND (length(v_direccion) > 250 OR btrim(v_direccion) <> v_direccion OR v_direccion ~ '[[:cntrl:]]') THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE = '22023';
  END IF;
  IF v_comuna IS NOT NULL AND (length(v_comuna) > 100 OR btrim(v_comuna) <> v_comuna OR v_comuna ~ '[[:cntrl:]]') THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE = '22023';
  END IF;
  IF v_correo IS NOT NULL AND (length(v_correo) > 254 OR v_correo !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE = '22023';
  END IF;
  IF v_activo !~ '^(true|false)$' THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE = '22023';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.sedes (tipo, nombre, rbd, direccion, comuna, correo_institucional, activo)
    VALUES (v_tipo, v_nombre, NULLIF(btrim(v_rbd), ''), NULLIF(btrim(v_direccion), ''), NULLIF(btrim(v_comuna), ''), NULLIF(lower(btrim(v_correo)), ''), v_activo = 'true')
    RETURNING id INTO nuevo_id;
    RETURN jsonb_build_object('id', nuevo_id, 'creada', true);
  END IF;

  SELECT * INTO anterior FROM public.sedes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sede no disponible' USING ERRCODE = 'P1006';
  END IF;
  UPDATE public.sedes
     SET tipo = v_tipo, nombre = v_nombre, rbd = NULLIF(btrim(v_rbd), ''),
         direccion = NULLIF(btrim(v_direccion), ''), comuna = NULLIF(btrim(v_comuna), ''),
         correo_institucional = NULLIF(lower(btrim(v_correo)), ''), activo = (v_activo = 'true')
   WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id, 'creada', false);
END;
$function$;
CREATE OR REPLACE FUNCTION public.guardar_sede_directorio_acceso(p_actor text, p_sede uuid, p_datos jsonb, p_sede_version text, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE anterior public.sedes%ROWTYPE;posterior public.sedes%ROWTYPE;director public.directorio_sedes%ROWTYPE;k text;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'directorio_institucional.editar');

 PERFORM pg_advisory_xact_lock(1793750400000);
 PERFORM 1 FROM public.usuarios_acceso u WHERE u.correo=p_actor AND u.activo AND public.rbac_rol_motor(u.correo) IN ('administrador','administrador_gestion') FOR SHARE;
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
$function$;
CREATE OR REPLACE FUNCTION public.guardar_usuario_acceso(p_actor text, p_correo text, p_nombre text, p_rol text, p_activo boolean, p_version integer)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
  SELECT public.guardar_usuario_acceso(p_actor, p_correo, p_nombre, p_rol, p_activo, p_version, NULL::uuid);
$function$;
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
 PERFORM public.rbac_exigir(p_actor,'usuarios_operativos.administrar');
 PERFORM public.rbac_validar_usuario(p_actor,p_correo,p_rol,p_activo);

  -- Mismo bloqueo que la versión anterior; revalidar al actor tras adquirirlo.
  PERFORM pg_advisory_xact_lock(1793404800000);
  SELECT public.rbac_rol_motor(p_actor) INTO actor_rol FROM public.usuarios_acceso
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
$function$;
CREATE OR REPLACE FUNCTION public.importar_foto_insumo_acceso(p_actor text, p_producto uuid, p_imagen uuid, p_url_anterior text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 PERFORM public.rbac_exigir(p_actor,'catalogo_insumos.editar');

 PERFORM public.autorizar_insumos_utic(p_actor);
 PERFORM 1 FROM public.catalogo_insumos WHERE id=p_producto AND foto_url=p_url_anterior FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'La referencia de foto cambió' USING ERRCODE='P3101';END IF;
 PERFORM public.asignar_foto_insumo_acceso(p_actor,p_producto,p_imagen);
END;$function$;
CREATE OR REPLACE FUNCTION public.ingresar_stock_insumo_acceso(p_actor text, p_solicitud uuid, p_producto uuid, p_cantidad integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE h public.insumos_historial%ROWTYPE;antes jsonb;despues jsonb;sol jsonb;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'stock_insumos.registrar');

 PERFORM public.autorizar_insumos_utic(p_actor);
 IF p_solicitud IS NULL OR p_producto IS NULL OR p_cantidad IS NULL OR p_cantidad NOT BETWEEN 1 AND 100000 THEN RAISE EXCEPTION 'Ingreso inválido' USING ERRCODE='22023';END IF;
 sol:=jsonb_build_object('producto',p_producto,'cantidad',p_cantidad);SELECT * INTO h FROM public.insumos_historial WHERE id=p_solicitud;
 IF FOUND THEN IF h.actor=p_actor AND h.accion='stock' AND h.solicitud=sol THEN RETURN jsonb_build_object('repetida',true);END IF;RAISE EXCEPTION 'Solicitud reutilizada' USING ERRCODE='P3101';END IF;
 PERFORM 1 FROM public.catalogo_insumos WHERE id=p_producto AND activo FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Producto no disponible' USING ERRCODE='P3102';END IF;
 SELECT to_jsonb(s) INTO antes FROM public.stock_insumos s WHERE producto_id=p_producto FOR UPDATE;
 UPDATE public.stock_insumos SET existencia=existencia+p_cantidad,actualizado_en=CURRENT_TIMESTAMP WHERE producto_id=p_producto RETURNING to_jsonb(stock_insumos) INTO despues;
 IF NOT FOUND THEN RAISE EXCEPTION 'Producto sin stock registrado' USING ERRCODE='P3102';END IF;
 INSERT INTO public.insumos_historial(id,producto_id,actor,accion,solicitud,antes,despues) VALUES(p_solicitud,p_producto,p_actor,'stock',sol,antes,despues);RETURN jsonb_build_object('repetida',false);
END;$function$;
CREATE OR REPLACE FUNCTION public.iniciar_envio_acta_acceso(p_actor text, p_id uuid, p_acta uuid, p_destinos text[], p_remitente text, p_revisado boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE previo public.actas_envios%ROWTYPE;token uuid;destinos text[];x text;
BEGIN
 IF NOT public.rbac_acta_autorizada(p_actor,p_acta,'enviar') THEN RAISE EXCEPTION 'Documento fuera del alcance autorizado' USING ERRCODE='42501';END IF;

 PERFORM public.rbac_exigir(p_actor,CASE WHEN EXISTS(SELECT 1 FROM public.actas_documentos WHERE id=p_acta AND solicitud_insumo_id IS NOT NULL) THEN 'actas_insumos.enviar' ELSE 'actas.enviar' END);

 PERFORM pg_advisory_xact_lock(1794355200000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND (public.rbac_rol_motor(correo) IN ('administrador','administrador_gestion') OR (public.rbac_rol_motor(correo)='gestor_insumos' AND EXISTS(SELECT 1 FROM public.actas_documentos a WHERE a.id=p_acta AND a.solicitud_insumo_id IS NOT NULL AND a.entrega_insumo_id IS NOT NULL))) FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
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
END;$function$;
CREATE OR REPLACE FUNCTION public.mover_bien_acceso(p_actor text, p_id uuid, p_datos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE anterior public.movimientos_inventario%ROWTYPE;eq public.equipos%ROWTYPE;cel public.celulares%ROWTYPE;sede public.sedes%ROWTYPE;sede_previa public.sedes%ROWTYPE;
 tipo text;accion text;id_bien uuid;destino uuid;fecha date;receptor text;motivo text;version integer;custodia text;referencia uuid;antes jsonb;despues jsonb;solicitud jsonb;ultima date;k text;actual integer;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'movimientos.confirmar');

 PERFORM pg_advisory_xact_lock(1793577600000);
 PERFORM pg_advisory_xact_lock(1794268800000);
 PERFORM 1 FROM public.usuarios_acceso u WHERE u.correo=p_actor AND u.activo AND public.rbac_rol_motor(u.correo) IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_datos)t(k) WHERE t.k NOT IN ('tipo','bienId','accion','destino','fecha','receptor','motivo','version')) THEN RAISE EXCEPTION 'Solicitud inválida' USING ERRCODE='22023';END IF;
 FOREACH k IN ARRAY ARRAY['tipo','bienId','accion','destino','fecha','receptor','motivo'] LOOP
  IF jsonb_typeof(p_datos->k) IS DISTINCT FROM 'string' OR (p_datos->>k) ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Campo inválido' USING ERRCODE='22023';END IF;
 END LOOP;
 tipo:=p_datos->>'tipo';accion:=p_datos->>'accion';
 IF tipo NOT IN ('equipo','celular') OR accion NOT IN ('devolucion','asignacion','traspaso') OR jsonb_typeof(p_datos->'version') IS DISTINCT FROM 'number' OR (p_datos->>'version') !~ '^[1-9][0-9]{0,9}$' OR (p_datos->>'version')::numeric>=2147483647 THEN RAISE EXCEPTION 'Tipo o versión inválidos' USING ERRCODE='22023';END IF;
 IF (p_datos->>'bienId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Bien inválido' USING ERRCODE='22023';END IF;
 id_bien:=(p_datos->>'bienId')::uuid;version:=(p_datos->>'version')::integer;receptor:=normalize(btrim(p_datos->>'receptor'),NFC);motivo:=normalize(btrim(p_datos->>'motivo'),NFC);
 IF length(receptor) NOT BETWEEN 1 AND 200 OR length(motivo)>500 OR (p_datos->>'fecha') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Receptor, motivo o fecha inválidos' USING ERRCODE='22023';END IF;
 BEGIN fecha:=(p_datos->>'fecha')::date;EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'Fecha inválida' USING ERRCODE='22023';END;
 IF fecha<DATE '1900-01-01' OR fecha>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date OR to_char(fecha,'YYYY-MM-DD')<>p_datos->>'fecha' THEN RAISE EXCEPTION 'Fecha inválida' USING ERRCODE='22023';END IF;
 IF accion IN ('asignacion','traspaso') THEN
  IF (p_datos->>'destino') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Destino inválido' USING ERRCODE='22023';END IF;
  destino:=(p_datos->>'destino')::uuid;
 ELSIF p_datos->>'destino'<>'' THEN RAISE EXCEPTION 'Una devolución tiene como destino Bodega TI' USING ERRCODE='22023';END IF;
 solicitud:=jsonb_build_object('tipo',tipo,'bienId',id_bien,'accion',accion,'destino',COALESCE(destino::text,''),'fecha',to_char(fecha,'YYYY-MM-DD'),'receptor',receptor,'motivo',motivo,'version',version);
 SELECT * INTO anterior FROM public.movimientos_inventario WHERE id=p_id;
 IF FOUND THEN
  IF anterior.actor=p_actor AND anterior.solicitud=solicitud THEN RETURN jsonb_build_object('id',p_id,'repetida',true);END IF;
  RAISE EXCEPTION 'La solicitud ya se utilizó' USING ERRCODE='P2601';
 END IF;
 IF destino IS NOT NULL THEN SELECT * INTO sede FROM public.sedes WHERE id=destino AND activo FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Destino no disponible' USING ERRCODE='P2604';END IF;END IF;
 IF tipo='equipo' THEN
  SELECT * INTO eq FROM public.equipos WHERE id=id_bien FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Bien no disponible' USING ERRCODE='P2604';END IF;
  IF EXISTS(SELECT 1 FROM public.incidentes_robos_equipos d JOIN public.incidentes_robos i ON i.id=d.incidente_id WHERE d.equipo_id=id_bien AND i.estado IN ('reportado','validado') AND d.recuperado_fecha IS NULL) THEN RAISE EXCEPTION 'Existe un incidente abierto' USING ERRCODE='P2605';END IF;
  custodia:=eq.custodia;actual:=eq.version;referencia:=eq.sede_id;antes:=to_jsonb(eq)||jsonb_build_object('ubicacionBodega',(SELECT nombre FROM public.ubicaciones_bodega WHERE id=eq.ubicacion_bodega_id));
 ELSE
  SELECT * INTO cel FROM public.celulares WHERE id=id_bien FOR UPDATE;IF NOT FOUND OR NOT cel.activo THEN RAISE EXCEPTION 'Bien no disponible' USING ERRCODE='P2604';END IF;
  custodia:=cel.custodia;actual:=cel.version;referencia:=cel.sede_id;
  antes:=jsonb_build_object('estadoAdministrativo',cel.estado_administrativo,'fechaBaja',cel.fecha_baja,'sedeId',cel.sede_id,'telefono',cel.telefono,'marca',cel.marca,'modelo',cel.modelo,'imei',COALESCE(cel.imei,''),'inventario',COALESCE(cel.numero_inventario,''),'condicionTecnica',cel.condicion_tecnica,'responsable',cel.responsable,'observaciones',cel.observaciones,'activo',cel.activo,'custodia',cel.custodia,'ubicacionBodegaId',cel.ubicacion_bodega_id,'ubicacionBodega',(SELECT nombre FROM public.ubicaciones_bodega WHERE id=cel.ubicacion_bodega_id));
 END IF;
 IF version<>actual THEN RAISE EXCEPTION 'El bien cambió' USING ERRCODE='P2601';END IF;
 IF (accion='asignacion' AND custodia<>'en_bodega') OR (accion IN ('devolucion','traspaso') AND custodia<>'asignado') THEN RAISE EXCEPTION 'El estado no permite este movimiento' USING ERRCODE='P2602';END IF;
 SELECT max(m.fecha) INTO ultima FROM public.movimientos_inventario m WHERE (tipo='equipo' AND m.equipo_id=id_bien) OR (tipo='celular' AND m.celular_id=id_bien);
 IF ultima IS NOT NULL AND fecha<ultima THEN RAISE EXCEPTION 'La fecha es anterior al último movimiento' USING ERRCODE='22023';END IF;
 SELECT * INTO sede_previa FROM public.sedes WHERE id=referencia FOR SHARE;
 IF accion='traspaso' AND (sede_previa.tipo NOT IN ('establecimiento','jardin_infantil') OR sede.tipo NOT IN ('establecimiento','jardin_infantil') OR NOT sede_previa.activo OR referencia=destino) THEN RAISE EXCEPTION 'Los traspasos de Nivel Central pasan por Bodega TI' USING ERRCODE='P2901';END IF;
 IF tipo='equipo' THEN
  IF accion='devolucion' THEN UPDATE public.equipos SET custodia='en_bodega',version=equipos.version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=id_bien RETURNING * INTO eq;
  ELSE UPDATE public.equipos SET sede_id=destino,custodia='asignado',situacion=CASE WHEN sede.tipo='nivel_central' THEN 'registrado_nc' ELSE 'recibido' END,fecha_entrega=fecha,enlace_acta=NULL,version=equipos.version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=id_bien RETURNING * INTO eq;END IF;
  despues:=to_jsonb(eq)||jsonb_build_object('ubicacionBodega',(SELECT nombre FROM public.ubicaciones_bodega WHERE id=eq.ubicacion_bodega_id));
 ELSE
  IF accion='devolucion' THEN UPDATE public.celulares SET custodia='en_bodega',responsable='',version=celulares.version+1,actualizado_por=p_actor,actualizado_en=CURRENT_TIMESTAMP WHERE id=id_bien RETURNING * INTO cel;
  ELSE UPDATE public.celulares SET sede_id=destino,custodia='asignado',responsable=receptor,version=celulares.version+1,actualizado_por=p_actor,actualizado_en=CURRENT_TIMESTAMP WHERE id=id_bien RETURNING * INTO cel;END IF;
  despues:=jsonb_build_object('estadoAdministrativo',cel.estado_administrativo,'fechaBaja',cel.fecha_baja,'sedeId',cel.sede_id,'telefono',cel.telefono,'marca',cel.marca,'modelo',cel.modelo,'imei',COALESCE(cel.imei,''),'inventario',COALESCE(cel.numero_inventario,''),'condicionTecnica',cel.condicion_tecnica,'responsable',cel.responsable,'observaciones',cel.observaciones,'activo',cel.activo,'custodia',cel.custodia,'ubicacionBodegaId',cel.ubicacion_bodega_id,'ubicacionBodega',(SELECT nombre FROM public.ubicaciones_bodega WHERE id=cel.ubicacion_bodega_id));
 END IF;
 antes:=antes||jsonb_build_object('sedeNombre',sede_previa.nombre,'rbd',sede_previa.rbd,'sedeTipo',sede_previa.tipo,'direccion',sede_previa.direccion,'comuna',sede_previa.comuna,'correoInstitucional',sede_previa.correo_institucional);
 IF accion='devolucion' THEN sede:=sede_previa;END IF;
 despues:=despues||jsonb_build_object('sedeTipo',sede.tipo,'direccion',sede.direccion,'comuna',sede.comuna,'correoInstitucional',sede.correo_institucional,'categoriaNombre',CASE WHEN tipo='equipo' THEN (SELECT c.nombre FROM public.categorias_bienes c WHERE c.id=eq.categoria_id) ELSE 'Celular' END,'sedeNombre',CASE WHEN accion IN ('asignacion','traspaso') THEN sede.nombre ELSE sede_previa.nombre END,'rbd',CASE WHEN accion IN ('asignacion','traspaso') THEN sede.rbd ELSE sede_previa.rbd END);
 INSERT INTO public.movimientos_inventario(id,equipo_id,celular_id,accion,fecha,receptor,origen_sede_id,destino_sede_id,actor,motivo,solicitud,antes,despues)
 VALUES(p_id,CASE WHEN tipo='equipo' THEN id_bien END,CASE WHEN tipo='celular' THEN id_bien END,accion,fecha,receptor,CASE WHEN accion IN ('devolucion','traspaso') THEN referencia END,destino,p_actor,motivo,solicitud,antes,despues);
 IF tipo='equipo' THEN INSERT INTO public.equipos_historial(equipo_id,actor,motivo,antes,despues,movimiento_id) VALUES(id_bien,p_actor,COALESCE(NULLIF(motivo,''),CASE WHEN accion IN ('asignacion','traspaso') THEN CASE WHEN accion='traspaso' THEN 'Traspaso directo entre sedes educativas' ELSE 'Asignación desde Bodega TI' END ELSE 'Devolución a Bodega TI' END),antes,despues,p_id);
 ELSE INSERT INTO public.celulares_historial(celular_id,actor,motivo,antes,despues,movimiento_id) VALUES(id_bien,p_actor,COALESCE(NULLIF(motivo,''),CASE WHEN accion IN ('asignacion','traspaso') THEN CASE WHEN accion='traspaso' THEN 'Traspaso directo entre sedes educativas' ELSE 'Asignación desde Bodega TI' END ELSE 'Devolución a Bodega TI' END),antes,despues,p_id);END IF;
 RETURN jsonb_build_object('id',p_id,'repetida',false);
END;$function$;
CREATE OR REPLACE FUNCTION public.mover_operacion_acceso(p_actor text, p_id uuid, p_datos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE k text;g text;l jsonb;sol jsonb;lineas jsonb;canon jsonb;paso jsonb;ids uuid[]:='{}';movs uuid[]:='{}';
 anterior public.operaciones_inventario%ROWTYPE;origen public.sedes%ROWTYPE;destino public.sedes%ROWTYPE;
 referencia uuid;primera uuid;actual integer;custodia text;custodia_inicial text;directa boolean;res jsonb;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'movimientos.confirmar');

 PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1794268800000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND public.rbac_rol_motor(correo) IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_datos) t(k) WHERE t.k NOT IN ('tipo','clase','destino','fecha','receptor','receptorDevolucion','motivo','devoluciones','entregas','detalleDevueltos','detalleEntregados')) THEN RAISE EXCEPTION 'Solicitud inválida' USING ERRCODE='22023';END IF;
 sol:='{}';
 FOREACH k IN ARRAY ARRAY['tipo','clase','destino','fecha','receptor','receptorDevolucion','motivo','detalleDevueltos','detalleEntregados'] LOOP
  IF jsonb_typeof(p_datos->k) IS DISTINCT FROM 'string' OR length(p_datos->>k)>(CASE WHEN k LIKE 'detalle%' THEN 1000 WHEN k='motivo' THEN 500 WHEN k IN ('receptor','receptorDevolucion') THEN 200 ELSE 50 END) OR (CASE WHEN k LIKE 'detalle%' THEN replace(replace(replace(p_datos->>k,chr(13),''),chr(10),''),chr(9),'') ELSE p_datos->>k END) ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Campo inválido' USING ERRCODE='22023';END IF;
  sol:=sol||jsonb_build_object(k,normalize(btrim(p_datos->>k),NFC));
 END LOOP;
 IF sol->>'tipo' NOT IN ('cambio','traspaso') OR sol->>'clase' NOT IN ('equipo','celular') OR sol->>'destino' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR sol->>'receptor'='' OR (sol->>'tipo'='cambio' AND sol->>'receptorDevolucion'='') THEN RAISE EXCEPTION 'Tipo o participantes inválidos' USING ERRCODE='22023';END IF;
 sol:=sol||jsonb_build_object('destino',(sol->>'destino')::uuid);
 FOREACH g IN ARRAY ARRAY['devoluciones','entregas'] LOOP
  lineas:=p_datos->g;IF jsonb_typeof(lineas) IS DISTINCT FROM 'array' OR jsonb_array_length(lineas)>100 THEN RAISE EXCEPTION 'Hasta 100 bienes por grupo' USING ERRCODE='22023';END IF;
  canon:='[]';
  FOR l IN SELECT value FROM jsonb_array_elements(lineas) LOOP
   IF jsonb_typeof(l) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Línea inválida' USING ERRCODE='22023';END IF;
   IF (SELECT array_agg(t.k ORDER BY t.k) FROM jsonb_object_keys(l)t(k)) IS DISTINCT FROM ARRAY['id','movimientoId','version'] OR jsonb_typeof(l->'id') IS DISTINCT FROM 'string' OR jsonb_typeof(l->'movimientoId') IS DISTINCT FROM 'string' OR l->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR l->>'movimientoId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR jsonb_typeof(l->'version') IS DISTINCT FROM 'number' OR l->>'version' !~ '^[1-9][0-9]{0,9}$' OR (l->>'version')::numeric>=2147483647 THEN RAISE EXCEPTION 'Identificación o versión inválida' USING ERRCODE='22023';END IF;
   IF (l->>'id')::uuid=ANY(ids) OR (l->>'movimientoId')::uuid=ANY(movs) OR (l->>'movimientoId')::uuid=p_id THEN RAISE EXCEPTION 'Bien o movimiento repetido' USING ERRCODE='22023';END IF;
   ids:=array_append(ids,(l->>'id')::uuid);movs:=array_append(movs,(l->>'movimientoId')::uuid);
   canon:=canon||jsonb_build_array(jsonb_build_object('id',(l->>'id')::uuid,'movimientoId',(l->>'movimientoId')::uuid,'version',(l->>'version')::integer));
  END LOOP;
  SELECT COALESCE(jsonb_agg(value ORDER BY value->>'id'),'[]') INTO canon FROM jsonb_array_elements(canon);
  sol:=sol||jsonb_build_object(g,canon);
 END LOOP;
 IF jsonb_array_length(sol->'entregas')=0 OR (sol->>'tipo'='cambio' AND jsonb_array_length(sol->'devoluciones')=0) OR (sol->>'tipo'='traspaso' AND (jsonb_array_length(sol->'devoluciones')<>0 OR sol->>'receptorDevolucion'<>'' OR sol->>'detalleDevueltos'<>'')) THEN RAISE EXCEPTION 'Grupos inválidos' USING ERRCODE='22023';END IF;
 SELECT * INTO anterior FROM public.operaciones_inventario WHERE id=p_id;
 IF FOUND THEN IF anterior.actor=p_actor AND anterior.solicitud=sol THEN RETURN jsonb_build_object('id',p_id,'repetida',true);END IF;RAISE EXCEPTION 'Solicitud repetida con otros datos' USING ERRCODE='P2601';END IF;
 IF EXISTS(SELECT 1 FROM public.movimientos_inventario WHERE id=ANY(movs)) THEN RAISE EXCEPTION 'Movimiento ya utilizado' USING ERRCODE='P2601';END IF;
 SELECT * INTO destino FROM public.sedes WHERE id=(sol->>'destino')::uuid AND activo FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Destino no disponible' USING ERRCODE='P2604';END IF;
 -- Todos los bienes de un grupo de traspaso tienen igual procedencia y ruta.
 FOR l IN SELECT value FROM jsonb_array_elements(CASE WHEN sol->>'tipo'='cambio' THEN sol->'devoluciones' ELSE sol->'entregas' END) LOOP
  IF sol->>'clase'='equipo' THEN SELECT e.sede_id,e.custodia,e.version INTO referencia,custodia,actual FROM public.equipos e WHERE e.id=(l->>'id')::uuid FOR UPDATE;
  ELSE SELECT c.sede_id,c.custodia,c.version INTO referencia,custodia,actual FROM public.celulares c WHERE c.id=(l->>'id')::uuid FOR UPDATE;END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bien no disponible' USING ERRCODE='P2604';END IF;
  IF actual<>(l->>'version')::integer THEN RAISE EXCEPTION 'El bien cambió' USING ERRCODE='P2601';END IF;
  IF primera IS NULL THEN primera:=referencia;custodia_inicial:=custodia;END IF;
  IF referencia<>primera OR custodia<>custodia_inicial THEN RAISE EXCEPTION 'Selecciona bienes de una misma procedencia y ruta' USING ERRCODE='P2901';END IF;
 END LOOP;
 SELECT * INTO origen FROM public.sedes WHERE id=primera FOR SHARE;
 directa:=sol->>'tipo'='traspaso' AND custodia_inicial='asignado';
 IF sol->>'tipo'='cambio' THEN
  IF primera<>destino.id OR custodia_inicial<>'asignado' THEN RAISE EXCEPTION 'El cambio devuelve bienes asignados a la sede receptora' USING ERRCODE='P2901';END IF;
 ELSE
  IF primera=destino.id OR custodia_inicial NOT IN ('en_bodega','asignado') OR (directa AND (origen.tipo NOT IN ('establecimiento','jardin_infantil') OR destino.tipo NOT IN ('establecimiento','jardin_infantil'))) THEN RAISE EXCEPTION 'Nivel Central requiere paso por Bodega TI; entre sedes educativas se admite directo' USING ERRCODE='P2901';END IF;
 END IF;
 INSERT INTO public.operaciones_inventario(id,tipo,clase,actor,origen_sede_id,destino_sede_id,directa,solicitud,datos)
 VALUES(p_id,sol->>'tipo',sol->>'clase',p_actor,primera,destino.id,directa,sol,jsonb_build_object('origen',to_jsonb(origen),'destino',to_jsonb(destino)));
 FOREACH g IN ARRAY ARRAY['devoluciones','entregas'] LOOP
  FOR l IN SELECT value FROM jsonb_array_elements(sol->g) LOOP
   paso:=jsonb_build_object('tipo',sol->>'clase','bienId',l->>'id','accion',CASE WHEN g='devoluciones' THEN 'devolucion' WHEN directa THEN 'traspaso' ELSE 'asignacion' END,'destino',CASE WHEN g='devoluciones' THEN '' ELSE destino.id::text END,'fecha',sol->>'fecha','receptor',CASE WHEN g='devoluciones' THEN sol->>'receptorDevolucion' ELSE sol->>'receptor' END,'motivo',sol->>'motivo','version',l->'version');
   res:=public.mover_bien_acceso(p_actor,(l->>'movimientoId')::uuid,paso);
   IF COALESCE((res->>'repetida')::boolean,false) THEN RAISE EXCEPTION 'Movimiento reutilizado' USING ERRCODE='P2601';END IF;
   INSERT INTO public.operaciones_inventario_detalle(operacion_id,movimiento_id,grupo) VALUES(p_id,(l->>'movimientoId')::uuid,CASE WHEN g='devoluciones' THEN 'devolucion' ELSE 'entrega' END);
  END LOOP;
 END LOOP;
 RETURN jsonb_build_object('id',p_id,'repetida',false);
END;$function$;
CREATE OR REPLACE FUNCTION public.mover_prestamo_acceso(p_actor text, p_id uuid, p_datos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE tipo text;accion text;id_bien uuid;destino uuid;fecha date;limite date;version integer;prestamo_id uuid;
 receptor text;motivo text;k text;solicitud jsonb;anterior public.movimientos_inventario%ROWTYPE;prestamo public.prestamos_inventario%ROWTYPE;
 eq public.equipos%ROWTYPE;cel public.celulares%ROWTYPE;origen public.sedes%ROWTYPE;sede public.sedes%ROWTYPE;
 antes jsonb;despues jsonb;custodia text;referencia uuid;ultima date;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'prestamos.confirmar');

 PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1794268800000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND public.rbac_rol_motor(correo) IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_datos)t(k) WHERE t.k NOT IN ('tipo','bienId','accion','destino','fecha','receptor','motivo','version','fechaLimite','prestamoId')) THEN RAISE EXCEPTION 'Solicitud inválida' USING ERRCODE='22023';END IF;
 FOREACH k IN ARRAY ARRAY['tipo','bienId','accion','destino','fecha','receptor','motivo','fechaLimite','prestamoId'] LOOP
  IF jsonb_typeof(p_datos->k) IS DISTINCT FROM 'string' OR (p_datos->>k) ~ '[[:cntrl:]]' OR length(p_datos->>k)>(CASE WHEN k='motivo' THEN 500 WHEN k='receptor' THEN 200 ELSE 50 END) THEN RAISE EXCEPTION 'Campo inválido' USING ERRCODE='22023';END IF;
 END LOOP;
 tipo:=p_datos->>'tipo';accion:=p_datos->>'accion';
 IF tipo NOT IN ('equipo','celular') OR accion NOT IN ('prestamo','devolucion_prestamo') OR jsonb_typeof(p_datos->'version') IS DISTINCT FROM 'number' OR (p_datos->>'version') !~ '^[1-9][0-9]{0,9}$' OR (p_datos->>'version')::numeric>=2147483647 THEN RAISE EXCEPTION 'Tipo o versión inválidos' USING ERRCODE='22023';END IF;
 IF (p_datos->>'bienId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Bien inválido' USING ERRCODE='22023';END IF;
 id_bien:=(p_datos->>'bienId')::uuid;version:=(p_datos->>'version')::integer;receptor:=normalize(btrim(p_datos->>'receptor'),NFC);motivo:=normalize(btrim(p_datos->>'motivo'),NFC);
 IF receptor='' OR (p_datos->>'fecha') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Receptor o fecha inválidos' USING ERRCODE='22023';END IF;
 BEGIN fecha:=(p_datos->>'fecha')::date;EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'Fecha inválida' USING ERRCODE='22023';END;
 IF fecha<DATE '1900-01-01' OR fecha>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date OR to_char(fecha,'YYYY-MM-DD')<>p_datos->>'fecha' THEN RAISE EXCEPTION 'Fecha inválida' USING ERRCODE='22023';END IF;
 IF accion='prestamo' THEN
  IF p_datos->>'prestamoId'<>'' OR (p_datos->>'destino') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR (p_datos->>'fechaLimite') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Destino o límite inválido' USING ERRCODE='22023';END IF;
  destino:=(p_datos->>'destino')::uuid;
  BEGIN limite:=(p_datos->>'fechaLimite')::date;EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RAISE EXCEPTION 'Límite inválido' USING ERRCODE='22023';END;
  IF limite<fecha OR to_char(limite,'YYYY-MM-DD')<>p_datos->>'fechaLimite' THEN RAISE EXCEPTION 'Límite inválido' USING ERRCODE='22023';END IF;
 ELSE
  IF p_datos->>'destino'<>'' OR p_datos->>'fechaLimite'<>'' OR (p_datos->>'prestamoId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Préstamo inválido' USING ERRCODE='22023';END IF;
  prestamo_id:=(p_datos->>'prestamoId')::uuid;
 END IF;
 solicitud:=jsonb_build_object('tipo',tipo,'bienId',id_bien,'accion',accion,'destino',COALESCE(destino::text,''),'fecha',to_char(fecha,'YYYY-MM-DD'),'receptor',receptor,'motivo',motivo,'version',version,'fechaLimite',COALESCE(to_char(limite,'YYYY-MM-DD'),''),'prestamoId',COALESCE(prestamo_id::text,''));
 SELECT * INTO anterior FROM public.movimientos_inventario WHERE id=p_id;
 IF FOUND THEN IF anterior.actor=p_actor AND anterior.solicitud=solicitud THEN RETURN jsonb_build_object('id',p_id,'repetida',true);END IF;RAISE EXCEPTION 'Solicitud repetida con otros datos' USING ERRCODE='P2601';END IF;
 IF tipo='equipo' THEN
  SELECT * INTO eq FROM public.equipos WHERE id=id_bien FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Bien no disponible' USING ERRCODE='P2604';END IF;
  IF eq.version<>version THEN RAISE EXCEPTION 'Versión obsoleta' USING ERRCODE='P2601';END IF;
  IF EXISTS(SELECT 1 FROM public.incidentes_robos_equipos d JOIN public.incidentes_robos i ON i.id=d.incidente_id WHERE d.equipo_id=id_bien AND i.estado IN ('reportado','validado') AND d.recuperado_fecha IS NULL) THEN RAISE EXCEPTION 'Incidente abierto' USING ERRCODE='P2605';END IF;
  custodia:=eq.custodia;referencia:=eq.sede_id;antes:=to_jsonb(eq);
 ELSE
  SELECT * INTO cel FROM public.celulares WHERE id=id_bien FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Bien no disponible' USING ERRCODE='P2604';END IF;
  IF cel.version<>version THEN RAISE EXCEPTION 'Versión obsoleta' USING ERRCODE='P2601';END IF;
  IF accion='prestamo' AND NOT cel.activo THEN RAISE EXCEPTION 'Celular archivado' USING ERRCODE='P2604';END IF;
  custodia:=cel.custodia;referencia:=cel.sede_id;antes:=to_jsonb(cel);
 END IF;
 SELECT max(m.fecha) INTO ultima FROM public.movimientos_inventario m WHERE (tipo='equipo' AND m.equipo_id=id_bien) OR (tipo='celular' AND m.celular_id=id_bien);
 IF ultima IS NOT NULL AND fecha<ultima THEN RAISE EXCEPTION 'Fecha anterior al último movimiento' USING ERRCODE='22023';END IF;
 SELECT * INTO origen FROM public.sedes WHERE id=referencia FOR SHARE;
 IF accion='prestamo' THEN
  IF NOT origen.activo THEN RAISE EXCEPTION 'Origen no disponible' USING ERRCODE='P2604';END IF;
  IF custodia<>'en_bodega' OR EXISTS(SELECT 1 FROM public.prestamos_inventario p WHERE p.estado='abierto' AND ((tipo='equipo' AND p.equipo_id=id_bien) OR (tipo='celular' AND p.celular_id=id_bien))) THEN RAISE EXCEPTION 'Solo se presta desde Bodega TI' USING ERRCODE='P2802';END IF;
  SELECT * INTO sede FROM public.sedes WHERE id=destino AND activo FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Destino no disponible' USING ERRCODE='P2604';END IF;
 ELSE
  SELECT * INTO prestamo FROM public.prestamos_inventario WHERE id=prestamo_id FOR UPDATE;
  IF NOT FOUND OR prestamo.estado<>'abierto' OR prestamo.origen_sede_id<>referencia OR (tipo='equipo' AND prestamo.equipo_id IS DISTINCT FROM id_bien) OR (tipo='celular' AND prestamo.celular_id IS DISTINCT FROM id_bien) OR custodia<>'en_prestamo' OR fecha<prestamo.fecha_salida THEN RAISE EXCEPTION 'Préstamo no corresponde al bien o ya está cerrado' USING ERRCODE='P2801';END IF;
 END IF;
 IF tipo='equipo' THEN UPDATE public.equipos SET custodia=CASE WHEN accion='prestamo' THEN 'en_prestamo' ELSE 'en_bodega' END,version=equipos.version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=id_bien RETURNING * INTO eq;despues:=to_jsonb(eq);
 ELSE UPDATE public.celulares SET custodia=CASE WHEN accion='prestamo' THEN 'en_prestamo' ELSE 'en_bodega' END,version=celulares.version+1,actualizado_por=p_actor,actualizado_en=CURRENT_TIMESTAMP WHERE id=id_bien RETURNING * INTO cel;despues:=to_jsonb(cel);END IF;
 antes:=antes||jsonb_build_object('sedeId',referencia,'sedeNombre',origen.nombre,'rbd',origen.rbd,'sedeTipo',origen.tipo);
 despues:=despues||jsonb_build_object('sedeId',referencia,'sedeNombre',origen.nombre,'rbd',origen.rbd,'sedeTipo',origen.tipo,'categoriaNombre',CASE WHEN tipo='equipo' THEN (SELECT nombre FROM public.categorias_bienes WHERE id=eq.categoria_id) ELSE 'Celular' END,'prestamoId',CASE WHEN accion='prestamo' THEN p_id ELSE prestamo.id END,'destinoPrestamoNombre',CASE WHEN accion='prestamo' THEN sede.nombre ELSE prestamo.datos_destino->>'nombre' END);
 INSERT INTO public.movimientos_inventario(id,equipo_id,celular_id,accion,fecha,receptor,origen_sede_id,destino_sede_id,actor,motivo,solicitud,antes,despues)
 VALUES(p_id,CASE WHEN tipo='equipo' THEN id_bien END,CASE WHEN tipo='celular' THEN id_bien END,accion,fecha,receptor,CASE WHEN accion='prestamo' THEN referencia ELSE prestamo.destino_sede_id END,CASE WHEN accion='prestamo' THEN destino ELSE referencia END,p_actor,motivo,solicitud,antes,despues);
 IF accion='prestamo' THEN INSERT INTO public.prestamos_inventario(id,equipo_id,celular_id,origen_sede_id,destino_sede_id,fecha_salida,fecha_limite,receptor,datos_destino)
 VALUES(p_id,CASE WHEN tipo='equipo' THEN id_bien END,CASE WHEN tipo='celular' THEN id_bien END,referencia,destino,fecha,limite,receptor,to_jsonb(sede));
 ELSE UPDATE public.prestamos_inventario SET estado='devuelto',movimiento_devolucion_id=p_id,fecha_devolucion=fecha WHERE id=prestamo.id;END IF;
 IF tipo='equipo' THEN INSERT INTO public.equipos_historial(equipo_id,actor,motivo,antes,despues,movimiento_id) VALUES(id_bien,p_actor,COALESCE(NULLIF(motivo,''),CASE WHEN accion='prestamo' THEN 'Préstamo temporal desde Bodega TI' ELSE 'Devolución del préstamo a Bodega TI' END),antes,despues,p_id);
 ELSE INSERT INTO public.celulares_historial(celular_id,actor,motivo,antes,despues,movimiento_id) VALUES(id_bien,p_actor,COALESCE(NULLIF(motivo,''),CASE WHEN accion='prestamo' THEN 'Préstamo temporal desde Bodega TI' ELSE 'Devolución del préstamo a Bodega TI' END),antes,despues,p_id);END IF;
 RETURN jsonb_build_object('id',p_id,'repetida',false);
END;$function$;
CREATE OR REPLACE FUNCTION public.preparar_acta_acceso(p_actor text, p_id uuid, p_movimiento uuid, p_metadata jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE m public.movimientos_inventario%ROWTYPE;p public.prestamos_inventario%ROWTYPE;a public.actas_documentos%ROWTYPE;meta jsonb;datos jsonb;numero bigint;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'actas.registrar');

 PERFORM pg_advisory_xact_lock(1794355200000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND public.rbac_rol_motor(correo) IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM public.operaciones_inventario_detalle WHERE movimiento_id=p_movimiento) THEN RAISE EXCEPTION 'Usar el acta compartida de la operación' USING ERRCODE='P2701';END IF;
 SELECT * INTO m FROM public.movimientos_inventario WHERE id=p_movimiento FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Movimiento no disponible' USING ERRCODE='P2702';END IF;
 IF m.accion NOT IN ('prestamo','devolucion_prestamo') THEN RETURN public.preparar_acta_movimiento_base(p_actor,p_id,p_movimiento,p_metadata);END IF;
 IF p_id IS NULL THEN RAISE EXCEPTION 'Solicitud inválida' USING ERRCODE='22023';END IF;
 meta:=public.normalizar_metadata_acta(p_metadata,true);
 SELECT * INTO a FROM public.actas_documentos WHERE id=p_id;
 IF FOUND THEN IF a.actor=p_actor AND a.movimiento_id=p_movimiento AND a.solicitud=meta THEN RETURN jsonb_build_object('id',a.id,'datos',a.datos,'completa',a.pdf IS NOT NULL);END IF;RAISE EXCEPTION 'Solicitud repetida con otros datos' USING ERRCODE='P2701';END IF;
 IF EXISTS(SELECT 1 FROM public.actas_documentos WHERE movimiento_id=p_movimiento) THEN RAISE EXCEPTION 'Ya existe acta' USING ERRCODE='P2701';END IF;
 SELECT * INTO p FROM public.prestamos_inventario WHERE id=p_movimiento OR movimiento_devolucion_id=p_movimiento;
 IF NOT FOUND THEN RAISE EXCEPTION 'Préstamo no disponible' USING ERRCODE='P2702';END IF;
 UPDATE public.actas_contador SET ultimo=ultimo+1 WHERE id AND ultimo<999999999999 RETURNING ultimo INTO numero;
 IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo asignar folio' USING ERRCODE='P2702';END IF;
 datos:=jsonb_build_object('schema',4,'modelo','institucional-prestamos-20261105','tipo',m.accion,'fecha',m.fecha::text,'emitidoEn',CURRENT_TIMESTAMP,'movimientoId',m.id,'prestamoId',p.id,'fechaLimite',p.fecha_limite::text,'folioPrestamo',CASE WHEN m.accion='prestamo' THEN numero ELSE (SELECT folio FROM public.actas_documentos WHERE movimiento_id=p.id AND pdf IS NOT NULL) END,
 'clase',CASE WHEN m.equipo_id IS NOT NULL THEN 'equipo' ELSE 'celular' END,'origen',CASE WHEN m.accion='prestamo' THEN 'Bodega TI' ELSE p.datos_destino->>'nombre' END,'destino',CASE WHEN m.accion='prestamo' THEN p.datos_destino->>'nombre' ELSE 'Bodega TI' END,
 'sedeTipo',p.datos_destino->>'tipo','sedeNombre',p.datos_destino->>'nombre','rbd',COALESCE(p.datos_destino->>'rbd',''),'sedeDatos',jsonb_build_object('direccion',p.datos_destino->>'direccion','comuna',p.datos_destino->>'comuna','correoInstitucional',p.datos_destino->>'correo_institucional'),
 'receptorNombre',m.receptor,'actor',p_actor,'actorNombre',COALESCE((SELECT NULLIF(f.nombre,'') FROM public.funcionarios_nc f WHERE lower(f.correo)=p_actor AND f.activo ORDER BY f.id LIMIT 1),(SELECT NULLIF(u.nombre,'') FROM public.usuarios_acceso u WHERE u.correo=p_actor),''),'bienes',jsonb_build_array(m.despues),'metadata',meta,'folio',numero,'version',1);
 INSERT INTO public.actas_documentos(id,movimiento_id,folio,actor,solicitud,datos) VALUES(p_id,p_movimiento,numero,p_actor,meta,datos);
 RETURN jsonb_build_object('id',p_id,'datos',datos,'completa',false);
END;$function$;
CREATE OR REPLACE FUNCTION public.preparar_acta_entrega_acceso(p_actor text, p_id uuid, p_entrega uuid, p_metadata jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE e public.entregas_equipos%ROWTYPE;a public.actas_documentos%ROWTYPE;meta jsonb;datos jsonb;bienes jsonb;numero bigint;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'actas.registrar');

 PERFORM pg_advisory_xact_lock(1794355200000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND public.rbac_rol_motor(correo) IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR p_entrega IS NULL THEN RAISE EXCEPTION 'Fuente requerida' USING ERRCODE='22023';END IF;
 SELECT * INTO e FROM public.entregas_equipos WHERE id=p_entrega FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Entrega no disponible' USING ERRCODE='P2702';END IF;
 -- Los contactos originales se conservan aunque las reglas de ingreso actual
 -- sean más estrictas. Esto no autoriza su uso como destino SMTP.
 IF jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023';END IF;
 meta:=public.normalizar_metadata_acta(CASE WHEN COALESCE(e.receptor_datos->>'correo','')<>'' THEN p_metadata||jsonb_build_object('recibeCorreo','') ELSE p_metadata END,false);
 IF COALESCE(e.receptor_datos->>'correo','')<>'' THEN
  IF jsonb_typeof(p_metadata->'recibeCorreo') IS DISTINCT FROM 'string' OR lower(btrim(p_metadata->>'recibeCorreo')) IS DISTINCT FROM lower(e.receptor_datos->>'correo') THEN RAISE EXCEPTION 'Conservar correo registrado' USING ERRCODE='22023';END IF;
  meta:=meta||jsonb_build_object('recibeCorreo',e.receptor_datos->>'correo');
 END IF;
 -- No reemplazar a la receptora original ni enriquecerla con el directorio actual.
 IF COALESCE(e.receptor_datos->>'rut','')<>'' AND meta->>'recibeRun' IS DISTINCT FROM upper(replace(e.receptor_datos->>'rut','.','')) THEN RAISE EXCEPTION 'Conservar RUN registrado' USING ERRCODE='22023';END IF;
 meta:=meta||jsonb_build_object('recibeCargo',e.receptor_cargo);
 SELECT * INTO a FROM public.actas_documentos WHERE id=p_id;
 IF FOUND THEN IF a.actor=p_actor AND a.entrega_id=p_entrega AND (a.solicitud||jsonb_build_object('recibeUnidad',COALESCE(a.solicitud->>'recibeUnidad',''),'recibeSubdireccion',COALESCE(a.solicitud->>'recibeSubdireccion','')))=meta THEN RETURN jsonb_build_object('id',a.id,'datos',a.datos,'completa',a.pdf IS NOT NULL);END IF;RAISE EXCEPTION 'Solicitud repetida con otros datos' USING ERRCODE='P2701';END IF;
 IF EXISTS(SELECT 1 FROM public.actas_documentos WHERE entrega_id=p_entrega) THEN RAISE EXCEPTION 'Ya existe un acta' USING ERRCODE='P2701';END IF;
 SELECT jsonb_agg(d.despues ORDER BY d.equipo_id) INTO bienes FROM public.entregas_detalle d WHERE d.entrega_id=e.id;
 IF bienes IS NULL THEN RAISE EXCEPTION 'Entrega sin bienes registrados' USING ERRCODE='P2702';END IF;
 UPDATE public.actas_contador SET ultimo=ultimo+1 WHERE id AND ultimo<999999999999 RETURNING ultimo INTO numero;
 IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo asignar folio' USING ERRCODE='P2702';END IF;
 datos:=jsonb_build_object('schema',3,'modelo','institucional-20261104','sedeTipo','jardin_infantil','tipo','entrega_historica','fecha',e.fecha_entrega::text,'emitidoEn',CURRENT_TIMESTAMP,'movimientoId',NULL,'entregaId',e.id,'clase','equipo',
 'origen','No informado al registrar la entrega','destino',e.sede_nombre,'sedeNombre',e.sede_nombre,'rbd',COALESCE(e.sede_rbd,''),'comuna',e.comuna,'sedeDatos',e.sede_datos,
 'receptorNombre',e.receptor_nombre,'actor',p_actor,'actorNombre',COALESCE((SELECT NULLIF(f.nombre,'') FROM public.funcionarios_nc f WHERE lower(f.correo)=p_actor AND f.activo ORDER BY f.id LIMIT 1),(SELECT NULLIF(u.nombre,'') FROM public.usuarios_acceso u WHERE u.correo=p_actor),''),'bienes',bienes,'metadata',meta,'folio',numero,'version',1);
 INSERT INTO public.actas_documentos(id,entrega_id,folio,actor,solicitud,datos) VALUES(p_id,p_entrega,numero,p_actor,meta,datos);
 RETURN jsonb_build_object('id',p_id,'datos',datos,'completa',false);
END;$function$;
CREATE OR REPLACE FUNCTION public.preparar_acta_insumo_acceso(p_actor text, p_id uuid, p_solicitud uuid, p_metadata jsonb, p_lineas jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE s public.solicitudes_insumos%ROWTYPE;ent public.entregas_insumos%ROWTYPE;sd public.sedes%ROWTYPE;a public.actas_documentos%ROWTYPE;meta jsonb;sol jsonb;bienes jsonb;datos jsonb;numero bigint;lineas jsonb;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'actas_insumos.registrar');

 PERFORM public.autorizar_insumos_utic(p_actor);PERFORM pg_advisory_xact_lock(1794355200000);
 IF p_id IS NULL OR jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' OR jsonb_typeof(p_lineas) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Acta inválida' USING ERRCODE='22023';END IF;
 SELECT * INTO s FROM public.solicitudes_insumos WHERE id=p_solicitud FOR UPDATE;
 IF NOT FOUND OR s.estado<>'entregada' THEN RAISE EXCEPTION 'Registra la entrega en la misma operación antes del acta' USING ERRCODE='P2602';END IF;
 SELECT * INTO ent FROM public.entregas_insumos WHERE solicitud_id=p_solicitud;
 IF NOT FOUND THEN RAISE EXCEPTION 'Entrega no disponible' USING ERRCODE='P2604';END IF;
 IF ent.actor IS DISTINCT FROM p_actor THEN RAISE EXCEPTION 'La entrega corresponde a otro operador' USING ERRCODE='42501';END IF;
 SELECT jsonb_agg(jsonb_build_object('producto_id',d.producto_id,'cantidad_entregada',d.cantidad_entregada) ORDER BY d.producto_id) INTO lineas FROM public.entregas_insumos_detalle d WHERE entrega_id=ent.id;
 IF (SELECT jsonb_agg(jsonb_build_object('producto_id',(l->>'producto_id')::uuid,'cantidad_entregada',(l->>'cantidad_entregada')::integer) ORDER BY (l->>'producto_id')::uuid) FROM jsonb_array_elements(p_lineas)l WHERE (l->>'cantidad_entregada')::integer>0) IS DISTINCT FROM lineas THEN RAISE EXCEPTION 'Las cantidades del acta deben ser las entregadas' USING ERRCODE='22023';END IF;
 meta:=public.normalizar_metadata_acta(p_metadata-ARRAY['fechaEntrega','recibeNombre'],false);
 IF p_metadata->>'recibeNombre' IS DISTINCT FROM ent.receptor OR p_metadata->>'fechaEntrega' IS DISTINCT FROM ent.fecha_entrega::text OR meta->>'entregaNombre' IS DISTINCT FROM ent.responsable_ti THEN RAISE EXCEPTION 'Participantes o fecha no coinciden con la entrega' USING ERRCODE='22023';END IF;
 sol:=jsonb_build_object('metadata',meta,'lineas',lineas,'fecha',ent.fecha_entrega,'receptor',ent.receptor);
 SELECT * INTO a FROM public.actas_documentos WHERE id=p_id;
 IF FOUND THEN IF a.actor=p_actor AND a.solicitud_insumo_id=p_solicitud AND a.entrega_insumo_id=ent.id AND a.solicitud=sol THEN RETURN jsonb_build_object('id',a.id,'datos',a.datos,'completa',a.pdf IS NOT NULL);END IF;RAISE EXCEPTION 'Acta ya emitida con otros datos' USING ERRCODE='P2701';END IF;
 IF s.acta_id IS NOT NULL THEN RAISE EXCEPTION 'La solicitud ya tiene acta' USING ERRCODE='P2701';END IF;
 SELECT * INTO sd FROM public.sedes WHERE id=s.sede_id;
 SELECT jsonb_agg(jsonb_build_object('producto_id',d.producto_id,'codigo',c.codigo,'nombre',c.nombre,'categoria',c.categoria,'unidad',c.unidad,'cantidad_entregada',d.cantidad_entregada) ORDER BY c.codigo) INTO bienes FROM public.entregas_insumos_detalle d JOIN public.catalogo_insumos c ON c.id=d.producto_id WHERE d.entrega_id=ent.id;
 UPDATE public.actas_contador SET ultimo=ultimo+1 WHERE id AND ultimo<999999999999 RETURNING ultimo INTO numero;
 IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo asignar folio' USING ERRCODE='P2702';END IF;
 datos:=jsonb_build_object('schema',4,'modelo','institucional-insumos','tipo','entrega_insumo','clase','insumo','fecha',ent.fecha_entrega::text,'emitidoEn',CURRENT_TIMESTAMP,'movimientoId',NULL,'entregaId',NULL,'solicitudInsumoId',s.id,'origen','Bodega TI / Insumos','destino',sd.nombre,'sedeNombre',sd.nombre,'rbd',COALESCE(sd.rbd,''),'sedeTipo',sd.tipo,'sedeDatos',jsonb_build_object('direccion',sd.direccion,'comuna',sd.comuna,'correoInstitucional',sd.correo_institucional),'receptorNombre',ent.receptor,'actor',p_actor,'actorNombre',COALESCE((SELECT NULLIF(nombre,'') FROM public.usuarios_acceso WHERE correo=p_actor),p_actor),'bienes',bienes,'metadata',meta,'folio',numero,'version',1);
 INSERT INTO public.actas_documentos(id,solicitud_insumo_id,entrega_insumo_id,folio,actor,solicitud,datos) VALUES(p_id,p_solicitud,ent.id,numero,p_actor,sol,datos);
 RETURN jsonb_build_object('id',p_id,'datos',datos,'completa',false);
END;$function$;
CREATE OR REPLACE FUNCTION public.preparar_acta_movimiento_base(p_actor text, p_id uuid, p_movimiento uuid, p_metadata jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE m public.movimientos_inventario%ROWTYPE;a public.actas_documentos%ROWTYPE;meta jsonb:='{}';datos jsonb;numero bigint;k text;v text;maximo integer;rut text;suma integer;digito integer;dv text;
BEGIN
 PERFORM pg_advisory_xact_lock(1794355200000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND public.rbac_rol_motor(correo) IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR p_movimiento IS NULL OR jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_metadata)t(k) WHERE t.k NOT IN ('entregaNombre','entregaRun','entregaCargo','entregaCorreo','recibeRun','recibeCargo','recibeCorreo','recibeUnidad','recibeSubdireccion','accesorios','observaciones')) THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023';END IF;
 meta:=public.normalizar_metadata_acta(p_metadata,true);
 SELECT * INTO a FROM public.actas_documentos WHERE id=p_id;
 IF FOUND THEN IF a.actor=p_actor AND a.movimiento_id=p_movimiento AND (a.solicitud||jsonb_build_object('recibeUnidad',COALESCE(a.solicitud->>'recibeUnidad',''),'recibeSubdireccion',COALESCE(a.solicitud->>'recibeSubdireccion','')))=meta THEN RETURN jsonb_build_object('id',a.id,'datos',a.datos,'completa',a.pdf IS NOT NULL);END IF;RAISE EXCEPTION 'Solicitud repetida con otros datos' USING ERRCODE='P2701';END IF;
 IF EXISTS(SELECT 1 FROM public.actas_documentos WHERE movimiento_id=p_movimiento) THEN RAISE EXCEPTION 'Ya existe un acta' USING ERRCODE='P2701';END IF;
 SELECT * INTO m FROM public.movimientos_inventario WHERE id=p_movimiento FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Movimiento no disponible' USING ERRCODE='P2702';END IF;
 UPDATE public.actas_contador SET ultimo=ultimo+1 WHERE id AND ultimo<999999999999 RETURNING ultimo INTO numero;
 IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo asignar folio' USING ERRCODE='P2702';END IF;
 datos:=jsonb_build_object('schema',3,'modelo','institucional-20261104','tipo',m.accion,'fecha',m.fecha::text,'emitidoEn',CURRENT_TIMESTAMP,'movimientoId',m.id,'clase',CASE WHEN m.equipo_id IS NOT NULL THEN 'equipo' ELSE 'celular' END,
 'origen',CASE WHEN m.accion='devolucion' THEN m.antes->>'sedeNombre' ELSE 'Bodega TI' END,'destino',CASE WHEN m.accion='asignacion' THEN m.despues->>'sedeNombre' ELSE 'Bodega TI' END,
 'sedeTipo',m.despues->>'sedeTipo','sedeDatos',jsonb_build_object('direccion',m.despues->>'direccion','comuna',m.despues->>'comuna','correoInstitucional',m.despues->>'correoInstitucional'),'sedeNombre',COALESCE(m.despues->>'sedeNombre',''),'rbd',COALESCE(m.despues->>'rbd',''),'receptorNombre',m.receptor,'actor',p_actor,'actorNombre',COALESCE((SELECT NULLIF(f.nombre,'') FROM public.funcionarios_nc f WHERE lower(f.correo)=p_actor AND f.activo ORDER BY f.id LIMIT 1),(SELECT NULLIF(u.nombre,'') FROM public.usuarios_acceso u WHERE u.correo=p_actor),''),'bienes',jsonb_build_array(m.despues),'metadata',meta,'folio',numero,'version',1);
 INSERT INTO public.actas_documentos(id,movimiento_id,folio,actor,solicitud,datos) VALUES(p_id,p_movimiento,numero,p_actor,meta,datos);
 RETURN jsonb_build_object('id',p_id,'datos',datos,'completa',false);
END;$function$;
CREATE OR REPLACE FUNCTION public.preparar_acta_operacion_acceso(p_actor text, p_id uuid, p_operacion uuid, p_metadata jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE o public.operaciones_inventario%ROWTYPE;a public.actas_documentos%ROWTYPE;meta jsonb;datos jsonb;numero bigint;entregados jsonb;devueltos jsonb;s jsonb;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'actas.registrar');

 PERFORM pg_advisory_xact_lock(1794355200000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND public.rbac_rol_motor(correo) IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR p_operacion IS NULL THEN RAISE EXCEPTION 'Fuente requerida' USING ERRCODE='22023';END IF;
 meta:=public.normalizar_metadata_acta(p_metadata,true);
 SELECT * INTO a FROM public.actas_documentos WHERE id=p_id;
 IF FOUND THEN IF a.actor=p_actor AND a.operacion_id=p_operacion AND a.solicitud=meta THEN RETURN jsonb_build_object('id',a.id,'datos',a.datos,'completa',a.pdf IS NOT NULL);END IF;RAISE EXCEPTION 'Solicitud de acta reutilizada' USING ERRCODE='P2701';END IF;
 IF EXISTS(SELECT 1 FROM public.actas_documentos WHERE operacion_id=p_operacion) THEN RAISE EXCEPTION 'Ya existe acta' USING ERRCODE='P2701';END IF;
 SELECT * INTO o FROM public.operaciones_inventario WHERE id=p_operacion FOR SHARE;
 IF NOT FOUND OR o.actor<>p_actor THEN RAISE EXCEPTION 'Operación no disponible' USING ERRCODE='P2702';END IF;
 IF o.tipo='cambio' AND meta->>'entregaNombre'<>o.solicitud->>'receptorDevolucion' THEN RAISE EXCEPTION 'Revisa la persona UTIC que recibe los devueltos y entrega el reemplazo' USING ERRCODE='22023';END IF;
 SELECT COALESCE(jsonb_agg(m.despues ORDER BY COALESCE(m.equipo_id,m.celular_id)) FILTER(WHERE d.grupo='entrega'),'[]'),COALESCE(jsonb_agg(m.antes||jsonb_build_object('categoriaNombre',m.despues->>'categoriaNombre') ORDER BY COALESCE(m.equipo_id,m.celular_id)) FILTER(WHERE d.grupo='devolucion'),'[]') INTO entregados,devueltos FROM public.operaciones_inventario_detalle d JOIN public.movimientos_inventario m ON m.id=d.movimiento_id WHERE d.operacion_id=o.id;
 UPDATE public.actas_contador SET ultimo=ultimo+1 WHERE id AND ultimo<999999999999 RETURNING ultimo INTO numero;
 IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo asignar folio' USING ERRCODE='P2702';END IF;
 s:=o.datos->'destino';
 datos:=jsonb_build_object('schema',5,'modelo','institucional-operaciones-20261106','tipo',o.tipo,'operacionId',o.id,'movimientoId',NULL,'fecha',o.solicitud->>'fecha','emitidoEn',CURRENT_TIMESTAMP,'clase',o.clase,
 'origen',CASE WHEN o.tipo='cambio' OR NOT o.directa THEN 'Bodega TI' ELSE o.datos->'origen'->>'nombre' END,'procedencia',o.datos->'origen'->>'nombre','ruta',CASE WHEN o.directa THEN 'directa' ELSE 'bodega' END,'destino',s->>'nombre','sedeNombre',s->>'nombre','sedeTipo',s->>'tipo','rbd',COALESCE(s->>'rbd',''),'sedeDatos',jsonb_build_object('direccion',s->>'direccion','comuna',s->>'comuna','correoInstitucional',s->>'correo_institucional'),
 'receptorNombre',o.solicitud->>'receptor','actor',p_actor,'actorNombre',COALESCE((SELECT NULLIF(f.nombre,'') FROM public.funcionarios_nc f WHERE lower(f.correo)=p_actor AND f.activo ORDER BY f.id LIMIT 1),(SELECT NULLIF(u.nombre,'') FROM public.usuarios_acceso u WHERE u.correo=p_actor),''),'bienes',entregados,'bienesDevueltos',devueltos,'detalleDevueltos',o.solicitud->>'detalleDevueltos','detalleEntregados',o.solicitud->>'detalleEntregados','motivo',o.solicitud->>'motivo','metadata',meta,'folio',numero,'version',1);
 INSERT INTO public.actas_documentos(id,operacion_id,folio,actor,solicitud,datos) VALUES(p_id,o.id,numero,p_actor,meta,datos);
 RETURN jsonb_build_object('id',p_id,'datos',datos,'completa',false);
END;$function$;
CREATE OR REPLACE FUNCTION public.recuperar_equipo_robo_acceso(p_actor text, p_id uuid, p_version integer, p_equipo uuid, p_fecha date, p_motivo text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE incidente public.incidentes_robos%ROWTYPE; detalle public.incidentes_robos_equipos%ROWTYPE;
 equipo public.equipos%ROWTYPE; posterior public.equipos%ROWTYPE;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'incidentes.aprobar');

 PERFORM pg_advisory_xact_lock(1793577600000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND public.rbac_rol_motor(correo) IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501'; END IF;
 SELECT * INTO incidente FROM public.incidentes_robos WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR incidente.estado<>'validado' OR incidente.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'El incidente cambió' USING ERRCODE='P2301'; END IF;
 SELECT * INTO detalle FROM public.incidentes_robos_equipos WHERE incidente_id=p_id AND equipo_id=p_equipo FOR UPDATE;
 IF NOT FOUND OR detalle.recuperado_fecha IS NOT NULL THEN RAISE EXCEPTION 'Equipo no recuperable en este incidente' USING ERRCODE='P2301'; END IF;
 IF p_fecha IS NULL OR p_fecha<incidente.fecha OR p_fecha>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date
   OR p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Recuperación inválida' USING ERRCODE='22023'; END IF;
 UPDATE public.incidentes_robos_equipos SET recuperado_fecha=p_fecha,recuperado_por=p_actor,recuperacion_motivo=btrim(p_motivo) WHERE incidente_id=p_id AND equipo_id=p_equipo;
 UPDATE public.incidentes_robos SET version=version+1 WHERE id=p_id;
 INSERT INTO public.incidentes_robos_historial(incidente_id,equipo_id,evento,actor,motivo,datos)
 VALUES(p_id,p_equipo,'recuperado',p_actor,btrim(p_motivo),jsonb_build_object('fecha',p_fecha,'equipoId',p_equipo));
 SELECT * INTO equipo FROM public.equipos WHERE id=p_equipo FOR UPDATE;
 UPDATE public.equipos SET version=version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=p_equipo RETURNING * INTO posterior;
 INSERT INTO public.equipos_historial(equipo_id,actor,motivo,antes,despues,incidente_id)
 VALUES(p_equipo,p_actor,'Equipo recuperado el '||p_fecha||': '||btrim(p_motivo),to_jsonb(equipo),to_jsonb(posterior),p_id);
 RETURN p_version+1;
END;
$function$;
CREATE OR REPLACE FUNCTION public.registrar_compra_insumo_acceso(p_actor text, p_solicitud uuid, p_datos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE h public.ingresos_insumos%ROWTYPE;p public.catalogo_insumos%ROWTYPE;c public.categorias_insumos_codigos%ROWTYPE;v_id uuid;v_version integer;v_cantidad integer;v_fecha date;v_oc text;v_nombre text;v_categoria text;v_unidad text;k text;sol jsonb;num bigint;codigo_nuevo text;coincidencias integer;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'compras_insumos.registrar');

 PERFORM public.autorizar_insumos_utic(p_actor);
 IF p_solicitud IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(p_datos))<>8 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_datos)t(k) WHERE t.k NOT IN ('productoId','version','nombre','categoria','unidad','cantidad','oc','fechaCompra')) THEN RAISE EXCEPTION 'Compra inválida' USING ERRCODE='22023';END IF;
 FOREACH k IN ARRAY ARRAY['productoId','nombre','categoria','unidad','oc','fechaCompra'] LOOP IF jsonb_typeof(p_datos->k) IS DISTINCT FROM 'string' OR p_datos->>k ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Datos de compra inválidos' USING ERRCODE='22023';END IF;END LOOP;
 IF (p_datos->>'productoId'<>'' AND p_datos->>'productoId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') OR jsonb_typeof(p_datos->'version') IS DISTINCT FROM 'number' OR p_datos->>'version' !~ '^[0-9]{1,10}$' OR (p_datos->>'version')::numeric>=2147483647 OR jsonb_typeof(p_datos->'cantidad') IS DISTINCT FROM 'number' OR p_datos->>'cantidad' !~ '^[1-9][0-9]{0,5}$' OR (p_datos->>'cantidad')::integer>100000 THEN RAISE EXCEPTION 'Producto, cantidad o versión inválidos' USING ERRCODE='22023';END IF;
 IF p_datos->>'productoId'='' THEN PERFORM public.rbac_exigir(p_actor,'catalogo_insumos.registrar');END IF;
 v_id:=NULLIF(p_datos->>'productoId','')::uuid;v_version:=(p_datos->>'version')::integer;v_cantidad:=(p_datos->>'cantidad')::integer;
 v_nombre:=btrim(normalize(p_datos->>'nombre',NFC));v_categoria:=btrim(normalize(p_datos->>'categoria',NFC));v_unidad:=btrim(normalize(p_datos->>'unidad',NFC));v_oc:=btrim(p_datos->>'oc');
 IF length(v_nombre) NOT BETWEEN 1 AND 200 OR length(v_categoria) NOT BETWEEN 1 AND 120 OR length(v_unidad) NOT BETWEEN 1 AND 60 OR length(v_oc) NOT BETWEEN 1 AND 120 OR p_datos->>'fechaCompra' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR (v_id IS NULL AND v_version<>0) OR (v_id IS NOT NULL AND v_version<1) THEN RAISE EXCEPTION 'Completa producto, categoría, unidad, OC y fecha' USING ERRCODE='22023';END IF;
 v_fecha:=(p_datos->>'fechaCompra')::date;IF v_fecha<'1900-01-01'::date OR v_fecha>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date THEN RAISE EXCEPTION 'Fecha de compra inválida' USING ERRCODE='22023';END IF;
 sol:=jsonb_build_object('productoId',COALESCE(v_id::text,''),'version',v_version,'nombre',v_nombre,'categoria',v_categoria,'unidad',v_unidad,'cantidad',v_cantidad,'oc',v_oc,'fechaCompra',v_fecha::text);
 SELECT * INTO h FROM public.ingresos_insumos WHERE id=p_solicitud;IF FOUND THEN IF h.clase='compra' AND h.actor=p_actor AND h.solicitud=sol THEN RETURN jsonb_build_object('id',h.id,'productoId',h.producto_id,'codigo',h.producto->>'codigo','repetida',true);END IF;RAISE EXCEPTION 'Solicitud ya utilizada' USING ERRCODE='P3301';END IF;
 IF v_id IS NOT NULL THEN
  SELECT * INTO p FROM public.catalogo_insumos WHERE id=v_id FOR UPDATE;
  IF NOT FOUND OR NOT p.activo THEN RAISE EXCEPTION 'Producto no disponible' USING ERRCODE='P3102';END IF;
  IF p.version<>v_version OR public.clave_insumo(p.nombre)<>public.clave_insumo(v_nombre) OR public.clave_insumo(p.categoria)<>public.clave_insumo(v_categoria) OR public.clave_insumo(p.unidad)<>public.clave_insumo(v_unidad) THEN RAISE EXCEPTION 'El producto cambió; vuelve a abrir el ingreso' USING ERRCODE='P3101';END IF;
 ELSE
  SELECT count(*) INTO coincidencias FROM public.catalogo_insumos WHERE public.clave_insumo(nombre)=public.clave_insumo(v_nombre) AND public.clave_insumo(categoria)=public.clave_insumo(v_categoria) AND public.clave_insumo(unidad)=public.clave_insumo(v_unidad);
  IF coincidencias>1 THEN RAISE EXCEPTION 'Hay productos anteriores coincidentes; selecciona uno del catálogo' USING ERRCODE='P3302';END IF;
  IF coincidencias=1 THEN
   SELECT * INTO p FROM public.catalogo_insumos WHERE public.clave_insumo(nombre)=public.clave_insumo(v_nombre) AND public.clave_insumo(categoria)=public.clave_insumo(v_categoria) AND public.clave_insumo(unidad)=public.clave_insumo(v_unidad) FOR UPDATE;
   IF NOT p.activo THEN RAISE EXCEPTION 'El producto está inactivo' USING ERRCODE='P3102';END IF;
  ELSE
   c:=public.asegurar_categoria_insumo(v_categoria);
   LOOP
    UPDATE public.categorias_insumos_codigos SET ultimo=ultimo+1 WHERE clave=c.clave AND ultimo<999999999999 RETURNING ultimo INTO num;
    IF NOT FOUND THEN RAISE EXCEPTION 'Correlativo agotado' USING ERRCODE='P3303';END IF;
    codigo_nuevo:=c.prefijo||'-'||lpad(num::text,GREATEST(6,length(num::text)),'0');
    EXIT WHEN NOT EXISTS(SELECT 1 FROM public.catalogo_insumos WHERE upper(codigo)=codigo_nuevo);
   END LOOP;
   INSERT INTO public.catalogo_insumos(codigo,nombre,categoria,unidad,categoria_codigo) VALUES(codigo_nuevo,v_nombre,c.nombre,v_unidad,c.clave) RETURNING * INTO p;
   INSERT INTO public.stock_insumos(producto_id,existencia,reservado) VALUES(p.id,0,0);
   INSERT INTO public.insumos_historial(id,producto_id,actor,accion,solicitud,antes,despues) VALUES(gen_random_uuid(),p.id,p_actor,'producto',sol,NULL,to_jsonb(p));
  END IF;
 END IF;
 PERFORM public.ingresar_stock_insumo_acceso(p_actor,gen_random_uuid(),p.id,v_cantidad);
 INSERT INTO public.ingresos_insumos(id,producto_id,clase,cantidad,oc,fecha_compra,actor,producto,solicitud) VALUES(p_solicitud,p.id,'compra',v_cantidad,v_oc,v_fecha,p_actor,jsonb_build_object('codigo',p.codigo,'nombre',p.nombre,'categoria',p.categoria,'unidad',p.unidad),sol);
 RETURN jsonb_build_object('id',p_solicitud,'productoId',p.id,'codigo',p.codigo,'repetida',false);
END;$function$;
CREATE OR REPLACE FUNCTION public.regularizar_entregas_acceso(p_actor text, p_solicitud uuid, p_grupos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE existente boolean;resultado jsonb;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'movimientos.confirmar');

 PERFORM pg_advisory_xact_lock(1793577600000);
 PERFORM pg_advisory_xact_lock(1794268800000);
 existente:=EXISTS(SELECT 1 FROM public.entregas_lotes WHERE id=p_solicitud);
 IF NOT existente AND jsonb_typeof(p_grupos)='array' AND EXISTS(SELECT 1 FROM jsonb_array_elements(p_grupos) g CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(g->'equipos')='array' THEN g->'equipos' ELSE '[]'::jsonb END) b JOIN public.equipos e ON e.id::text=b->>'id' WHERE e.custodia='en_prestamo') THEN RAISE EXCEPTION 'El bien está en préstamo' USING ERRCODE='P2802';END IF;
 resultado:=public.regularizar_entregas_base(p_actor,p_solicitud,p_grupos);
 IF NOT existente THEN
  UPDATE public.equipos e SET custodia='asignado' WHERE e.id IN(SELECT d.equipo_id FROM public.entregas_detalle d JOIN public.entregas_equipos x ON x.id=d.entrega_id WHERE x.lote_id=p_solicitud);

 UPDATE public.entregas_detalle x SET antes=x.antes||jsonb_build_object('ubicacionBodega',(SELECT nombre FROM public.ubicaciones_bodega WHERE id=(x.antes->>'ubicacion_bodega_id')::uuid)),despues=x.despues||jsonb_build_object('custodia','asignado','ubicacion_bodega_id',NULL,'ubicacionBodega',NULL) WHERE x.entrega_id IN(SELECT id FROM public.entregas_equipos WHERE lote_id=p_solicitud);
 UPDATE public.equipos_historial h SET antes=h.antes||jsonb_build_object('ubicacionBodega',(SELECT nombre FROM public.ubicaciones_bodega WHERE id=(h.antes->>'ubicacion_bodega_id')::uuid)),despues=h.despues||jsonb_build_object('custodia','asignado','ubicacion_bodega_id',NULL,'ubicacionBodega',NULL) WHERE h.entrega_id IN(SELECT id FROM public.entregas_equipos WHERE lote_id=p_solicitud);
 END IF;
 RETURN resultado;
END;$function$;
CREATE OR REPLACE FUNCTION public.regularizar_entregas_base(p_actor text, p_solicitud uuid, p_grupos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
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
    AND public.rbac_rol_motor(correo) IN ('administrador','administrador_gestion') FOR SHARE;
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
$function$;
CREATE OR REPLACE FUNCTION public.reportar_robo_acceso(p_actor text, p_id uuid, p_datos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 PERFORM public.rbac_exigir(p_actor,'incidentes.registrar');

 IF EXISTS(SELECT 1 FROM public.incidentes_robos WHERE id=p_id AND reportado_por=p_actor AND solicitud=p_datos) THEN
  PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND public.rbac_rol_motor(correo) IN ('administrador','administrador_gestion','encargado');
  IF FOUND THEN RETURN jsonb_build_object('id',p_id,'repetida',true);END IF;
 END IF;
 RAISE EXCEPTION 'Usa el reporte con número de parte y envío a TI' USING ERRCODE='22023';
END;$function$;
CREATE OR REPLACE FUNCTION public.reportar_robo_historico_interno(p_actor text, p_id uuid, p_datos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE usuario public.usuarios_acceso%ROWTYPE; sede public.sedes%ROWTYPE;
 equipo public.equipos%ROWTYPE; posterior public.equipos%ROWTYPE; anterior public.incidentes_robos%ROWTYPE;
 fecha date; lugar text; descripcion text; enlace text; fila jsonb; vistos uuid[]:=ARRAY[]::uuid[];
BEGIN
 PERFORM pg_advisory_xact_lock(1793577600000);
 SELECT * INTO usuario FROM public.usuarios_acceso WHERE correo=p_actor AND activo
   AND public.rbac_rol_motor(correo) IN ('administrador','administrador_gestion','encargado') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object' OR octet_length(p_datos::text)>1000000
   OR jsonb_typeof(p_datos->'equipos') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Solicitud inválida' USING ERRCODE='22023'; END IF;
 IF jsonb_array_length(p_datos->'equipos') NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Seleccionar entre 1 y 200 equipos' USING ERRCODE='22023'; END IF;
 SELECT * INTO anterior FROM public.incidentes_robos WHERE id=p_id;
 IF FOUND THEN
  IF anterior.reportado_por<>p_actor OR anterior.solicitud IS DISTINCT FROM p_datos THEN RAISE EXCEPTION 'Solicitud reutilizada' USING ERRCODE='P2303'; END IF;
  RETURN jsonb_build_object('id',p_id,'repetida',true);
 END IF;
 SELECT * INTO sede FROM public.sedes WHERE id=(p_datos->>'sedeId')::uuid AND activo FOR SHARE;
 IF NOT FOUND OR (public.rbac_rol_motor(usuario.correo)='encargado' AND usuario.sede_id IS DISTINCT FROM sede.id) THEN RAISE EXCEPTION 'Sede no autorizada' USING ERRCODE='42501'; END IF;
 IF COALESCE(p_datos->>'fecha','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION 'Fecha requerida' USING ERRCODE='22023'; END IF;
 fecha:=(p_datos->>'fecha')::date;
 lugar:=btrim(p_datos->>'lugar'); descripcion:=btrim(p_datos->>'descripcion'); enlace:=NULLIF(btrim(p_datos->>'enlace'),'');
 IF fecha<DATE '1900-01-01' OR fecha>(CURRENT_TIMESTAMP AT TIME ZONE 'America/Santiago')::date
  OR lugar IS NULL OR length(lugar) NOT BETWEEN 1 AND 300 OR lugar ~ '[[:cntrl:]]'
  OR descripcion IS NULL OR length(descripcion) NOT BETWEEN 1 AND 3000
  OR (enlace IS NOT NULL AND (length(enlace)>1500 OR enlace !~* '^https?://[^[:space:]]+$' OR enlace ~* '^https?://[^/]*@')) THEN RAISE EXCEPTION 'Antecedentes inválidos' USING ERRCODE='22023'; END IF;
 INSERT INTO public.incidentes_robos(id,sede_id,sede_nombre,sede_rbd,sede_tipo,comuna,fecha,lugar,descripcion,enlace,reportado_por,solicitud)
 VALUES(p_id,sede.id,sede.nombre,sede.rbd,sede.tipo,sede.comuna,fecha,lugar,descripcion,enlace,p_actor,p_datos);
 FOR fila IN SELECT value FROM jsonb_array_elements(p_datos->'equipos') LOOP
  SELECT * INTO equipo FROM public.equipos WHERE id=(fila->>'id')::uuid FOR UPDATE;
  IF NOT FOUND OR equipo.id=ANY(vistos) OR equipo.sede_id<>sede.id OR equipo.version IS DISTINCT FROM (fila->>'version')::integer THEN
   RAISE EXCEPTION 'La selección cambió; revisar nuevamente' USING ERRCODE='P2301'; END IF;
  IF EXISTS(SELECT 1 FROM public.incidentes_robos_equipos d JOIN public.incidentes_robos i ON i.id=d.incidente_id
    WHERE d.equipo_id=equipo.id AND i.estado IN ('reportado','validado') AND d.recuperado_fecha IS NULL) THEN
   RAISE EXCEPTION 'Equipo con incidente abierto' USING ERRCODE='P2302'; END IF;
  vistos:=array_append(vistos,equipo.id);
  INSERT INTO public.incidentes_robos_equipos(incidente_id,equipo_id,identificacion)
  SELECT p_id,equipo.id,jsonb_build_object('marca',equipo.marca,'modelo',equipo.modelo,'serie',equipo.serie,
    'inventario',equipo.numero_inventario,'categoriaId',equipo.categoria_id,'categoria',c.nombre) FROM public.categorias_bienes c WHERE c.id=equipo.categoria_id;
  UPDATE public.equipos SET version=version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=equipo.id RETURNING * INTO posterior;
  INSERT INTO public.equipos_historial(equipo_id,actor,motivo,antes,despues,incidente_id)
  VALUES(equipo.id,p_actor,'Robo reportado, pendiente de validación.',to_jsonb(equipo),to_jsonb(posterior),p_id);
 END LOOP;
 INSERT INTO public.incidentes_robos_historial(incidente_id,evento,actor,motivo,datos)
 VALUES(p_id,'reportado',p_actor,descripcion,jsonb_build_object('equipos',vistos,'fecha',fecha,'lugar',lugar));
 RETURN jsonb_build_object('id',p_id,'repetida',false);
END;
$function$;
CREATE OR REPLACE FUNCTION public.resolver_robo_acceso(p_actor text, p_id uuid, p_version integer, p_decision text, p_motivo text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE incidente public.incidentes_robos%ROWTYPE; equipo public.equipos%ROWTYPE; posterior public.equipos%ROWTYPE;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'incidentes.aprobar');

 PERFORM pg_advisory_xact_lock(1793577600000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND public.rbac_rol_motor(correo) IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501'; END IF;
 SELECT * INTO incidente FROM public.incidentes_robos WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR incidente.estado<>'reportado' OR incidente.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'El incidente cambió' USING ERRCODE='P2301'; END IF;
 IF p_decision IS NULL OR p_decision NOT IN ('validado','rechazado') OR p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Decisión inválida' USING ERRCODE='22023'; END IF;
 UPDATE public.incidentes_robos SET estado=p_decision,version=version+1 WHERE id=p_id;
 INSERT INTO public.incidentes_robos_historial(incidente_id,evento,actor,motivo,datos)
 VALUES(p_id,p_decision,p_actor,btrim(p_motivo),jsonb_build_object('antes',incidente.estado,'despues',p_decision));
 FOR equipo IN SELECT e.* FROM public.equipos e JOIN public.incidentes_robos_equipos d ON d.equipo_id=e.id WHERE d.incidente_id=p_id ORDER BY e.id FOR UPDATE OF e LOOP
  UPDATE public.equipos SET version=version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=equipo.id RETURNING * INTO posterior;
  INSERT INTO public.equipos_historial(equipo_id,actor,motivo,antes,despues,incidente_id)
  VALUES(equipo.id,p_actor,'Incidente de robo '||p_decision||': '||btrim(p_motivo),to_jsonb(equipo),to_jsonb(posterior),p_id);
 END LOOP;
 RETURN p_version+1;
END;
$function$;
CREATE OR REPLACE FUNCTION public.subir_acta_externa_acceso(p_actor text, p_id uuid, p_datos jsonb, p_pdf bytea, p_nombre text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE a public.actas_documentos%ROWTYPE; numero bigint; datos jsonb; tipo text; fecha text; sede text; receptor text;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'actas.registrar');

  PERFORM pg_advisory_xact_lock(1794355200000);
  PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND public.rbac_rol_motor(correo) IN ('administrador','administrador_gestion') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501'; END IF;
  IF p_id IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023'; END IF;
  IF p_pdf IS NULL OR octet_length(p_pdf) NOT BETWEEN 100 AND 8388608 OR left(encode(p_pdf,'escape'),5)<>'%PDF-' THEN RAISE EXCEPTION 'El archivo debe ser un PDF válido (máx. 8 MB).' USING ERRCODE='22023'; END IF;
  SELECT * INTO a FROM public.actas_documentos WHERE id=p_id;
  IF FOUND THEN
    IF a.actor=p_actor AND a.origen_externo AND a.pdf IS NOT NULL AND a.datos->>'archivoNombre'=COALESCE(p_datos->>'archivoNombre','') THEN
      RETURN jsonb_build_object('id',a.id,'folio',a.folio,'repetida',true);
    END IF;
    RAISE EXCEPTION 'Solicitud repetida con otros datos' USING ERRCODE='P2701';
  END IF;
  tipo := COALESCE(NULLIF(trim(p_datos->>'tipo'),''),'externa');
  fecha := COALESCE(NULLIF(trim(p_datos->>'fecha'),''), CURRENT_DATE::text);
  sede := COALESCE(NULLIF(trim(p_datos->>'sedeNombre'),''), 'Sin sede indicada');
  receptor := COALESCE(NULLIF(trim(p_datos->>'receptorNombre'),''), 'Sin receptor indicado');
  UPDATE public.actas_contador SET ultimo=ultimo+1 WHERE id AND ultimo<999999999999 RETURNING ultimo INTO numero;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo asignar folio' USING ERRCODE='P2702'; END IF;
  datos := jsonb_build_object(
    'schema', 4,
    'modelo', 'externa-subida',
    'tipo', tipo,
    'fecha', fecha,
    'emitidoEn', CURRENT_TIMESTAMP,
    'movimientoId', NULL,
    'entregaId', NULL,
    'operacionId', NULL,
    'clase', COALESCE(NULLIF(p_datos->>'clase',''),'equipo'),
    'origen', COALESCE(NULLIF(p_datos->>'origen',''),'Documento externo'),
    'destino', COALESCE(NULLIF(p_datos->>'destino',''),'Repositorio de actas'),
    'sedeNombre', sede,
    'sedeTipo', COALESCE(p_datos->>'sedeTipo',''),
    'rbd', COALESCE(p_datos->>'rbd',''),
    'receptorNombre', receptor,
    'actor', p_actor,
    'actorNombre', COALESCE((SELECT NULLIF(u.nombre,'') FROM public.usuarios_acceso u WHERE u.correo=p_actor), ''),
    'bienes', COALESCE(p_datos->'bienes', '[]'::jsonb),
    'metadata', jsonb_build_object('entregaNombre',COALESCE(p_datos->>'entregaNombre',''),'entregaRun','','entregaCargo','','entregaCorreo','','recibeRun','','recibeCargo',COALESCE(p_datos->>'recibeCargo',''),'recibeCorreo','','recibeUnidad','','recibeSubdireccion','','accesorios','','observaciones',COALESCE(p_datos->>'observaciones','')),
    'folio', numero,
    'version', 1,
    'origenExterno', true,
    'archivoNombre', COALESCE(NULLIF(p_nombre,''), COALESCE(p_datos->>'archivoNombre','acta.pdf'))
  );
  INSERT INTO public.actas_documentos(id, folio, actor, solicitud, datos, pdf, sha256, origen_externo, archivo_nombre)
  VALUES (p_id, numero, p_actor, jsonb_build_object('externa',true,'nombre',COALESCE(p_nombre,'')), datos, p_pdf, encode(sha256(p_pdf),'hex'), true, p_nombre);
  RETURN jsonb_build_object('id',p_id,'folio',numero,'repetida',false);
END;
$function$;
CREATE OR REPLACE FUNCTION public.ubicar_bien_bodega_acceso(p_actor text, p_solicitud uuid, p_datos jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE h public.ubicaciones_bodega_historial%ROWTYPE;tipo text;id_bien uuid;destino uuid;version_actual integer;anterior jsonb;posterior jsonb;sol jsonb;nombre_antes text;nombre_despues text;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'bodega.confirmar');

 PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1794268800000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND public.rbac_rol_motor(correo) IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Operación reservada a UTIC' USING ERRCODE='42501';END IF;
 IF p_solicitud IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(p_datos))<>4 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_datos)t(k) WHERE t.k NOT IN ('tipo','bienId','version','ubicacion')) OR jsonb_typeof(p_datos->'tipo') IS DISTINCT FROM 'string' OR jsonb_typeof(p_datos->'bienId') IS DISTINCT FROM 'string' OR jsonb_typeof(p_datos->'ubicacion') IS DISTINCT FROM 'string' OR jsonb_typeof(p_datos->'version') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Solicitud inválida' USING ERRCODE='22023';END IF;
 tipo:=p_datos->>'tipo';
 IF tipo NOT IN ('equipo','celular') OR p_datos->>'bienId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' OR p_datos->>'version' !~ '^[1-9][0-9]{0,9}$' OR (p_datos->>'version')::numeric>=2147483647 OR (p_datos->>'ubicacion'<>'' AND p_datos->>'ubicacion' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') THEN RAISE EXCEPTION 'Bien, ubicación o versión inválidos' USING ERRCODE='22023';END IF;
 id_bien:=(p_datos->>'bienId')::uuid;destino:=NULLIF(p_datos->>'ubicacion','')::uuid;
 sol:=jsonb_build_object('tipo',tipo,'bienId',id_bien,'version',(p_datos->>'version')::integer,'ubicacion',COALESCE(destino::text,''));
 SELECT * INTO h FROM public.ubicaciones_bodega_historial WHERE id=p_solicitud;
 IF FOUND THEN IF h.actor=p_actor AND h.solicitud=sol THEN RETURN jsonb_build_object('version',(h.despues->>'version')::integer,'repetida',true);END IF;RAISE EXCEPTION 'Solicitud ya utilizada' USING ERRCODE='P3201';END IF;
 IF destino IS NOT NULL THEN PERFORM 1 FROM public.ubicaciones_bodega WHERE id=destino AND activo FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Ubicación no disponible' USING ERRCODE='22023';END IF;END IF;
 IF tipo='equipo' THEN SELECT to_jsonb(e) INTO anterior FROM public.equipos e WHERE id=id_bien FOR UPDATE;
 ELSE SELECT to_jsonb(c) INTO anterior FROM public.celulares c WHERE id=id_bien FOR UPDATE;END IF;
 IF anterior IS NULL THEN RAISE EXCEPTION 'Bien no disponible' USING ERRCODE='P3202';END IF;
 version_actual:=(anterior->>'version')::integer;
 IF version_actual<>(p_datos->>'version')::integer THEN RAISE EXCEPTION 'El bien cambió; recarga antes de confirmar' USING ERRCODE='P3201';END IF;
 IF anterior->>'custodia'<>'en_bodega' OR anterior->>'estado_administrativo'<>'activo' OR (tipo='celular' AND NOT (anterior->>'activo')::boolean) THEN RAISE EXCEPTION 'El estado del bien impide ubicarlo en bodega' USING ERRCODE='P3202';END IF;
 IF tipo='equipo' AND EXISTS(SELECT 1 FROM public.incidentes_robos_equipos d JOIN public.incidentes_robos i ON i.id=d.incidente_id WHERE d.equipo_id=id_bien AND i.estado IN ('reportado','validado') AND d.recuperado_fecha IS NULL) THEN RAISE EXCEPTION 'Hay un incidente abierto' USING ERRCODE='P3202';END IF;
 SELECT nombre INTO nombre_antes FROM public.ubicaciones_bodega WHERE id=(anterior->>'ubicacion_bodega_id')::uuid;
 SELECT nombre INTO nombre_despues FROM public.ubicaciones_bodega WHERE id=destino;
 IF tipo='equipo' THEN
  UPDATE public.equipos SET ubicacion_bodega_id=destino,version=version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=id_bien RETURNING to_jsonb(equipos) INTO posterior;
  INSERT INTO public.equipos_historial(equipo_id,actor,motivo,antes,despues) VALUES(id_bien,p_actor,'Confirmación de ubicación física en Bodega TI',jsonb_build_object('sede_id',anterior->>'sede_id','ubicacionBodega',nombre_antes),jsonb_build_object('sede_id',posterior->>'sede_id','ubicacionBodega',nombre_despues));
 ELSE
  UPDATE public.celulares SET ubicacion_bodega_id=destino,version=version+1,actualizado_por=p_actor,actualizado_en=CURRENT_TIMESTAMP WHERE id=id_bien RETURNING to_jsonb(celulares) INTO posterior;
  INSERT INTO public.celulares_historial(celular_id,actor,motivo,antes,despues) VALUES(id_bien,p_actor,'Confirmación de ubicación física en Bodega TI',jsonb_build_object('sedeId',anterior->>'sede_id','ubicacionBodega',nombre_antes),jsonb_build_object('sedeId',posterior->>'sede_id','ubicacionBodega',nombre_despues));
 END IF;
 INSERT INTO public.ubicaciones_bodega_historial(id,equipo_id,celular_id,actor,solicitud,antes,despues) VALUES(p_solicitud,CASE WHEN tipo='equipo' THEN id_bien END,CASE WHEN tipo='celular' THEN id_bien END,p_actor,sol,anterior,posterior);
 RETURN jsonb_build_object('version',(posterior->>'version')::integer,'repetida',false);
END;$function$;
CREATE OR REPLACE FUNCTION public.validar_receptor_nc_acceso(p_actor text, p_funcionario uuid, p_sede uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 PERFORM public.rbac_exigir(p_actor,'movimientos.confirmar');

 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND public.rbac_rol_motor(correo) IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.sedes WHERE id=p_sede AND activo AND tipo='nivel_central' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Destino incompatible' USING ERRCODE='22023';END IF;
 IF p_funcionario IS NOT NULL THEN
  PERFORM 1 FROM public.funcionarios_nc WHERE id=p_funcionario AND activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Funcionario no disponible' USING ERRCODE='22023';END IF;
 END IF;
END;$function$;
CREATE OR REPLACE FUNCTION public.validar_solicitud_insumos(p_actor text, p_solicitud uuid, p_observacion text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE s public.solicitudes_insumos%ROWTYPE;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'seguimiento_insumos.aprobar');

  PERFORM 1 FROM public.usuarios_acceso u WHERE u.correo=p_actor AND u.activo AND public.rbac_rol_motor(u.correo) IN ('administrador','administrador_gestion','gestor_insumos') FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización para validar solicitudes de insumos' USING ERRCODE='42501'; END IF;
  SELECT * INTO s FROM public.solicitudes_insumos WHERE id=p_solicitud FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada' USING ERRCODE='P2604'; END IF;
  IF s.estado <> 'solicitada' THEN RAISE EXCEPTION 'Solo se puede validar una solicitud en estado solicitada' USING ERRCODE='P2602'; END IF;
  UPDATE public.solicitudes_insumos SET estado='en_validacion', validado_en=CURRENT_TIMESTAMP, validado_por=p_actor, observacion_validacion=COALESCE(trim(p_observacion),'') WHERE id=p_solicitud;
  RETURN jsonb_build_object('id',p_solicitud,'estado','en_validacion');
END;
$function$;
CREATE OR REPLACE FUNCTION public.vincular_acta_entrega_insumo_acceso(p_actor text, p_acta uuid, p_entrega uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE a public.actas_documentos%ROWTYPE;e public.entregas_insumos%ROWTYPE;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'actas_insumos.registrar');

 PERFORM public.autorizar_insumos_utic(p_actor);
 SELECT * INTO e FROM public.entregas_insumos WHERE id=p_entrega FOR UPDATE;
 SELECT * INTO a FROM public.actas_documentos WHERE id=p_acta;
 IF e.id IS NULL OR a.id IS NULL OR a.pdf IS NULL OR a.actor<>p_actor OR a.solicitud_insumo_id IS DISTINCT FROM e.solicitud_id OR a.entrega_insumo_id IS DISTINCT FROM e.id OR e.acta_id IS NOT NULL AND e.acta_id<>a.id THEN RAISE EXCEPTION 'El acta no corresponde a la entrega' USING ERRCODE='P2701';END IF;
 UPDATE public.entregas_insumos SET acta_id=p_acta WHERE id=e.id;
 UPDATE public.solicitudes_insumos SET acta_id=p_acta WHERE id=e.solicitud_id AND (acta_id IS NULL OR acta_id=p_acta);
 IF NOT FOUND THEN RAISE EXCEPTION 'La solicitud ya tiene otro documento' USING ERRCODE='P2701';END IF;
END;$function$;
`);
exports.down=()=>{throw new Error("Reversión RBAC requiere procedimiento ensayado.");};
