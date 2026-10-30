# Perfiles, facultades y acceso por sede

Acuerdo funcional con Felipe Silva, 29 de octubre de 2026, hora de Chile.
Complementa el [alcance y plan](alcance-y-plan.md).

**Estado: perfiles y alcance instalados y comprobados por Felipe en CentOS.**
Se implementan los cinco perfiles,
la vinculación local a una única sede EE/JI, los filtros de sedes/dependencias y
la administración delegada de usuarios. La ficha, registro, historial y carga
histórica de equipos se incorporan en la rama de inventario con comprobaciones
de alcance. Entregas, actas, préstamos, incidentes y funcionarios siguen
pendientes: sus permisos de esta matriz son el diseño para esas etapas. La migración conserva los accesos generales previos;
no crea perfiles de gestión ni importa sedes automáticamente.

## 1. Tres dimensiones independientes

La autorización deberá combinar:

1. **Cuenta activa y autorizada**: no basta pertenecer al dominio institucional.
2. **Facultad**: qué acción puede realizar según su perfil.
3. **Alcance**: sobre qué ámbito y sede puede realizarla.

Las verificaciones se aplicarán en el servidor, incluidas peticiones directas,
documentos, actas, informes, exportaciones y operaciones masivas. La visibilidad
del menú acompañará estos permisos; no será el control de seguridad.

## 2. Perfiles acordados

| Perfil | Propósito | Alcance funcional |
| --- | --- | --- |
| Administrador del sistema | Felipe: administra las autorizaciones de mayor nivel y la operación completa | Nivel Central y todos los EE/JI |
| Administrador de gestión | Jefatura y compañero de la unidad que Felipe autorice: autonomía completa para administrar la operación, incluidos usuarios operativos | Nivel Central y todos los EE/JI |
| Encargado de EE/JI | Administra el inventario propio, sus asignaciones, ubicaciones, préstamos, solicitudes y reportes | Solo la sede asignada |
| Consulta general / Auditor | Consulta los inventarios y su historial sin modificar datos | Nivel Central y todos los EE/JI |
| Consulta de establecimiento | Consulta el inventario de su sede sin modificar datos | Una única sede, EE o JI |

El perfil Administrador de gestión **no es un gestor limitado al registro**:
puede crear usuarios, asignar perfiles operativos, administrar los inventarios de
todos los ámbitos, generar actas, gestionar mantenedores y registrar funcionarios
de Nivel Central. La separación frente al Administrador del sistema corresponde
a la administración de privilegios superiores y a la configuración técnica.

## 3. Matriz de facultades

En la columna de Encargado, todas las facultades se limitan a su sede. Las acciones
sobre módulos pendientes se habilitarán cuando esos módulos se implementen.

| Operación | Administrador del sistema | Administrador de gestión | Encargado EE/JI | Consulta general / Auditor | Consulta de establecimiento |
| --- | --- | --- | --- | --- | --- |
| Consultar inventarios | Todos | Todos | Su sede | Todos | Su sede |
| Registrar ingresos de equipos | Sí | Sí | Su sede; ingreso propio inmediato, sin aprobación UTIC | No | No |
| Corregir datos permitidos, serie y número de inventario | Sí | Sí | Su sede, con motivo e historial | No | No |
| Gestionar asignaciones, ubicaciones y préstamos | Sí | Sí | Su sede | No | No |
| Gestionar ingresos, entregas y actas desde UTIC | Sí | Sí | Recepción y participación de su sede; facultades exactas pendientes | Solo consulta autorizada | Solo consulta autorizada de su sede |
| Gestionar mantenedores globales, incluidas categorías y sedes | Sí | Sí | No | No modifica | No modifica |
| Gestionar ubicaciones y dependencias locales | Sí | Sí | Su sede | No | No |
| Registrar usuarios y asignar perfiles operativos | Sí | Sí | No | No | No |
| Conceder Administrador de gestión | Sí | No | No | No | No |
| Conceder Administrador del sistema | Sí | No | No | No | No |
| Gestionar funcionarios y habilitación de Nivel Central | Sí | Sí | No | No por defecto | No por defecto |
| Solicitar insumos por carrito | Sujeto al flujo del módulo | Sujeto al flujo del módulo | Su sede | No por su rol de auditor | No por su rol de consulta |
| Reportar incidentes | Sí | Sí | Su sede | No por su rol de auditor | No por su rol de consulta |
| Validar robos, traspasos entre inventarios y bajas formales | Sí | Sí | No | No | No |
| Administrar configuración técnica, credenciales e integraciones | Reservado a la administración técnica | No | No | No | No |

La administración técnica no supone crear una pantalla que exponga claves ni
ejecutar automáticamente cambios en servidores. El mecanismo y el acceso técnico
correspondientes se mantendrán separados de la gestión operativa de inventario.

El traspaso requiere origen, destino, responsable, fecha y acta. El formato
documental y los detalles de recepción, baja y corrección aún deben definirse. El permiso no sustituye esas validaciones.
Ningún perfil operativo podrá borrar el historial para ocultar una corrección.

## 4. Administración delegada de usuarios

El Administrador de gestión podrá registrar cuentas, activar o desactivar accesos
operativos y asignar perfiles Encargado, Consulta general / Auditor o Consulta
de establecimiento con el alcance que
corresponda. Cada operación identificará al administrador que la realizó.

Para preservar la separación acordada:

- Solo el Administrador del sistema otorgará el perfil Administrador de gestión
  o Administrador del sistema.
- Un Administrador de gestión no podrá elevar su propio perfil ni conceder a
  otro un perfil administrativo reservado.
- Tampoco podrá eludir esa restricción activando, desactivando o modificando
  una cuenta con un perfil administrativo reservado. Esas cuentas quedarán bajo
  la administración del sistema.
- Los permisos nuevos, los cambios de perfil/alcance y las bajas de cuentas
  deberán verificarse en la siguiente petición, evitando que una sesión antigua
  conserve facultades retiradas.
- La implementación conservará la protección contra dejar el sistema sin un
  administrador del sistema activo y contra sobrescribir cambios concurrentes.

Antes de migrar se preparará una correspondencia explícita para los actuales
Administrador y Consulta. Consulta general tendrá el mismo alcance de lectura
global que Auditor; Consulta de establecimiento será la alternativa limitada
a una única sede. Estos nombres no implican permisos adicionales para Auditor.
Las cuentas existentes no se reasignarán automáticamente a una sede. No se elevarán usuarios por su correo, nombre, cargo o
por trabajar en UTIC. Felipe identificará las cuentas de jefatura y compañero;
no se inventarán ni asignarán esos correos durante el diseño.

## 5. Acceso de establecimientos y jardines

Varios correos institucionales pueden corresponder a una misma sede. Cada cuenta
tendrá autorización individual e historial de sus propias acciones. Compartir
sede no significa compartir contraseña ni identidad en la bitácora.

Cada persona utilizará su propio correo. El perfil Encargado de EE/JI requerirá
exactamente una sede asignada; no se habilitarán encargados con varias sedes.
El alcance global del Administrador del sistema y del Administrador de gestión
proviene de su perfil, no de acumular asignaciones como encargado. El auditor
conserva la consulta global sin facultades de modificación.

La sede autorizada se vinculará a la cuenta: **no se inferirá por la red o la IP
desde la que se conecte, por el nombre del correo ni por una sede elegida libremente**.
El encargado solo accederá a los equipos y movimientos de su sede, incluso si
intenta cambiar un identificador en una URL, formulario, petición o exportación.

El encargado podrá consultar **Pendientes de entrega** de su única sede en
una sección separada del inventario recibido. Esa consulta no incorporará los
equipos al inventario recibido ni a sus totales. Solo los perfiles Administrador
de gestión y Administrador del sistema podrán confirmar la entrega desde UTIC,
con fecha, receptor y acta. El encargado no podrá hacerlo mediante un cambio
de estado ni consultar pendientes de otra sede por una petición directa.

El encargado podrá incorporar de inmediato equipos de compra propia, donación
u otro origen a su sede y al consolidado EE/JI, sin validación previa de UTIC.
Se conservarán procedencia, autor, fecha y respaldo disponible, con controles de
duplicados. No podrá usar un ingreso nuevo para apropiarse de un equipo existente.

El encargado de Enlaces podrá ingresar y corregir el número de serie y el
número de inventario de los equipos de su sede. Cada corrección conservará
valor anterior, valor nuevo, autor, fecha y motivo, con controles para evitar
duplicados. Se mantendrá una identidad interna estable del equipo para que
corregir sus identificadores no rompa su historial ni sus actas anteriores.

El encargado no podrá eliminar registros de equipos ni su historial. La
restricción se aplicará en el servidor, aunque intente una petición directa.
Corregir datos no permite ejecutar un traspaso, validar un robo ni dar de baja
un equipo mediante la edición de otros campos.

Los traspasos NC hacia EE/JI, en sentido inverso y entre sedes quedan reservados
al Administrador de gestión y al Administrador del sistema. Conservarán el mismo
registro del equipo, su historial y el acta; ningún encargado podrá ejecutarlos.

Administrar su inventario incluye las modificaciones permitidas, asignaciones,
ubicaciones y préstamos. No incluye apropiarse de bienes destinados a otra sede,
incorporar como recibido un equipo todavía pendiente de entrega en UTIC, moverlo
entre inventarios sin el procedimiento autorizado, validar un robo ni ejecutar
una baja formal. El reporte de un incidente queda pendiente de validación por
UTIC, como se acordó en el alcance.

Los inventarios de Nivel Central y el consolidado de EE/JI conservarán su
separación aun cuando el auditor y los administradores puedan consultar ambos.

## 6. Auditoría y datos sensibles

Consulta general / Auditor tendrá lectura global. Consulta de establecimiento
requerirá exactamente una sede asignada y solo podrá consultar su inventario,
historial y documentos autorizados. No podrá registrar, editar, asignar, entregar,
aprobar, eliminar ni administrar usuarios. El filtro de sede se aplicará también
a peticiones directas y exportaciones, sin conceder acceso al inventario de NC.
Ambos perfiles usarán cuentas personales y tendrán bloqueadas las escrituras
en el servidor; el acceso a documentos respetará su alcance y sensibilidad.

El auditor podrá consultar todos los inventarios de NC, EE y JI, así como los
movimientos y las actas autorizadas. No podrá crear, editar, entregar, aprobar
ni administrar usuarios por ese perfil.

El acceso global al inventario no concede acceso irrestricto a PIN, secretos,
datos de habilitación de funcionarios o antecedentes sensibles de incidentes.
La matriz específica de esos datos se revisará al diseñar cada módulo. No se
incluirán credenciales o PIN en registros de auditoría en texto legible.

## 7. Criterios de aceptación para implementar esta matriz

1. Dos cuentas de un mismo EE/JI pueden gestionar su inventario, pero una cuenta
   de otra sede no puede leerlo ni modificarlo, incluso mediante peticiones directas.
2. El Administrador de gestión registra usuarios operativos y gestiona todos los
   ámbitos, pero no puede concederse ni conceder perfiles administrativos reservados.
3. Esa protección también cubre la edición de cuentas existentes, su activación
   y los cambios de alcance; ocultar una opción del selector no es suficiente.
   La consulta de pendientes propios no permite confirmar entregas ni incorpora
   esos equipos al inventario recibido o sus totales.
4. Consulta general / Auditor consulta todos los ámbitos sin ejecutar escrituras.
   Consulta de establecimiento solo lee su única sede y no puede consultar otra
   ni modificar datos, incluso mediante peticiones directas o exportaciones.
5. El encargado puede reportar un robo, pero no validarlo ni generar una baja
   cambiando otros campos del equipo.
6. Desactivar o limitar una cuenta afecta su siguiente petición; los cambios de
   autorización mantienen historial y protección ante concurrencia.
7. No se puede guardar ni utilizar un perfil Encargado de EE/JI sin sede o con
   más de una sede; varias cuentas personales sí pueden compartir la misma sede.
8. Los módulos todavía inexistentes no se anuncian como disponibles al crear el
   perfil; sus permisos se prueban al incorporar cada módulo.

## 8. Decisiones que aún requieren revisión

- Precisar los datos mínimos del ingreso propio y cualquier campo adicional
  de corrección; la edición trazable de serie y número de inventario y la
  incorporación inmediata sin aprobación UTIC ya están acordadas.
- Precisar la participación de la sede en las actas de recepción y los préstamos
  a terceros, su devolución, vencimiento y documentación.
- Asignar expresamente los nuevos perfiles y sedes a las cuentas que Felipe
  autorice; la migración mantiene los accesos generales anteriores.
- Definir el acceso a antecedentes sensibles sin ampliar por defecto las facultades
  de auditor ni de los encargados.

Estas decisiones se revisarán paso a paso en su etapa. La regla de una sola
sede por encargado ya está confirmada.
