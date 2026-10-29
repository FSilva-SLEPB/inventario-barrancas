# Respaldo cifrado de PostgreSQL en Drive

Requiere que la autorización y la prueba de cifrado hayan terminado correctamente.
Antes del primer envío, conservar fuera de CentOS una copia privada de
`~/.config/inventario-respaldos/recuperacion-cifrado.json`, separada de la unidad
que contiene los respaldos. Este archivo permite descifrar las copias.

## Crear una copia y comprobar su recuperación

Desde la raíz de `inventario-barrancas`, con PostgreSQL iniciado:

```bash
bash scripts/respaldar-postgresql-drive.sh
```

El script valida la configuración de Drive, la unidad, el permiso `drive.file`
y las claves de recuperación antes de crear el respaldo.

Utiliza `scripts/respaldar-postgresql.sh` para producir una copia local nueva.
Solo acepta sus cuatro archivos: `inventario.dump`, `roles.sql`, `metadatos.txt`
y `SHA256SUMS`. Rechaza archivos adicionales y verifica sus sumas SHA-256.
El archivo dump se procesa por partes al calcular la suma, sin cargarlo
completo en memoria.

Los archivos se envían mediante `barrancas_cifrado`, que cifra su contenido y
sus nombres. La fuente se monta en el contenedor como solo lectura. La carpeta
remota de cada copia utiliza una fecha UTC y un identificador aleatorio de
128 bits; el envío conserva los respaldos anteriores.

Después descarga los cuatro archivos desde Drive a una carpeta privada nueva,
comprueba que sus tamaños y sumas coincidan con el origen y ejecuta
`scripts/verificar-respaldo-postgresql.sh` sobre lo descargado. La restauración
ocurre en el contenedor aislado que ya utiliza ese procedimiento.

Solo tras superar la restauración publica `COMPLETO.json` dentro de la carpeta
cifrada. Este marcador contiene el identificador de la copia y de sus claves,
las sumas de los cuatro archivos y la fecha de verificación. También se descarga
de nuevo y se compara con el marcador local.

Finalmente crea una constancia privada en `backups/drive/`, excluida de Git.
La salida estándar contiene únicamente la ruta de la constancia; los mensajes
de progreso y el resultado de la restauración se muestran por la salida de error.

## Comprobar una copia existente

Consultar el identificador registrado en la constancia local y ejecutar:

```bash
bash scripts/respaldar-postgresql-drive.sh --verificar IDENTIFICADOR_DEL_RESPALDO
```

Este modo exige un marcador válido, descarga la copia indicada, comprueba sus
sumas y realiza otra restauración aislada. Guarda una constancia nueva de la
verificación y no crea otro dump ni escribe archivos en Drive.

El identificador aceptado tiene el formato
`inventario_AAAAMMDDTHHMMSSZ_32digitoshexadecimales`. Las copias que no tienen
un marcador de finalización válido requieren revisión antes de considerarlas
terminadas.

## Conservación y fallos

El script conserva la copia local original. Las descargas transitorias se
eliminan al finalizar. Un fallo impide guardar una constancia de éxito y deja
un diagnóstico privado en la carpeta de configuración.

Los archivos ya enviados a Drive también se conservan si una operación falla.
Cuando falla una etapa anterior a la restauración, el script no publica el
marcador. Si la restauración y la publicación terminaron, pero falló la
confirmación posterior del marcador o la constancia local, revisar la copia
con `--verificar` antes de decidir cómo continuar.

Las copias locales siguen protegidas por permisos de archivos y directorios;
el cifrado de este procedimiento se aplica antes del envío a Drive.
La configuración operativa contiene las claves necesarias para el trabajo
automático y debe mantenerse privada en el servidor.

Todavía deben configurarse la periodicidad, la retención, la supervisión de
errores y una copia adicional desconectada. Antes de programar tareas, también
comprobar la audiencia institucional del proyecto OAuth y la custodia de las
credenciales necesarias para reconstruir el servicio.

## Validación del código

Las pruebas con Drive y PostgreSQL simulados verifican la validación de la
configuración, las sumas, el orden de publicación, la conservación de las copias
anteriores y el rechazo de fallos de subida, descarga y restauración.
El 29 de octubre de 2026 se completó en CentOS el envío de una copia real,
su descarga desde Drive, la comprobación SHA-256 y la restauración aislada
en PostgreSQL 18. La constancia se guardó después de completar esas etapas.

GitHub Actions prueba el control del envío con servicios simulados y utiliza
Rclone real para cifrar y recuperar un respaldo de la base temporal de CI.
Los contenedores de cifrado no tienen red y las claves se generan para esa
ejecución; no utilizan la configuración privada del servidor ni acceden a Drive.
La prueba también exige rechazar una clave incorrecta y los archivos cifrados
alterados antes de recuperar y restaurar la copia correcta.

Para ejecutar esa prueba con una copia local ya creada:

```bash
bash scripts/verificar-cifrado-postgresql.sh DIRECTORIO_DEL_RESPALDO
```

La opción `--datos-ci` se utiliza exclusivamente con los datos ficticios que
prepara el workflow. La prueba no modifica la copia de origen y elimina sus
archivos de trabajo y claves temporales al terminar.

## Referencias

- [Copia con Rclone](https://rclone.org/commands/rclone_copy/)
- [Cifrado Crypt](https://rclone.org/crypt/)
- [Restauración con PostgreSQL 18](https://www.postgresql.org/docs/18/app-pgrestore.html)
