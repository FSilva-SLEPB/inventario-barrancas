# Autorización de Drive para los respaldos

Este paso configura la autorización OAuth de Rclone. La comprobación de escritura
en la unidad, el cifrado, el envío de las copias y su programación se realizan
después de autorizar la conexión.

## Preparación

Requisitos: Docker, Git, Bash y una conexión SSH desde el computador del usuario.
El JSON del cliente OAuth debe ser de tipo App de escritorio y estar guardado en
`~/.config/inventario-respaldos/oauth-cliente.json`, con permisos `600`.
La carpeta debe tener permisos `700` y quedar fuera de cualquier repositorio Git.

El proyecto de Google Cloud debe tener habilitada Google Drive API. Para uso
institucional dentro del mismo Workspace, configurar su audiencia como Interno.
Antes de programar tareas se debe comprobar esa configuración; una aplicación
externa en modo de prueba puede producir autorizaciones de corta duración.

El script utiliza la imagen de Rclone 1.75.2 identificada por el digest obtenido
en este servidor. El ayudante que procesa los archivos utiliza Node.js 24 sin
dependencias npm. La configuración y las credenciales no se imprimen.

```bash
bash scripts/autorizar-drive-inventario.sh preparar
```

La opción predeterminada también es `preparar`. Valida el JSON y comprueba que
Rclone pueda ejecutarse; conserva el archivo original.

## Túnel SSH y autorización

Crear en MobaXterm un túnel de tipo Local port forwarding:

| Campo | Valor |
| --- | --- |
| Forwarded port | `53682` |
| SSH server | La dirección utilizada en la sesión SSH de CentOS |
| SSH login | `slepb` |
| SSH port | El puerto de la sesión SSH existente |
| Remote server | `127.0.0.1` |
| Remote port | `53682` |

Mantener el túnel activo durante la autorización. El servidor OAuth temporal
escucha en la interfaz local de CentOS y el navegador se utiliza en el computador
del usuario.

```bash
bash scripts/autorizar-drive-inventario.sh autorizar
```

El script valida la redirección local antes de mostrarla: exige el cliente del
JSON, el proveedor de Google, el retorno local y el permiso `drive.file`.
Esa inspección no sigue la redirección hacia Google.

Abrir el enlace que muestra la terminal en el navegador del computador y elegir
la cuenta institucional que tiene acceso a la unidad de respaldos.
Revisar la autorización que solicita Google y completar el consentimiento.

El permiso `drive.file` limita a la herramienta a los archivos creados por ella.
Para este destino, el identificador de la unidad es `0AFt45KLDJwTFUk9PVA`.

## Archivos privados y resultado

Al completar el flujo, la configuración se publica como
`~/.config/inventario-respaldos/rclone.conf`, con permisos `600` y el nombre
de conexión `barrancas_drive`. Contiene credenciales y tokens renovables;
debe permanecer en los equipos autorizados.

Una configuración existente se conserva. Si hace falta renovar una autorización,
primero revisar su estado para preparar el procedimiento adecuado.

Los archivos transitorios con credenciales y respuestas se eliminan al terminar.
En caso de error, el diagnóstico de Rclone queda en un archivo privado
`error-oauth.*.log`, cuya ruta se indica en la terminal. Su contenido también
debe tratarse como información privada.

La variable opcional `INVENTARIO_RESPALDOS_CONFIG_DIR` permite utilizar otra
carpeta privada fuera de Git, con los mismos requisitos de permisos.

## Validación realizada

La sintaxis Bash y las pruebas con Docker simulado comprueban el manejo de
archivos privados, la conservación de configuraciones anteriores y el rechazo
de clientes, permisos, proveedores y tokens inesperados. Esas pruebas utilizan
una redirección HTTP local y credenciales ficticias; no acceden a Google.

La autorización real se completó en CentOS con la cuenta institucional. El
acceso a la unidad y la recuperación de una copia cifrada de PostgreSQL se
comprobaron el 29 de octubre de 2026. En una instalación nueva, repetir las
comprobaciones con la cuenta que operará los respaldos.

Este procedimiento prepara la autorización. Los pasos siguientes se describen
en [Cifrado en Drive](cifrado-drive.md) y
[Respaldo de PostgreSQL en Drive](respaldo-postgresql-drive.md).

## Referencias

- [Configuración remota de Rclone](https://rclone.org/remote_setup/)
- [Permisos y opciones de Google Drive en Rclone](https://rclone.org/drive/)
- [Comando de autorización](https://rclone.org/commands/rclone_authorize/)
- [Configuración de OAuth en Google Workspace](https://developers.google.com/workspace/guides/configure-oauth-consent)
- [Túneles SSH en MobaXterm](https://mobaxterm.mobatek.net/documentation.html)
