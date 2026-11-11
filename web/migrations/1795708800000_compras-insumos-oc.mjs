export function up(pgm){pgm.sql(`
CREATE FUNCTION public.clave_insumo(p_texto text) RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path=pg_catalog,pg_temp AS $fn$ SELECT lower(regexp_replace(btrim(normalize(p_texto,NFC)),'[[:space:]]+',' ','g'));$fn$;
REVOKE ALL ON FUNCTION public.clave_insumo(text) FROM PUBLIC,inventario_app;
CREATE TABLE public.categorias_insumos_codigos(
 clave text PRIMARY KEY,nombre text NOT NULL,prefijo text NOT NULL UNIQUE CHECK(prefijo ~ '^[A-Z0-9]{1,20}$'),ultimo bigint NOT NULL DEFAULT 0 CHECK(ultimo BETWEEN 0 AND 999999999999)
);
REVOKE ALL ON public.categorias_insumos_codigos FROM PUBLIC,inventario_app;
GRANT SELECT ON public.categorias_insumos_codigos TO inventario_app;
CREATE FUNCTION public.asegurar_categoria_insumo(p_nombre text) RETURNS public.categorias_insumos_codigos LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE c public.categorias_insumos_codigos%ROWTYPE;k text;base text;pref text;n integer:=1;ultimo_previo bigint;
BEGIN
 k:=public.clave_insumo(p_nombre);IF k IS NULL OR length(k) NOT BETWEEN 1 AND 120 OR p_nombre ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Categoría inválida' USING ERRCODE='22023';END IF;
 SELECT * INTO c FROM public.categorias_insumos_codigos WHERE clave=k;IF FOUND THEN RETURN c;END IF;
 base:=left(regexp_replace(translate(upper(normalize(p_nombre,NFC)),'ÁÉÍÓÚÜÑ','AEIOUUN'),'[^A-Z0-9]','','g'),3);IF base='' THEN base:='CAT';END IF;pref:=base;
 WHILE EXISTS(SELECT 1 FROM public.categorias_insumos_codigos WHERE prefijo=pref) LOOP n:=n+1;pref:=base||n::text;END LOOP;
 SELECT COALESCE(max(substring(codigo FROM length(pref)+2)::bigint),0) INTO ultimo_previo FROM public.catalogo_insumos WHERE upper(codigo) ~ ('^'||pref||'-[0-9]{1,12}$');
 INSERT INTO public.categorias_insumos_codigos(clave,nombre,prefijo,ultimo) VALUES(k,btrim(normalize(p_nombre,NFC)),pref,ultimo_previo) RETURNING * INTO c;RETURN c;
END;$fn$;
REVOKE ALL ON FUNCTION public.asegurar_categoria_insumo(text) FROM PUBLIC,inventario_app;
DO $categorias$ DECLARE r record;BEGIN FOR r IN SELECT DISTINCT categoria FROM public.catalogo_insumos WHERE length(btrim(categoria)) BETWEEN 1 AND 120 AND categoria !~ '[[:cntrl:]]' ORDER BY categoria LOOP PERFORM public.asegurar_categoria_insumo(r.categoria);END LOOP;END;$categorias$;
ALTER TABLE public.catalogo_insumos ADD COLUMN categoria_codigo text REFERENCES public.categorias_insumos_codigos(clave);
CREATE FUNCTION public.conservar_codigo_insumo() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN IF OLD.categoria_codigo IS NOT NULL AND NEW.codigo IS DISTINCT FROM OLD.codigo THEN RAISE EXCEPTION 'El código automático es permanente' USING ERRCODE='22023';END IF;RETURN NEW;END;$fn$;
REVOKE ALL ON FUNCTION public.conservar_codigo_insumo() FROM PUBLIC,inventario_app;
CREATE TRIGGER catalogo_insumos_conservar_codigo BEFORE UPDATE OF codigo ON public.catalogo_insumos FOR EACH ROW EXECUTE FUNCTION public.conservar_codigo_insumo();
CREATE TABLE public.ingresos_insumos(
 id uuid PRIMARY KEY,producto_id uuid NOT NULL REFERENCES public.catalogo_insumos(id),clase text NOT NULL CHECK(clase IN ('compra','saldo_anterior')),
 cantidad integer NOT NULL CHECK(cantidad>0),oc text,fecha_compra date,actor text NOT NULL,producto jsonb NOT NULL,solicitud jsonb NOT NULL,registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK((clase='compra' AND oc IS NOT NULL AND length(btrim(oc)) BETWEEN 1 AND 120 AND oc !~ '[[:cntrl:]]' AND fecha_compra IS NOT NULL) OR (clase='saldo_anterior' AND oc IS NULL AND fecha_compra IS NULL))
);
CREATE INDEX ingresos_insumos_producto_fecha ON public.ingresos_insumos(producto_id,registrado_en DESC,id DESC);
REVOKE ALL ON public.ingresos_insumos FROM PUBLIC,inventario_app;
GRANT SELECT ON public.ingresos_insumos TO inventario_app;
-- Antecedente del saldo existente, sin inventar OC/fecha ni volver a sumar stock.
INSERT INTO public.ingresos_insumos(id,producto_id,clase,cantidad,oc,fecha_compra,actor,producto,solicitud)
 SELECT gen_random_uuid(),c.id,'saldo_anterior',s.existencia,NULL,NULL,'migracion:compras-insumos',jsonb_build_object('codigo',c.codigo,'nombre',c.nombre,'categoria',c.categoria,'unidad',c.unidad),jsonb_build_object('existencia',s.existencia,'reservado',s.reservado)
 FROM public.catalogo_insumos c JOIN public.stock_insumos s ON s.producto_id=c.id WHERE s.existencia>0;
CREATE FUNCTION public.registrar_compra_insumo_acceso(p_actor text,p_solicitud uuid,p_datos jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE h public.ingresos_insumos%ROWTYPE;p public.catalogo_insumos%ROWTYPE;c public.categorias_insumos_codigos%ROWTYPE;v_id uuid;v_version integer;v_cantidad integer;v_fecha date;v_oc text;v_nombre text;v_categoria text;v_unidad text;k text;sol jsonb;num bigint;codigo_nuevo text;coincidencias integer;
BEGIN
 PERFORM public.autorizar_insumos_utic(p_actor);
 IF p_solicitud IS NULL OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(p_datos))<>8 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_datos)t(k) WHERE t.k NOT IN ('productoId','version','nombre','categoria','unidad','cantidad','oc','fechaCompra')) THEN RAISE EXCEPTION 'Compra inválida' USING ERRCODE='22023';END IF;
 FOREACH k IN ARRAY ARRAY['productoId','nombre','categoria','unidad','oc','fechaCompra'] LOOP IF jsonb_typeof(p_datos->k) IS DISTINCT FROM 'string' OR p_datos->>k ~ '[[:cntrl:]]' THEN RAISE EXCEPTION 'Datos de compra inválidos' USING ERRCODE='22023';END IF;END LOOP;
 IF (p_datos->>'productoId'<>'' AND p_datos->>'productoId' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$') OR jsonb_typeof(p_datos->'version') IS DISTINCT FROM 'number' OR p_datos->>'version' !~ '^[0-9]{1,10}$' OR (p_datos->>'version')::numeric>=2147483647 OR jsonb_typeof(p_datos->'cantidad') IS DISTINCT FROM 'number' OR p_datos->>'cantidad' !~ '^[1-9][0-9]{0,5}$' OR (p_datos->>'cantidad')::integer>100000 THEN RAISE EXCEPTION 'Producto, cantidad o versión inválidos' USING ERRCODE='22023';END IF;
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
END;$fn$;
REVOKE ALL ON FUNCTION public.registrar_compra_insumo_acceso(text,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_compra_insumo_acceso(text,uuid,jsonb) TO inventario_app;
`);}
export const down=false;
