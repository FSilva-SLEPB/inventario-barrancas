# Preparación del despliegue de producción

El entorno actual de desarrollo se conserva en `compose.yaml`. La alternativa
compilada está en **`compose.produccion.yaml`**, un archivo completo que se usa
por separado, no como un segundo archivo de superposición sobre el de desarrollo.
La incorporación del código a GitHub no cambia la instalación de CentOS.

## Componentes preparados

- `Dockerfile.web` instala dependencias fijadas y compila Next.js en una etapa
  independiente. La imagen final ejecuta `node server.js` con salida standalone,
  usuario no privilegiado y recursos estáticos locales.
- No recibe credenciales de Google/PostgreSQL durante la compilación. Se entregan
  al iniciar el contenedor, desde la configuración privada de la instalación.
- Compose publica la web solo en `127.0.0.1`, conserva PostgreSQL sin puertos
  públicos y configura reinicio, rotación de registros, raíz de la web de solo
  lectura, caché temporal y retirada de capacidades innecesarias.
- `/api/salud` devuelve únicamente `estado: ok` o `no_disponible`. Comprueba
  configuración mínima de autenticación, conexión/permisos de lectura y presencia
  del módulo NC requerido. No ejecuta migraciones ni publica datos o diagnósticos.
- El ejemplo de nginx en `deploy/nginx/inventario.conf.example` termina HTTPS,
  conserva Host/Origin, limita solicitudes de salud y permite el tamaño de cuerpo
  previsto por las acciones de la aplicación. El dominio y certificados se deben
  configurar para la instalación real.

La comprobación de salud no sustituye las pruebas funcionales ni un inicio de
sesión real con Google. Un estado `healthy` no certifica toda la instalación.

## Datos y nombre del proyecto

El volumen se llama `postgres_data` dentro de Compose y su nombre físico depende
del proyecto. Para reutilizar los datos actuales se debe conservar el mismo nombre
de proyecto usado en CentOS y comprobar el volumen existente. Cambiar el nombre
del proyecto puede crear otra base vacía; no se trata de una migración de datos.

`scripts/verificar-produccion.py` resuelve Compose sin imprimir sus variables
privadas y comprueba origen HTTPS, configuración, ejecución, puertos y existencia
del volumen esperado. No crea servicios ni datos:

```bash
python3 scripts/verificar-produccion.py
```

Si se utiliza un archivo privado o un nombre de proyecto distinto, se indican
explícitamente con `--env-file` y `--project-name`. La opción `--prueba-local`
permite HTTP solo en loopback y un volumen nuevo, para un ensayo aislado. No se
presenta como validación de un servicio publicado con HTTPS.

## Configuración que se conserva o completa

| Dato | Tratamiento |
| --- | --- |
| Contraseñas de PostgreSQL y del usuario web | Conservar las que corresponden a la base existente. Editar la variable no cambia la contraseña de un rol que ya está creado |
| `NEXTAUTH_SECRET` | Conservar bajo custodia; no regenerar por cada despliegue |
| Cliente web de Google | Configuración propia del inventario, separada de Drive; registrar el origen y callback HTTPS definitivos |
| `NEXTAUTH_URL` | Origen canónico, por ejemplo `https://inventario.DOMINIO/`, sin ruta adicional |
| `WEB_PORT` | Puerto local del proxy; predeterminado 3000, sin exposición en todas las interfaces |
| `APP_REVISION` e imágenes | Identificar la versión aprobada; preferir etiquetas de versión/commit, no sustituir una imagen sin registro |

La preparación existente genera contraseñas adecuadas para las URL de conexión.
La verificación compara la conexión web con la cuenta limitada y la base previstas.
Los secretos, certificados privados y copias no se incorporan al repositorio ni
se entregan al contexto de compilación. Si la red exige una CA adicional, los
Dockerfiles aceptan un secreto BuildKit `proxy_ca` durante la instalación; no se
desactiva la validación TLS ni se copia ese certificado a una capa de la imagen.

## Secuencia a comprobar al recuperar acceso

1. Identificar el proyecto, volumen y versión realmente instalados; revisar el
   estado de Git y resolver cambios locales sin sobrescribirlos.
2. Preparar la ventana y una copia de PostgreSQL con restauración verificada;
   conservar la configuración privada y el estado anterior.
3. Obtener el código aprobado y construir las imágenes de web y migraciones con
   una revisión identificada.
4. Revisar la configuración de producción y confirmar el volumen existente.
5. Con la web detenida durante la actualización, aplicar las migraciones de esa
   versión. La nueva ficha NC requiere `1794009600000_funcionarios-nivel-central`.
6. Iniciar la web compilada y comprobar salud, recursos estáticos, acceso real,
   perfiles, fichas, cargas y exportación. Registrar versión y resultado.
7. Completar y verificar nginx/HTTPS, callback de Google, reinicio, copias y avisos
   antes de abrir el acceso institucional definitivo.

Ejemplos de operaciones de esta etapa, desde la raíz y una vez identificados
correctamente proyecto, configuración y respaldo:

```bash
docker compose -f compose.produccion.yaml build web migrar
docker compose -f compose.produccion.yaml run --rm migrar
docker compose -f compose.produccion.yaml up -d --wait web
```

Los comandos anteriores son para una instalación revisada; no preparan por sí
solos dominio, certificados ni credenciales. No se eliminan volúmenes para
actualizar. El primer paso a producción requiere un plan de vuelta probado;
volver al código anterior no revierte datos ni migraciones.

## Ensayo automatizado de la imagen

`scripts/probar-imagen-produccion.mjs` admite únicamente una red identificada
como prueba/test/GitHub, y requiere imagen, contenedor de PostgreSQL y conexiones
exclusivamente de prueba. Inicia sus propios contenedores de web, verifica usuario,
raíz de solo lectura y salud, ejecuta las comprobaciones HTTP contra la imagen,
prueba fallos de configuración/conexión y elimina sus contenedores.

Los identificadores de Server Actions se extraen de la compilación ensayada;
no se reutilizan los de otra compilación del host. Solo se extraen metadatos de
acciones, no la clave de cifrado. La prueba de CI y el ensayo manual no usan
identidades, cookies ni secretos de Google reales.

Además, el ensayo de Compose debe cubrir base nueva, salud antes/después de las
migraciones y persistencia tras reiniciar PostgreSQL. Las pruebas del contenedor
no sustituyen la configuración de TLS/OAuth, la supervisión externa ni la
comprobación de operación en CentOS.

## Resultado del ensayo aislado

El ensayo local del 3 de noviembre (UTC) comprobó base nueva, HTTP 503 antes de
migrar, diez migraciones con la imagen independiente, repetición sin cambios,
HTTP 200 después de migrar y conservación de una fila ficticia tras reiniciar
PostgreSQL. La imagen pasó 283 comprobaciones HTTP, además de los casos de salud
con configuración y conexión inválidas. El navegador real verificó escritorio,
móvil y movimiento reducido. Se verificó también un respaldo/restauración.
La imagen de migraciones instala únicamente su paquete mínimo de pg/node-pg-migrate,
con su archivo de bloqueo y el ajuste de glob documentado en la auditoría.
Estos ensayos no son una instalación ni una prueba de HTTPS/OAuth real en CentOS.

La revisión de directorios añade `1794096000000_directorios-separados` a la
secuencia de instalación. La salud ahora requiere sus columnas y operación SQL;
no iniciar una imagen de esta revisión sobre una base que solo tenga diez
migraciones. Consultar [Directorios separados](directorios-separados.md).
