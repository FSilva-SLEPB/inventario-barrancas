# Sedes, directores y datos de recepción

Acuerdos con Felipe Silva, 29 de octubre de 2026, hora de Chile.
Complementa el [alcance y plan](alcance-y-plan.md) y la
[matriz de perfiles](matriz-perfiles.md).

**Estado: sedes cargadas y comprobadas por Felipe en CentOS:** 54 establecimientos,
23 jardines/salas cuna y la sede existente de Nivel Central. El directorio editable
y su importación están desplegados en su versión inicial. La ampliación de datos
y la carga del listado completo se preparan a continuación, antes de confirmar entregas. No se concedieron accesos
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

El directorio ampliado valida RUN y correos opcionales; distingue titular,
subrogante, cargo vacante y responsable pendiente. El nombre es obligatorio
cuando existe una persona vigente. No se copiarán los archivos originales
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


## Directorio editable de establecimientos y JISC

Mantenedores → Directorio de establecimientos y JISC ofrece búsqueda por RBD,
nombre, correo, comuna, tipo y situación del cargo. La ficha reúne nombre de sede,
dirección, comuna y correo institucional, junto con nombre del responsable, RUN,
correo de contacto, situación del cargo y observaciones de la fuente. El RBD y
el tipo no se cambian desde esta ficha. El acceso y la edición siguen reservados
a los dos perfiles administrativos.

La edición conserva versión de directorio y una huella de los datos de la sede,
actor, fecha, motivo y valores anteriores/nuevos. Una edición concurrente de la
sede o del responsable obliga a revisar de nuevo. Registrar una renuncia permite
dejar el cargo vacante sin persona vigente; el historial conserva a la anterior.
Reemplazar solo el nombre mediante las operaciones de compatibilidad no hereda
el RUN ni el correo de otra persona. No se conceden accesos al sistema al
registrar nombres o correos.

El importador admite CSV, TSV/TXT con tabulaciones y tabla pegada desde Excel.
Reconoce las diez columnas del listado maestro, compara por RBD exacto y muestra
los cambios completos antes de confirmar. Distingue las filas de Nivel Central y
las informa como excluidas de este directorio. Rechaza RBD desconocidos de EE/JISC,
duplicados, encabezados ambiguos, RUN con dígito verificador incorrecto y correos
inválidos. Las confirmaciones revalidan contenido, versiones y permisos; un error
cancela toda la carga. Los reintentos no duplican historial.

Las entregas a jardines proponen nombre, RUN y correo del responsable vigente.
Se pueden ajustar para identificar a quien realmente recibió; modificar el nombre
borra los contactos propuestos de la otra persona para evitar atribuciones falsas.
La entrega guarda esos datos y la dirección/correo del establecimiento como una
instantánea. Una modificación posterior del directorio no cambia las entregas ya
registradas. Las entregas anteriores a esta ampliación conservan sus datos
originales; no se rellenan con datos actuales que no se conocían al registrarlas.
Las asignaciones y actas nuevas de EE/JISC usarán este directorio en su etapa.

## Fuente recibida el 2 de noviembre de 2026

Felipe volvió a proporcionar el listado en texto con diez columnas. La revisión
de formato identifica 78 filas: 77 EE/JISC y una de Nivel Central. Para EE/JISC
hay 65 titulares, 11 subrogantes y una fila sin persona, que Felipe confirmó dejar
como Responsable pendiente. Los 76 RUN de responsables de EE/JISC informados
pasan la validación del dígito verificador. La grafía de origen SUBDORGANCIA se
presenta como Subrogante. Las fechas y observaciones originales se conservan como
texto, sin inventar fechas de nombramiento.

Esta revisión de formato no sustituye la correspondencia con la base de CentOS
ni confirma que los datos estén cargados. La carga real se revisa en la vista
previa de esa instalación. El archivo original y los nombres, RUN y correos no
se copian al repositorio; los ejemplos y pruebas usan personas ficticias.
La ampliación requiere `1793923200000_directorio-establecimientos` antes de
iniciar la nueva versión de web.

## Consulta y carga en la interfaz unificada

El listado abre la ficha completa; la edición se ofrece dentro de ella. El acceso
al directorio se mantiene en Mantenedores y se retira de la portada de Inventario.
La carga se abre en `/mantenedores/directores/cargar`; distingue fichas sin cargar
de cargos expresamente pendientes o vacantes.

La instalación del código no incorpora por sí sola el archivo personal recibido
en el chat. Ese listado debe cargarse en la instancia de CentOS, desde el navegador
o mediante la herramienta privada siguiente. No debe añadirse el original a Git.

Si el TXT ya está en el servidor, desde la raíz del proyecto:

```bash
docker compose exec -T web node scripts/cargar-directorio.mjs --actor correo@slepb.gob.cl < /ruta/privada/listado.txt
```

La revisión imprime cantidades y situaciones, sin nombres, RUN ni contactos.
Después de comprobar la correspondencia, la misma orden con `--confirmar` ejecuta
la carga atómica con la cuenta administrativa indicada. Usa el usuario de base de
la aplicación y las mismas funciones y validadores del navegador; no concede
cuentas ni permisos. Si el archivo ya estaba cargado, no duplica el historial.

La cuenta indicada debe estar activa con perfil administrativo. No se incluyen
contraseñas de PostgreSQL en la orden: se usa la configuración del contenedor.
Si el archivo solo está en el computador del usuario, se selecciona directamente
en la página de carga; no hace falta transferirlo previamente al servidor.
