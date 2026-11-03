# Inventario de celulares

El módulo está en **Inventario → Inventario de celulares**. Registra equipos de
establecimientos, jardines infantiles, salas cuna y Nivel Central. Por confirmación
de Felipe, dos celulares por EE/JI es la cantidad habitual y se permiten excepciones.
Cada celular tiene un número propio; esta versión no registra dos SIM por equipo.
No se crean celulares ni números ficticios al aplicar la migración.

## Registro, consulta y actualización

El registro mínimo requiere sede y número móvil chileno. El teléfono se normaliza
al formato `+56912345678`. Marca, modelo, IMEI, número de inventario, responsable o
uso y observaciones se pueden completar después. El IMEI, si se informa, debe tener
15 dígitos con dígito verificador correcto; IMEI e inventario son únicos dentro del
módulo. La referencia de responsable es un texto administrativo y no constituye
un acta ni una asignación formal a un funcionario.

Cada fila ofrece solamente **Ver ficha**. La consulta se abre en la ventana común
del sistema y ofrece **Editar ficha** a quien tiene permiso. Los formularios llegan
rellenos, permiten cancelar y conservan los valores si hay errores. Un guardado
correcto cierra la ventana y muestra la confirmación SweetAlert. Se conservan los
filtros; la consulta admite búsqueda, tipo de sede, sede, vigencia y 50/100/150 filas.

Un número no puede estar en dos fichas vigentes a la vez. Archivar conserva la
identidad y el historial y permite reutilizar el número en otro equipo. Archivar
no equivale a una baja patrimonial. Reutilizar una línea no cambia las instantáneas
anteriores. El estado de funcionamiento es independiente de la vigencia.

Los dos perfiles administrativos consultan y actualizan todas las sedes, incluido
Nivel Central. El encargado registra y actualiza su sede; los perfiles de consulta
solo leen su alcance. Cambiar de sede requiere devolución a Bodega TI y una asignación confirmadas por UTIC; una edición de ficha no cambia la sede. Las personas
de una nueva sede no reciben eventos privados de la sede anterior: el historial
local muestra solamente eventos cuyo antes y después pertenecen a su sede.

## Datos e historial

`celulares` guarda la ficha vigente y referencia `sedes`. `celulares_historial`
conserva actor, fecha, motivo y datos anteriores/posteriores, incluidos teléfono,
sede y vigencia. La función controlada `guardar_celular_acceso` comprueba permisos,
versiones, datos y duplicados; la cuenta web no escribe directamente en las tablas.
Los reintentos iguales no duplican el ingreso ni el historial.

El inventario de celulares tiene identidad y tablas propias. No se duplica en los
listados de equipos generales. Los incidentes de robo actuales corresponden a los
equipos generales; incorporar reportes de celulares, actas, planes de operador,
facturación y asignaciones formales a funcionarios requiere su flujo específico.
No se incorporan esos procesos como si ya estuvieran implementados.

El modelo actual contiene 22 tablas funcionales más `pgmigrations` y 28 claves
foráneas. El diagrama y documento se generan desde la base; el material histórico
para jefatura conserva su fecha y estructura originales.

## Instalación

El alta del módulo requiere `1794182400000_inventario-celulares`; la custodia y los movimientos comunes requieren además `1794268800000_custodia-movimientos-inventario`.
Primero se prepara un respaldo con restauración comprobada, se aplican las
migraciones y se reconstruye/reemplaza solo la web compilada con el mismo proyecto
Compose. La salud devuelve 503 si faltan las columnas de custodia, las tablas o las funciones controladas de celulares/movimientos.
Crear o fusionar el PR no instala código ni modifica la base de CentOS.

El dashboard de Robos se retiró por solicitud de Felipe. Permanecen los reportes,
el consolidado, validaciones, recuperaciones e historial. Los enlaces anteriores
del dashboard y su exportación redirigen al consolidado tras comprobar la sesión.

## Verificación

Se probaron 102 casos unitarios y 359 comprobaciones HTTP con PostgreSQL temporal,
incluidos roles, excepciones sobre dos equipos, número/IMEI/inventario únicos,
archivo y reutilización de línea, cambios de sede, privacidad del historial local,
versiones concurrentes y salud sin la nueva función. Chromium verificó las
ventanas, alta mínima, edición/cancelación, errores con datos conservados, aviso
único, filtros, teclado, móvil, contraste, texto ampliado y el modelo actualizado.
El ensayo de recuperación incluye el celular y su historial con datos ficticios.

## Devolución y asignación

Los celulares devueltos ingresan al mismo estado lógico **En Bodega TI** que los equipos generales y se consultan juntos. Solo UTIC confirma los movimientos desde la ficha, con fecha, receptor y motivo. Una asignación requiere primero estar en Bodega TI. El alta administrativa propone Bodega TI y permite registrar un equipo ya asignado; las fichas anteriores mantienen sus datos. Funcionamiento, vigencia y custodia se conservan separados. Las ubicaciones físicas se definirán después. Ver [la guía común](homologacion-y-bodega-ti.md).
