# Insumos: catálogo e ingresos por compra

UTIC o el Gestor de insumos inicia el ingreso desde **Crear insumo e ingresar cantidad**. El botón abre
la misma ventana de edición compartida del sistema. Se completan categoría,
producto, unidad, cantidad, OC y fecha de compra. Al guardar, la ventana se cierra
y aparece la confirmación de éxito; un error conserva los valores para corregirlos.

El código se genera una sola vez al crear el producto: abreviatura de la categoría
y correlativo, por ejemplo `ACC-000001`. Categorías con la misma abreviatura reciben
prefijos distintos (`ACC2`, etc.). El código permanece al editar el producto o su
categoría. Los códigos anteriores se conservan y no se reutilizan por colisión.

Se puede seleccionar un producto existente o ingresar sus mismos nombre, categoría
y unidad: si hay una sola coincidencia, se reutiliza su ficha y código. Cada compra
conserva por separado su OC, fecha, cantidad, autor y datos del producto al ingresar;
el stock suma las cantidades. Dos compras con OC distintas no crean dos fichas del
mismo producto. Si los datos antiguos contienen varias coincidencias, se exige
seleccionar una ficha. Las unidades diferentes no se convierten ni suman entre sí.

La columna Acciones usa los iconos compartidos para editar, registrar otra compra,
ver los ingresos y cambiar la foto. **Ver compras** abre el historial, con Mostrar
50/100/150 registros. Editar el catálogo no reescribe las compras anteriores. Las
reservas y entregas siguen usando el stock agregado; esta versión no distribuye
las salidas entre OC ni incorpora costos o valorización.

## Conservación y controles

La migración 29 (`1795708800000_compras-insumos-oc`) agrega ingresos y correlativos.
Las existencias anteriores se documentan como saldo anterior sin inventar OC o
fecha; no se vuelven a sumar al stock. Se conservan reservas, entregas, fotografías,
historial, equipos, celulares y PDFs emitidos.

El servidor y la base validan permisos UTIC, cantidades enteras positivas, OC,
fecha válida y versión del producto. El registro de compra, stock e historial se
guarda en una transacción. Repetir la misma solicitud no duplica el ingreso; usar
su identificador con otros datos produce un error. Las cuentas de la aplicación
no tienen escritura directa sobre ingresos o correlativos. La función técnica
anterior de stock se conserva para compatibilidad; el formulario y la acción web
de ingreso sin OC se sustituyen por este flujo.

Antes de instalar: respaldo con restauración comprobada, web detenida, migraciones,
compilación y arranque según [despliegue](despliegue-produccion.md). Esta documentación
describe el cambio de código; su publicación no acredita instalación en CentOS.

## Verificación del cambio

En una base aislada, la actualización desde la migración 28 conservó las huellas
de diez tablas existentes, incluidos stock, reservas y documentos. Se comprobó
restauración con compras, correlativos, fotos y actas de prueba. Pasaron las 156
pruebas unitarias y la batería SQL/HTTP, incluidos doce escenarios de compras con
permisos, reintentos, concurrencia, versión, error transaccional y recibos históricos.
El navegador comprobó tres compras de una ficha (10 + 5 + 2), edición, mensajes de
éxito, errores conservados, bloqueo durante el guardado, historial, paginación,
Escape y vista móvil. Una revisión independiente de código comprobó el identificador
nuevo por apertura, sin depender de la velocidad de actualización del listado.

El perfil específico y el circuito de aprobación y entrega se describen en
[Gestor y flujo de Insumos](gestor-y-flujo-insumos.md).
