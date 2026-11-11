# Definición de dashboards y bodegas TI

Requisitos acordados por Felipe después de instalar el PR #53. Las cinco ubicaciones físicas están preparadas en la aplicación; su instalación en CentOS está pendiente. Los dashboards todavía no están implementados. Ver [bodegas físicas](bodegas-fisicas.md).

## Dos dashboards

- **Nivel Central:** bienes de su inventario, disponibles, asignados, préstamos y seguimiento de funcionamiento e incidentes, con su stock en Bodega TI.
- **Establecimientos/JI-SC (P02):** la misma presentación y procesos para su inventario y stock en Bodega TI.

Las ubicaciones físicas son compartidas entre ambos inventarios. Mover un equipo de P02 a Primer Piso no lo convierte en un bien de Nivel Central. Un traslado entre bodegas tampoco es un traspaso de pertenencia.

Los resúmenes deben permitir localizar pantallas y otros tipos de equipo disponibles. Un bien asignado o con un robo registrado no acredita presencia física en una bodega; ubicación, custodia, funcionamiento e incidentes deben tener un significado explícito.

## Ubicaciones confirmadas

| Ubicación | Dependencias |
| --- | --- |
| Bodega TI Primer Piso | SLEP Barrancas |
| Bodega TI Segundo Piso | SLEP Barrancas |
| Bodega BOX 3 | SLEP Barrancas |
| Bodega BOX 4 | SLEP Barrancas |
| Bodega TI Bicentenario | Antiguo Liceo Bicentenario, Av. Cardenal Raúl Silva Henríquez #1185, Cerro Navia |

Felipe identificó el antiguo establecimiento como **RBD 31288 — LICEO BICENTENARIO DE EXCELENCIA NACIONAL DE** (nombre proporcionado), e indicó que ya no es establecimiento activo. Antes de regularizar su directorio se identificará el registro por RBD, conservando referencias y antecedentes. No se borran sus registros ni se infiere un traslado masivo de bienes.

Bicentenario recibe por lo general equipos que se darán de baja. Trasladar allí un bien registra ubicación; no implica una baja formal, una eliminación ni una modificación automática de su funcionamiento.

Los bienes anteriores cuya bodega física no se conoce deben conservar esa falta de información. No se asignará un piso o BOX por suposición.

## Disponibilidad y estados

Libre significa disponible para asignar; los bienes que esperan reparación o baja quedan excluidos. No basta con que aparezcan Activos o En bodega.

Felipe precisó los dos selectores y sus tres reglas en [Componente React de estados](componente-estados-activo.md). La ubicación física y la pertenencia NC/P02 siguen siendo datos propios de las operaciones del inventario.

Inactivo se retira de opciones nuevas. Los antecedentes antiguos Inactivo, Sin verificar o Fuera de servicio requieren clasificación, sin convertirlos automáticamente en baja u operativo.

## Homologación y trabajo posterior

Filtros, Mostrar 50/100/150, acciones con iconos, ventanas, permisos UTIC y confirmaciones se reutilizan entre ambos ámbitos. Los documentos emitidos conservan sus bytes y participantes.

Se mantienen los filtros futuros solicitados: año, robos, tipo de compra, empresa y OC. Falta definir qué fecha representa el año y el dato que identifica la empresa; no se incorporan interpretaciones financieras por suposición.

La carga/subida de inventario será otra etapa, con revisión del formato y la clasificación previa. La depreciación, el alta contable y la baja formal requieren antecedentes e integración propios.


## Criterios de la etapa de ubicaciones físicas

Implementar primero las ubicaciones y su trazabilidad; después los resúmenes. Este orden permite que el dashboard use datos registrados, sin deducir un piso o BOX a partir de la sede de pertenencia.

- Ofrecer las cinco bodegas confirmadas a equipos y celulares, con las mismas ventanas, filtros y permisos UTIC.
- Conservar la ubicación desconocida de los registros anteriores. Elegir una bodega registra su ubicación física, sin cambiar inventario, condición o administrativo.
- Registrar cambios de ubicación con versión, autor, fecha e historial. Un reintento no duplica el movimiento; cerrar sin confirmar conserva la ubicación anterior.
- Identificar el registro del antiguo establecimiento por RBD 31288 antes de regularizarlo. Conservar referencias y documentos; no mover bienes por inferencia.

Criterios para revisar esa implementación:

| Caso | Resultado esperado |
| --- | --- |
| Equipos NC y P02 en el mismo BOX | Comparten ubicación; cada uno conserva su inventario |
| Traslado entre bodegas | Cambia ubicación, con historial; no crea otro bien ni un traspaso de pertenencia |
| Envío a Bicentenario | No da de baja ni cambia automáticamente la condición |
| Ubicación anterior desconocida | Sigue sin identificar hasta una confirmación de UTIC |
| Cuenta de sede intenta trasladar | El servidor rechaza la operación |
| Dos cambios simultáneos | La versión anterior no sobrescribe el cambio ya confirmado |

La fecha del filtro Año y la fuente de Empresa/OC siguen pendientes de definir. No se implementan métricas financieras ni un dashboard separado de Robos por aproximación.
