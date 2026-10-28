# Respaldo local y comprobación de PostgreSQL 18

Este procedimiento crea una copia lógica de la base `inventario` y comprueba
su recuperación en un contenedor temporal de PostgreSQL 18.

## Crear y comprobar una copia

Ejecutar desde la raíz del proyecto con el servicio `db` iniciado:

```bash
respaldo_pg="$(bash scripts/respaldar-postgresql.sh)" &&
bash scripts/verificar-respaldo-postgresql.sh "$respaldo_pg"
```

El primer script imprime la ruta de la copia en su salida estándar. Los mensajes
de progreso se escriben en la salida de error para permitir la captura de esa ruta.

El destino predeterminado es `backups/postgresql/`. Se puede indicar otra carpeta:

```bash
bash scripts/respaldar-postgresql.sh /ruta/privada/respaldos-postgresql
```

Los destinos dentro del proyecto deben estar excluidos de Git. Las reglas
actuales también excluyen `backups/` del contexto de construcción de Docker.

## Contenido de cada copia

La carpeta, identificada por fecha UTC y un sufijo aleatorio, contiene:

- `inventario.dump`: estructura, datos, propietarios y permisos de la base,
  en formato personalizado comprimido de `pg_dump`.
- `roles.sql`: definición de los roles del clúster, excluyendo sus contraseñas.
- `metadatos.txt`: versión, fecha y commit del código disponible al crear la copia.
- `SHA256SUMS`: sumas de comprobación de los otros tres archivos.

La carpeta se crea con permisos `700` y sus archivos con `600`. Una copia que
falla no se publica como terminada. Cada ejecución genera una carpeta nueva
y conserva las anteriores.

Las credenciales se leen dentro del contenedor `db`. El archivo `.env` y los
hashes de las contraseñas de los roles quedan fuera del respaldo.

Las copias de esta etapa se guardan sin cifrado. Los permisos del sistema de
archivos limitan el acceso al usuario que las crea.

## Qué comprueba la restauración

Para comprobar de nuevo una copia existente:

```bash
bash scripts/verificar-respaldo-postgresql.sh /ruta/completa/de/la/copia
```

El script valida el formato y las sumas SHA-256 antes de iniciar un contenedor
nuevo con `postgres:18-bookworm`. Ese contenedor utiliza `--network none`,
sin puertos publicados ni montajes del servicio `db`.

Dentro del contenedor se crean una base de control y un usuario administrativo
temporal. Su almacenamiento es independiente del volumen `postgres_data`
del proyecto.

Primero se recuperan los roles y luego se reconstruye `inventario`, conservando
propietarios, configuración y permisos, incluidos los de acceso a la base.
Si ocurre un error se descarta el contenedor completo de prueba.

La comprobación se conecta como `inventario_app` y verifica las tablas de
catálogos, los permisos limitados, la relación entre dependencias y sedes y
los índices únicos. Muestra las cantidades de registros recuperados.

Al terminar se eliminan el contenedor de prueba y su almacenamiento temporal.
Si ocurre un error, se intenta la misma limpieza y se conserva un registro
local privado con los detalles del diagnóstico.

Este script sirve para comprobar una copia; la recuperación del servicio en
otro entorno debe preparar además las credenciales y la configuración de destino.
Los roles restaurados requieren que se configuren sus contraseñas para aceptar
conexiones que utilicen autenticación por contraseña.

## Verificación en GitHub Actions

CI crea un registro ficticio en cada catálogo de su base temporal. Luego ejecuta
los mismos scripts de respaldo y restauración y comprueba que se conservaron
los textos con tildes y apóstrofos, la relación con la sede y el estado inactivo.

`RESPALDO_DB_CONTAINER` permite señalar el identificador del contenedor temporal
de CI sin cargar la configuración local de Compose. El argumento `--datos-ci`
activa las comprobaciones de los datos ficticios; se utiliza únicamente en CI.

## Pasos pendientes antes de trabajar con datos reales

Quedan por configurar el cifrado, una copia fuera del servidor, la periodicidad,
la retención y la comprobación periódica de recuperación. Esta copia local
verificable es la primera etapa del esquema de respaldo.

## Referencias

- [pg_dump de PostgreSQL 18](https://www.postgresql.org/docs/18/app-pgdump.html)
- [pg_dumpall de PostgreSQL 18](https://www.postgresql.org/docs/18/app-pg-dumpall.html)
- [pg_restore de PostgreSQL 18](https://www.postgresql.org/docs/18/app-pgrestore.html)
