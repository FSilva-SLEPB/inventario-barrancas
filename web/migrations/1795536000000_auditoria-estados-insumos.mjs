export function up(pgm){pgm.sql(`
-- Corrección nueva: no modificar migraciones ni documentos ya emitidos.
CREATE OR REPLACE FUNCTION public.proteger_estados_activo() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF OLD.estado_administrativo='dado_de_baja' THEN RAISE EXCEPTION 'Registro histórico de solo lectura' USING ERRCODE='P3002';END IF;
 IF NEW.estado_administrativo='activo' AND OLD.estado_administrativo='activo' AND NEW.condicion_tecnica='' AND OLD.condicion_tecnica<>'' THEN RAISE EXCEPTION 'Selecciona una condición para sustituir la registrada' USING ERRCODE='22023';END IF;
 IF NEW.custodia IS DISTINCT FROM OLD.custodia OR NEW.sede_id IS DISTINCT FROM OLD.sede_id THEN
  IF OLD.estado_administrativo<>'activo' OR NEW.estado_administrativo<>'activo' THEN RAISE EXCEPTION 'El estado administrativo impide el movimiento' USING ERRCODE='P3003';END IF;
  IF NEW.custodia<>'en_bodega' AND NEW.condicion_tecnica NOT IN ('operativo','bodega_ti','sin_verificar') THEN RAISE EXCEPTION 'La condición impide entregar o prestar el bien' USING ERRCODE='P3003';END IF;
 END IF;RETURN NEW;
END;$fn$;
ALTER TABLE public.catalogo_insumos ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>0);
ALTER TABLE public.solicitudes_insumos ADD COLUMN solicitud_original jsonb,ADD COLUMN solicitud_aprobacion jsonb;
ALTER TABLE public.entregas_insumos ADD COLUMN solicitud_original jsonb,ADD COLUMN actor text;
CREATE TABLE public.insumos_historial(
 id uuid PRIMARY KEY,producto_id uuid REFERENCES public.catalogo_insumos(id),actor text NOT NULL,accion text NOT NULL,
 solicitud jsonb NOT NULL,antes jsonb,despues jsonb NOT NULL,registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.imagenes_insumos(
 id uuid PRIMARY KEY,mime text NOT NULL CHECK(mime IN ('image/png','image/jpeg','image/webp')),
 contenido bytea NOT NULL CHECK(octet_length(contenido) BETWEEN 12 AND 5242880),
 creado_por text NOT NULL,creado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
REVOKE ALL ON public.insumos_historial,public.imagenes_insumos FROM PUBLIC,inventario_app;
GRANT SELECT ON public.insumos_historial,public.imagenes_insumos TO inventario_app;
CREATE FUNCTION public.autorizar_insumos_utic(p_actor text) RETURNS void LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1795536000000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Operación reservada a UTIC' USING ERRCODE='42501';END IF;
END;$fn$;
REVOKE ALL ON FUNCTION public.autorizar_insumos_utic(text) FROM PUBLIC,inventario_app;
CREATE FUNCTION public.guardar_producto_insumo_acceso(p_actor text,p_solicitud uuid,p_datos jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE anterior public.catalogo_insumos%ROWTYPE;posterior public.catalogo_insumos%ROWTYPE;h public.insumos_historial%ROWTYPE;v_id uuid;k text;
BEGIN
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
END;$fn$;
CREATE FUNCTION public.ingresar_stock_insumo_acceso(p_actor text,p_solicitud uuid,p_producto uuid,p_cantidad integer) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE h public.insumos_historial%ROWTYPE;antes jsonb;despues jsonb;sol jsonb;
BEGIN
 PERFORM public.autorizar_insumos_utic(p_actor);
 IF p_solicitud IS NULL OR p_producto IS NULL OR p_cantidad IS NULL OR p_cantidad NOT BETWEEN 1 AND 100000 THEN RAISE EXCEPTION 'Ingreso inválido' USING ERRCODE='22023';END IF;
 sol:=jsonb_build_object('producto',p_producto,'cantidad',p_cantidad);SELECT * INTO h FROM public.insumos_historial WHERE id=p_solicitud;
 IF FOUND THEN IF h.actor=p_actor AND h.accion='stock' AND h.solicitud=sol THEN RETURN jsonb_build_object('repetida',true);END IF;RAISE EXCEPTION 'Solicitud reutilizada' USING ERRCODE='P3101';END IF;
 PERFORM 1 FROM public.catalogo_insumos WHERE id=p_producto AND activo FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Producto no disponible' USING ERRCODE='P3102';END IF;
 SELECT to_jsonb(s) INTO antes FROM public.stock_insumos s WHERE producto_id=p_producto FOR UPDATE;
 UPDATE public.stock_insumos SET existencia=existencia+p_cantidad,actualizado_en=CURRENT_TIMESTAMP WHERE producto_id=p_producto RETURNING to_jsonb(stock_insumos) INTO despues;
 IF NOT FOUND THEN RAISE EXCEPTION 'Producto sin stock registrado' USING ERRCODE='P3102';END IF;
 INSERT INTO public.insumos_historial(id,producto_id,actor,accion,solicitud,antes,despues) VALUES(p_solicitud,p_producto,p_actor,'stock',sol,antes,despues);RETURN jsonb_build_object('repetida',false);
END;$fn$;
CREATE FUNCTION public.guardar_foto_insumo_acceso(p_actor text,p_id uuid,p_mime text,p_contenido bytea) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 PERFORM public.autorizar_insumos_utic(p_actor);
 IF p_id IS NULL OR p_mime NOT IN ('image/png','image/jpeg','image/webp') OR p_contenido IS NULL OR octet_length(p_contenido) NOT BETWEEN 12 AND 5242880 OR NOT ((p_mime='image/png' AND encode(substring(p_contenido FROM 1 FOR 8),'hex')='89504e470d0a1a0a') OR (p_mime='image/jpeg' AND encode(substring(p_contenido FROM 1 FOR 3),'hex')='ffd8ff') OR (p_mime='image/webp' AND substring(p_contenido FROM 1 FOR 4)=convert_to('RIFF','UTF8') AND substring(p_contenido FROM 9 FOR 4)=convert_to('WEBP','UTF8'))) THEN RAISE EXCEPTION 'Imagen inválida' USING ERRCODE='22023';END IF;
 INSERT INTO public.imagenes_insumos(id,mime,contenido,creado_por) VALUES(p_id,p_mime,p_contenido,p_actor);RETURN p_id;
END;$fn$;
CREATE FUNCTION public.asignar_foto_insumo_acceso(p_actor text,p_producto uuid,p_imagen uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE anterior jsonb;posterior jsonb;
BEGIN
 PERFORM public.autorizar_insumos_utic(p_actor);PERFORM 1 FROM public.imagenes_insumos WHERE id=p_imagen FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Imagen no disponible' USING ERRCODE='22023';END IF;
 SELECT to_jsonb(c) INTO anterior FROM public.catalogo_insumos c WHERE id=p_producto FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Producto no disponible' USING ERRCODE='P3102';END IF;
 IF anterior->>'foto_url'='/api/insumos/imagen?id='||p_imagen::text THEN RETURN;END IF;
 UPDATE public.catalogo_insumos SET foto_url='/api/insumos/imagen?id='||p_imagen::text,version=version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=p_producto RETURNING to_jsonb(catalogo_insumos) INTO posterior;
 INSERT INTO public.insumos_historial(id,producto_id,actor,accion,solicitud,antes,despues) VALUES(gen_random_uuid(),p_producto,p_actor,'foto',jsonb_build_object('imagen',p_imagen),anterior,posterior);
END;$fn$;
REVOKE ALL ON FUNCTION public.guardar_producto_insumo_acceso(text,uuid,jsonb),public.ingresar_stock_insumo_acceso(text,uuid,uuid,integer),public.guardar_foto_insumo_acceso(text,uuid,text,bytea),public.asignar_foto_insumo_acceso(text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_producto_insumo_acceso(text,uuid,jsonb),public.ingresar_stock_insumo_acceso(text,uuid,uuid,integer),public.guardar_foto_insumo_acceso(text,uuid,text,bytea),public.asignar_foto_insumo_acceso(text,uuid,uuid) TO inventario_app;
CREATE OR REPLACE FUNCTION public.crear_solicitud_insumos(p_actor text,p_sede_id uuid,p_lineas jsonb,p_datos jsonb DEFAULT '{}'::jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE actor public.usuarios_acceso%ROWTYPE;v_id uuid;elem jsonb;pid uuid;cant integer;sol jsonb;anterior public.solicitudes_insumos%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1795536000000);
 SELECT * INTO actor FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion','encargado') FOR SHARE;
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
END;$fn$;
CREATE OR REPLACE FUNCTION public.aprobar_solicitud_insumos(p_actor text,p_solicitud uuid,p_datos jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE s public.solicitudes_insumos%ROWTYPE;e jsonb;d public.solicitudes_insumos_detalle%ROWTYPE;st public.stock_insumos%ROWTYPE;cantidad integer;sol jsonb;total integer:=0;
BEGIN
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
END;$fn$;
CREATE OR REPLACE FUNCTION public.entregar_solicitud_insumos(p_actor text,p_solicitud uuid,p_datos jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE s public.solicitudes_insumos%ROWTYPE;ent public.entregas_insumos%ROWTYPE;e jsonb;d public.solicitudes_insumos_detalle%ROWTYPE;r public.reservas_insumos%ROWTYPE;cantidad integer;sol jsonb;fecha date;total integer:=0;
BEGIN
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
END;$fn$;
CREATE OR REPLACE FUNCTION public.preparar_acta_insumo_acceso(p_actor text,p_id uuid,p_solicitud uuid,p_metadata jsonb,p_lineas jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE s public.solicitudes_insumos%ROWTYPE;ent public.entregas_insumos%ROWTYPE;sd public.sedes%ROWTYPE;a public.actas_documentos%ROWTYPE;meta jsonb;sol jsonb;bienes jsonb;datos jsonb;numero bigint;lineas jsonb;
BEGIN
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
END;$fn$;
CREATE OR REPLACE FUNCTION public.vincular_acta_entrega_insumo_acceso(p_actor text,p_acta uuid,p_entrega uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE a public.actas_documentos%ROWTYPE;e public.entregas_insumos%ROWTYPE;
BEGIN
 PERFORM public.autorizar_insumos_utic(p_actor);
 SELECT * INTO e FROM public.entregas_insumos WHERE id=p_entrega FOR UPDATE;
 SELECT * INTO a FROM public.actas_documentos WHERE id=p_acta;
 IF e.id IS NULL OR a.id IS NULL OR a.pdf IS NULL OR a.actor<>p_actor OR a.solicitud_insumo_id IS DISTINCT FROM e.solicitud_id OR a.entrega_insumo_id IS DISTINCT FROM e.id OR e.acta_id IS NOT NULL AND e.acta_id<>a.id THEN RAISE EXCEPTION 'El acta no corresponde a la entrega' USING ERRCODE='P2701';END IF;
 UPDATE public.entregas_insumos SET acta_id=p_acta WHERE id=e.id;
 UPDATE public.solicitudes_insumos SET acta_id=p_acta WHERE id=e.solicitud_id AND (acta_id IS NULL OR acta_id=p_acta);
 IF NOT FOUND THEN RAISE EXCEPTION 'La solicitud ya tiene otro documento' USING ERRCODE='P2701';END IF;
END;$fn$;
CREATE OR REPLACE FUNCTION public.cancelar_solicitud_insumos(p_actor text,p_solicitud uuid,p_motivo text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE s public.solicitudes_insumos%ROWTYPE;r public.reservas_insumos%ROWTYPE;
BEGIN
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
END;$fn$;
CREATE FUNCTION public.importar_foto_insumo_acceso(p_actor text,p_producto uuid,p_imagen uuid,p_url_anterior text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 PERFORM public.autorizar_insumos_utic(p_actor);
 PERFORM 1 FROM public.catalogo_insumos WHERE id=p_producto AND foto_url=p_url_anterior FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'La referencia de foto cambió' USING ERRCODE='P3101';END IF;
 PERFORM public.asignar_foto_insumo_acceso(p_actor,p_producto,p_imagen);
END;$fn$;
REVOKE ALL ON FUNCTION public.importar_foto_insumo_acceso(text,uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.importar_foto_insumo_acceso(text,uuid,uuid,text) TO inventario_app;
-- Restablecer ACL explícitas tras reemplazar funciones.
REVOKE ALL ON FUNCTION public.crear_solicitud_insumos(text,uuid,jsonb,jsonb),public.aprobar_solicitud_insumos(text,uuid,jsonb),public.entregar_solicitud_insumos(text,uuid,jsonb),public.preparar_acta_insumo_acceso(text,uuid,uuid,jsonb,jsonb),public.vincular_acta_entrega_insumo_acceso(text,uuid,uuid),public.cancelar_solicitud_insumos(text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_solicitud_insumos(text,uuid,jsonb,jsonb),public.aprobar_solicitud_insumos(text,uuid,jsonb),public.entregar_solicitud_insumos(text,uuid,jsonb),public.preparar_acta_insumo_acceso(text,uuid,uuid,jsonb,jsonb),public.vincular_acta_entrega_insumo_acceso(text,uuid,uuid),public.cancelar_solicitud_insumos(text,uuid,text) TO inventario_app;
-- Reconciliar reservas de solicitudes cerradas sin alterar existencia física ni actas.
DO $do$ DECLARE r record;antes jsonb;despues jsonb;BEGIN
 FOR r IN SELECT st.producto_id,COALESCE(sum(rv.cantidad_reservada) FILTER(WHERE si.estado='aprobada' AND rv.consumida_en IS NULL AND rv.liberada_en IS NULL),0)::integer AS correcta FROM public.stock_insumos st LEFT JOIN public.reservas_insumos rv ON rv.producto_id=st.producto_id LEFT JOIN public.solicitudes_insumos si ON si.id=rv.solicitud_id GROUP BY st.producto_id LOOP
  SELECT to_jsonb(st) INTO antes FROM public.stock_insumos st WHERE producto_id=r.producto_id;
  IF (antes->>'reservado')::integer<>r.correcta AND r.correcta<=(antes->>'existencia')::integer THEN
   UPDATE public.stock_insumos SET reservado=r.correcta WHERE producto_id=r.producto_id RETURNING to_jsonb(stock_insumos) INTO despues;
   INSERT INTO public.insumos_historial(id,producto_id,actor,accion,solicitud,antes,despues) VALUES(gen_random_uuid(),r.producto_id,'migracion:auditoria-estados-insumos','reconciliacion',jsonb_build_object('criterio','reservas abiertas de solicitudes aprobadas'),antes,despues);
  END IF;
 END LOOP;
END;$do$;
ALTER TABLE public.stock_insumos ADD CONSTRAINT stock_insumos_reserva_fisica CHECK(reservado<=existencia) NOT VALID;
`);}
export const down=false;
