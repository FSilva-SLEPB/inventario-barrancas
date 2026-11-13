exports.up=pgm=>pgm.sql(String.raw`
ALTER TABLE public.celulares ADD COLUMN uso_contacto text NOT NULL DEFAULT 'sin_clasificar' CHECK(uso_contacto IN ('sin_clasificar','establecimiento','director'));
ALTER TABLE public.celulares ADD COLUMN contacto_director_run text;
CREATE TABLE public.celulares_contacto_cambios(id uuid PRIMARY KEY,celular_id uuid NOT NULL REFERENCES public.celulares(id),actor text NOT NULL,entrada jsonb NOT NULL,antes jsonb NOT NULL,despues jsonb NOT NULL,registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP);
REVOKE ALL ON public.celulares_contacto_cambios FROM PUBLIC,inventario_app;GRANT SELECT ON public.celulares_contacto_cambios TO inventario_app;
CREATE FUNCTION public.limpiar_contacto_celular() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $fn$ BEGIN IF NEW.sede_id IS DISTINCT FROM OLD.sede_id OR NEW.custodia IS DISTINCT FROM OLD.custodia THEN NEW.uso_contacto:='sin_clasificar';NEW.contacto_director_run:=NULL;END IF;RETURN NEW;END;$fn$;
CREATE TRIGGER celulares_limpiar_contacto BEFORE UPDATE OF sede_id,custodia ON public.celulares FOR EACH ROW EXECUTE FUNCTION public.limpiar_contacto_celular();
CREATE FUNCTION public.clasificar_contacto_celular(p_actor text,p_id uuid,p_celular uuid,p_version integer,p_uso text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE c public.celulares%ROWTYPE;h public.celulares_contacto_cambios%ROWTYPE;entrada jsonb;antes jsonb;despues jsonb;run text;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'celulares.editar');IF public.rbac_contexto(p_actor)->>'clasePerfil' NOT IN ('sistema','utic') OR public.rbac_contexto(p_actor)->>'alcance'<>'global' THEN RAISE EXCEPTION 'Solo UTIC clasifica el contacto' USING ERRCODE='42501';END IF;
 IF p_id IS NULL OR p_celular IS NULL OR p_version IS NULL OR p_version<1 OR p_uso IS NULL OR p_uso NOT IN ('sin_clasificar','establecimiento','director') THEN RAISE EXCEPTION 'Clasificación inválida' USING ERRCODE='22023';END IF;
 entrada:=jsonb_build_object('celular',p_celular,'version',p_version,'uso',p_uso);SELECT * INTO c FROM public.celulares WHERE id=p_celular FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Celular no disponible' USING ERRCODE='22023';END IF;SELECT * INTO h FROM public.celulares_contacto_cambios WHERE id=p_id;
 IF FOUND THEN IF h.actor=p_actor AND h.entrada=entrada THEN RETURN h.despues;END IF;RAISE EXCEPTION 'Solicitud reutilizada' USING ERRCODE='P3401';END IF;
 IF c.version<>p_version THEN RAISE EXCEPTION 'La ficha cambió' USING ERRCODE='P2501';END IF;
 IF c.estado_administrativo='dado_de_baja' THEN RAISE EXCEPTION 'Registro histórico' USING ERRCODE='P3002';END IF;
 IF c.custodia<>'asignado' OR NOT c.activo OR c.estado_administrativo<>'activo' THEN RAISE EXCEPTION 'Clasifica solo celulares activos asignados' USING ERRCODE='22023';END IF;
 IF p_uso='director' THEN SELECT upper(replace(replace(d.rut,'.',''),' ','')) INTO run FROM public.directorio_sedes d JOIN public.sedes s ON s.id=d.sede_id WHERE d.sede_id=c.sede_id AND d.situacion IN ('titular','subrogante') AND s.activo AND s.tipo IN ('establecimiento','jardin_infantil');IF COALESCE(run,'')='' THEN RAISE EXCEPTION 'Registra el RUN del director vigente en el directorio antes de vincular su celular' USING ERRCODE='P4101';END IF;END IF;
 antes:=jsonb_build_object('usoContacto',c.uso_contacto,'directorRun',c.contacto_director_run,'version',c.version);
 UPDATE public.celulares SET uso_contacto=p_uso,contacto_director_run=run,version=version+1,actualizado_por=p_actor,actualizado_en=CURRENT_TIMESTAMP WHERE id=p_celular RETURNING jsonb_build_object('usoContacto',uso_contacto,'directorRun',contacto_director_run,'version',version) INTO despues;
 INSERT INTO public.celulares_contacto_cambios VALUES(p_id,p_celular,p_actor,entrada,antes,despues,CURRENT_TIMESTAMP);
 INSERT INTO public.celulares_historial(celular_id,actor,motivo,antes,despues) VALUES(p_celular,p_actor,'Clasificación de contacto desde Inventario de celulares',antes,despues);
 RETURN despues;
END;$fn$;
CREATE FUNCTION public.contactos_celulares_sedes(p_actor text,p_sedes uuid[],p_uso text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE ctx jsonb;permitido boolean;
BEGIN
 ctx:=public.rbac_contexto(p_actor);IF ctx IS NULL THEN RAISE EXCEPTION 'Cuenta no autorizada' USING ERRCODE='42501';END IF;
 IF p_uso IS NULL OR p_uso NOT IN ('establecimiento','director') OR cardinality(p_sedes)>5000 THEN RAISE EXCEPTION 'Consulta inválida' USING ERRCODE='22023';END IF;
 permitido:=CASE WHEN p_uso='director' THEN public.rbac_tiene(p_actor,'directorio_personas.consultar') ELSE public.rbac_tiene(p_actor,'directorio_institucional.consultar') OR public.rbac_tiene(p_actor,'directorio_autorizado.consultar') OR public.rbac_tiene(p_actor,'sedes.consultar') END;
 IF NOT permitido THEN RAISE EXCEPTION 'Contacto fuera de alcance' USING ERRCODE='42501';END IF;
 RETURN COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY sede_id,telefono,id) FROM (
 SELECT c.id,c.sede_id,c.telefono,c.uso_contacto,a.id AS acta_id FROM public.celulares c JOIN public.sedes s ON s.id=c.sede_id LEFT JOIN public.directorio_sedes d ON d.sede_id=s.id
 LEFT JOIN LATERAL(SELECT m.id,(SELECT operacion_id FROM public.operaciones_inventario_detalle od WHERE od.movimiento_id=m.id) AS operacion FROM public.movimientos_inventario m WHERE m.celular_id=c.id AND m.accion='asignacion' AND m.destino_sede_id=c.sede_id ORDER BY m.registrado_en DESC,m.id DESC LIMIT 1)m ON true
 LEFT JOIN LATERAL(SELECT ad.id FROM public.actas_documentos ad WHERE (ad.movimiento_id=m.id OR ad.operacion_id=m.operacion) AND ad.pdf IS NOT NULL AND (p_uso<>'director' OR upper(replace(replace(ad.datos->'metadata'->>'recibeRun','.',''),' ',''))=c.contacto_director_run) AND public.rbac_acta_autorizada(p_actor,ad.id,'consultar') ORDER BY ad.emitido_en DESC LIMIT 1)a ON true
 WHERE s.id=ANY(p_sedes) AND s.activo AND s.tipo IN ('establecimiento','jardin_infantil') AND c.custodia='asignado' AND c.activo AND c.estado_administrativo='activo' AND c.uso_contacto=p_uso
 AND (p_uso<>'director' OR d.situacion IN ('titular','subrogante') AND c.contacto_director_run=upper(replace(replace(d.rut,'.',''),' ','')))
 AND (ctx->>'alcance'='global' OR ctx->>'alcance'='sede' AND s.id=(SELECT u.sede_id FROM public.usuarios_acceso u WHERE u.correo=p_actor) OR p_uso='establecimiento' AND public.rbac_tiene(p_actor,'directorio_autorizado.consultar'))
 )t),'[]'::jsonb);
END;$fn$;
CREATE TABLE public.fotografias_funcionarios(id uuid PRIMARY KEY,funcionario_id uuid NOT NULL REFERENCES public.funcionarios_nc(id),version integer NOT NULL CHECK(version>0),actor text NOT NULL,mime text NOT NULL,contenido bytea NOT NULL,registrado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(funcionario_id,version),CHECK(octet_length(contenido) BETWEEN 12 AND 5242880 AND ((mime='image/png' AND encode(substring(contenido FROM 1 FOR 8),'hex')='89504e470d0a1a0a') OR (mime='image/jpeg' AND encode(substring(contenido FROM 1 FOR 3),'hex')='ffd8ff') OR (mime='image/webp' AND substring(contenido FROM 1 FOR 4)=convert_to('RIFF','UTF8') AND substring(contenido FROM 9 FOR 4)=convert_to('WEBP','UTF8')))));
REVOKE ALL ON public.fotografias_funcionarios FROM PUBLIC,inventario_app;
CREATE FUNCTION public.consultar_fotografia_funcionario(p_actor text,p_funcionario uuid,p_foto uuid DEFAULT NULL) RETURNS TABLE(id uuid,version integer,mime text,contenido bytea) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
 SELECT f.id,f.version,f.mime,f.contenido FROM public.fotografias_funcionarios f WHERE f.funcionario_id=p_funcionario AND (p_foto IS NULL OR f.id=p_foto) AND ((public.rbac_tiene(p_actor,'funcionarios.consultar') AND public.rbac_contexto(p_actor)->>'alcance'='global') OR (public.rbac_tiene(p_actor,'mis_datos.consultar') AND public.rbac_contexto(p_actor)->>'alcance'='propios' AND EXISTS(SELECT 1 FROM public.usuarios_acceso u WHERE u.correo=p_actor AND u.funcionario_id=p_funcionario))) ORDER BY f.version DESC LIMIT 1;
$fn$;
CREATE FUNCTION public.guardar_fotografia_funcionario_acceso(p_actor text,p_id uuid,p_funcionario uuid,p_version integer,p_mime text,p_contenido bytea) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE anterior public.fotografias_funcionarios%ROWTYPE;actual integer;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'funcionarios.editar');IF public.rbac_contexto(p_actor)->>'clasePerfil' NOT IN ('sistema','utic') OR public.rbac_contexto(p_actor)->>'alcance'<>'global' THEN RAISE EXCEPTION 'Sin permiso para cambiar fotografías' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM public.funcionarios_nc WHERE id=p_funcionario AND activo FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Funcionario no disponible' USING ERRCODE='22023';END IF;
 IF p_id IS NULL OR p_version IS NULL OR p_version<0 OR p_version>=2147483647 OR p_mime IS NULL OR p_mime NOT IN ('image/png','image/jpeg','image/webp') OR p_contenido IS NULL OR octet_length(p_contenido) NOT BETWEEN 12 AND 5242880 THEN RAISE EXCEPTION 'Fotografía inválida' USING ERRCODE='22023';END IF;
 SELECT * INTO anterior FROM public.fotografias_funcionarios WHERE id=p_id;IF FOUND THEN IF anterior.actor=p_actor AND anterior.funcionario_id=p_funcionario AND anterior.version=p_version+1 AND anterior.mime=p_mime AND anterior.contenido=p_contenido THEN RETURN jsonb_build_object('id',anterior.id,'version',anterior.version,'repetida',true);END IF;RAISE EXCEPTION 'Solicitud reutilizada' USING ERRCODE='P3401';END IF;
 SELECT COALESCE(max(version),0) INTO actual FROM public.fotografias_funcionarios WHERE funcionario_id=p_funcionario;IF actual<>p_version THEN RAISE EXCEPTION 'La fotografía cambió' USING ERRCODE='P3402';END IF;
 INSERT INTO public.fotografias_funcionarios VALUES(p_id,p_funcionario,actual+1,p_actor,p_mime,p_contenido,CURRENT_TIMESTAMP);RETURN jsonb_build_object('id',p_id,'version',actual+1,'repetida',false);
END;$fn$;
REVOKE ALL ON FUNCTION public.clasificar_contacto_celular(text,uuid,uuid,integer,text),public.contactos_celulares_sedes(text,uuid[],text),public.consultar_fotografia_funcionario(text,uuid,uuid),public.guardar_fotografia_funcionario_acceso(text,uuid,uuid,integer,text,bytea),public.limpiar_contacto_celular() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clasificar_contacto_celular(text,uuid,uuid,integer,text),public.contactos_celulares_sedes(text,uuid[],text),public.consultar_fotografia_funcionario(text,uuid,uuid),public.guardar_fotografia_funcionario_acceso(text,uuid,uuid,integer,text,bytea) TO inventario_app;
`);
exports.down=()=>{throw new Error('Conservar fotografías e historial; usar reversión con respaldo verificado.');};
