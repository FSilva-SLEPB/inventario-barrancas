# Tablas y carga de Inventario completo

Corrección solicitada por Felipe tras instalar el RBAC. Mantener el patrón compartido en todos los listados: iconos compactos con nombre accesible y ayuda, salto de línea dentro de un grupo acotado y ninguna columna superpuesta. No ocultar campos para simular responsividad. En pantallas estrechas la tabla conserva desplazamiento horizontal dentro de su recuadro; el resto de la página se adapta al ancho disponible. Los iconos miden 36 px con ratón y mantienen 44 px en dispositivos táctiles.

## Archivo y vista previa

La plantilla `/plantillas/equipos-historicos.csv` contiene las 23 columnas indicadas por Felipe, en su mismo orden: año, RBD, establecimiento, dirección, comuna, RUT y nombre de director/a, adquisición, OC, ID de adquisición, CDP, fecha OC, guía/factura, cantidad, tipo de estado, tipo de compra, categoría, marca, modelo, serie, inventario y los dos estados. Admite CSV UTF-8 con punto y coma, coma o tabulaciones. No abre XLSX ni ejecuta fórmulas.

No exige agregar Origen, la columna antigua Estado, fecha exacta de entrega ni enlace de acta. Los datos de adquisición pueden faltar sin inventarlos. RBD/NC y categoría deben corresponder a registros activos únicos. Marca, modelo y estados se validan. Si falta serie, se conserva una observación explícita de que no vino informada y debe identificarse físicamente; no se fabrican identificadores ni una causa del faltante. El número de inventario puede quedar pendiente.

Se mantiene compatibilidad con CSV anteriores que usan Estado=Activo/En Bodega del SLEP. La condición anterior no se convierte automáticamente a Operativo. Sin origen declarado se usa Otro origen, conservando la adquisición original como antecedente, sin atribuir una compra a UTIC.

La vista previa presenta el total de bienes individuales, número de filas de origen, errores y avisos, y permite revisar las 23 columnas originales de las primeras 20 filas antes de confirmar. Los errores no escriben datos; un fallo posterior cancela toda la carga.

## Cantidades e identidad

Definición confirmada: CANTIDAD 10 crea diez bienes individuales. Se aceptan solo enteros entre 1 y 2500, sin separadores de miles ni decimales: escribir `1000`, evitando interpretar ambiguamente `1.000` como una unidad. El total del archivo no puede superar 2500 bienes.

Con cantidad mayor que uno, serie e inventario deben estar pendientes. Si la fila aporta un identificador individual, la vista previa pide separar cada equipo en una fila con cantidad 1. No se duplica ni se decide por suposición a qué unidad corresponde una única serie. Cada registro nuevo tiene su propia identidad interna, unidad dentro del grupo, fila, archivo y hash de origen. Repetir el mismo archivo no vuelve a crear los bienes.

Los valores originales se conservan en `equipos.datos_compra.antecedentesCarga`, con cantidad y unidad de origen. No se actualizan sedes ni directores a partir de esos textos. La ficha distingue los antecedentes del archivo de los datos actuales del directorio y oculta datos de director/RUT a perfiles sin consulta del directorio de personas. Las descargas ordinarias no incluyen el JSON de origen. Para futuros dashboards contar bienes por su identidad; no sumar la cantidad original repetida en cada unidad del grupo.

## Estados y bajas pendientes

Activo conserva la condición informada. Robado/No encontrado requieren además permiso TI para confirmar estados y dejan la condición vacía; se conserva el valor original de la planilla. Esto no crea una denuncia ni valida un incidente que no fue informado.

Definición confirmada: Dado de baja sin fecha se conserva como antecedente pendiente de validar por TI, sin inventar fecha ni realizar una baja formal. La carga no solicita otra columna de fecha ni genera movimientos o actas de baja. El registro muestra el pendiente, conserva sus estados originales declarados y bloquea movimientos por SQL hasta que TI lo resuelva desde Estados del activo.

El pendiente se guarda en `datos_compra.bajaPendienteTI`; no es un nuevo estado administrativo. Al confirmar un estado, TI elimina ese pendiente con versión, solicitud idempotente e historial. Si TI confirma Dado de baja ahora, se registra la fecha actual de esa confirmación y se aplica Obsoleto/solo lectura; no se presenta como la fecha de una baja histórica desconocida. Guardar Activo confirma que debe seguir en uso y mantiene el antecedente original de lo declarado en el archivo.

La migración 38 modifica procedimientos y añade una guarda de movimientos. No reclasifica bienes existentes ni altera cuentas, ubicaciones, documentos o cargas anteriores. Antes de instalar: respaldo con restauración comprobada. Para revertir, conservar primero cualquier operación nueva y restaurar el respaldo y revisión anteriores; no borrar las cargas nuevas mediante un down destructivo.

## Validación de ensayo

Compilación y ESLint sin errores; 162 pruebas unitarias y 29 suites SQL/HTTP aprobadas, incluida una suite de 10 escenarios específicos de carga completa. Se comprobaron expansión de cantidades, reintentos, atomicidad, estados, permisos, conservación del directorio y protección de datos personales del origen. Chromium verificó 1440/900/390 px, objetivos táctiles de 44 px, varias líneas de iconos, desplazamiento sin superposición, celulares/directorio/insumos y una carga real desde la vista previa. La migración mantuvo las huellas de las 46 tablas anteriores y el respaldo del esquema nuevo se restauró en un contenedor de prueba independiente.
