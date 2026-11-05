# Revisión de la instalación efectiva en CentOS

El PR #51 incorporó préstamos y correo restringido. Felipe confirmó la instalación
y su funcionamiento después de aplicar la migración 18. La revisión siguiente
compara los contenedores en ejecución con la configuración prevista y ayuda a
completar los pendientes de seguridad del host. No es una certificación.

## Ejecutar sin detener la web

Desde la copia instalada y actualizada del repositorio:

```bash
cd /home/slepb/inventario-barrancas
python3 scripts/revisar-instalacion.py --prueba-local \
  --project-name inventario-barrancas
```

Usar `--prueba-local` mientras el origen canónico sea HTTP en localhost. Para el
origen HTTPS definitivo se omite esa opción. Con otro archivo privado se indica
`--env-file /ruta/absoluta/al/archivo`, sin pegar su contenido en una conversación.
El script requiere Python 3, Docker Compose y permisos habituales del usuario de
la instalación; no solicita sudo ni cambia permisos por su cuenta.

| Resultado | Significado |
| --- | --- |
| Código 1 / ERROR | No se completó la consulta o hay una diferencia/riesgo que revisar. No recrear servicios automáticamente. |
| Código 2 / OK y PENDIENTE | Los controles automáticos efectivos pasaron, pero quedan comprobaciones manuales. No equivale a seguridad completa aprobada. |

El código 2 es deliberado: no encadenar este diagnóstico con un despliegue usando
`&&` ni configurarlo como healthcheck. La salud de la aplicación sigue en
`/api/salud`; este script es revisión operativa bajo demanda.

## Qué comprueba

- Archivo de configuración regular, privado y del usuario actual; rechaza enlaces.
- Configuración prevista mediante el mismo validador de producción existente.
- Dos servicios en ejecución y healthy, identificados por proyecto y servicio.
- Servidor web compilado, modo production, usuario limitado, raíz de solo lectura,
  capacidades retiradas, no-new-privileges y ausencia de ejecución privilegiada.
- Comando, punto de entrada y directorio de trabajo previstos; rechazo de variables
  duplicadas, ajustes de carga de código no declarados y validación TLS desactivada.
- Sin red host ni montajes de código/persistentes inesperados en la web; política
  de reinicio y rotación de registros coincidentes con Compose.
- Publicación web solo en loopback y en los puertos previstos; PostgreSQL sin
  publicación de puertos y con el volumen persistente esperado.
- Revisión de la imagen igual al commit del código local y variables efectivas
  coincidentes con Compose, sin reproducir sus valores.
- Modo correo prueba y lista vacía o el único buzón autorizado. Distingue transporte
  pendiente de configurar y configuración presente aún sin comprobar conectividad.

Todas las consultas son de solo lectura. No ejecuta SQL, inicia/recrea servicios,
edita el archivo privado, instala paquetes, envía correo ni crea caché Python en
el repositorio. Docker Compose resuelve la configuración privada en memoria;
su salida y los diagnósticos originales de los comandos nunca se imprimen.
Un fallo no muestra contraseñas, tokens, correos del directorio ni cadenas de conexión.

## Verificaciones manuales que continúan pendientes

1. **Correo:** Felipe informó que el servicio todavía no está definido y no indicó
   una dirección exacta de remitente. Configurar ambos datos y credenciales solo
   en CentOS cuando se acuerden. Mantener `ACTAS_CORREO_MODO=prueba` y como único
   destinatario `correoprueba@slepb.gob.cl`.
2. **HTTPS y OAuth:** validar certificado y cadena, proxy/Host/Origin, cookies
   Secure en el origen definitivo e inicio de sesión real con perfiles autorizados.
   El diagnóstico no inicia sesión ni realiza peticiones externas por su cuenta.
3. **Host:** comprobar firewall, SELinux, actualizaciones del SO/Docker/imágenes,
   permisos de secretos, cuentas de administración y exposición real desde la red.
4. **Recuperación programada:** revisar temporizadores/cron, último resultado,
   custodia de claves y realizar una restauración verificada periódica. Que un
   servicio esté healthy no prueba la recuperación ni el envío a Drive.

## Mantenimiento de dependencias de desarrollo

La revisión posterior al PR #51 sustituye solo las ramas afectadas de minimatch
(`>=7.0.0 <11.0.1`) por `11.0.4` mediante una excepción explícita de npm. Los
consumidores de minimatch 3 conservan su rama. La versión es compatible con Node
24, requisito de la aplicación; las migraciones ya utilizaban minimatch 11 por glob.

El aviso GHSA-g3hv-75wg-m249 afectaba a herramientas de desarrollo. La excepción
cruza una versión mayor de una dependencia transitiva, por lo que se verifica la
instalación reproducible, ESLint, compilación, pruebas y dependencias. Se retirará
cuando todos los consumidores admitan una versión corregida directamente. No se
utiliza `npm audit fix --force` ni se cambia el flujo operativo del inventario.
CI rechaza avisos moderados o superiores en las dependencias web, incluyendo
desarrollo; el umbral anterior permitía el aviso moderado ahora corregido.

El resultado cero de `npm audit` es una consulta de avisos conocidos en una fecha;
no prueba ausencia de vulnerabilidades en el código o el servidor.
