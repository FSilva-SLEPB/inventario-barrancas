exports.up=pgm=>pgm.sql(String.raw`
DO $fn$
DECLARE p record;previos text[];actuales text[];nuevos text[]:=ARRAY['equipos.exportar','equipos.descargar','celulares.exportar','celulares.descargar'];a jsonb;d jsonb;
BEGIN
 SELECT jsonb_build_object('limite',(SELECT to_jsonb(l) FROM public.rbac_limites_perfiles l WHERE codigo='enlaces_ee'),'perfiles',(SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object('permisos',ARRAY(SELECT permiso FROM public.rbac_perfil_permisos WHERE perfil_id=r.id ORDER BY permiso))) FROM public.rbac_perfiles r WHERE codigo='enlaces_ee')) INTO a;
 SELECT permisos INTO previos FROM public.rbac_limites_perfiles WHERE codigo='enlaces_ee';
 FOR p IN SELECT id FROM public.rbac_perfiles WHERE codigo='enlaces_ee' LOOP
  SELECT COALESCE(array_agg(permiso),'{}'::text[]) INTO actuales FROM public.rbac_perfil_permisos WHERE perfil_id=p.id;
  -- No reabrir un perfil cuyo Administrador haya reducido sus permisos.
  IF previos<@actuales AND actuales<@(previos||nuevos) THEN
   INSERT INTO public.rbac_perfil_permisos SELECT p.id,unnest(nuevos) ON CONFLICT DO NOTHING;
   UPDATE public.rbac_perfiles SET version=version+1 WHERE id=p.id;
  END IF;
 END LOOP;
 UPDATE public.rbac_limites_perfiles SET permisos=ARRAY(SELECT DISTINCT x FROM unnest(permisos||nuevos)x ORDER BY x) WHERE codigo='enlaces_ee';
 SELECT jsonb_build_object('limite',(SELECT to_jsonb(l) FROM public.rbac_limites_perfiles l WHERE codigo='enlaces_ee'),'perfiles',(SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object('permisos',ARRAY(SELECT permiso FROM public.rbac_perfil_permisos WHERE perfil_id=r.id ORDER BY permiso))) FROM public.rbac_perfiles r WHERE codigo='enlaces_ee')) INTO d;
 INSERT INTO public.rbac_cambios_migracion VALUES('1796659200000_descargas-enlaces-ee',current_user,a,d,CURRENT_TIMESTAMP);
END;$fn$;
`);
exports.down=()=>{throw new Error('Conservar permisos e historial; revertir con respaldo verificado.');};
