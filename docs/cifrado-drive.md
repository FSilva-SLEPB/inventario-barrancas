# Preparación y prueba del cifrado en Drive

Requiere la autorización `barrancas_drive` ya guardada en
`~/.config/inventario-respaldos/rclone.conf`. La carpeta debe quedar fuera de Git,
pertenecer al usuario actual y tener permisos `700`; los archivos privados,
permisos `600`.

```bash
bash scripts/preparar-cifrado-drive.sh
```

El script comprueba el identificador de la unidad, el cliente y el permiso
`drive.file` antes de conectarse. Conserva las conexiones y claves existentes:
si sus ajustes no coinciden, detiene la preparación para revisar el estado.
La imagen de Rclone queda fijada al digest utilizado durante la autorización.

## Preparación de las claves

Primero intenta crear una carpeta temporal en la unidad acordada. Si falla el
acceso, conserva la configuración existente y no genera claves de cifrado.

Cuando aún no hay una conexión cifrada, genera dos secretos aleatorios de
256 bits usando el generador criptográfico de Node.js. Rclone prepara los valores
que necesita para su configuración mediante su comando `obscure`, recibiéndolos
por la entrada estándar. Los secretos no se pasan como argumentos de comandos.

Se conserva una copia privada de la configuración OAuth anterior y se añade
`barrancas_cifrado`, que cifra el contenido, los nombres de archivos y los
nombres de directorios. Su destino previsto es
`barrancas_drive:PostgreSQL-Cifrado`.

La configuración operativa debe permitir el cifrado y descifrado automático.
Sus contraseñas están ofuscadas en el archivo de Rclone; esa ofuscación es
reversible y no sustituye los permisos de acceso ni la protección del servidor.

## Archivo de recuperación

El archivo `~/.config/inventario-respaldos/recuperacion-cifrado.json` contiene
las claves y los ajustes necesarios para descifrar las copias. No incluye
tokens OAuth ni el secreto del cliente de Google, pero permite abrir los datos
cifrados y debe tratarse como una credencial.

Antes de empezar a enviar respaldos de PostgreSQL, conservar una copia de este
archivo fuera de CentOS, en el almacenamiento protegido de credenciales de UTIC.
Debe guardarse separado de los respaldos cifrados. No subirlo a la unidad de
respaldos ni compartir su contenido en el chat o el repositorio.

El script mantiene las claves creadas si falla una operación posterior. Repetir
la preparación utiliza las mismas claves y prueba su funcionamiento; no genera
otro juego que impida recuperar las copias anteriores.

## Comprobación funcional

La prueba utiliza exclusivamente un texto ficticio y una carpeta nueva de
nombre aleatorio dentro de `Comprobaciones`:

1. Sube el texto mediante la conexión de cifrado.
2. Descarga los bytes almacenados en Drive mediante la conexión base.
3. Comprueba el formato del archivo cifrado y su nombre.
4. Utiliza una configuración independiente, creada con el archivo de
   recuperación y sin credenciales de Google, para descifrar localmente.
5. Compara el texto recuperado con el original.
6. Retira el único archivo ficticio y la carpeta temporal, una vez comprobados.

La recuperación local se ejecuta con la red del contenedor deshabilitada.
Los registros y archivos transitorios permanecen privados. Una prueba fallida
puede conservar su carpeta remota para diagnóstico; su limpieza automática
solo intenta quitarla si está vacía, sin borrar su contenido.

La carpeta común `Comprobaciones` puede permanecer en la unidad. En este paso
no se envían respaldos de la base de datos ni documentos del inventario.

## Alcance pendiente

El acceso, el cifrado y la recuperación con el archivo de claves se probaron
en CentOS. El 29 de octubre de 2026 también se completó el
[envío y la restauración de un respaldo de PostgreSQL desde Drive](respaldo-postgresql-drive.md).

La periodicidad, la retención, la supervisión de errores y una copia
desconectada adicional se configurarán en pasos posteriores. Antes de programar
tareas, confirmar la custodia externa del archivo de recuperación y la audiencia
institucional del proyecto OAuth.

Las pruebas locales de desarrollo emplean Docker simulado para comprobar
permisos, conservación de claves, rechazo de configuraciones inesperadas y
tratamiento de fallos. No sustituyen la prueba de Rclone y Google en CentOS.

## Referencias

- [Cifrado Crypt de Rclone](https://rclone.org/crypt/)
- [Preparación de contraseñas para Rclone](https://rclone.org/commands/rclone_obscure/)
- [Copia de archivos](https://rclone.org/commands/rclone_copy/)
