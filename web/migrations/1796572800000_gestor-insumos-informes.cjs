exports.up=pgm=>pgm.sql(String.raw`
-- Trazabilidad de ampliaciones de catálogo sin atribuir una identidad humana a SQL.
CREATE TABLE public.rbac_cambios_migracion(nombre text PRIMARY KEY,actor_sql text NOT NULL,antes jsonb NOT NULL,despues jsonb NOT NULL,registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
REVOKE ALL ON public.rbac_cambios_migracion FROM PUBLIC,inventario_app;
GRANT SELECT ON public.rbac_cambios_migracion TO inventario_app;
DO $fn$
DECLARE v_perfil record;previos text[];actuales text[];nuevos text[]:=ARRAY['gestion_insumos.consultar','gestion_insumos.exportar','gestion_insumos.descargar'];a jsonb;d jsonb;
BEGIN
 SELECT jsonb_build_object('perfiles',(SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object('permisos',ARRAY(SELECT permiso FROM public.rbac_perfil_permisos WHERE perfil_id=p.id ORDER BY permiso))) FROM public.rbac_perfiles p),'anteriores',(SELECT jsonb_agg(to_jsonb(r)) FROM public.rbac_anteriores r),'versiones',(SELECT jsonb_agg(jsonb_build_object('correo',u.correo,'version',u.version)) FROM public.usuarios_acceso u WHERE perfil_id IS NULL AND rol IN ('administrador','administrador_gestion','gestor_insumos'))) INTO a;
 INSERT INTO public.rbac_permisos(codigo,recurso,accion) SELECT 'gestion_insumos.'||v,'gestion_insumos',v FROM unnest(ARRAY['consultar','exportar','descargar'])v;
 FOR v_perfil IN SELECT * FROM public.rbac_perfiles WHERE clase='sistema' OR codigo IN ('gestor_tic','insumos') LOOP
  SELECT permisos INTO previos FROM public.rbac_limites_perfiles WHERE codigo=v_perfil.codigo;
  SELECT COALESCE(array_agg(permiso),'{}'::text[]) INTO actuales FROM public.rbac_perfil_permisos WHERE perfil_id=v_perfil.id;
  -- Respetar un perfil operativo que el Administrador ya haya restringido.
  IF v_perfil.clase='sistema' OR (actuales<@previos AND previos<@actuales) THEN
   INSERT INTO public.rbac_perfil_permisos SELECT v_perfil.id,unnest(nuevos);
   UPDATE public.rbac_perfiles SET version=version+1 WHERE id=v_perfil.id;
  END IF;
 END LOOP;
 UPDATE public.rbac_limites_perfiles SET permisos=permisos||nuevos WHERE codigo IN ('sistema','gestor_tic','insumos');
 UPDATE public.rbac_anteriores SET permisos=permisos||nuevos WHERE rol IN ('administrador','administrador_gestion','gestor_insumos');
 UPDATE public.usuarios_acceso SET version=version+1 WHERE perfil_id IS NULL AND rol IN ('administrador','administrador_gestion','gestor_insumos');
 SELECT jsonb_build_object('perfiles',(SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object('permisos',ARRAY(SELECT permiso FROM public.rbac_perfil_permisos WHERE perfil_id=p.id ORDER BY permiso))) FROM public.rbac_perfiles p),'anteriores',(SELECT jsonb_agg(to_jsonb(r)) FROM public.rbac_anteriores r),'versiones',(SELECT jsonb_agg(jsonb_build_object('correo',u.correo,'version',u.version)) FROM public.usuarios_acceso u WHERE perfil_id IS NULL AND rol IN ('administrador','administrador_gestion','gestor_insumos'))) INTO d;
 INSERT INTO public.rbac_cambios_migracion VALUES('1796572800000_gestor-insumos-informes',current_user,a,d,CURRENT_TIMESTAMP);
END;$fn$;
CREATE INDEX solicitudes_insumos_fecha_ingreso ON public.solicitudes_insumos(solicitado_en,id);
CREATE INDEX solicitudes_insumos_fecha_entrega ON public.solicitudes_insumos(entregado_en,id) WHERE entregado_en IS NOT NULL;
CREATE FUNCTION public.consultar_gestor_insumos(p_actor text,p_filtros jsonb,p_accion text DEFAULT 'consultar') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE k text;v_sede uuid;v_producto uuid;v_desde date;v_hasta date;v_tipo text;v_categoria text;v_q text;v_estado text;v_base text;v_grupo text;v_vista text;v_pagina integer;v_limite integer;v_stock boolean;salida jsonb;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'gestion_insumos.consultar');
 IF public.rbac_contexto(p_actor)->>'alcance' IS DISTINCT FROM 'global' THEN RAISE EXCEPTION 'El gestor requiere alcance global' USING ERRCODE='42501';END IF;
 IF p_accion='exportar' THEN PERFORM public.rbac_exigir(p_actor,'gestion_insumos.exportar');PERFORM public.rbac_exigir(p_actor,'gestion_insumos.descargar');ELSIF p_accion<>'consultar' OR p_accion IS NULL THEN RAISE EXCEPTION 'Acción inválida' USING ERRCODE='22023';END IF;
 IF jsonb_typeof(p_filtros) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_filtros)t(k) WHERE t.k NOT IN ('sede','producto','desde','hasta','tipo','categoria','q','estado','base','grupo','vista','pagina','limite')) THEN RAISE EXCEPTION 'Filtros inválidos' USING ERRCODE='22023';END IF;
 FOR k IN SELECT jsonb_object_keys(p_filtros) LOOP
  IF jsonb_typeof(p_filtros->k) IS DISTINCT FROM (CASE WHEN k IN ('pagina','limite') THEN 'number' ELSE 'string' END) THEN RAISE EXCEPTION 'Tipo de filtro inválido' USING ERRCODE='22023';END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY['sede','producto'] LOOP
  IF COALESCE(p_filtros->>k,'')<>'' AND p_filtros->>k !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Identificador inválido' USING ERRCODE='22023';END IF;
 END LOOP;
 FOREACH k IN ARRAY ARRAY['desde','hasta'] LOOP
  IF COALESCE(p_filtros->>k,'')<>'' AND (p_filtros->>k !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR length(p_filtros->>k)<>10) THEN RAISE EXCEPTION 'Fecha inválida' USING ERRCODE='22023';END IF;
 END LOOP;
 v_sede:=NULLIF(p_filtros->>'sede','')::uuid;v_producto:=NULLIF(p_filtros->>'producto','')::uuid;v_desde:=NULLIF(p_filtros->>'desde','')::date;v_hasta:=NULLIF(p_filtros->>'hasta','')::date;
 v_tipo:=COALESCE(p_filtros->>'tipo','');v_categoria:=COALESCE(p_filtros->>'categoria','');v_q:=COALESCE(p_filtros->>'q','');v_estado:=COALESCE(p_filtros->>'estado','');v_base:=COALESCE(p_filtros->>'base','solicitud');v_grupo:=COALESCE(p_filtros->>'grupo','todas');v_vista:=COALESCE(p_filtros->>'vista','dashboard');
 IF COALESCE(p_filtros->>'pagina','1') !~ '^[1-9][0-9]{0,5}$' OR COALESCE(p_filtros->>'limite','50') !~ '^[1-9][0-9]{0,4}$' THEN RAISE EXCEPTION 'Página inválida' USING ERRCODE='22023';END IF;
 v_pagina:=COALESCE((p_filtros->>'pagina')::integer,1);v_limite:=COALESCE((p_filtros->>'limite')::integer,50);
 IF (v_limite NOT IN (50,100,150) AND NOT (p_accion='exportar' AND v_limite=10000)) OR length(v_categoria)>120 OR length(v_q)>150 OR v_tipo NOT IN ('','establecimiento','jardin_infantil','nivel_central') OR v_estado NOT IN ('','activas','finalizadas','solicitada','en_validacion','aprobada','entregada','cancelada') OR v_base NOT IN ('solicitud','entrega') OR v_grupo NOT IN ('todas','pendientes','validadas','aprobadas','entregadas') OR v_vista NOT IN ('dashboard','sedes','productos','consolidado','detalle','stock') OR v_desde>v_hasta THEN RAISE EXCEPTION 'Filtros fuera de rango' USING ERRCODE='22023';END IF;
 IF v_vista='stock' THEN PERFORM public.rbac_exigir(p_actor,'stock_insumos.consultar');ELSE PERFORM public.rbac_exigir(p_actor,'seguimiento_insumos.consultar');END IF;
 v_stock:=public.rbac_tiene(p_actor,'stock_insumos.consultar');
 WITH lineas AS MATERIALIZED (
  SELECT si.id AS solicitud_id,si.estado,si.solicitado_en,si.validado_en,si.aprobado_en,si.entregado_en,s.id AS sede_id,s.rbd,s.nombre AS sede,s.tipo,c.id AS producto_id,c.codigo,c.nombre AS producto,c.categoria,c.unidad,d.cantidad_solicitada,d.cantidad_aprobada,d.cantidad_entregada
  FROM public.solicitudes_insumos si JOIN public.sedes s ON s.id=si.sede_id JOIN public.solicitudes_insumos_detalle d ON d.solicitud_id=si.id JOIN public.catalogo_insumos c ON c.id=d.producto_id
  WHERE (v_sede IS NULL OR si.sede_id=v_sede) AND (v_producto IS NULL OR c.id=v_producto) AND (v_tipo='' OR s.tipo=v_tipo) AND (v_categoria='' OR c.categoria=v_categoria)
   AND (v_q='' OR c.nombre ILIKE '%'||v_q||'%' OR c.codigo ILIKE '%'||v_q||'%') AND (v_estado='' OR si.estado=v_estado OR v_estado='activas' AND si.estado IN ('solicitada','en_validacion','aprobada') OR v_estado='finalizadas' AND si.estado IN ('entregada','cancelada')) AND (v_base<>'entrega' OR si.entregado_en IS NOT NULL)
   AND (v_grupo='todas' OR v_grupo='pendientes' AND si.estado IN ('solicitada','en_validacion','aprobada') OR v_grupo='validadas' AND si.estado IN ('en_validacion','aprobada') AND si.validado_en IS NOT NULL OR v_grupo='aprobadas' AND si.estado='aprobada' OR v_grupo='entregadas' AND si.estado='entregada')
   AND (v_desde IS NULL OR ((CASE WHEN v_base='entrega' THEN si.entregado_en ELSE si.solicitado_en END) AT TIME ZONE 'America/Santiago')::date>=v_desde)
   AND (v_hasta IS NULL OR ((CASE WHEN v_base='entrega' THEN si.entregado_en ELSE si.solicitado_en END) AT TIME ZONE 'America/Santiago')::date<=v_hasta)
 ), solicitudes AS MATERIALIZED (SELECT DISTINCT solicitud_id,estado,solicitado_en,validado_en,entregado_en,sede_id,rbd,sede,tipo FROM lineas),
 por_sede AS (SELECT sede_id,rbd,sede,tipo,count(*) FILTER(WHERE estado<>'cancelada') AS solicitudes,count(*) FILTER(WHERE estado='entregada') AS entregadas,count(*) FILTER(WHERE estado IN ('solicitada','en_validacion','aprobada')) AS pendientes FROM solicitudes GROUP BY sede_id,rbd,sede,tipo),
 por_producto AS (SELECT producto_id,codigo,producto,categoria,unidad,COALESCE(sum(cantidad_solicitada) FILTER(WHERE estado<>'cancelada'),0) AS solicitado,COALESCE(sum(cantidad_aprobada) FILTER(WHERE estado IN ('aprobada','entregada')),0) AS aprobado,COALESCE(sum(cantidad_entregada) FILTER(WHERE estado='entregada'),0) AS entregado,count(DISTINCT solicitud_id) FILTER(WHERE estado<>'cancelada') AS solicitudes FROM lineas GROUP BY producto_id,codigo,producto,categoria,unidad),
 consolidado AS (SELECT sede_id,rbd,sede,tipo,producto_id,codigo,producto,unidad,sum(cantidad_entregada) AS entregado,count(DISTINCT solicitud_id) AS entregas,min((entregado_en AT TIME ZONE 'America/Santiago')::date)::text AS primera_entrega,max((entregado_en AT TIME ZONE 'America/Santiago')::date)::text AS ultima_entrega FROM lineas WHERE estado='entregada' AND cantidad_entregada>0 GROUP BY sede_id,rbd,sede,tipo,producto_id,codigo,producto,unidad),
 stock AS MATERIALIZED (SELECT c.id AS producto_id,c.codigo,c.nombre AS producto,c.categoria,c.unidad,c.activo,COALESCE(st.existencia,0) AS existencia,COALESCE(st.reservado,0) AS reservado,COALESCE(st.existencia-st.reservado,0) AS disponible FROM public.catalogo_insumos c LEFT JOIN public.stock_insumos st ON st.producto_id=c.id WHERE v_stock AND (v_producto IS NULL OR c.id=v_producto) AND (v_categoria='' OR c.categoria=v_categoria) AND (v_q='' OR c.nombre ILIKE '%'||v_q||'%' OR c.codigo ILIKE '%'||v_q||'%')),
 informe AS MATERIALIZED (
  SELECT to_jsonb(x) AS dato,lower(sede)||sede_id::text AS orden FROM por_sede x WHERE v_vista='sedes'
  UNION ALL SELECT to_jsonb(x),lower(producto)||producto_id::text FROM por_producto x WHERE v_vista='productos'
  UNION ALL SELECT to_jsonb(x),lower(sede)||sede_id::text||codigo||producto_id::text FROM consolidado x WHERE v_vista IN ('dashboard','consolidado')
  UNION ALL SELECT jsonb_build_object('solicitud_id',solicitud_id,'sede_id',sede_id,'rbd',rbd,'sede',sede,'tipo',tipo,'producto_id',producto_id,'codigo',codigo,'producto',producto,'unidad',unidad,'solicitado',cantidad_solicitada,'aprobado',cantidad_aprobada,'entregado',cantidad_entregada,'estado',estado,'fecha_solicitud',to_char(solicitado_en AT TIME ZONE 'America/Santiago','YYYY-MM-DD HH24:MI'),'fecha_validacion',to_char(validado_en AT TIME ZONE 'America/Santiago','YYYY-MM-DD HH24:MI'),'fecha_entrega',to_char(entregado_en AT TIME ZONE 'America/Santiago','YYYY-MM-DD HH24:MI')),solicitado_en::text||solicitud_id::text||codigo FROM lineas WHERE v_vista='detalle'
  UNION ALL SELECT to_jsonb(x),lower(producto)||producto_id::text FROM stock x WHERE v_vista='stock'
 ), paginas AS (SELECT count(*) AS total,GREATEST(1,ceil(count(*)/v_limite::numeric)::integer) AS paginas FROM informe), paginas_solicitudes AS (SELECT count(*) AS total,GREATEST(1,ceil(count(*)/v_limite::numeric)::integer) AS paginas FROM solicitudes)
 SELECT jsonb_build_object(
  'totales',(SELECT jsonb_build_object('solicitudes',count(*),'pendientes',count(*) FILTER(WHERE estado IN ('solicitada','en_validacion','aprobada')),'validadas',count(*) FILTER(WHERE estado IN ('en_validacion','aprobada') AND validado_en IS NOT NULL),'aprobadas',count(*) FILTER(WHERE estado='aprobada'),'entregadas',count(*) FILTER(WHERE estado='entregada'),'canceladas',count(*) FILTER(WHERE estado='cancelada')) FROM solicitudes),
  'unidades',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY unidad) FROM (SELECT unidad,COALESCE(sum(cantidad_solicitada) FILTER(WHERE estado<>'cancelada'),0) AS solicitado,COALESCE(sum(cantidad_aprobada) FILTER(WHERE estado IN ('aprobada','entregada')),0) AS aprobado,COALESCE(sum(cantidad_entregada) FILTER(WHERE estado='entregada'),0) AS entregado FROM lineas GROUP BY unidad)t),'[]'::jsonb),
  'ranking',COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (SELECT * FROM por_sede WHERE solicitudes>0 ORDER BY solicitudes DESC,sede,sede_id LIMIT 10)t),'[]'::jsonb),
  'stock_unidades',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY unidad) FROM (SELECT unidad,sum(existencia) AS existencia,sum(reservado) AS reservado,sum(disponible) AS disponible FROM stock GROUP BY unidad)t),'[]'::jsonb),'puede_stock',v_stock,
  'filas',COALESCE((SELECT jsonb_agg(dato ORDER BY orden) FROM (SELECT * FROM informe ORDER BY orden LIMIT v_limite OFFSET ((SELECT LEAST(v_pagina,paginas)-1 FROM paginas)::bigint*v_limite))t),'[]'::jsonb),
  'total',(SELECT total FROM paginas),'pagina',(SELECT LEAST(v_pagina,paginas) FROM paginas),'paginas',(SELECT paginas FROM paginas),
  'solicitudes_ids',COALESCE((SELECT jsonb_agg(solicitud_id) FROM (SELECT solicitud_id FROM solicitudes ORDER BY CASE WHEN v_grupo IN ('pendientes','validadas') AND estado='aprobada' THEN 0 WHEN v_grupo IN ('pendientes','validadas') AND validado_en IS NOT NULL THEN 1 ELSE 2 END,solicitado_en DESC,solicitud_id LIMIT v_limite OFFSET ((SELECT LEAST(v_pagina,paginas)-1 FROM paginas_solicitudes)::bigint*v_limite))t),'[]'::jsonb),
  'pagina_solicitudes',(SELECT LEAST(v_pagina,paginas) FROM paginas_solicitudes),'paginas_solicitudes',(SELECT paginas FROM paginas_solicitudes),'generado_en',CURRENT_TIMESTAMP
 ) INTO salida;
 RETURN salida;
END;$fn$;
REVOKE ALL ON FUNCTION public.consultar_gestor_insumos(text,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consultar_gestor_insumos(text,jsonb,text) TO inventario_app;
`);
exports.down=()=>{throw new Error('Conservar perfiles y auditoría; revertir con respaldo verificado.');};
