# Sistema de Inventario 2.0 EE y TI — SLEP Barrancas

## Objetivo

Desarrollar una aplicación web para gestionar solicitudes de insumos,
registrar inventario, generar actas y permitir su firma.

## Alcance inicial

- Gestión de usuarios y permisos.
- Solicitudes de insumos.
- Registro de bienes y movimientos de inventario.
- Generación de actas.
- Firma y consulta de documentos.

## Base tecnológica prevista

- React y Next.js con TypeScript.
- Node.js.
- PostgreSQL.
- Docker Engine y Docker Compose.
- CentOS Stream 9 como entorno de desarrollo.

## Diseño y requisitos institucionales

El diseño tomará como referencia el UI Kit de Gobierno de Chile
y la identidad institucional del SLEP Barrancas.

Se revisarán las normas y políticas institucionales aplicables a
accesibilidad, protección de datos personales, ciberseguridad
y documentos electrónicos.

El mecanismo de firma se definirá según los requisitos de cada acta.

Referencia de diseño: https://kitdigital.gob.cl/

## Forma de trabajo

El desarrollo será paso a paso, con explicación y comprobación de
cada avance. Los cambios se registrarán con Git y GitHub.

Durante el desarrollo se utilizarán datos ficticios.
Las contraseñas, credenciales y respaldos quedarán fuera del repositorio.

## Estado

Base de Next.js funcionando con Docker Compose. ESLint, TypeScript y compilación de producción verificados.

## Desarrollo local

Requisitos: Git, Docker Engine y Docker Compose.

Para preparar una copia nueva, ejecutar desde la raíz del repositorio:

1. Crear la configuración local: `bash scripts/preparar-entorno.sh`
2. Instalar las dependencias: `docker compose run --rm web npm ci`
3. Iniciar la aplicación: `docker compose up -d --wait`
4. Preparar el usuario de la aplicación: `docker compose exec -T db psql -X -U inventario_admin -d inventario -v ON_ERROR_STOP=1 --single-transaction -f - < database/preparar-usuario.sql`
5. Aplicar las migraciones: `docker compose run --build --rm migrar`

Comandos de trabajo:

- Revisar el código: `docker compose exec web npm run lint`
- Compilar para producción: `docker compose exec web npm run build`
- Consultar los registros: `docker compose logs --tail=40 web`
- Detener la aplicación: `docker compose stop web`

El servicio escucha en `127.0.0.1:3000` del equipo CentOS.
El acceso desde otro equipo se realizará mediante un túnel SSH.

## Base de datos de desarrollo

El servicio `db` utiliza PostgreSQL 18. Los datos se conservan en el
volumen `postgres_data` y la contraseña local se guarda en `.env`.

El script `scripts/preparar-entorno.sh` conserva una contraseña ya configurada.

Para detener ambos servicios conservando los datos: `docker compose stop`.

## Respaldos de PostgreSQL

La medición de capacidad, el plan de retención sin borrado y los avisos
del respaldo semanal se describen en [Control de respaldos](docs/control-respaldos.md).

Crear una copia local y comprobar su recuperación:

```bash
respaldo_pg="$(bash scripts/respaldar-postgresql.sh)" &&
bash scripts/verificar-respaldo-postgresql.sh "$respaldo_pg"
```

Las copias se guardan en `backups/postgresql/`, con permisos privados y fuera
del seguimiento de Git. La recuperación se prueba en un contenedor independiente.

Consulta el alcance y los pasos pendientes en
[Respaldos de PostgreSQL](docs/respaldos-postgresql.md).

## Respaldos cifrados en Drive

La conexión institucional cifra el contenido y los nombres de las copias antes
del envío. Después descarga cada copia y prueba su restauración en un contenedor
independiente de PostgreSQL. Al terminar guarda una constancia en `backups/drive/`.

Con la autorización y el cifrado ya preparados, ejecutar desde la raíz:

```bash
bash scripts/respaldar-postgresql-drive.sh
```

Las credenciales y las claves permanecen en `~/.config/inventario-respaldos/`,
fuera del repositorio. Antes del primer envío se debe guardar fuera de CentOS
una copia privada de `recuperacion-cifrado.json`, separada de los respaldos.

Consultar los procedimientos de [autorización](docs/conexion-drive.md),
[preparación del cifrado](docs/cifrado-drive.md) y
[envío y recuperación](docs/respaldo-postgresql-drive.md).
La periodicidad, la retención y los avisos de error se configurarán después.

## Verificaciones automáticas

GitHub Actions revisa dependencias, ESLint, migraciones, permisos,
integridad de los catálogos, respaldo, cifrado y restauración, y compilación
en los pull requests hacia
`main` y al actualizar esa rama.

Las pruebas utilizan una base temporal con credenciales de prueba.
Las pruebas de catálogos revierten sus registros ficticios. La prueba de respaldo
utiliza datos ficticios que se eliminan junto con la base temporal al terminar CI.
El cifrado se prueba sin conexión a Drive, con claves temporales. También se
comprueba el control del envío con Drive simulado; CI no utiliza credenciales de Google.

Para verificar los catálogos localmente: `bash scripts/verificar-base-datos.sh`.

## Catálogos y bodegas

La sección `/mantenedores/categorias` permite consultar las categorías de bienes.
La creación, edición y activación o desactivación están habilitadas
en desarrollo mientras se incorpora la autenticación con Google Workspace.

La web utiliza el usuario limitado `inventario_app` para acceder a PostgreSQL.

La organización prevista es reunir los catálogos y la consulta de
existencias dentro de Mantenedores, con dos bodegas:

- Equipos: registros individuales con cantidad 1, identificación por serie
  e inventario, asignaciones y devoluciones.
- Suministros: productos con cantidades, ingresos y entregas. Las existencias
  se actualizarán mediante los movimientos de bodega.

## Referencias de interfaz

- [SLEP Santa Corina](https://slepsantacorina.gob.cl/)
- [Framework del Gobierno Digital](https://framework.digital.gob.cl/)
- [Recomendaciones WEB 2026](https://kitdigital.gob.cl/archivos/Recomendaciones-WEB-2026.pdf)

La interfaz tomará como guía las capturas del sistema anterior:
cabecera institucional azul, identidad de SLEP Barrancas, menú lateral
por secciones y Mantenedores desplegable.

Se conservará la tipografía gobCL. Los formularios y tablas se presentarán
en paneles blancos, con adaptación a pantallas pequeñas y navegación por teclado.

Bootstrap se incorpora mediante npm, con versión fijada y recursos
servidos desde la aplicación. Las interacciones se implementarán con React.
