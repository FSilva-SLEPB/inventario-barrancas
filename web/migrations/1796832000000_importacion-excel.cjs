exports.up=pgm=>pgm.sql(String.raw`
CREATE TABLE public.importaciones_excel(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor text NOT NULL REFERENCES public.usuarios_acceso(correo),
 archivo text NOT NULL,sha256 text NOT NULL,tipo text NOT NULL CHECK(tipo IN ('central','establecimientos','funcionarios','vinculos')),
 hoja text NOT NULL,datos jsonb NOT NULL,creado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 vence_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP+interval '30 minutes',confirmado_en timestamptz,resultado jsonb,
 UNIQUE(actor,sha256,tipo,hoja));
REVOKE ALL ON public.importaciones_excel FROM PUBLIC,inventario_app;
CREATE FUNCTION public.exigir_importacion_excel(p_actor text,p_tipo text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE contexto jsonb;
BEGIN
 contexto:=public.rbac_contexto(p_actor);
 IF contexto->>'alcance' IS DISTINCT FROM 'global' OR COALESCE(contexto->>'clasePerfil','') NOT IN ('sistema','utic') THEN RAISE EXCEPTION 'Se requiere UTIC global' USING ERRCODE='42501';END IF;
 IF p_tipo='funcionarios' THEN PERFORM public.rbac_exigir(p_actor,'funcionarios.consultar');PERFORM public.rbac_exigir(p_actor,'funcionarios.registrar');
 ELSIF p_tipo='vinculos' THEN PERFORM public.rbac_exigir(p_actor,'equipos.consultar');PERFORM public.rbac_exigir(p_actor,'equipos.editar');PERFORM public.rbac_exigir(p_actor,'funcionarios.consultar');PERFORM public.rbac_exigir(p_actor,'funcionarios.editar');
 ELSIF p_tipo IN ('central','establecimientos') THEN PERFORM public.rbac_exigir(p_actor,'equipos.consultar');PERFORM public.rbac_exigir(p_actor,'equipos.registrar');
 ELSE RAISE EXCEPTION 'Modalidad inválida' USING ERRCODE='22023';END IF;
END;$f$;
CREATE FUNCTION public.preparar_importacion_excel(p_actor text,p_archivo text,p_sha text,p_tipo text,p_hoja text,p_datos jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE registro jsonb;d jsonb;r public.importaciones_excel%ROWTYPE;total integer:=0;
BEGIN
 PERFORM public.exigir_importacion_excel(p_actor,p_tipo);
 IF p_archivo IS NULL OR length(p_archivo) NOT BETWEEN 1 AND 200 OR p_archivo ~ '[[:cntrl:]]' OR p_sha IS NULL OR p_sha !~ '^[0-9a-f]{64}$' OR p_hoja IS NULL OR length(p_hoja) NOT BETWEEN 1 AND 100 OR p_hoja ~ '[[:cntrl:]]' OR jsonb_typeof(p_datos) IS DISTINCT FROM 'array' OR jsonb_array_length(p_datos) NOT BETWEEN 1 AND 5000 OR octet_length(p_datos::text)>8000000 THEN RAISE EXCEPTION 'Carga inválida' USING ERRCODE='22023';END IF;
 FOR registro IN SELECT value FROM jsonb_array_elements(p_datos) LOOP
  IF jsonb_typeof(registro) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(registro))<>2 OR NOT registro ?& ARRAY['fila','datos'] OR registro->>'fila' !~ '^[1-9][0-9]{0,4}$' OR jsonb_typeof(registro->'datos') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Fila inválida' USING ERRCODE='22023';END IF;
  d:=registro->'datos';
  IF p_tipo='funcionarios' THEN
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(d)t(k) WHERE k NOT IN ('nombre','rut','correo','unidad','subdireccion','cargo','fechaIngreso','activo')) OR COALESCE(d->>'rut','')='' OR d->>'fechaIngreso' IS DISTINCT FROM '' OR d->'activo' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Campos de persona no permitidos' USING ERRCODE='22023';END IF;total:=total+1;
  ELSIF p_tipo='vinculos' THEN
   IF (SELECT count(*) FROM jsonb_object_keys(d))<>5 OR NOT d ?& ARRAY['equipoId','version','funcionarioId','funcionarioVersion','rut'] THEN RAISE EXCEPTION 'Vínculo inválido' USING ERRCODE='22023';END IF;total:=total+1;
  ELSE
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(d)t(k) WHERE k NOT IN ('id','sedeId','categoriaId','marca','modelo','serie','inventario','motivoIdentificacion','origen','condicionTecnica','observaciones','compra','estadoHistorico','estadoAdministrativo','cantidad','antecedentesCarga','fechaEntrega','enlaceActa','filaOrigen')) OR COALESCE(d->>'id','')<>'' OR d->>'fechaEntrega' IS DISTINCT FROM '' OR d->>'estadoAdministrativo' NOT IN ('activo','dado_de_baja') OR jsonb_typeof(d->'antecedentesCarga') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Campos de equipo no permitidos' USING ERRCODE='22023';END IF;
   IF EXISTS(SELECT 1 FROM jsonb_object_keys(d->'antecedentesCarga')t(k) WHERE k NOT IN ('Año de Entrega','RBD','ESTABLECIMIENTO','DIRECCIÓN','COMUNA','RUT DIRECTOR/A','DIRECTOR/A','Adquision','N° OC','ID Adquision','N° CDP','FECHA OC','N° Guia / Factura','CANTIDAD','Tipo de Estado','Tipo de compra','Categoria','MARCA','MODELO','N° DE SERIE','N° INVENTARIO','ESTADO ADMINISTRATIVO','ESTADO CONDICION','LINK ENTREGA','DETALLE U OBSERVACIONES')) THEN RAISE EXCEPTION 'Antecedentes no permitidos' USING ERRCODE='22023';END IF;
   IF jsonb_typeof(d->'compra') IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(d->'compra')t(k) WHERE k NOT IN ('anioEntrega','modalidadCompra','ordenCompra','idAdquisicion','cdp','fechaOrdenCompra','guiaFactura','condicionIngreso','financiamiento')) THEN RAISE EXCEPTION 'Adquisición no permitida' USING ERRCODE='22023';END IF;
   IF (d->>'cantidad') !~ '^[1-9][0-9]{0,3}$' OR (d->>'cantidad')::integer>2500 THEN RAISE EXCEPTION 'Cantidad inválida' USING ERRCODE='22023';END IF;
   IF NOT EXISTS(SELECT 1 FROM public.sedes s WHERE s.id=(d->>'sedeId')::uuid AND s.activo AND (s.tipo='nivel_central')=(p_tipo='central')) THEN RAISE EXCEPTION 'Sede incompatible' USING ERRCODE='42501';END IF;
   total:=total+(d->>'cantidad')::integer;
  END IF;
 END LOOP;
 IF total>5000 THEN RAISE EXCEPTION 'Máximo 5000 unidades' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(1796832000000);
 DELETE FROM public.importaciones_excel WHERE confirmado_en IS NULL AND vence_en<CURRENT_TIMESTAMP;
 SELECT * INTO r FROM public.importaciones_excel WHERE actor=p_actor AND sha256=p_sha AND tipo=p_tipo AND hoja=p_hoja FOR UPDATE;
 IF FOUND THEN
  IF r.confirmado_en IS NULL THEN UPDATE public.importaciones_excel SET id=gen_random_uuid(),datos=p_datos,vence_en=CURRENT_TIMESTAMP+interval '30 minutes' WHERE id=r.id RETURNING id INTO r.id;END IF;RETURN r.id;
 END IF;
 INSERT INTO public.importaciones_excel(actor,archivo,sha256,tipo,hoja,datos) VALUES(p_actor,p_archivo,p_sha,p_tipo,p_hoja,p_datos) RETURNING id INTO r.id;RETURN r.id;
END;$f$;
CREATE FUNCTION public.confirmar_importacion_excel(p_actor text,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $f$
DECLARE r public.importaciones_excel%ROWTYPE;previa jsonb;registro jsonb;d jsonb;lote jsonb:='[]';unidades integer:=0;n integer;cantidad integer:=0;parte integer:=0;sha text;salida jsonb;e public.equipos%ROWTYPE;
BEGIN
 -- Mismo orden de bloqueos que las operaciones de equipos/personas para evitar carreras.
 PERFORM pg_advisory_xact_lock(1793404800000);PERFORM pg_advisory_xact_lock(1793577600000);PERFORM pg_advisory_xact_lock(1794268800000);PERFORM pg_advisory_xact_lock(1794009600000);PERFORM pg_advisory_xact_lock(1796832000000);
 SELECT * INTO r FROM public.importaciones_excel WHERE id=p_id AND actor=p_actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Vista previa no disponible' USING ERRCODE='42501';END IF;
 PERFORM public.exigir_importacion_excel(p_actor,r.tipo);
 IF r.confirmado_en IS NOT NULL THEN RETURN r.resultado||jsonb_build_object('repetida',true);END IF;
 IF r.vence_en<CURRENT_TIMESTAMP THEN RAISE EXCEPTION 'La vista previa venció' USING ERRCODE='P4201';END IF;
 SELECT resultado INTO previa FROM public.importaciones_excel WHERE sha256=r.sha256 AND tipo=r.tipo AND hoja=r.hoja AND confirmado_en IS NOT NULL LIMIT 1;
 IF FOUND THEN UPDATE public.importaciones_excel SET confirmado_en=CURRENT_TIMESTAMP,resultado=previa,datos='[]' WHERE id=r.id;RETURN previa||jsonb_build_object('repetida',true);END IF;
 FOR registro IN SELECT value FROM jsonb_array_elements(r.datos) LOOP
  d:=registro->'datos';
  IF r.tipo='funcionarios' THEN
   -- Solo altas: la importación no actualiza ni desactiva una ficha existente.
   IF EXISTS(SELECT 1 FROM public.funcionarios_nc WHERE rut=d->>'rut' OR (NULLIF(d->>'correo','') IS NOT NULL AND correo=d->>'correo')) THEN RAISE EXCEPTION 'La ficha ya existe; revisa otra vista previa' USING ERRCODE='P4201';END IF;
   PERFORM public.guardar_funcionario_nc_acceso(p_actor,gen_random_uuid(),d,0,'Importación Excel: '||r.archivo||' · fila '||(registro->>'fila'));cantidad:=cantidad+1;
  ELSIF r.tipo='vinculos' THEN
   PERFORM 1 FROM public.funcionarios_nc WHERE id=(d->>'funcionarioId')::uuid AND version=(d->>'funcionarioVersion')::integer AND rut=d->>'rut' AND activo FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'La identidad o versión del funcionario cambió' USING ERRCODE='P4201';END IF;
   SELECT * INTO e FROM public.equipos WHERE id=(d->>'equipoId')::uuid FOR UPDATE;
   IF e.id IS NULL OR e.version IS DISTINCT FROM (d->>'version')::integer OR e.estado_administrativo<>'activo' OR e.datos_compra->'bajaPendienteTI'='true'::jsonb OR EXISTS(SELECT 1 FROM public.asignaciones_funcionarios WHERE equipo_id=e.id AND finalizado_en IS NULL) THEN RAISE EXCEPTION 'El equipo cambió o ya tiene vínculo' USING ERRCODE='P4201';END IF;
   PERFORM public.rbac_vincular_asignacion(p_actor,gen_random_uuid(),'equipo',e.id,e.version,(d->>'funcionarioId')::uuid,NULL,'Vínculo revisado desde Excel: '||r.archivo||' · fila '||(registro->>'fila'));cantidad:=cantidad+1;
  ELSE
   -- Lotes internos <=2500, dentro de ESTA transacción; nunca se pide dividir el Excel.
   n:=(d->>'cantidad')::integer;
   IF unidades+n>2500 THEN
    parte:=parte+1;sha:=encode(sha256(convert_to(r.sha256||r.tipo||r.hoja||r.id::text||parte::text,'UTF8')),'hex');
    PERFORM public.cargar_equipos_acceso(p_actor,lote,r.archivo,sha);lote:='[]';unidades:=0;
   END IF;
   lote:=lote||jsonb_build_array(d);unidades:=unidades+n;cantidad:=cantidad+n;
  END IF;
 END LOOP;
 IF jsonb_array_length(lote)>0 THEN parte:=parte+1;sha:=encode(sha256(convert_to(r.sha256||r.tipo||r.hoja||r.id::text||parte::text,'UTF8')),'hex');PERFORM public.cargar_equipos_acceso(p_actor,lote,r.archivo,sha);END IF;
 salida:=jsonb_build_object('id',r.id,'cantidad',cantidad,'tipo',r.tipo,'repetida',false);
 UPDATE public.importaciones_excel SET confirmado_en=CURRENT_TIMESTAMP,resultado=salida,datos='[]' WHERE id=r.id;
 RETURN salida;
END;$f$;
REVOKE ALL ON FUNCTION public.exigir_importacion_excel(text,text),public.preparar_importacion_excel(text,text,text,text,text,jsonb),public.confirmar_importacion_excel(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.exigir_importacion_excel(text,text),public.preparar_importacion_excel(text,text,text,text,text,jsonb),public.confirmar_importacion_excel(text,uuid) TO inventario_app;
`);
exports.down=()=>{throw new Error('No eliminar importaciones ni historial. Revertir la aplicación o restaurar un respaldo verificado.');};
