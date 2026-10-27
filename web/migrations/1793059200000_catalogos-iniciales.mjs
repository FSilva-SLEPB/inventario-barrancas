export function up(pgm) {
  pgm.sql(`
CREATE TABLE public.sedes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (
    tipo IN ('nivel_central', 'establecimiento', 'jardin_infantil')
  ),
  nombre text NOT NULL CHECK (nombre = btrim(nombre) AND nombre <> ''),
  rbd text UNIQUE CHECK (
    rbd IS NULL OR (rbd = btrim(rbd) AND rbd <> '')
  ),
  direccion text,
  comuna text,
  correo_institucional text,
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT sedes_nivel_central_sin_rbd
    CHECK (tipo <> 'nivel_central' OR rbd IS NULL)
);

CREATE TABLE public.dependencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id uuid NOT NULL REFERENCES public.sedes(id) ON DELETE RESTRICT,
  nombre text NOT NULL CHECK (nombre = btrim(nombre) AND nombre <> ''),
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX dependencias_sede_nombre_unico
  ON public.dependencias (sede_id, lower(nombre));

CREATE TABLE public.categorias_bienes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL CHECK (nombre = btrim(nombre) AND nombre <> ''),
  activo boolean NOT NULL DEFAULT true,
  creado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX categorias_bienes_nombre_unico
  ON public.categorias_bienes (lower(nombre));

GRANT SELECT, INSERT, UPDATE
  ON TABLE public.sedes, public.dependencias, public.categorias_bienes
  TO inventario_app;
  `);
}

export const down = false;
