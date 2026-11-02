# Sedes, directores y datos de recepción

Acuerdos con Felipe Silva, 29 de octubre de 2026, hora de Chile.
Complementa el [alcance y plan](alcance-y-plan.md) y la
[matriz de perfiles](matriz-perfiles.md).

**Estado: sedes cargadas y comprobadas por Felipe en CentOS:** 54 establecimientos,
23 jardines/salas cuna y la sede existente de Nivel Central. El directorio editable
y su importación CSV están preparados; la carga de los nombres reales se revisará
a partir de la fuente maestra antes de confirmar entregas. No se concedieron accesos
a partir de los correos de la planilla.

## Fuente maestra y revisión inicial

Felipe confirmó que la hoja **Directoresas** de `INV_P02_v01 (3).xlsx` es el
listado más actualizado de establecimientos educacionales y jardines infantiles.
Será la fuente maestra para preparar las sedes y sus datos de dirección.

La revisión inicial encontró 78 registros con identificadores no vacíos y no
repetidos. La hoja **Carpetas** de `INV_EE.EE_V1.2.xlsx` contiene 53 registros y
servirá como referencia complementaria; no sustituye al listado maestro ni se
sumará a él para crear sedes duplicadas. Estos recuentos no equivalen todavía a
una validación completa ni a una carga aprobada.

La preparación revisará RBD o identificador, nombre, tipo EE/JI, comuna,
dirección y correo institucional. Se contrastarán las sedes que ya existan en el
sistema antes de crear nuevas. No se asignará tipo ni se fusionarán registros
ambiguos silenciosamente; se presentarán las diferencias antes de la carga.

Las dependencias o ubicaciones, como biblioteca, sala de Enlaces y bodega,
pertenecen a una sede y no constituyen nuevos establecimientos. Nivel Central
se conserva como ámbito separado; este listado maestro corresponde a EE/JI.

Los selectores y la identificación de la sede de la sesión mostrarán
**RBD - Nombre del EE/JI**, conservando guiones y dígitos del identificador.
Nivel Central y cualquier sede sin RBD mostrarán solo su nombre en esos lugares.
El listado de sedes separará los datos en columnas, en este orden:
**RBD | Nombre EE/JI | Tipo | Dirección | Comuna**. Los administradores tendrán
además la acción de editar. Las sedes inactivas se identificarán junto al nombre.
Un dato opcional ausente se mostrará como un guion. Esta presentación no modifica
los nombres ni identificadores guardados.

## Datos de directores y acceso al sistema

Los datos disponibles de los directores se conservarán para las asignaciones y
entregas a los establecimientos, según confirmó Felipe. Se mantendrán separados
de los datos propios de la sede y vinculados a ella.

Registrar a un director o su correo no crea una cuenta autorizada ni concede
un perfil. El acceso institucional continuará requiriendo autorización explícita
en el mantenedor de usuarios y el alcance correspondiente.

La definición de campos obligatorios, validación de RUN, contactos y tratamiento
de reemplazos se realizará al implementar. No se copiarán los archivos originales
ni nombres, RUN o correos personales al repositorio. Los datos personales no
quedarán expuestos por defecto por permitir consultar el listado de sedes.

## Conservación de actas y trazabilidad

Al emitir un acta se conservarán los datos del receptor que correspondan a esa
entrega. Un cambio posterior de director no reescribirá las actas anteriores;
las nuevas utilizarán los datos vigentes. El historial permitirá distinguir a
quien recibió en cada momento.

Para las entregas a jardines infantiles, Felipe confirmó que la receptora será
la directora del jardín. Al regularizar las entregas de octubre de 2026 se
registrará su nombre una vez por jardín y se conservará como dato histórico,
con el cargo fijo Directora del jardín infantil. No se sustituye por la directora
actual si cambia posteriormente. Los nombres se incorporan al directorio desde la fuente maestra con revisión previa;
la entrega los propone automáticamente. El lápiz permite ajustar al receptor
histórico de una entrega sin cambiar el directorio ni las entregas anteriores.
Para otros tipos de entrega se identificará al receptor real en su etapa. El contenido,
numeración, firma y custodia de actas se definirán en su etapa.

## Criterios para la implementación

- La carga previa muestra correspondencias, datos incompletos y posibles
  duplicados sin modificar producción.
- Un mismo establecimiento conserva una identidad estable para usuarios,
  dependencias, equipos y documentos.
- Actualizar los datos del director no cambia autorizaciones de usuarios ni
  los datos conservados en actas ya emitidas.
- Las consultas y documentos respetan el alcance por sede y los permisos sobre
  datos personales; se verifica también el acceso por petición directa.


## Directorio editable

Mantenedores → Directorio de directores y directoras reúne una persona responsable
por sede EE/JISC. Los dos perfiles administrativos pueden actualizar el nombre
mediante el lápiz; se conserva versión, actor, fecha, motivo y antes/después.
Una edición obsoleta se rechaza. No se conceden accesos al sistema al registrar
un nombre y no se importan RUN ni contactos en esta etapa.

La carga CSV UTF-8 usa RBD exacto y Nombre, mantiene ceros/guiones y muestra la
correspondencia y el nombre anterior/nuevo antes de confirmar. Rechaza sedes
inactivas, desconocidas, duplicadas y encabezados ambiguos. La confirmación
revalida archivo, versiones y permisos y es transaccional; un error cancela todo.
Los reintentos del mismo archivo no duplican cambios. El original se conserva
fuera de Git bajo custodia institucional; el código no contiene nombres reales.
La migración crea un directorio vacío: no supone que los nombres ya estén cargados.
