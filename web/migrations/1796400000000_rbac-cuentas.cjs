exports.up=pgm=>pgm.sql(`
CREATE FUNCTION public.rbac_guardar_cuenta(p_actor text,p_solicitud uuid,p_correo text,p_version integer,p_datos jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$
DECLARE u public.usuarios_acceso%ROWTYPE;p public.rbac_perfiles%ROWTYPE;c jsonb;h public.rbac_historial%ROWTYPE;entrada jsonb;antes jsonb;res jsonb;perfil uuid;sede uuid;persona uuid;alcance text;
BEGIN
 PERFORM public.rbac_exigir(p_actor,'usuarios_operativos.administrar');c:=public.rbac_contexto(p_actor);entrada:=jsonb_build_array(p_correo,p_version,p_datos);
 SELECT * INTO h FROM public.rbac_historial WHERE solicitud=p_solicitud;
 IF FOUND THEN IF h.actor=p_actor AND h.tipo='cuenta' AND h.entrada=entrada THEN RETURN h.despues;END IF;RAISE EXCEPTION 'Solicitud reutilizada' USING ERRCODE='P3501';END IF;
 IF p_solicitud IS NULL OR p_correo IS NULL OR p_correo !~ '^[a-z0-9._%+-]+@slepb[.]gob[.]cl$' OR jsonb_typeof(p_datos) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(p_datos))<>7 OR jsonb_typeof(p_datos->'nombre') IS DISTINCT FROM 'string' OR length(p_datos->>'nombre')>120 OR jsonb_typeof(p_datos->'activo') IS DISTINCT FROM 'boolean' OR length(btrim(p_datos->>'motivo')) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Cuenta inválida' USING ERRCODE='22023';END IF;
 SELECT * INTO u FROM public.usuarios_acceso WHERE correo=p_correo FOR UPDATE;
 IF (u.correo IS NULL AND p_version<>0) OR (u.correo IS NOT NULL AND u.version IS DISTINCT FROM p_version) THEN RAISE EXCEPTION 'La cuenta cambió' USING ERRCODE='P3501';END IF;
 perfil:=NULLIF(p_datos->>'perfilId','')::uuid;sede:=NULLIF(p_datos->>'sedeId','')::uuid;persona:=NULLIF(p_datos->>'funcionarioId','')::uuid;alcance:=p_datos->>'alcance';
 IF c->>'clasePerfil'<>'sistema' AND (p_actor=p_correo OR u.rol IN ('administrador','administrador_gestion') OR EXISTS(SELECT 1 FROM public.rbac_perfiles WHERE id=u.perfil_id AND clase IN ('sistema','utic'))) THEN RAISE EXCEPTION 'Cuenta protegida' USING ERRCODE='42501';END IF;
 antes:=CASE WHEN u.correo IS NULL THEN NULL ELSE to_jsonb(u) END;
 IF perfil IS NULL THEN
  IF c->>'clasePerfil'<>'sistema' AND EXISTS(SELECT 1 FROM public.rbac_anteriores a,unnest(a.permisos)x WHERE a.rol=u.rol AND NOT public.rbac_tiene(p_actor,x)) THEN RAISE EXCEPTION 'Cuenta con facultades superiores' USING ERRCODE='42501';END IF;
  IF u.correo IS NULL OR u.perfil_id IS NOT NULL OR alcance IS DISTINCT FROM (CASE WHEN u.rol IN ('encargado','consulta_sede') THEN 'sede' ELSE 'global' END) OR sede IS DISTINCT FROM u.sede_id OR persona IS NOT NULL THEN RAISE EXCEPTION 'Selecciona un perfil autorizado; no convertir automáticamente' USING ERRCODE='22023';END IF;
 ELSE
  SELECT * INTO p FROM public.rbac_perfiles WHERE id=perfil AND activo FOR SHARE;
  IF p.id IS NULL OR alcance IS NULL OR NOT alcance=ANY(p.alcances) THEN RAISE EXCEPTION 'Perfil o alcance inválido' USING ERRCODE='22023';END IF;
  IF c->>'clasePerfil'<>'sistema' AND (p.clase IN ('sistema','utic') OR EXISTS(SELECT 1 FROM public.rbac_perfil_permisos WHERE perfil_id=p.id AND NOT public.rbac_tiene(p_actor,permiso))) THEN RAISE EXCEPTION 'No puedes asignar privilegios superiores' USING ERRCODE='42501';END IF;
  IF p.codigo IN ('enlaces_ee','director_ee') AND NOT EXISTS(SELECT 1 FROM public.sedes WHERE id=sede AND activo AND tipo='establecimiento') OR p.codigo IN ('encargado_jardin','directora_ji') AND NOT EXISTS(SELECT 1 FROM public.sedes WHERE id=sede AND activo AND tipo='jardin_infantil') THEN RAISE EXCEPTION 'Tipo de sede incorrecto' USING ERRCODE='22023';END IF;
  IF alcance='sede' THEN PERFORM 1 FROM public.sedes WHERE id=sede AND activo AND tipo IN ('establecimiento','jardin_infantil') FOR SHARE;IF NOT FOUND OR persona IS NOT NULL THEN RAISE EXCEPTION 'Sede inválida' USING ERRCODE='22023';END IF;
  ELSIF alcance='propios' THEN PERFORM 1 FROM public.funcionarios_nc WHERE id=persona AND activo AND correo=p_correo FOR SHARE;IF NOT FOUND OR sede IS NOT NULL THEN RAISE EXCEPTION 'Vincula la ficha con el mismo correo' USING ERRCODE='22023';END IF;
  ELSIF sede IS NOT NULL OR persona IS NOT NULL THEN RAISE EXCEPTION 'Alcance incompatible' USING ERRCODE='22023';END IF;
 END IF;
 IF u.correo IS NULL THEN
  INSERT INTO public.usuarios_acceso(correo,nombre,rol,activo,perfil_id,alcance_rbac,sede_id,funcionario_id) VALUES(p_correo,btrim(p_datos->>'nombre'),'consulta',(p_datos->>'activo')::boolean,perfil,alcance,sede,persona);
 ELSE
  UPDATE public.usuarios_acceso SET nombre=btrim(p_datos->>'nombre'),activo=(p_datos->>'activo')::boolean,perfil_id=perfil,alcance_rbac=CASE WHEN perfil IS NOT NULL THEN alcance END,sede_id=sede,funcionario_id=persona,version=version+1,actualizado_en=CURRENT_TIMESTAMP WHERE correo=p_correo;
 END IF;
 PERFORM public.rbac_proteger_administrador();SELECT to_jsonb(x) INTO res FROM public.usuarios_acceso x WHERE correo=p_correo;
 INSERT INTO public.rbac_historial(solicitud,actor,tipo,objetivo,motivo,antes,despues,entrada) VALUES(p_solicitud,p_actor,'cuenta',p_correo,p_datos->>'motivo',antes,res,entrada);
 INSERT INTO public.usuarios_acceso_historial(actor,correo,antes,despues) VALUES(p_actor,p_correo,antes,res);RETURN res;
END;$fn$;
REVOKE ALL ON FUNCTION public.rbac_guardar_cuenta(text,uuid,text,integer,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rbac_guardar_cuenta(text,uuid,text,integer,jsonb) TO inventario_app;
`);
exports.down=()=>{throw new Error('Conservar cuentas e historial RBAC.');};
