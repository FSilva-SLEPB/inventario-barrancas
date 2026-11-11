# Datos y fotografía del establecimiento

Inicio de Encargado EE/JI y Consulta de establecimiento muestra **Datos del
establecimiento**, con nombre, RBD, tipo, comuna, dirección y correo de su sede
asignada. La fotografía ocupa una columna al lado; en móvil pasa debajo de los
datos. Los perfiles globales conservan el Inicio general.

El encargado puede usar **Subir fotografía** o **Cambiar fotografía** para su sede.
Se aceptan JPG, PNG y WEBP de hasta 5 MB, con validación en servidor y base de datos.
Las cuentas de consulta solo ven la fotografía. Administrador del sistema y
Administrador de gestión tienen autorización de escritura; Gestor de insumos no
recibe permisos sobre fotografías de establecimientos.

Cada subida conserva bytes, sede, versión, autor y fecha en PostgreSQL. No depende
de archivos de `public` ni se pierde al reemplazar el contenedor web. Las versiones
anteriores se conservan; una subida concurrente no sobrescribe otra silenciosamente.
Ante una respuesta perdida, Reintentar subida usa la misma solicitud para evitar
filas duplicadas. El formulario muestra errores y confirma las subidas exitosas.
La imagen nueva y su versión se actualizan al recibir la confirmación, aunque la
actualización del resto de Inicio sea lenta. Cambiar de sede reinicia ese estado.

La API requiere sesión, limita el cuerpo y valida origen, formato y permisos por
sede. Una persona de otra sede no puede leer la imagen ni modificarla mediante una
URL o formulario alterado. Las respuestas de imagen son privadas, sin caché y con
nosniff; la revocación del acceso se aplica en la siguiente petición.

Requiere la migración 31 (`1795881600000_fotografias-sedes`), respaldo comprobado y
compilación de web. No importa fotografías ficticias ni modifica registros previos
en instalaciones reales. El ensayo de recuperación con fotografía pertenece solo
al conjunto de datos aislados de CI.

El cambio pasó 160 pruebas unitarias y nueve escenarios nuevos SQL/HTTP de fotos,
incluidos concurrencia, versiones, idempotencia, formato/tamaño, permisos y
revocación. En navegador se probó foto lateral/móvil, rechazo de SVG, respuesta
perdida con reintento sin duplicación, cambio y persistencia tras recargar. La
actualización 30→31 conservó las huellas de catorce tablas existentes y la
restauración recuperó exactamente los bytes de una fotografía de prueba.
