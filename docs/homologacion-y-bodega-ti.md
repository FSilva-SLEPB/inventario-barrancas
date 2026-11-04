# Homologación y Bodega TI

Regla permanente acordada con Felipe: **un mismo proceso debe verse y funcionar igual en todos los módulos**. Está registrada en [AGENTS.md](../AGENTS.md) para futuros desarrollos.

## Consultas y fichas

- `PanelFiltros` presenta los criterios específicos, Búsqueda general, Buscar y Limpiar. Cambiar criterios vuelve a la primera página; cambiar Tipo limpia Sede y RBD incompatibles.
- `FiltrosInventario` reutiliza ese panel y los mismos selectores para Nivel Central, P02, Celulares y Bodega TI. Sede y RBD se habilitan al elegir Tipo; Nivel Central no usa RBD.
- `PanelResultados` reúne recuento, Mostrar 50/100/150 y paginación. También se utiliza en Directorio, Funcionarios y Robos.
- Cada listado tiene columna **Acciones**, con los botones **Ver** y **Editar** según permisos. Documentos: **Ver acta** e **Imprimir**; un acta emitida conserva su PDF y no se edita. Este criterio sustituye la regla anterior de editar solo después de ver la ficha. Cancelar conserva la consulta. Guardar cierra la edición y confirma el éxito con el aviso compartido; un error conserva los valores y no anuncia éxito.
- Se amplían estos componentes cuando aparece una necesidad nueva. No se crea otra variante de filtros, botones o confirmaciones para el mismo proceso.

## Custodia común

Equipos y celulares tienen dos estados de custodia: **En Bodega TI** y **Asignado / recibido**. Funcionamiento y vigencia de la ficha son datos independientes. Archivar un celular no constituye una devolución ni una baja patrimonial.

Bodega TI reúne ambos tipos de bien. La sede que aparece allí es una referencia de destino o procedencia. Las ubicaciones físicas de las distintas bodegas se definirán después; esta versión no crea sedes ni ubicaciones ficticias.

Solo los perfiles **administrador** y **administrador de gestión** de UTIC confirman movimientos. Las sedes consultan los bienes de su alcance y mantienen sus permisos ordinarios de ficha; no pueden confirmar asignaciones/devoluciones ni editar bienes en Bodega TI.

| Operación | Requisito | Resultado |
| --- | --- | --- |
| Devolver | Bien asignado | En Bodega TI; conserva la sede como referencia de procedencia |
| Asignar | Bien en Bodega TI | Asignado a una sede activa de NC, EE o JI/SC |

Ambas operaciones usan la misma ventana y validación: fecha real, persona que recibe y motivo. La asignación añade la sede de destino. No se admiten fechas futuras ni anteriores al último movimiento. Cada operación comprueba permisos y versión en servidor/base, conserva antes/después y admite reintentos sin duplicar el registro. Un celular archivado o un equipo con incidente de robo abierto no se puede mover.

Para cambiar de sede se devuelve primero a Bodega TI y luego se asigna. Editar datos de la ficha no permite saltarse este proceso. El número telefónico sigue asociado al celular; cambiar de número es una edición con historial. El receptor de una asignación de celular queda como responsable; al devolverlo se limpia ese dato vigente y se conserva en el historial.

## Registros existentes e historial

La migración `1794268800000_custodia-movimientos-inventario` añade la custodia sin cambiar identificadores, números, sedes ni versiones anteriores: equipos pendientes pasan a En Bodega TI; los demás equipos y los celulares existentes quedan Asignados / recibidos. No se inventan movimientos anteriores.

Las situaciones antiguas de recepción se conservan para importaciones y entregas históricas. La regularización histórica de jardines sigue disponible; repetirla no revierte una devolución posterior. Las actas anteriores conservan sus instantáneas y no se sustituyen por una asignación nueva.

Las devoluciones/asignaciones se consultan en Movimientos y actas y en el historial de cada ficha. `movimientos_inventario` refiere exactamente a un equipo o a un celular; sus dos historiales enlazan al movimiento. El modelo entidad relación documenta las tablas y sus relaciones reales. Después de una reasignación, una sede no obtiene el historial privado de la sede anterior.

## Instalación

Requiere aplicar la migración y reconstruir la imagen compilada. En CentOS se detiene el servicio web, se obtiene y verifica un respaldo, se actualiza `main`, se migra y se reconstruye con `compose.produccion.yaml` y el proyecto `inventario-barrancas`. Se inicia únicamente web con `--no-deps`, se comprueba `/api/salud` y se prueban las fichas. No usar el servidor `next dev` para esta instalación estable ni eliminar el volumen PostgreSQL. La guía [de despliegue](despliegue-produccion.md) detalla el procedimiento.
