export function up(pgm) {
  pgm.sql(`
CREATE TABLE public.cargas_equipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL,
  archivo text NOT NULL CHECK (length(archivo) BETWEEN 1 AND 200),
  sha256 text UNIQUE NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  cantidad integer NOT NULL CHECK (cantidad BETWEEN 1 AND 2500),
  registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE public.equipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id uuid NOT NULL REFERENCES public.sedes(id) ON DELETE RESTRICT,
  categoria_id uuid NOT NULL REFERENCES public.categorias_bienes(id) ON DELETE RESTRICT,
  marca text NOT NULL CHECK (length(marca) BETWEEN 1 AND 120 AND marca=btrim(marca)),
  modelo text NOT NULL CHECK (length(modelo) BETWEEN 1 AND 200 AND modelo=btrim(modelo)),
  serie text CHECK (serie IS NULL OR (length(serie) BETWEEN 1 AND 120 AND serie=btrim(serie))),
  numero_inventario text CHECK (numero_inventario IS NULL OR (length(numero_inventario) BETWEEN 1 AND 120 AND numero_inventario=btrim(numero_inventario))),
  motivo_identificacion text NOT NULL DEFAULT '' CHECK (length(motivo_identificacion)<=500),
  CONSTRAINT equipos_identificacion_pendiente CHECK (
    (serie IS NOT NULL AND numero_inventario IS NOT NULL) OR length(btrim(motivo_identificacion))>0
  ),
  origen text NOT NULL CHECK (origen IN ('compra_utic','compra_sede','donacion','otro')),
  situacion text NOT NULL CHECK (situacion IN ('registrado_nc','pendiente_entrega','recibido','recibido_historico')),
  condicion_tecnica text NOT NULL CHECK (condicion_tecnica IN ('sin_verificar','operativo','en_reparacion','fuera_de_servicio')),
  datos_compra jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(datos_compra)='object' AND octet_length(datos_compra::text)<=8000),
  fecha_entrega date,
  enlace_acta text CHECK (enlace_acta IS NULL OR (length(enlace_acta)<=1500 AND enlace_acta ~ '^https?://')),
  observaciones text NOT NULL DEFAULT '' CHECK (length(observaciones)<=2000),
  carga_id uuid REFERENCES public.cargas_equipos(id) ON DELETE RESTRICT,
  fila_origen integer,
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  creado_por text NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX equipos_serie_unica ON public.equipos(upper(serie)) WHERE serie IS NOT NULL;
CREATE UNIQUE INDEX equipos_inventario_unico ON public.equipos(upper(numero_inventario)) WHERE numero_inventario IS NOT NULL;
CREATE INDEX equipos_sede_idx ON public.equipos(sede_id,situacion);
CREATE TABLE public.equipos_historial (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  equipo_id uuid NOT NULL REFERENCES public.equipos(id) ON DELETE RESTRICT,
  actor text NOT NULL,
  motivo text NOT NULL CHECK (length(btrim(motivo)) BETWEEN 1 AND 500),
  antes jsonb,
  despues jsonb NOT NULL,
  registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
REVOKE ALL ON public.equipos,public.equipos_historial,public.cargas_equipos FROM PUBLIC,inventario_app;
GRANT SELECT ON public.equipos,public.equipos_historial,public.cargas_equipos TO inventario_app;

CREATE FUNCTION public.guardar_equipo_acceso(p_actor text,p_datos jsonb,p_version integer,p_motivo text,p_carga uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
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
  IF NOT FOUND OR actor.rol NOT IN ('administrador','administrador_gestion','encargado') THEN
    RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';
  END IF;
  SELECT * INTO sede FROM public.sedes WHERE id=sede_id AND activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sede no disponible' USING ERRCODE='P2001'; END IF;
  IF actor.rol='encargado' AND (actor.sede_id IS DISTINCT FROM sede_id OR sede.tipo='nivel_central') THEN
    RAISE EXCEPTION 'Sede fuera del alcance' USING ERRCODE='42501';
  END IF;
  IF p_version IS NULL OR p_version<0 OR p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 1 AND 500
    OR p_datos->>'origen' IS NULL OR p_datos->>'condicionTecnica' IS NULL THEN
    RAISE EXCEPTION 'Datos inválidos' USING ERRCODE='22023';
  END IF;
  IF p_carga IS NOT NULL AND (actor.rol='encargado' OR equipo_id IS NOT NULL OR NOT EXISTS(
      SELECT 1 FROM public.cargas_equipos c WHERE c.id=p_carga AND c.actor=p_actor)) THEN
    RAISE EXCEPTION 'Carga no autorizada' USING ERRCODE='42501';
  END IF;
  IF equipo_id IS NULL THEN
    IF p_version<>0 THEN RAISE EXCEPTION 'Versión inválida' USING ERRCODE='P2002'; END IF;
    IF actor.rol='encargado' AND p_datos->>'origen'='compra_utic' THEN
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
    IF NOT FOUND OR (actor.rol='encargado' AND (anterior.sede_id IS DISTINCT FROM actor.sede_id OR anterior.situacion='pendiente_entrega')) THEN
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
$fn$;
REVOKE ALL ON FUNCTION public.guardar_equipo_acceso(text,jsonb,integer,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_equipo_acceso(text,jsonb,integer,text,uuid) TO inventario_app;

CREATE FUNCTION public.cargar_equipos_acceso(p_actor text,p_filas jsonb,p_archivo text,p_sha text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE carga public.cargas_equipos%ROWTYPE; fila jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(1793577600000);
  PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion') FOR SHARE;
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
$fn$;
REVOKE ALL ON FUNCTION public.cargar_equipos_acceso(text,jsonb,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cargar_equipos_acceso(text,jsonb,text,text) TO inventario_app;
  `);
}
export const down = false;
