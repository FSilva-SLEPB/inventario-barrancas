# Actas: generación, impresión y correo

## Alcance de la primera integración

Desde **Inventario → Movimientos y actas**, UTIC puede preparar un acta para una asignación o devolución confirmada de equipos o celulares. Se consulta también el listado de actas emitidas, con los filtros y paginación comunes.

Las cuatro familias propuestas comparten la presentación y las acciones de Imprimir, Descargar PDF y Enviar por correo. Esta integración habilita los movimientos existentes de asignación/devolución. Préstamos, cambios/traspasos compuestos, entrega de insumos y bajas requieren sus registros y validaciones antes de emitir actas operativas. Los quince DOCX se revisaron como ejemplos; no se utilizan como archivos de combinación ni se instalan como plantillas.

## Emisión y numeración

Felipe indicó finalmente iniciar desde **0**, sustituyendo la idea inicial de continuar una serie anterior. La numeración es única, sin una secuencia distinta por tipo ni reinicio automático anual: ACT-000000, ACT-000001, etc.

La pantalla muestra el movimiento y su receptor real. Se revisan los datos de quien entrega y se completan los RUN y antecedentes pertinentes. No se completan movimientos antiguos automáticamente con el director o funcionario vigente. Se conservan la fecha real del movimiento y la fecha de emisión como datos diferentes.

Preparar los datos no ejecuta otra asignación o devolución. La emisión reserva el folio, compone el PDF y guarda sus datos y bytes en una transacción. Si la composición falla, se revierte también la reserva del folio. Un reintento de la misma solicitud no emite otra acta. Dos solicitudes concurrentes no generan dos actas para el mismo movimiento.

El PDF lleva la fuente institucional, encabezados y páginas calculadas. Se conservan su versión, sus bytes y su huella SHA-256. Cambiar posteriormente el nombre de una sede, los datos de un bien o el directorio no cambia el documento emitido. Las correcciones/anulaciones con documentos de reemplazo se desarrollarán como un flujo propio: esta primera versión no permite sobrescribir ni borrar un acta emitida.

## Impresión y descarga

La ficha contiene las acciones comunes:

- **Imprimir:** solicita la impresión del PDF conservado, mediante el visor del navegador.
- **Descargar PDF:** obtiene ese mismo archivo y versión.
- **Enviar por correo:** permite revisar los destinatarios antes de adjuntar el PDF conservado.

Abrir la impresión no se registra como prueba de una impresión completada; el usuario puede cancelar el diálogo. Si el navegador no abre la impresión embebida, Abrir PDF permite utilizar la impresión nativa del visor. Generar el documento no atribuye una firma ni aceptación a sus participantes.

## Correo de no responder

El remitente será una cuenta institucional de **no responder**. Su dirección exacta y el relay o cuenta autorizada se configuran en el archivo privado `.env` de CentOS:

| Variable | Uso |
| --- | --- |
| ACTAS_CORREO_REMITENTE | Dirección institucional real de no responder, autorizada por la organización |
| ACTAS_SMTP_HOST | Host del servicio o relay autorizado |
| ACTAS_SMTP_PUERTO | Puerto; por defecto 587 |
| ACTAS_SMTP_TLS_DIRECTO | `si` para TLS directo, por ejemplo puerto 465; `no` para STARTTLS obligatorio |
| ACTAS_SMTP_USUARIO | Usuario si el servicio requiere autenticación |
| ACTAS_SMTP_CLAVE | Credencial privada correspondiente; no se introduce en Git ni en el chat |

Se verifica siempre el certificado TLS. La cuenta y las credenciales de Google Drive o el inicio de sesión de la web no se reutilizan como permiso para enviar correos. En caso de usar un relay sin usuario/clave, este debe estar autorizado institucionalmente para el servidor. No hay un botón que envíe automáticamente a todos los contactos de una sede.

El formulario permite revisar hasta cinco direcciones distintas separadas por comas; se rechazan cabeceras, nombres con direcciones embebidas y caracteres de control. El asunto y nombre de adjunto proceden del folio conservado. La cuenta de no responder lleva un nombre visible institucional y cabeceras de correo automático.

Si el transporte no está configurado, la opción sigue visible e informa que no está habilitada. La emisión, impresión y descarga funcionan sin SMTP; no se informa un envío exitoso ni se simula que salió un mensaje.

## Historial y resultados

Solo los dos perfiles administradores de UTIC emiten, consultan estas actas y solicitan sus envíos en esta primera integración. Las acciones vuelven a comprobar permisos; ocultar un botón no es el control de acceso.

Cada intento registra la solicitud, destinatarios, remitente, actor, resultado y fechas. El servidor de correo puede aceptar todos los destinatarios, aceptar algunos, rechazar el envío o dejar un resultado incierto por una interrupción. La aceptación no es una confirmación de lectura ni de llegada a la bandeja de entrada.

No se reenvía automáticamente un resultado incierto. Se exige revisar el intento anterior antes de solicitar otro. Una solicitud ya procesada no vuelve a enviarse. Se impiden dos envíos simultáneos del acta y se limita la repetición reciente. Si el proceso se interrumpe, un intento que no se confirmó pasa a mostrarse como resultado por confirmar, sin convertirlo en éxito.

El adjunto y la impresión usan los mismos bytes del PDF emitido; no se vuelve a consultar el directorio para regenerarlo. No se consumen nuevos folios al imprimir, descargar o reenviar.

## Instalación y verificación

Requiere `1794355200000_actas-documentos-correo` y reconstruir la imagen compilada con `compose.produccion.yaml`. Se conserva el proyecto y volumen existentes. Primero se obtiene un respaldo con recuperación verificada. La configuración privada y la conectividad SMTP se verifican después en CentOS; integrar el PR no configura por sí solo una cuenta de correo.

El respaldo incluye contador, documento con sus bytes/huella y registros de envío. La verificación de recuperación comprueba permisos, datos ficticios del PDF e historial. Las pruebas de correo usan únicamente un servidor local TLS y buzones ficticios, con casos de duplicación, rechazo parcial y conexión interrumpida. No se envían mensajes a personas reales desde el entorno de desarrollo.

La dependencia de SMTP está fijada con el alias `actas-smtp` a Nodemailer 10.3.1. Esto permite utilizar la versión actualizada sin instalar el peer opcional antiguo de correo de NextAuth; la aplicación sigue utilizando el proveedor de Google para autenticación. No se fuerza una degradación de dependencias.
