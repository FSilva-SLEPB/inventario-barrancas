# Alcance y plan de Inventario 2.0 EE y TI

Acuerdos de trabajo con Felipe Silva, UTIC del SLEP Barrancas.
Fecha de corte: 30 de octubre de 2026, hora de Chile.

Este documento reúne las reglas acordadas y el orden propuesto de desarrollo.
No significa que los módulos descritos estén implementados. Cada cambio deberá
actualizar aquí su estado y mantener las decisiones anteriores, o explicar la
modificación acordada con el responsable del proyecto.

## 1. Objetivo y forma de trabajo

Gestionar inventarios tecnológicos, insumos, solicitudes, funcionarios de Nivel
Central, asignaciones, entregas, actas e incidentes con trazabilidad.

- Antes de programar una etapa, presentar su flujo, alcance y decisiones pendientes.
- Revisar los cambios por PR y comprobar el flujo con datos ficticios.
- Dar al usuario instrucciones de instalación y pruebas paso a paso, esperando
  los resultados de cada paso dependiente antes de continuar.
- Integrar las peticiones nuevas a este plan, indicando qué etapa afectan.
- Mantener credenciales, PIN, datos personales y respaldos fuera de Git.
- Distinguir pruebas locales, verificaciones de GitHub e instalación real en CentOS.

## 2. Estado de partida

Referencia de partida revisada: `main`, commit `7b19ffd`. El módulo de equipos
de esta rama está pendiente de revisión e instalación.

| Capacidad | Estado al corte |
| --- | --- |
| Acceso institucional de Google Workspace y lista de cuentas autorizadas | Implementado; probado en CentOS |
| Perfiles y alcance | Cinco perfiles instalados y comprobados por Felipe en CentOS |
| Mantenedor de usuarios y perfiles; activación/desactivación e historial | Implementado y probado por el usuario |
| Protección del último administrador activo y control de ediciones obsoletas | Implementado; probado automáticamente |
| Portada, portal sin menú y pantalla de acceso denegado | Implementados y comprobados en CentOS |
| Catálogos de sedes, dependencias y categorías | Implementados |
| Respaldo cifrado semanal en Drive con restauración de prueba | Configurado y probado en el CentOS de desarrollo |
| Control diario de capacidad y plan de retención | Configurado; borrado automático desactivado |
| Avisos por correo | Pendientes de configurar y probar el transporte |
| Ficha e ingreso de equipos, historial y carga histórica CSV | Preparados en la rama de inventario, pendientes de integrar e instalar; ver inventario-equipos.md |
| Entregas, movimientos, actas y solicitudes | Pendientes |
| Permisos y filtrado de datos por sede | Instalados y comprobados para usuarios, sedes y dependencias; ampliación a equipos preparada en esta rama |
| Funcionarios y habilitación tecnológica de Nivel Central | Pendientes |
| Reportes, validación de robos, recuperación por equipo y consolidado | Preparados en PR #35; instalación y carga de incidentes reales pendientes |

Los temporizadores y las credenciales del CentOS no se transfieren con Git.
La instalación en otro equipo requiere preparar y verificar su propia operación.

## 3. Separación de inventarios acordada

Se mantendrán dos consultas generales separadas:

1. **Inventario general de Nivel Central**.
2. **Consolidado de establecimientos educacionales (EE) y jardines infantiles (JI)**,
   con filtros para distinguir ambos ámbitos y cada sede.

Cada EE o JI verá únicamente los datos autorizados de su sede. UTIC tendrá
consulta consolidada según sus permisos. La restricción se aplicará en el
servidor a consultas, modificaciones, documentos y exportaciones; ocultar menús
no sustituye esa protección.

Un equipo tendrá un único registro e historial. Las vistas consolidadas y de
sede consultarán ese registro, sin duplicarlo. Un bien no pertenecerá a dos
inventarios recibidos simultáneamente. Cualquier traslado posterior entre
ámbitos deberá conservar origen, destino, responsable, fecha y antecedentes.

Comprar, registrar o custodiar un equipo desde UTIC no lo convierte en un bien
del inventario de Nivel Central.

## 4. Compra, carga masiva y entrega

### Listado maestro de sedes y directores

La hoja Directoresas de `INV_P02_v01 (3).xlsx` será la fuente maestra actualizada
de EE/JI, según confirmación de Felipe. Los datos de directores se conservarán
para asignaciones y entregas, separados de los datos de la sede. No otorgarán
acceso automático al sistema. Las actas conservarán los datos de quien recibió
en cada entrega, aunque después cambie el director. La preparación y los criterios
de carga se documentan en [Sedes y directores](sedes-y-directores.md).

### Datos conocidos antes del ingreso

Al registrar los equipos ya se conoce si se compraron para Nivel Central, EE o
JI y la distribución aplicable. El prorrateo puede cambiar antes de registrarlos;
esa planificación previa queda fuera del flujo inicial del sistema.

La carga desde planilla deberá ofrecer revisión previa y detección de duplicados
antes de confirmar. La plantilla, los campos obligatorios, las excepciones de
serie/número de inventario y el manejo de filas erróneas se definirán antes de
implementar la importación. No habrá una importación silenciosa de datos ambiguos.

### Ingresos propios de establecimientos y jardines

El encargado podrá registrar equipos comprados por su sede, recibidos por
donación u otro origen. El ingreso se incorporará de inmediato al inventario
de su única sede y al consolidado de EE/JI, sin aprobación previa de UTIC.
Se conservarán procedencia, autor del registro, fecha y respaldo disponible,
con controles de duplicados. Los campos obligatorios y la plantilla se definirán
antes de implementar. Esta facultad no permite registrar como propio un equipo
que ya pertenece a otro inventario ni anticipar una entrega pendiente de UTIC.

### Corrección de identificadores y conservación de registros

El encargado de Enlaces podrá ingresar y corregir la serie y el número de
inventario de los equipos de su única sede. Se conservarán el valor anterior,
el nuevo, quién modificó, cuándo y el motivo; se comprobarán duplicados antes de
aceptar el cambio. El equipo mantendrá su identidad interna y la vinculación de
su historial y documentos previos, sin reescribir actas ya emitidas.

El encargado no podrá eliminar registros ni historial. La edición de datos no
habilita traspasos, validación de robos ni bajas, reservados a los perfiles
administrativos según la matriz. Estas restricciones se comprobarán en el servidor.

### Traspasos entre inventarios

Se permitirán traspasos de Nivel Central hacia EE/JI y en sentido inverso,
así como entre sedes. Los ejecutará el Administrador de gestión; el Administrador
del sistema conserva esa facultad por su acceso completo. Los encargados de
EE/JI no podrán ejecutarlos ni eludir esta restricción editando el destino.

Al confirmar el traspaso, el mismo equipo cambiará de inventario de pertenencia,
sin duplicarse ni perder su historial. Se conservarán origen, destino,
responsable, fecha y acta. Dejará de contar en el inventario actual de origen
y pasará al de destino; sus movimientos anteriores permanecerán en el historial.
El formato del acta y los detalles de recepción se definirán antes de implementar.
La custodia temporal por reparación seguirá sin constituir un traspaso.

### Destino, custodia y entrega son datos distintos

| Situación de un equipo destinado a un EE o JI | Control de UTIC y consolidado EE/JI | Inventario recibido de la sede |
| --- | --- | --- |
| Registrado, asignado a sede destinataria y aún en bodega | Visible como pendiente de entrega, con ubicación física | Aún no se incorpora |
| Entrega confirmada | Visible como entregado, con acta e historial | Se incorpora |
| En reparación bajo custodia de UTIC después de haber sido entregado | Visible con ubicación y condición actualizadas | Permanece en la sede a la que pertenece |

La entrega se confirmará con fecha, receptor y acta. Este evento incorporará
el equipo al inventario recibido de la sede, sin quitarlo del consolidado.
Los totales deberán distinguir pendientes y entregados, sin contar dos veces
el mismo equipo. Un consolidado no equivale a existencias físicas de bodega.

El encargado podrá consultar los equipos destinados a su única sede que aún
permanecen en bodega TIC en una sección **Pendientes de entrega**, separada de
su inventario recibido. Verlos no los incorporará al inventario recibido ni a
sus totales; seguirán visibles en el consolidado EE/JI como pendientes, sin
contarse dos veces. No podrá confirmar su entrega ni marcarlos como recibidos
editando su estado. La confirmación corresponderá a UTIC, mediante los perfiles
Administrador de gestión y Administrador del sistema y con fecha, receptor y
acta. La consulta de pendientes también respetará el filtro de sede en el servidor.

Se utilizará **Confirmar entrega**, en lugar de confundirla con una activación.
Se distinguirán:

- Ámbito y sede destinataria.
- Pertenencia al inventario después de la entrega.
- Ubicación/custodia física actual.
- Estado del proceso de entrega.
- Condición técnica, por ejemplo operativo o en reparación.
- Situación administrativa, por ejemplo una baja formal.
- Asignación a un responsable y sus fechas.

Una reparación no cambiará la pertenencia del equipo. Una devolución definitiva,
un traspaso y una baja requerirán movimientos propios. Los traspasos respetarán
las reglas anteriores; los detalles documentales y el procedimiento de baja
se definirán antes de implementar. Para Nivel Central falta precisar el paso de bodega a uso
interno y la entrega a funcionarios; no se aplicará por analogía sin revisión.

## 5. Equipos, suministros, solicitudes y actas

| Módulo de la primera versión | Alcance acordado |
| --- | --- |
| Equipos | Bienes individuales, incluidos equipos tecnológicos e impresoras, con identificación, compra e historial |
| Inventario de Nivel Central | Consulta y gestión separadas; asignaciones a funcionarios |
| Inventarios de EE/JI | Inventario recibido por sede y consolidado UTIC; entregas desde bodega |
| Bodega de suministros | Productos con cantidades, ingresos y entregas; diferenciados de los equipos individuales |
| Solicitudes | Carrito de insumos para EE y JI, con revisión y atención por UTIC |
| Actas y documentos | Vinculados a entregas, asignaciones y movimientos; conservación de versiones e historial |
| Consultas e informes | Consolidado EE/JI, inventario de Nivel Central, bodega e incidentes según autorización |

Las solicitudes por usuario de Nivel Central quedan para una ampliación posterior.
El [flujo acordado de solicitudes de insumos](solicitudes-insumos.md) define:
carrito de la sede, validación por TI, reserva al aprobar y una única entrega
con acta por las cantidades aprobadas. No habrá entregas parciales ni saldos
pendientes automáticos. Las reducciones requieren motivo y ajuste de aprobación.
Al entregar se descuenta la existencia física y se consume la reserva; al cancelar
antes de entregar se libera la reserva, conservando responsable, motivo e historial.
El módulo todavía no está implementado. La conciliación de datos históricos,
los ajustes, las unidades y los detalles de documentos requieren diseño previo.

El formato de actas, numeración, responsables de firma, mecanismo de firma y
custodia documental siguen pendientes de definición. No se presupone firma
electrónica implementada ni se reemplaza un documento firmado sobrescribiéndolo.

## 6. Funcionarios y habilitación de Nivel Central

Este módulo será exclusivo de Nivel Central y se distinguirá del mantenedor
de personas autorizadas a entrar al sistema. Un funcionario puede tener equipos
asignados sin tener acceso al inventario; un encargado de un EE/JI puede tener
acceso al sistema sin ser funcionario de Nivel Central.

**Primera versión:** UTIC registra funcionarios y gestiona su habilitación.

1. Registrar datos personales/laborales, unidad, subdirección y fecha prevista de ingreso.
2. Preparar propuestas de usuario, correo, cuenta de Office/Microsoft 365 y datos
   de impresión, detectando conflictos.
3. Generar una solicitud de habilitación con los datos y un checklist de tareas.
4. Avisar a UTIC por correo cuando el transporte esté configurado y probado;
   la solicitud también deberá estar disponible dentro del sistema.
5. Registrar responsables, avance, fechas y pendientes del checklist.
6. Vincular los equipos entregados y sus actas con el funcionario.

UTIC creará las cuentas manualmente en las plataformas. Esta versión no
aprovisionará automáticamente Google Workspace ni Microsoft 365.
Los servicios, licencias, programas y tareas del checklist se acordarán al
diseñar el módulo; no se inventa aquí una lista definitiva.

Los PIN y otros datos sensibles tendrán permisos específicos y no se incluirán
en correos generales ni en el historial de cambios en texto legible. La regla de
generación, el tratamiento de homónimos, la validación de RUN, los conflictos
con cuentas existentes y la recuperación de datos sensibles están pendientes.
Las reglas históricas mencionadas en resúmenes no se considerarán una decisión
de seguridad definitiva sin revisarlas al implementar este módulo.

**Segunda versión:** una persona autorizada que no sea de TI podrá registrar
funcionarios y solicitar su habilitación. Tendrá permisos limitados a esa función;
no recibirá automáticamente el perfil de administrador global.

## 7. Incidentes de robo y recuperación

Habrá incidentes para **Nivel Central** y para **EE/JI**, manteniendo el ámbito
y la sede de los bienes afectados. Un incidente podrá incluir varios equipos.

Flujo acordado:

1. Una persona autorizada reporta fecha, lugar, descripción, bienes y antecedentes.
   Un encargado de EE/JI podrá reportar únicamente dentro de sus autorizaciones.
2. La solicitud queda pendiente de revisión. Reportar no permite confirmar
   unilateralmente el robo ni alterar el estado validado de los bienes.
3. Un administrador o una persona con permiso específico valida o rechaza,
   registrando quién, cuándo y el motivo.
4. Al validar, los equipos quedan vinculados al incidente e identificados como
   afectados por robo, conservando su pertenencia e historial.

Un robo **no elimina el bien ni genera una baja administrativa automática**.
El bien seguirá en su inventario y consolidado, distinguido de los disponibles.
La recuperación o una baja formal serán eventos posteriores documentados.
En Nivel Central se conservará el vínculo al funcionario que tenía el equipo;
esa asignación no atribuye automáticamente responsabilidad por el incidente.

UTIC podrá consultar incidentes, cantidades, categorías, fechas, valores
disponibles y recuperaciones, por sede y ámbito. La vista general mantendrá los
filtros que separan Nivel Central y EE/JI. No se ha acordado aún un mapa geográfico.
Los documentos y antecedentes sensibles tendrán acceso restringido.

## 8. Permisos y trazabilidad transversales

Los perfiles y el alcance por sede fueron instalados y comprobados por Felipe
en CentOS. La ampliación a fichas, historial y carga de equipos está preparada
en la rama de inventario, pendiente de revisión e instalación. La migración conserva
Administrador como Administrador del sistema y Consulta como Consulta general /
Auditor, con su alcance global anterior.
La [matriz de perfiles y acceso por sede](matriz-perfiles.md) documenta el diseño
acordado para la siguiente etapa: Administrador del sistema, Administrador de
gestión, Encargado de EE/JI, Consulta general / Auditor y Consulta de establecimiento.
Se incorporan los cinco perfiles y el filtrado por sede en los mantenedores
existentes. Los permisos de los módulos futuros siguen pendientes de cada etapa.

La jefatura y el compañero de UTIC autorizados podrán gestionar todos los
inventarios, los mantenedores, usuarios operativos, actas y registros de Nivel
Central mediante el perfil Administrador de gestión. No podrán conceder los
perfiles administrativos reservados ni administrar la configuración técnica.
Los encargados podrán gestionar el inventario, asignaciones, ubicaciones y
préstamos de su sede. Consulta general / Auditor consultará todos los ámbitos
sin modificarlos. Consulta de establecimiento estará vinculada a una única sede
EE/JI y solo podrá ver su inventario y documentos autorizados, sin registrar,
editar, asignar ni eliminar. Las cuentas serán personales para ambos perfiles.
Varias personas podrán acceder a una misma sede con sus propios correos. Cada
encargado estará vinculado a una única sede; no habrá encargados de varias sedes.
Los perfiles administrativos mantienen su alcance global y el auditor su consulta
global, conforme a la matriz.

La validación de robos, los traspasos entre inventarios y las bajas formales
quedarán reservados a la administración del sistema y de gestión. Este documento
no concede permisos nuevos a ninguna cuenta ni modifica los actuales.

La trazabilidad deberá identificar actor, fecha, motivo cuando corresponda,
estado anterior/posterior y documentos asociados. No se borrarán movimientos
para ocultar correcciones: se registrará su rectificación de forma controlada.
No se registrarán contraseñas, tokens ni PIN en bitácoras.

## 9. Orden propuesto de desarrollo

La etapa 1 fue instalada y comprobada por Felipe con las 78 sedes. La ficha,
historial y carga CSV de la etapa 2 están preparados para revisión en esta rama;
las demás etapas siguen pendientes. El orden es una propuesta para
revisar con Felipe; no representa una fecha comprometida ni aprobación de los
detalles técnicos que aún faltan.

| Etapa | Resultado esperado y criterio de revisión |
| --- | --- |
| 1. Acceso por sede | Matriz de permisos y usuarios vinculados a sedes. Un EE/JI no puede leer ni modificar datos de otro, tampoco por URL o petición directa |
| 2. Equipos y carga masiva | Plantilla revisada, detección de duplicados, ingreso por ámbito/destino y consulta de pendientes en bodega, sin mezclarlos con el inventario recibido |
| 3. Funcionarios de Nivel Central | Registro y propuesta de habilitación interna; reglas de identidad revisadas, checklist y solicitud disponibles aunque el correo siga pendiente |
| 4. Entregas, asignaciones y actas | Entrega confirmada incorpora el bien a la sede; asignaciones a funcionarios, devolución/reparación y traspasos conservan historial |
| 5. Incidentes | Reporte de varios equipos, validación autorizada, rechazo, recuperación y separación respecto de la baja formal |
| 6. Suministros y carrito | Ingresos/entregas de stock y solicitudes de EE/JI con el circuito de revisión y atención previamente acordado |
| 7. Consolidación y operación | Informes completos según permisos, auditoría revisada, correos probados y procedimiento de traslado al equipo definitivo |

Las consultas básicas se desarrollarán junto con cada módulo; la etapa final
completa los informes, no posterga la visibilidad ni la separación de inventarios.
Las mejoras visuales podrán incorporarse sin alterar las reglas funcionales acordadas.

## 10. Próxima decisión de diseño

La matriz funcional está recogida en [Perfiles y acceso por sede](matriz-perfiles.md).
Antes de implementarla quedan por precisar, paso a paso:

- La primera ficha y carga están documentadas en [Ficha y carga de equipos](inventario-equipos.md); se permiten identificadores pendientes con motivo y trazabilidad.

La vinculación de cada encargado a una única sede y su consulta separada de
Pendientes de entrega ya están acordadas.
Las preguntas restantes se resolverán en su etapa; no es necesario responderlas todas juntas.


## Actualización de prioridades: ficha, directorio e incidentes

Felipe solicitó simplificar la selección de Bodega TI y la ficha, y resolver la
recepción automática desde un directorio editable de directores/as por sede.
Estas mejoras se preparan primero, conservando el historial de las entregas.

Esta actualización incorpora un consolidado de equipos
reportados/validados como robados, por ámbito NC o EE/JISC, establecimiento,
comuna, fechas y categoría. Reportado, validado, rechazado y recuperado se
conservan como eventos distintos; reportar un robo no ejecuta una baja ni
elimina el equipo. El consolidado distingue equipos afectados de cantidad
de incidentes para no duplicar equipos. El dashboard de establecimientos vendrá
después, basado en esos registros y con los filtros de acceso por sede.

En Nivel Central, devolución, reasignación, daño/reparación y robo deberán
registrarse como movimientos/incidentes vinculados al mismo equipo y, cuando
corresponda, al funcionario. No se resolverán sobrescribiendo su responsable
actual ni cambiando un campo de funcionamiento para simular un robo o una baja.
El reporte/validación/recuperación y consolidado de robos se incluyen en esta
actualización. Devolución, asignación a funcionarios, reparación y dashboard
siguen pendientes; requieren sus movimientos propios y no se simulan mediante
ediciones del directorio ni del funcionamiento del equipo.
