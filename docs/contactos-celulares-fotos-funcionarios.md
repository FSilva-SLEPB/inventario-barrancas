# Contactos derivados del inventario y fotografía del funcionario

## Celulares

Los directorios institucionales y de directores/as EE/JI muestran una columna de
celulares de consulta, obtenidos directamente desde Inventario de celulares.
Inicio por sede muestra su celular institucional. El directorio autorizado del
Funcionario y su CSV/PDF incluyen únicamente los celulares institucionales; no
incluyen teléfonos vinculados personalmente a directores.

Para distinguir su uso se agrega **Contacto del directorio / Uso del celular** en
la ficha de Inventario de celulares: Sin clasificar, Establecimiento/jardín o
Director/a. Solo Sistema/UTIC global con celulares.editar puede cambiarlo; se exige
un celular activo, administrativamente Activo y asignado. Crear/corregir el número
sigue usando la edición habitual del inventario. No existen inputs de teléfono
ni copias editables de estos valores en directorios, Inicio o funcionarios.

No se deduce el uso de los nombres, del texto libre Responsable o uso ni del orden
de los registros. Los anteriores quedan Sin clasificar hasta revisión. Si hay
varios teléfonos clasificados para el mismo destino, se muestran todos.

Para Director/a, se captura el RUN vigente del directorio, titular o subrogante.
Sin RUN no se permite esa vinculación. Un reemplazo, vacancia o cambio de RUN
retira el contacto del directorio hasta revisión explícita; nunca se hereda el
celular por coincidencia de sede o nombre. Esta clasificación describe un uso:
no confirma una entrega ni genera un acta nueva. Devolver, prestar o cambiar la
sede limpia la clasificación; no recupera una anterior por suposición.

Cada cambio conserva actor, versión, solicitud idempotente, antes y después.
La consulta SQL verifica cuenta activa, permisos del directorio y alcance. Sede
solo consulta su sede; el directorio institucional autorizado conserva su alcance
general de contacto sin datos personales de directores. No concede otros módulos.

**Ver acta de asignación** enlaza el documento conservado de la última asignación
a esa sede, considerando operaciones compuestas. No vuelve a emitirlo ni consume
folio. Solo aparece si existe PDF y el perfil ya puede consultar esa acta mediante
la autorización existente; en otro caso indica Sin acta consultable. En director/a,
además se exige coincidencia del RUN receptor del acta. No amplía permisos de actas
ni permite acceder a documentos ajenos al cambiar identificadores.

## Fotografía del funcionario

La ficha de Funcionarios permite subir/cambiar la fotografía con el mismo
componente y validaciones de las fotos de establecimientos. Inicio del perfil
Funcionario la muestra al lado de sus datos y debajo en móvil. Solo Sistema/UTIC
global con funcionarios.editar modifica; el funcionario consulta su foto, sin
control de subida ni edición propia. Personal con funcionarios.consultar global
puede consultarla como parte de la ficha; no concede ese permiso a nuevos perfiles.

Originales/versiones se guardan en PostgreSQL con FK al funcionario, actor y fecha;
no se guardan archivos en public ni se inventa una fotografía. JPG/PNG/WEBP, máximo
5 MB, validación de formato, origen, permisos, versión e idempotencia en API y SQL.
La tabla no tiene SELECT directo para el rol app: lectura mediante función que
comprueba recurso global o mis_datos y funcionario_id propios. Respuesta privada
sin caché. Cambios de cuenta/perfil aplican en la siguiente petición. Se conservan
las fotos previas y se incluyen en los respaldos de la base.

## Validación y reversión

Migración41 añade dos columnas y dos tablas sin alterar columnas anteriores,
cuentas, directorios, movimientos ni PDFs. Ensayo transaccional40→41: 55 tablas y
columnas previas idénticas por SHA256; ningún celular reclasificado automáticamente.
CI ejecuta este ensayo antes de aplicar la migración completa.

El conjunto contactos-fotos-http prueba separación de usos, sede ajena, actas
conservadas/autorizadas, actualización del número, reemplazo del director,
devolución, fotografía propia/ajena, SQL sin acceso directo, origen, MIME, versiones,
concurrencia e invalidación de la misma sesión. Chromium comprueba clasificación
y subida reales, directorios, Inicio de sede y funcionario en 1440/900/390 px.

Despliegue posterior: respaldo/restauración comprobada, migración41 y nueva web.
Para retroceder la interfaz, la web anterior tolera las nuevas tablas/columnas;
conservarlas junto a sus datos y auditoría, no ejecutar down. Para restauración
integral, respaldar los datos nuevos y conciliar escrituras posteriores al
respaldo antes de reabrir. Producción no se modifica durante el desarrollo.

Evidencia local: compilación y 166 controles unitarios correctos; 31 suites SQL/HTTP
(incluidos ocho escenarios nuevos), sin errores ESLint. Respaldo de ensayo41
restaurado y comprobado en un contenedor aislado. El primer intento agotó el
almacenamiento temporal del contenedor; se repitió la misma verificación con tmpfs
privado de 512 MB, sin cambiar el procedimiento de producción ni omitir controles.
