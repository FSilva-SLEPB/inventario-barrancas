export function up(pgm){pgm.sql(`
CREATE TABLE public.actas_contador(id boolean PRIMARY KEY DEFAULT true CHECK(id),ultimo bigint NOT NULL DEFAULT -1 CHECK(ultimo BETWEEN -1 AND 999999999999));
INSERT INTO public.actas_contador(id) VALUES(true);
CREATE TABLE public.actas_documentos(
 id uuid PRIMARY KEY,movimiento_id uuid NOT NULL UNIQUE REFERENCES public.movimientos_inventario(id),folio bigint NOT NULL UNIQUE CHECK(folio BETWEEN 0 AND 999999999999),version integer NOT NULL DEFAULT 1 CHECK(version=1),
 actor text NOT NULL,solicitud jsonb NOT NULL,datos jsonb NOT NULL,pdf bytea,sha256 text,
 emitido_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK((pdf IS NULL AND sha256 IS NULL) OR (pdf IS NOT NULL AND sha256 IS NOT NULL AND octet_length(pdf) BETWEEN 100 AND 8388608 AND left(encode(pdf,'escape'),5)='%PDF-' AND sha256=encode(sha256(pdf),'hex')))
);
CREATE TABLE public.actas_envios(
 id uuid PRIMARY KEY,acta_id uuid NOT NULL REFERENCES public.actas_documentos(id),actor text NOT NULL,destinatarios text[] NOT NULL CHECK(cardinality(destinatarios) BETWEEN 1 AND 5),
 estado text NOT NULL CHECK(estado IN ('en_curso','aceptado','parcial','fallido','no_confirmado')),remitente text NOT NULL,
 token uuid NOT NULL,resultado jsonb NOT NULL DEFAULT '{}'::jsonb,creado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,terminado_en timestamptz
);
CREATE INDEX actas_envios_documento_fecha ON public.actas_envios(acta_id,creado_en DESC);
REVOKE ALL ON public.actas_contador,public.actas_documentos,public.actas_envios FROM PUBLIC,inventario_app;
GRANT SELECT ON public.actas_contador,public.actas_documentos,public.actas_envios TO inventario_app;

CREATE FUNCTION public.preparar_acta_acceso(p_actor text,p_id uuid,p_movimiento uuid,p_metadata jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE m public.movimientos_inventario%ROWTYPE;a public.actas_documentos%ROWTYPE;meta jsonb:='{}';datos jsonb;numero bigint;k text;v text;maximo integer;rut text;suma integer;digito integer;dv text;
BEGIN
 PERFORM pg_advisory_xact_lock(1794355200000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR p_movimiento IS NULL OR jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_metadata)t(k) WHERE t.k NOT IN ('entregaNombre','entregaRun','entregaCargo','entregaCorreo','recibeRun','recibeCargo','recibeCorreo','accesorios','observaciones')) THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023';END IF;
 FOREACH k IN ARRAY ARRAY['entregaNombre','entregaRun','entregaCargo','entregaCorreo','recibeRun','recibeCargo','recibeCorreo','accesorios','observaciones'] LOOP
  maximo:=CASE WHEN k='observaciones' THEN 2000 WHEN k='accesorios' THEN 500 WHEN k LIKE '%Correo' THEN 254 WHEN k LIKE '%Run' THEN 12 ELSE 200 END;
  IF jsonb_typeof(p_metadata->k) IS DISTINCT FROM 'string' OR length(p_metadata->>k)>maximo OR (CASE WHEN k IN ('observaciones','accesorios') THEN replace(replace(replace(p_metadata->>k,E'\\r',''),E'\\n',''),E'\\t','') ELSE p_metadata->>k END) ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Campo inválido' USING ERRCODE='22023';END IF;
  v:=normalize(btrim(p_metadata->>k),NFC);
  IF k='entregaNombre' AND v='' THEN RAISE EXCEPTION 'Nombre requerido' USING ERRCODE='22023';END IF;
  IF k LIKE '%Run' THEN
   rut:=upper(replace(v,'.',''));IF rut !~ '^[0-9]{7,8}-[0-9K]$' THEN RAISE EXCEPTION 'RUN inválido' USING ERRCODE='22023';END IF;
   suma:=0;FOR digito IN 1..length(split_part(rut,'-',1)) LOOP suma:=suma+substring(reverse(split_part(rut,'-',1)),digito,1)::integer*(2+(digito-1)%6);END LOOP;
   digito:=11-suma%11;dv:=CASE digito WHEN 11 THEN '0' WHEN 10 THEN 'K' ELSE digito::text END;IF split_part(rut,'-',2)<>dv THEN RAISE EXCEPTION 'RUN inválido' USING ERRCODE='22023';END IF;v:=rut;
  END IF;
  IF k LIKE '%Correo' THEN v:=lower(v);IF v<>'' AND (v !~ '^[a-z0-9._%+!-]+@[a-z0-9.-]+[.][a-z]{2,63}$' OR v LIKE '%..%') THEN RAISE EXCEPTION 'Correo inválido' USING ERRCODE='22023';END IF;END IF;
  meta:=meta||jsonb_build_object(k,v);
 END LOOP;
 SELECT * INTO a FROM public.actas_documentos WHERE id=p_id;
 IF FOUND THEN IF a.actor=p_actor AND a.movimiento_id=p_movimiento AND a.solicitud=meta THEN RETURN jsonb_build_object('id',a.id,'datos',a.datos,'completa',a.pdf IS NOT NULL);END IF;RAISE EXCEPTION 'Solicitud repetida con otros datos' USING ERRCODE='P2701';END IF;
 IF EXISTS(SELECT 1 FROM public.actas_documentos WHERE movimiento_id=p_movimiento) THEN RAISE EXCEPTION 'Ya existe un acta' USING ERRCODE='P2701';END IF;
 SELECT * INTO m FROM public.movimientos_inventario WHERE id=p_movimiento FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Movimiento no disponible' USING ERRCODE='P2702';END IF;
 UPDATE public.actas_contador SET ultimo=ultimo+1 WHERE id AND ultimo<999999999999 RETURNING ultimo INTO numero;
 IF NOT FOUND THEN RAISE EXCEPTION 'No se pudo asignar folio' USING ERRCODE='P2702';END IF;
 datos:=jsonb_build_object('schema',1,'tipo',m.accion,'fecha',m.fecha::text,'emitidoEn',CURRENT_TIMESTAMP,'movimientoId',m.id,'clase',CASE WHEN m.equipo_id IS NOT NULL THEN 'equipo' ELSE 'celular' END,
 'origen',CASE WHEN m.accion='devolucion' THEN m.antes->>'sedeNombre' ELSE 'Bodega TI' END,'destino',CASE WHEN m.accion='asignacion' THEN m.despues->>'sedeNombre' ELSE 'Bodega TI' END,
 'sedeNombre',COALESCE(m.despues->>'sedeNombre',''),'rbd',COALESCE(m.despues->>'rbd',''),'receptorNombre',m.receptor,'actor',p_actor,'bienes',jsonb_build_array(m.despues),'metadata',meta,'folio',numero,'version',1);
 INSERT INTO public.actas_documentos(id,movimiento_id,folio,actor,solicitud,datos) VALUES(p_id,p_movimiento,numero,p_actor,meta,datos);
 RETURN jsonb_build_object('id',p_id,'datos',datos,'completa',false);
END;$fn$;
REVOKE ALL ON FUNCTION public.preparar_acta_acceso(text,uuid,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preparar_acta_acceso(text,uuid,uuid,jsonb) TO inventario_app;

CREATE FUNCTION public.completar_pdf_acta_acceso(p_actor text,p_id uuid,p_pdf bytea)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion') FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF p_pdf IS NULL OR octet_length(p_pdf) NOT BETWEEN 100 AND 8388608 OR left(encode(p_pdf,'escape'),5)<>'%PDF-' THEN RAISE EXCEPTION 'PDF inválido' USING ERRCODE='22023';END IF;
 UPDATE public.actas_documentos SET pdf=p_pdf,sha256=encode(sha256(p_pdf),'hex') WHERE id=p_id AND actor=p_actor AND pdf IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Documento no disponible' USING ERRCODE='P2701';END IF;
END;$fn$;
REVOKE ALL ON FUNCTION public.completar_pdf_acta_acceso(text,uuid,bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.completar_pdf_acta_acceso(text,uuid,bytea) TO inventario_app;

CREATE FUNCTION public.iniciar_envio_acta_acceso(p_actor text,p_id uuid,p_acta uuid,p_destinos text[],p_remitente text,p_revisado boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE previo public.actas_envios%ROWTYPE;token uuid;destinos text[];x text;
BEGIN
 PERFORM pg_advisory_xact_lock(1794355200000);
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion') FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
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
END;$fn$;
REVOKE ALL ON FUNCTION public.iniciar_envio_acta_acceso(text,uuid,uuid,text[],text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.iniciar_envio_acta_acceso(text,uuid,uuid,text[],text,boolean) TO inventario_app;

-- El token de procesamiento permite registrar el resultado incluso si se revocó al solicitante durante SMTP.
CREATE FUNCTION public.terminar_envio_acta_acceso(p_id uuid,p_token uuid,p_estado text,p_resultado jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 IF p_estado IS NULL OR p_estado NOT IN ('aceptado','parcial','fallido','no_confirmado') OR jsonb_typeof(p_resultado) IS DISTINCT FROM 'object' OR octet_length(p_resultado::text)>4000 THEN RAISE EXCEPTION 'Resultado inválido' USING ERRCODE='22023';END IF;
 UPDATE public.actas_envios SET estado=p_estado,resultado=p_resultado,terminado_en=CURRENT_TIMESTAMP WHERE id=p_id AND token=p_token AND estado IN ('en_curso','no_confirmado') AND terminado_en IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Envío no disponible' USING ERRCODE='P2701';END IF;
END;$fn$;
REVOKE ALL ON FUNCTION public.terminar_envio_acta_acceso(uuid,uuid,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.terminar_envio_acta_acceso(uuid,uuid,text,jsonb) TO inventario_app;
`);}
export const down=false;
