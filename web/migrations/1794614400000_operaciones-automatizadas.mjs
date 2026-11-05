export function up(pgm){pgm.sql(`
-- El motivo no es una condición de una entrega. El historial mantiene una descripción automática.
ALTER TABLE public.movimientos_inventario DROP CONSTRAINT movimientos_inventario_motivo_check;
ALTER TABLE public.movimientos_inventario ADD CONSTRAINT movimientos_inventario_motivo_check CHECK(length(btrim(motivo))<=500);
DO $m$
DECLARE definicion text;
BEGIN
 definicion:=pg_get_functiondef('public.mover_bien_acceso(text,uuid,jsonb)'::regprocedure);
 IF position('length(motivo) NOT BETWEEN 1 AND 500' in definicion)=0 OR position('VALUES(id_bien,p_actor,motivo,antes' in definicion)=0 THEN RAISE EXCEPTION 'Versión de movimiento incompatible';END IF;
 definicion:=replace(definicion,'length(motivo) NOT BETWEEN 1 AND 500','length(motivo)>500');
 definicion:=replace(definicion,'VALUES(id_bien,p_actor,motivo,antes',$v$VALUES(id_bien,p_actor,COALESCE(NULLIF(motivo,''),CASE WHEN accion='asignacion' THEN 'Asignación desde Bodega TI' ELSE 'Devolución a Bodega TI' END),antes$v$);
 EXECUTE definicion;
 definicion:=pg_get_functiondef('public.normalizar_metadata_acta(jsonb,boolean)'::regprocedure);
 IF position('(p_obligatorios OR v<>'''')' in definicion)=0 THEN RAISE EXCEPTION 'Versión de participantes incompatible';END IF;
 -- El correo autenticado identifica a UTIC; nunca inventar un RUN no registrado.
 definicion:=replace(definicion,$v$(p_obligatorios OR v<>'')$v$,$v$v<>''$v$);EXECUTE definicion;
 FOREACH definicion IN ARRAY ARRAY['public.preparar_acta_acceso(text,uuid,uuid,jsonb)','public.preparar_acta_entrega_acceso(text,uuid,uuid,jsonb)'] LOOP
  definicion:=pg_get_functiondef(definicion::regprocedure);
  IF position($v$'actor',p_actor$v$ in definicion)=0 THEN RAISE EXCEPTION 'Versión de acta incompatible';END IF;
  definicion:=replace(definicion,$v$'actor',p_actor$v$,$v$'actor',p_actor,'actorNombre',COALESCE((SELECT NULLIF(f.nombre,'') FROM public.funcionarios_nc f WHERE lower(f.correo)=p_actor AND f.activo ORDER BY f.id LIMIT 1),(SELECT NULLIF(u.nombre,'') FROM public.usuarios_acceso u WHERE u.correo=p_actor),'')$v$);
  EXECUTE definicion;
 END LOOP;
END;$m$;
CREATE FUNCTION public.version_flujo_acta() RETURNS integer LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS 'SELECT 1';
REVOKE ALL ON FUNCTION public.version_flujo_acta() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.version_flujo_acta() TO inventario_app;
-- Validación de catálogo bajo los mismos permisos limitados de la aplicación.
CREATE FUNCTION public.validar_receptor_nc_acceso(p_actor text,p_funcionario uuid,p_sede uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
BEGIN
 PERFORM 1 FROM public.usuarios_acceso WHERE correo=p_actor AND activo AND rol IN ('administrador','administrador_gestion') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin autorización' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.sedes WHERE id=p_sede AND activo AND tipo='nivel_central' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Destino incompatible' USING ERRCODE='22023';END IF;
 IF p_funcionario IS NOT NULL THEN
  PERFORM 1 FROM public.funcionarios_nc WHERE id=p_funcionario AND activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Funcionario no disponible' USING ERRCODE='22023';END IF;
 END IF;
END;$fn$;
REVOKE ALL ON FUNCTION public.validar_receptor_nc_acceso(text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_receptor_nc_acceso(text,uuid,uuid) TO inventario_app;

`);}
export function down(){throw new Error('Conservar movimientos, identidades y actas emitidas; no hay reversión automática.');}
