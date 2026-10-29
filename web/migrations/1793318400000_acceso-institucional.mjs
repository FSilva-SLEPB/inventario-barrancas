export function up(pgm) {
  pgm.sql(`
CREATE TABLE public.usuarios_acceso (
  correo text PRIMARY KEY CHECK (
    correo = lower(correo) AND correo ~ '^[a-z0-9._%+-]+@slepb[.]gob[.]cl$'
  ),
  rol text NOT NULL CHECK (rol IN ('administrador', 'consulta')),
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
REVOKE ALL ON public.usuarios_acceso FROM PUBLIC, inventario_app;
GRANT SELECT ON public.usuarios_acceso TO inventario_app;

INSERT INTO public.usuarios_acceso (correo, rol)
VALUES ('felipe.silva@slepb.gob.cl', 'administrador');
  `);
}

export const down = false;
