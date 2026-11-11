# Correcciones de auditoría — 10 de noviembre de 2026

Se conserva el carrito y diseño del PR63. No se instala automáticamente en CentOS ni se envían correos institucionales.

## Cambios

- Se elimina el acceso temporal sin OAuth. La variable antigua REVISION_SIN_OAUTH ya no concede acceso. Se requiere Google y cuenta autorizada.
- Consultas de solicitudes/detalles filtran la sede de la sesión tanto al listar como al consultar por UUID. Solo UTIC gestiona stock; Consulta y Consulta de sede no crean solicitudes. La base también valida rol, sede activa, productos activos y cantidades enteras sin duplicados.
- Guardar una condición vacía no borra clasificaciones anteriores; la migración nueva protege también los endpoints antiguos. No se inventan condiciones ni se reescriben PDFs.
- Catálogo e ingresos de stock pasan por funciones autorizadas, auditoría, versión de producto e idempotencia de solicitudes. Se corrige Editar→Guardar, se usa la ventana común con lápiz y se conservan los datos en errores. El catálogo y carrito también usan la ventana común con cierre por teclado.
- Aprobación reserva solo líneas solicitadas, en sus cantidades válidas. Una entrega única parcial consume solamente lo entregado y libera toda la reserva de esa solicitud, sin afectar otras solicitudes. No se convierte stock entre unidades por editar un producto.
- Entrega, acta y PDF comparten transacción. El vínculo al documento queda validado sin alterar un PDF emitido ni ignorar errores. Los reintentos conservan acta, folio y cantidades.
- El PDF de insumos muestra código, producto, unidad y cantidad efectivamente entregada, con identidad institucional y participantes. Los documentos externos conservan su PDF y tienen etiqueta segura.
- Las fotos nuevas se guardan en PostgreSQL, con autorización, validación de bytes/tamaño y protección de origen en ambos POST. No necesitan escribir en el contenedor web; forman parte de sus respaldos.
- El diagrama se genera desde la base migrada; la prueba que exige concordancia sigue activa.

## Datos anteriores e instalación

La migración 1795536000000 añade protecciones, sin editar migraciones aplicadas. La reconciliación de reservas conserva existencia física y registra antes/después; casos con reservas abiertas superiores a existencia requieren revisión, sin inventar stock.

Antes de instalar: respaldo verificado de PostgreSQL y copia de las fotos anteriores de `web/public/uploads/insumos` si existen. Compilar e instalar desde una revisión exacta. Mantener el bind `127.0.0.1` y retirar el valor temporal de acceso sin OAuth de la configuración del servidor.

Las fotos anteriores no se pueden recuperar a partir de una URL si ya se perdieron sus archivos. Se conservan sus referencias. El importador `web/scripts/importar-fotos-insumos.mjs` permite revisarlas con `--actor CORREO_UTIC --directorio RUTA`; solo modifica datos con `--aplicar`. Usar una conexión PostgreSQL configurada en el equipo, sin pegar credenciales en el chat. Conservar los archivos originales y el respaldo durante la importación.

No se restaura automáticamente una condición que ya esté vacía: revisar su historial para distinguir una pérdida previa de una recuperación con condición pendiente.

## Comprobaciones

Pruebas de perfiles/sedes, cantidades, concurrencia y reintentos, stock, rollback ante fallo del PDF, fotografía autenticada y origen cruzado. La imagen de producción se ensaya con raíz de solo lectura. Los ensayos de correo usan solamente SMTP local ficticio; el buzón institucional autorizado sigue siendo correoprueba@slepb.gob.cl.

Resultados locales sobre la rama revisada:

- Compilación completa y ESLint: sin errores (8 advertencias de imágenes/navegación).
- 154 pruebas unitarias aprobadas; suite integral HTTP/SQL/PDF aprobada, incluidos 36 escenarios de estados y 23 de insumos, usando el rol limitado.
- Actualización desde las primeras 26 migraciones: registros de equipos, celulares, movimientos y actas/PDFs idénticos antes/después.
- Respaldo y recuperación en otro contenedor comprobados con stock, reserva abierta, foto y acta de insumos.
- Navegador Chromium: edición en modal, éxito del guardado/stock, subida de foto, Escape, catálogo/carrito, cantidad, vista móvil y envío persistido.
- Importador de fotos: revisión sin escrituras, importación autorizada, bytes originales conservados y reintento sin duplicado.

La instalación real en CentOS, la configuración de correo, HTTPS y accesos Google del servidor deben verificarse allí. Estas pruebas locales no acreditan cambios en ese equipo.

## Homologación final sin acceso al servidor

El detalle de solicitudes usa la ventana compartida; los formularios se abren desde acciones con iconos según estado y perfil. Solicitar solo aparece a perfiles con permiso de gestión. Los enlaces de actas se muestran a UTIC, conforme a los permisos existentes del repositorio documental.

Se precargan el solicitante y quien entrega desde los datos de la cuenta autenticada, y quien recibe desde la solicitud. Los campos desconocidos quedan vacíos; el lápiz permite corregir participantes. El correo autor de la solicitud sigue ligado a la sesión. Las entregas muestran RUN y cargo junto a cada persona, separados de la institución.

La creación navega una sola vez a su detalle y usa la confirmación firmada común. No basta escribir `guardado=1` en la URL. Validar, aprobar, cancelar y regresar desde acta/correo conservan filtros, página y tamaño; Todos incluye solicitudes finalizadas. Cantidades fraccionadas, vacías o repetidas rechazan el formulario completo y conservan los valores, sin ignorar líneas ni registrar una entrega por omisión.

Chromium comprobó también solicitar→validar→aprobar→entregar→PDF, participantes precargados/editables, stock final y regreso desde el documento y su ventana de correo. No se envió correo institucional. No se añade otra migración. La [puesta en marcha pendiente](puesta-en-marcha-pendiente.md) separa lo preparado de lo que necesita CentOS o definición posterior.
