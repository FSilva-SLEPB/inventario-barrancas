# Actas institucionales, impresión y correo

## Recorrido de uso

1. UTIC abre el bien en **Inventario** o **Bodega TI**. En la columna **Acciones**
   dispone de **Asignar / entregar** cuando está en bodega, o **Devolver a Bodega TI**
   cuando está asignado. También están disponibles en el detalle del bien.
2. Revisa destino, fecha real, receptor y motivo. Revisa los participantes precargados del
   acta. Quien entrega se obtiene de la cuenta autenticada y su ficha de funcionario;
   los datos pueden corregirse con el lápiz. El motivo es opcional. Contacto, cargo, unidad, subdirección, estado,
   accesorios y observaciones usan los mismos campos compartidos en todo el sistema.
   Los contactos de directorio son sugerencias editables; cambiar el destino limpia
   los datos de la sede anterior. No se inventa una persona para un cargo pendiente.
3. **Confirmar asignación y acta** o **Confirmar devolución y acta** guarda ambos
   registros en una sola transacción. Si falla el PDF, se revierte también el
   movimiento y el folio. Un reintento de la misma solicitud no duplica nada.
4. Se conserva la consulta con sus filtros y se abre el acta en una ventana. Incluye
   **Imprimir**, **Descargar PDF** y **Enviar por correo**, con el mismo componente
   del detalle de documentos. La confirmación de éxito indica que el acta está lista.
5. **Movimientos y actas** es consulta de operaciones realizadas: Ver bien, Ver
   acta e Imprimir según corresponda. No inicia asignaciones ni devoluciones.

La sede puede consultar el inventario de su alcance, pero solo los dos perfiles
administradores de UTIC confirman movimientos y emiten/consultan/envían actas.

## Modelo institucional

El contenido se basa en los Word aportados por Felipe: asignación NC, EE y JISC,
asignación de celulares y devolución de equipos/celulares. Se conserva el estilo
institucional aprobado y se incorpora el logo oficial de Barrancas, la cabecera
institucional y su unidad. Los Word privados no se instalan ni se publican.

| Parte del modelo aportado | Documento generado |
| --- | --- |
| Folio y fecha | Secuencia común desde ACT-000000, versión, fecha real y fecha de emisión |
| Recibe | Nombre, RUN, cargo y correo; unidad/subdirección cuando corresponde |
| EE/JISC | RBD, establecimiento, dirección y comuna conservados al confirmar |
| Detalle de bienes | Tabla de inventario, descripción, marca, modelo y serie; para celulares, IMEI y teléfono por equipo |
| Estado, accesorios y observación | Condición registrada y antecedentes revisados por UTIC |
| Condiciones de uso | Uso institucional, comercialización, avisos de robo, responsabilidad y devolución NC al terminar la relación laboral |
| Devolución | Constancia de recepción por la Unidad TIC, estado y accesorios faltantes |
| Entrega / recibe | Nombres, RUN, cargo y espacios de firma, con identificación del emisor |

No se afirma que un equipo está nuevo u operativo si su registro no lo indica.
Generar el PDF no acredita una firma. Los documentos breves usan una página A4;
con más bienes o texto, continúan con logo, cabecera, tabla y numeración de páginas.

Los préstamos temporales y su devolución vinculada se implementan en la actualización
18; véase [Préstamos](prestamos-inventario.md). Usan los modelos de préstamo EE/NC
aportados por Felipe, con plazo y referencia al documento original. Los cambios o
traspasos compuestos, entrega de insumos y bajas siguen pendientes de operaciones
propias; no se registran mediante una asignación ficticia.

## Datos anteriores y folios

Cada PDF emitido conserva sus bytes, SHA-256, datos, folio y versión. El formato
nuevo se aplica a nuevas emisiones; no sobrescribe documentos ya emitidos o
adjuntados a correos anteriores. Imprimir, descargar y reenviar usan el mismo PDF.

Los registros previos sin documento se completan desde **Ver → Actas del bien →
Completar acta**. Se documenta la operación anterior, sin volver a mover el equipo.
Las entregas históricas conservan la fecha, sede, receptora y todos los bienes del
grupo original. Los datos desconocidos pueden quedar vacíos y se identifican así.
Los contactos ya registrados se conservan incluso cuando las reglas actuales para
nuevos destinatarios son más estrictas; nunca se sustituyen por el directorio actual.

## Correo institucional

El remitente es una cuenta institucional de no responder. Configurar exclusivamente
en CentOS las variables `ACTAS_CORREO_REMITENTE`, `ACTAS_SMTP_HOST`,
`ACTAS_SMTP_PUERTO`, `ACTAS_SMTP_TLS_DIRECTO`, `ACTAS_SMTP_USUARIO` y
`ACTAS_SMTP_CLAVE`; no compartir ni incorporar credenciales a Git.

Cada envío requiere destinatarios explícitos, valida cabeceras y conserva actor,
resultado e idempotencia. Una aceptación SMTP no confirma lectura ni llegada a la
bandeja final. Los resultados inciertos exigen revisión antes de reenviar y no se
reintentan automáticamente. Sin configuración, el formulario explica que el envío
no está habilitado. Las pruebas usan únicamente SMTP local TLS y buzones ficticios.

Se utiliza el alias `actas-smtp` fijado a Nodemailer 10.3.1, sin instalar el peer
opcional antiguo de NextAuth. La autenticación institucional sigue usando Google.

## Actualización

La integración inicial utilizó `1794355200000_actas-documentos-correo` y la fuente
histórica `1794441600000_actas-entregas-historicas`. El recorrido actual requiere
**1794528000000_acta-desde-inventario**, **1794614400000_operaciones-automatizadas**
y **1794700800000_prestamos-inventario**,
y reconstruir/recrear la web compilada.

La última migración conserva los documentos y datos previos; amplía los metadatos
opcionales y guarda ubicación, tipo de sede y categoría al confirmar, para que el
PDF no dependa de cambios posteriores en los mantenedores. Mantiene permisos,
versiones e idempotencia, incluidos los metadatos de documentos anteriores.

Respaldo, migraciones y salud se comprueban antes de habilitar la web. La ejecución
standalone debe incluir fuentes institucionales y logo local, incluso en las rutas
que confirman operaciones desde el inventario. El respaldo conserva PDF, contador,
fuentes e historial de correo; se verifica su restauración en un contenedor aislado.

## Acciones y datos precargados

Los listados comparten iconos: ojo para consultar, lápiz para editar, flecha para
asignar o devolver, documento e impresora para actas. Cada icono tiene nombre
accesible y ayuda al pasar el cursor; conserva permisos y navegación por teclado.

Al entregar a EE/JISC se muestran por separado la institución (nombre, RBD,
dirección, comuna y correo institucional) y su director/a (nombre, RUN, cargo y
correo personal registrado). Los datos del directorio vigente se cargan solos.
En NC se selecciona un funcionario activo: nombre, RUN, cargo, correo, unidad y
subdirección se cargan juntos. No aparecen RBD o dirección de colegio. Una persona
no registrada se puede completar expresamente con la opción Otra persona. Cambiar
de sede o funcionario limpia los datos de la selección anterior.

La cuenta autenticada es siempre el actor auditado y emisor del documento, aunque
el lápiz cambie a la persona que entrega físicamente. Se prioriza la ficha de
funcionario vinculada por correo y el nombre de Usuarios; si no hay nombre
registrado se muestra el correo autenticado, sin inferir un nombre ni inventar un
RUN. Los RUN conocidos se precargan y los informados se validan; uno ausente puede
quedar sin informar. El nombre del emisor queda conservado en nuevas actas. Imprimir
una versión emitida conserva su emisor y participantes originales.

La devolución propone como persona que entrega a quien recibió en la asignación
registrada, y como receptor en UTIC a quien opera el sistema. El motivo puede quedar
vacío en el movimiento. El historial registra automáticamente el tipo de operación
cuando no se escribió un motivo; no se inventa una justificación personal.

Al revisar formularios con datos ausentes, escribir con teclado carácter a carácter
en nombre, RUN o correo y comprobar que el campo siga editable. Escribir en un campo
vacío activa el lápiz de su grupo; no debe bloquearse después de la primera letra.

## Ensayos solo a buzones de prueba (5 de noviembre)

Por instrucción de Felipe, mantener `ACTAS_CORREO_MODO=prueba`. Configurar en CentOS
`ACTAS_CORREO_PRUEBA_DESTINATARIOS` con la dirección exacta de prueba/Barranquín
confirmada. Para este ensayo el único buzón institucional autorizado es
`correoprueba@slepb.gob.cl`; no agregar otros. La capacidad técnica de hasta cinco
buzones no amplía esta autorización.
Sin lista explícita o sin transporte configurado, el envío permanece deshabilitado.

En este modo el formulario propone el primer buzón autorizado, no el correo real
registrado en el acta. El usuario puede elegir otros de la lista. El servidor rechaza
cualquier destinatario externo a la lista antes de registrar el intento y otra vez
antes de crear el transporte SMTP, incluso mediante una petición manipulada. No se
sustituyen destinatarios silenciosamente. El asunto lleva `[PRUEBA]`; los bytes y
participantes del PDF conservado no se modifican. El resultado registra el modo.

La capacidad anterior de correo a destinatarios explícitos requiere configurar
`ACTAS_CORREO_MODO=produccion` en el servidor. No existe un control en la interfaz
para cambiar de modo. No se habilitará durante estos ensayos; requeriría una nueva
instrucción de Felipe. Las credenciales se configuran solo en CentOS y no se comparten.
En desarrollo se utiliza únicamente SMTP local TLS con direcciones ficticias.
