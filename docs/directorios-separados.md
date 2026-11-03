# Directorios separados y cierre de edición

La consulta se divide en cuatro accesos de Mantenedores. Las vistas comparten
las mismas sedes y personas vigentes; no duplican registros ni mantienen cuatro
copias que puedan divergir.

| Sección | Datos del listado |
| --- | --- |
| Directorio de establecimientos | RBD, nombre, dirección, comuna, correo electrónico institucional |
| Directores/as EE.EE. | RBD, establecimiento, RUN, nombres, apellidos, correo electrónico del responsable, estado contractual |
| Directorio JI y SC | RBD, nombre, dirección, comuna, correo electrónico institucional |
| Directoras JI y SC | RBD, jardín, RUN, nombres, apellidos, estado contractual |

Por confirmación de Felipe, **estado contractual significa titular, subrogante,
vacante o pendiente**. No se refiere a planta, contrata u otra modalidad laboral.
Los jardines y salas cuna usan el tipo ya existente `jardin_infantil`.

## Consultar, editar y guardar

El listado abre una ficha de consulta. Dentro de ella aparece el lápiz para
editar. Guardar correctamente vuelve a la ficha y termina la edición, conservando
los filtros. Un error conserva el formulario y los datos para poder corregirlos.
Cancelar vuelve a la ficha sin guardar.

Editar el establecimiento modifica únicamente sus datos institucionales. Editar
la persona modifica sus datos y estado, sin sobrescribir los datos de la sede.
El RBD de la sede se puede corregir y mantiene su restricción de unicidad; su UUID
permanece estable. La escritura comprueba permisos, tipos, versión y datos de la
sede para rechazar una edición obsoleta o una petición manipulada.

El módulo continúa reservado a los dos perfiles administrativos. Un enlace o
identificador de EE.EE. no abre la ficha en la sección de JI/SC, ni al revés.
Los perfiles locales y de consulta siguen sin acceder al directorio privado.

Las cuatro pantallas comparten tabla, ficha, filtros, estados, botones e historial.
El correo de directoras JI/SC ya conservado en la base no se elimina al instalar.
No se presenta como columna ni campo de esa ficha; se conserva para las entregas
si sigue siendo la misma persona y se limpia si cambia la directora.

## Nombres y datos anteriores

La migración `1794096000000_directorios-separados` añade `nombres` y `apellidos`
a `directorio_sedes`. No infiere apellidos a partir de palabras ni cambia los
nombres completos ya guardados. Los registros antiguos muestran **Nombre completo
pendiente de separar** hasta que una persona autorizada revisa ambos campos.

Al guardar una persona vigente se valida la pareja y se compone su nombre completo
para mantener el autocompletado de recepción. Vacante/pendiente queda sin persona
vigente y conserva a la anterior en el historial. Cargas anteriores con nombre
completo siguen siendo compatibles: conservan la separación si es la misma
persona y la limpian si se reemplaza el nombre por otra persona.

La carga original de CSV/TXT/TSV sigue disponible desde Cargar listado. Instalar el
código no importa datos privados automáticamente. Un listado con nombres completos
conserva esos valores como tales; su separación se revisa en la ficha de la persona.

Los cambios de sede y de persona se registran con actor, fecha, motivo y valores
anteriores/posteriores. Las entregas existentes conservan su nombre, RUN, contacto
y datos de establecimiento originales. Una corrección del RBD no reescribe las
entregas históricas ni cambia el equipo de identidad.

## Otros cambios de navegación y edición

- Modelo de datos sale del menú y las tarjetas de Mantenedores. Permanece como
  documentación técnica para administradores en `/documentacion/modelo-datos`;
  la URL anterior redirige después de comprobar el permiso.
- Inventario de celulares es un acceso y una página pendiente de definición.
  No registra celulares, líneas, asignaciones ni datos simulados.
- Editar categorías, sedes, dependencias o usuarios vuelve al listado y cierra
  su formulario. Registrar varios elementos seguidos mantiene el flujo de alta.
- Editar un equipo vuelve a su ficha de consulta. Las fichas NC vuelven a consulta
  tras alta o edición, con sus filtros. Las validaciones y el historial permanecen.

## Comprobación de instalación

La actualización requiere respaldo con restauración comprobada y la nueva
migración antes de iniciar la web. La salud comprueba también las columnas y la
operación controlada de los nuevos directorios; devuelve 503 si falta esa parte.
El modelo mantiene 19 tablas funcionales y 20 relaciones; cambian columnas y uso,
no se agregan cuatro tablas duplicadas. El material de jefatura del PR #39 conserva
su fecha y estructura histórica.

Las pruebas incluyen una base anterior con nombre compuesto, conservación de datos
al migrar, cuatro tablas y ámbitos, edición solo desde la ficha, permisos,
validación, cierre al guardar, cambios concurrentes, contactos e historial,
compatibilidad con importaciones y respaldo/restauración con nombres y apellidos.

Verificación de esta revisión: 96 pruebas unitarias, 311 comprobaciones HTTP y
navegador Chromium real con guardar/cancelar/validar, escritorio, móvil y movimiento
reducido. El ensayo de respaldo/restauración incluye la pareja nombres/apellidos.
Dependencias permaneció abierta 45 segundos con `next dev` sin recargas espontáneas
en el entorno aislado; la causa del síntoma observado en CentOS sigue pendiente de
los registros de esa instalación. Esta revisión no se presenta como solución
confirmada de ese incidente.
