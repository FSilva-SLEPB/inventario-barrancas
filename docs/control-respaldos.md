# Control de respaldos en CentOS

Complementa el respaldo cifrado semanal existente, sin cambiar el dump, las
claves ni la unidad de Drive. Requiere Python 3.9 o superior con `zoneinfo`
y datos horarios del sistema, Docker y la configuración privada ya existente.

## Política inicial

- Presupuesto de Drive: **1 TB decimal** para `PostgreSQL-Cifrado`.
  Advertencia desde 800 GB; crítico desde 900 GB. No es una cuota impuesta a Drive.
- Presupuesto local inicial: **50 GB decimales** para `backups/postgresql`.
  Avisos desde 40 GB y 45 GB; aviso adicional con menos de 10 GB libres en el disco.
- Conservar una copia por cada una de las últimas ocho semanas con respaldos y
  una por cada uno de los últimos doce meses con respaldos, usando America/Santiago.
  Se elige la más reciente de cada período. La unión no duplica copias.
  Los envíos manuales de una semana no desplazan ocho semanas de historia.
- La retención genera un **plan**, sin borrar. No hay comandos de eliminación.
  Las carpetas desconocidas y las copias sin marcador requieren revisión.
- Se avisa si no hay una copia completada en los últimos ocho días.

El control mide los bytes **cifrados** de toda la carpeta remota, incluidos envíos
incompletos. No mide la cuota de toda la organización ni la papelera de Drive.
El plan se basa en marcadores COMPLETO.json de las claves actuales: documentan
una restauración previa; medir no vuelve a restaurar cada copia. Un marcador
inválido, una clave distinta o un fallo de lectura invalida el control completo;
no se presenta como tamaño cero ni se prepara un plan parcial de eliminación.

El borrado automático queda pendiente de revisar un primer inventario real y de
implementar una limpieza con revalidación de las copias conservadas. No se debe
usar `sync`, `purge` ni eliminar copias manualmente para simular esa política.
Las copias locales también se conservan; el presupuesto de 50 GB solo avisa.

## Inspección inicial (sin modificar servicios)

Desde `/home/slepb/inventario-barrancas`, como `slepb`:

```bash
python3 --version
python3 -c 'from zoneinfo import ZoneInfo; print(ZoneInfo("America/Santiago"))'
python3 scripts/controlar-respaldos.py --solo-control
python3 -m json.tool ~/.config/inventario-respaldos/control/ultimo-control.json
```

El informe no contiene credenciales, aunque sí identificadores de respaldos;
mantenerlo privado. El código 0 indica control sin avisos; 2 indica advertencias;
1 indica fallo. Una advertencia no elimina ni bloquea un respaldo nuevo.
El controlador respeta el mismo `respaldo.lock` del servicio existente y el
bloqueo interno del script de Drive. No ejecutar el controlador bajo otro flock
del mismo archivo: se bloquearía a sí mismo.

## Correo institucional

Destinatario inicial: **felipe.silva@slepb.gob.cl**. El controlador usa el MTA
local compatible con `sendmail`, sin almacenar contraseñas en Git. Antes de
activar avisos revisar en CentOS, sin mostrar configuraciones ni secretos:

```bash
command -v sendmail || test -x /usr/sbin/sendmail
rpm -q postfix msmtp
```

Si falta el transporte, configurar un relay autorizado por la institución. No
asumir que OAuth de Drive sirve para enviar correo, ni habilitar un relay abierto.
La selección de relay de Workspace o autenticación requiere revisar la salida
anterior y las reglas de la organización; las credenciales se ingresan solo en
archivos privados del servidor. No solicitar contraseñas por chat.

Cuando el transporte esté configurado:

```bash
python3 scripts/controlar-respaldos.py --probar-aviso
```

Confirmar recepción real en el buzón (y revisar spam). La aceptación por el MTA
no prueba entrega. Si no se acepta, el `.eml` permanece privado bajo `control/`
y `ultimo-aviso.json` informa el estado. No se reenvían pendientes automáticamente:
resolver primero el MTA y repetir la prueba; conservar los avisos para auditoría.
Los avisos no adjuntan dumps, archivos de configuración ni logs del proveedor.
La revisión diaria puede repetir advertencias mientras persistan.

## Activación en el servidor

Estos pasos presuponen el servicio y temporizador semanal ya instalados para
`slepb`. El repositorio debe estar en `/home/slepb/inventario-barrancas`.
Verificar antes que no existan archivos con los mismos nombres en `/etc/systemd/`;
si existen, compararlos y conservar una copia antes de reemplazarlos.

Después del control inicial y de revisar el informe:

```bash
sudo install -d -m 755 /etc/systemd/system/inventario-respaldo.service.d
sudo install -m 644 deploy/systemd/inventario-respaldo.service.d/control.conf \
  /etc/systemd/system/inventario-respaldo.service.d/control.conf
sudo install -m 644 deploy/systemd/inventario-control-respaldos.service \
  /etc/systemd/system/inventario-control-respaldos.service
sudo install -m 644 deploy/systemd/inventario-control-respaldos.timer \
  /etc/systemd/system/inventario-control-respaldos.timer
sudo systemctl daemon-reload
sudo systemd-analyze verify inventario-respaldo.service \
  inventario-control-respaldos.service inventario-control-respaldos.timer
```

Solo si la validación anterior pasa:

```bash
sudo systemctl start inventario-control-respaldos.service &&
sudo systemctl enable --now inventario-control-respaldos.timer
sudo systemctl list-timers --all 'inventario-*'
sudo journalctl -u inventario-control-respaldos.service -n 30 --no-pager
```

El respaldo sigue programado los domingos a las 02:00. La medición corre cada
día a las 09:00, hora de Chile, sin generar otro dump. Los temporizadores recuperan
una ejecución omitida al encender CentOS. Un cierre forzado o un apagado completo
no puede generar un correo desde ese servidor: el control posterior detecta
respaldos antiguos. La supervisión externa queda pendiente.

Para volver al servicio semanal anterior, detener y deshabilitar únicamente
`inventario-control-respaldos.timer`, retirar únicamente el drop-in `control.conf`
creado aquí y ejecutar `systemctl daemon-reload`. No borrar volúmenes ni datos.

## Validación de desarrollo

```bash
python3 tests/respaldos/probar-control-respaldos.py
python3 tests/respaldos/probar-envio-drive.py
```

Las pruebas simulan Drive, PostgreSQL y correo: verifican fechas en Chile,
retención sin duplicados, umbrales, rechazos de marcadores, conservación de
incompletas, ausencia de operaciones destructivas y avisos pendientes/aceptados.
No afirman entrega real ni instalación en CentOS.
