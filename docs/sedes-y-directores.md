# Sedes, directores y datos de recepción

Acuerdos con Felipe Silva, 29 de octubre de 2026, hora de Chile.
Complementa el [alcance y plan](alcance-y-plan.md) y la
[matriz de perfiles](matriz-perfiles.md).

**Estado: sedes cargadas y comprobadas por Felipe en CentOS:** 54 establecimientos,
23 jardines/salas cuna y la sede existente de Nivel Central. La gestión de
directores y sus datos de recepción siguen pendientes. No se concedieron accesos
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

El director registrado no se presumirá receptor de toda entrega: al confirmar
se identificará al receptor real, conforme al flujo acordado. El contenido,
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
