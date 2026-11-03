# Directorios separados y cierre de edición

La sección **Directorio** tiene su propio acceso en Inicio y en el menú lateral,
fuera de Mantenedores. Al entrar o desplegarla se muestran las cuatro consultas. Las vistas comparten
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

El listado abre una ficha de consulta en una ventana modal sobre la tabla. Dentro
de ella aparece **Editar ficha**. Guardar correctamente cierra la ventana y vuelve
al listado con los filtros y el orden conservados; una confirmación SweetAlert
informa que la actualización del contacto fue exitosa. Un error conserva el formulario y los datos para poder corregirlos.
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
En el listado el nombre es texto normal y cada fila tiene una sola acción:
**Ver ficha**. Dentro de la ficha se encuentra **Editar ficha**.
El correo de directoras JI/SC ya conservado en la base no se elimina al instalar.
No se presenta como columna ni campo de esa ficha; se conserva para las entregas
si sigue siendo la misma persona y se limpia si cambia la directora.

## Nombres y datos anteriores

La migración `1794096000000_directorios-separados` añade `nombres` y `apellidos`
a `directorio_sedes`. No infiere apellidos a partir de palabras ni cambia los
nombres completos ya guardados. Los registros antiguos muestran **Nombre completo
pendiente de separar** hasta que una persona autorizada revisa ambos campos.
Al editar se propone una separación editable, con el nombre completo original
a la vista y un aviso para revisarla. La propuesta usa las dos últimas unidades
como apellidos y conserva partículas; no garantiza interpretar correctamente
todos los nombres. No escribe en la base hasta que se confirma **Guardar cambios**.
Si ya hay nombres y apellidos guardados, se muestran exactamente esos valores.
Con menos de tres palabras no se propone un apellido para evitar inventarlo.

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
- Inventario de celulares se incorporó en una revisión posterior: ver
  [su alcance y operación](inventario-celulares.md). No importa datos automáticamente.
- Editar categorías, sedes, dependencias o usuarios vuelve al listado y cierra
  su formulario. Registrar varios elementos seguidos mantiene el flujo de alta.
- Editar un equipo vuelve a su ficha de consulta. Las fichas NC vuelven a consulta
  tras alta o edición, con sus filtros. Las validaciones y el historial permanecen.

## Comprobación de instalación

La migración de directorios separados requiere respaldo con restauración comprobada
y aplicar `1794096000000_directorios-separados` antes de iniciar la web.
El ajuste posterior de ventanas y confirmaciones no añade migraciones ni importa
listados. En una instalación que ya tiene esa migración basta reconstruir y
reemplazar la web compilada siguiendo la guía de operación. La salud comprueba también las columnas y la
operación controlada de los nuevos directorios; devuelve 503 si falta esa parte.
El modelo mantiene 19 tablas funcionales y 20 relaciones; cambian columnas y uso,
no se agregan cuatro tablas duplicadas. El material de jefatura del PR #39 conserva
su fecha y estructura histórica.

Las pruebas incluyen una base anterior con nombre compuesto, conservación de datos
al migrar, cuatro tablas y ámbitos, edición solo desde la ficha, permisos,
validación, cierre al guardar, cambios concurrentes, contactos e historial,
compatibilidad con importaciones y respaldo/restauración con nombres y apellidos.

Verificación de la separación inicial (PR #42): 96 pruebas unitarias, 319 comprobaciones HTTP y
navegador Chromium real con guardar/cancelar/validar, escritorio, móvil y movimiento
reducido. El ensayo de respaldo/restauración incluye la pareja nombres/apellidos.
El 3 de noviembre se cambió la web de CentOS al servidor compilado y se comprobó
su estado saludable, HTTP 200 y estabilidad del navegador. La causa exacta del
bucle de recompilación en desarrollo no se identificó; el acceso operativo usa
ahora la imagen compilada. Los cambios de navegación se incorporan reconstruyendo
esa imagen, con las instrucciones de operación actualizadas.

## Rutas de Directorio

Las consultas están en `/directorio/establecimientos`, `/directorio/directores`,
`/directorio/jardines` y `/directorio/directoras`. La carga está en
`/directorio/cargar`. Las direcciones anteriores de Mantenedores redirigen a
estas páginas después de comprobar el permiso y conservan los filtros y la ficha
seleccionada. Mantenedores mantiene sus catálogos, usuarios y funcionarios NC.

## Lectura y confirmaciones de guardado

Las cuatro tablas ordenan por RBD de forma natural y permiten elegir Nombre A–Z.
RBD, RUN, correo y **Ver ficha** se mantienen completos; en pantallas estrechas
solo se desplaza horizontalmente la tabla. La página y la ventana no se ensanchan.
Las ventanas permiten Tab, Mayús+Tab y Escape, devuelven el foco al origen y
respetan la preferencia de movimiento reducido. Durante el guardado no se puede
cerrar la ventana con Escape o el botón de cierre.

La misma ventana se usa al editar categorías, sedes, dependencias, usuarios,
equipos y funcionarios NC. Las altas consecutivas de catálogos mantienen su
formulario, con una confirmación visible por cada guardado correcto. Las altas
y ediciones de funcionarios vuelven a la ficha de consulta.

Las confirmaciones SweetAlert también cubren cargas confirmadas de equipos y
directorio, entregas e incidentes de robo. Las vistas previas y los errores no
muestran éxito. Los textos se presentan como texto, sin interpretar HTML.
Las acciones que redirigen emiten un recibo firmado de corta duración, sin datos
personales; el navegador lo verifica, lo retira de la dirección sin recargar y
muestra una sola confirmación. Añadir `guardado=1` o un recibo inventado a una URL
no provoca un SweetAlert de éxito. No se usa un temporizador de refresco.

Validación del ajuste de ventanas: 99 pruebas unitarias, 323 comprobaciones HTTP
y Chromium real en escritorio y móvil, con navegación por teclado, cancelación,
validación, cierre al guardar y confirmación única. La auditoría de dependencias
de producción no informa vulnerabilidades conocidas. Estas pruebas usan datos
ficticios; no equivalen a instalar el cambio en CentOS.
