export function up(pgm){pgm.sql(`
CREATE TABLE public.celulares (
 id uuid PRIMARY KEY,
 sede_id uuid NOT NULL REFERENCES public.sedes(id),
 telefono text NOT NULL CHECK(telefono ~ '^[+]569[0-9]{8}$'),
 marca text NOT NULL DEFAULT '' CHECK(length(marca)<=120 AND marca=btrim(marca) AND marca !~ '[[:cntrl:]]'),
 modelo text NOT NULL DEFAULT '' CHECK(length(modelo)<=200 AND modelo=btrim(modelo) AND modelo !~ '[[:cntrl:]]'),
 imei text CHECK(imei IS NULL OR imei ~ '^[0-9]{15}$'),
 numero_inventario text CHECK(numero_inventario IS NULL OR (length(numero_inventario) BETWEEN 1 AND 120 AND numero_inventario=btrim(numero_inventario) AND numero_inventario !~ '[[:cntrl:]]')),
 condicion_tecnica text NOT NULL DEFAULT 'sin_verificar' CHECK(condicion_tecnica IN ('sin_verificar','operativo','en_reparacion','fuera_de_servicio')),
 responsable text NOT NULL DEFAULT '' CHECK(length(responsable)<=200 AND responsable=btrim(responsable) AND responsable !~ '[[:cntrl:]]'),
 observaciones text NOT NULL DEFAULT '' CHECK(length(observaciones)<=2000 AND observaciones=btrim(observaciones)),
 activo boolean NOT NULL DEFAULT true,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 creado_por text NOT NULL,creado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 actualizado_por text NOT NULL,actualizado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX celulares_telefono_vigente ON public.celulares(telefono) WHERE activo;
CREATE UNIQUE INDEX celulares_imei_unico ON public.celulares(imei) WHERE imei IS NOT NULL;
CREATE UNIQUE INDEX celulares_inventario_unico ON public.celulares(lower(numero_inventario)) WHERE numero_inventario IS NOT NULL;
CREATE INDEX celulares_sede ON public.celulares(sede_id,activo,id);
CREATE TABLE public.celulares_historial (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 celular_id uuid NOT NULL REFERENCES public.celulares(id),
 actor text NOT NULL,motivo text NOT NULL CHECK(length(btrim(motivo)) BETWEEN 1 AND 500),
 antes jsonb,despues jsonb NOT NULL,registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
REVOKE ALL ON public.celulares,public.celulares_historial FROM PUBLIC,inventario_app;
GRANT SELECT ON public.celulares,public.celulares_historial TO inventario_app;
CREATE FUNCTION public.guardar_celular_acceso(p_actor text,p_id uuid,p_datos jsonb,p_version integer,p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE anterior public.celulares%ROWTYPE;posterior public.celulares%ROWTYPE;actor public.usuarios_acceso%ROWTYPE;sede public.sedes%ROWTYPE;sede_anterior public.sedes%ROWTYPE;
 sede_id uuid;telefono text;marca text;modelo text;imei text;inventario text;condicion text;responsable text;observaciones text;activo boolean;
 normalizado jsonb;previo jsonb;k text;suma integer;digito integer;i integer;
BEGIN
 PERFORM pg_advisory_xact_lock(1794182400000);
 SELECT * INTO actor FROM public.usuarios_acceso u WHERE u.correo=p_actor AND u.activo AND u.rol IN ('administrador','administrador_gestion','encargado') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR p_version IS NULL OR p_version<0 OR p_version>=2147483647 OR p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 1 AND 500 OR p_motivo ~ '[[:cntrl:]]' OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_datos) t(k) WHERE t.k NOT IN ('sedeId','telefono','marca','modelo','imei','inventario','condicionTecnica','responsable','observaciones','activo')) THEN RAISE EXCEPTION 'Campo no permitido' USING ERRCODE='22023';END IF;
 FOREACH k IN ARRAY ARRAY['sedeId','telefono','marca','modelo','imei','inventario','condicionTecnica','responsable','observaciones'] LOOP
  IF jsonb_typeof(p_datos->k) IS DISTINCT FROM 'string' OR regexp_replace(p_datos->>k,CASE WHEN k='observaciones' THEN E'[\\r\\n\\t]' ELSE '$^' END,'','g') ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Campo inválido' USING ERRCODE='22023';END IF;
 END LOOP;
 IF jsonb_typeof(p_datos->'activo') IS DISTINCT FROM 'boolean' OR p_datos->>'sedeId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Sede o vigencia inválida' USING ERRCODE='22023';END IF;
 sede_id:=(p_datos->>'sedeId')::uuid;telefono:=btrim(p_datos->>'telefono');
 marca:=normalize(btrim(p_datos->>'marca'),NFC);modelo:=normalize(btrim(p_datos->>'modelo'),NFC);
 imei:=NULLIF(btrim(p_datos->>'imei'),'');inventario:=NULLIF(normalize(btrim(p_datos->>'inventario'),NFC),'');
 condicion:=p_datos->>'condicionTecnica';responsable:=normalize(btrim(p_datos->>'responsable'),NFC);observaciones:=normalize(btrim(p_datos->>'observaciones'),NFC);activo:=(p_datos->>'activo')::boolean;
 IF telefono !~ '^[+]569[0-9]{8}$' OR length(marca)>120 OR length(modelo)>200 OR length(inventario)>120 OR length(responsable)>200 OR length(observaciones)>2000 OR condicion NOT IN ('sin_verificar','operativo','en_reparacion','fuera_de_servicio') THEN RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023';END IF;
 IF imei IS NOT NULL THEN
  IF imei !~ '^[0-9]{15}$' THEN RAISE EXCEPTION 'IMEI inválido' USING ERRCODE='22023';END IF;
  suma:=0;FOR i IN 1..15 LOOP digito:=substring(imei,i,1)::integer;IF i%2=0 THEN digito:=digito*2;IF digito>9 THEN digito:=digito-9;END IF;END IF;suma:=suma+digito;END LOOP;
  IF suma%10<>0 THEN RAISE EXCEPTION 'Dígito IMEI inválido' USING ERRCODE='22023';END IF;
 END IF;
 SELECT * INTO anterior FROM public.celulares WHERE id=p_id FOR UPDATE;
 IF actor.rol='encargado' AND (actor.sede_id IS NULL OR sede_id<>actor.sede_id OR (anterior.id IS NOT NULL AND anterior.sede_id<>actor.sede_id)) THEN RAISE EXCEPTION 'Sin autorización para esta sede' USING ERRCODE='42501';END IF;
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
END;$fn$;
REVOKE ALL ON FUNCTION public.guardar_celular_acceso(text,uuid,jsonb,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_celular_acceso(text,uuid,jsonb,integer,text) TO inventario_app;
`);}
export const down=false;
