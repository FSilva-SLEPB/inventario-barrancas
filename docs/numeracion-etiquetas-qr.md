# Numeración y etiquetas QR

Implementación para revisión y despliegue posterior. Requiere migración 43 y la
versión de importación Excel ya incorporada en main. No se ejecuta sobre CentOS
desde el entorno de desarrollo ni se fusiona automáticamente.

## Dónde se encuentra

Inventario incorpora **Generar números de inventario** y **Etiquetas QR** como
accesos independientes, también visibles en el menú según los permisos efectivos.
Los listados de Nivel Central/P02 ofrecen acceso a ambos con ámbito y búsqueda.
Desde la ficha de un equipo se puede ir a generar su número pendiente o preparar
su etiqueta. Usa filtros, tabla con scroll interior, paginación 50/100/150 y modal
compartidos. Funciona para equipos de Nivel Central, establecimientos y jardines;
no se extiende automáticamente a celulares ni a insumos.

## Numeración

Se adapta la regla del código Apps Script entregado por Felipe:

`PREFIJO + AA de la OC + correlativo de cuatro dígitos`, por ejemplo AIO250001.

- Configuración por categoría, editable en el modal Configurar prefijos. Se
  inicializan únicamente nombres reconocidos en el código recibido: All In One
  AIO, Monitor MON, Proyector PRO, Impresora IMP, Notebook/Laptop LAP, PC/Computador
  de Escritorio PC, Tablet TAB, Servidor SRV, Switch SWT, Router RTR, Access Point
  AP, UPS, Cámara CAM, Escáner ESC y Raspberry Pi RPI. No se crean categorías.
  Para cualquier otra, UTIC debe elegir explícitamente un prefijo de 2–5 letras.
- Dos categorías con el mismo prefijo comparten correlativo. El contador se
  separa por prefijo y los dos dígitos del año, igual que el formato recibido;
  no se crean secuencias distintas por sede o inventario que pudieran colisionar.
- Se exige serie, categoría/prefijo activos, estado administrativo Activo y
  número pendiente. No se numeran bajas pendientes ni bienes en préstamo.
- Usa fecha de OC válida. Si falta, el operador confirma expresamente un año
  1900–2099; se registra como año de numeración, **sin inventar una fecha de OC**.
  No usa el año actual ni el de entrega por suposición. Una fecha inválida debe
  corregirse; el año alternativo no la reemplaza silenciosamente.
- Continúa por encima del mayor correlativo reconocido en equipos, celulares y
  números emitidos. No modifica los números anteriores, aunque su formato difiera.
  No renumera al cambiar año, categoría o prefijo. Los generados son permanentes;
  su cambio por otra pantalla o por solicitudes directas queda bloqueado en SQL.
- No reutiliza correlativos emitidos. Si llega a 9999, se detiene y requiere una
  decisión de formato; no vuelve a 0001. Un cambio de año inicia su otra secuencia.
- Hasta 150 equipos por confirmación, con versiones de ficha y prefijo. El lote se
  guarda completo o se revierte completo; las peticiones repetidas son idempotentes.
  Conserva actor, antes/después y lote en historial. No crea actas ni movimientos.

Los números escritos manualmente siguen admitidos en las fichas conforme al flujo
existente, con unicidad entre equipos/celulares para nuevos números. No se corrigen
ni eliminan duplicados históricos entre tablas por migración; editar otros datos
sin cambiar ese número antiguo sigue siendo posible.

## Etiquetas

Se adapta la biblioteca QR de Kazuhiko Arase proporcionada por el usuario (MIT),
con su aviso de autoría. No se ejecuta Apps Script ni se conecta Google Sheets:
PostgreSQL es la fuente de los equipos autorizados.

- PDF **Carta 215,9 × 279,4 mm**, 3 columnas × 10 filas.
- Etiquetas **66,5 × 25 mm**, márgenes laterales 4,2 mm, superior/inferior 14,7 mm,
  separación horizontal 4 mm, vertical 0 mm; QR de 23 mm con zona blanca de cuatro
  módulos. Se usan las medidas del código entregado, no una aproximación A4.
- Posición inicial 1–30 para aprovechar hojas usadas; 1–10 copias por equipo,
  hasta 150 equipos y 300 etiquetas por lote. Ajustes X/Y entre −3 y 3 mm.
- Plantilla P02 muestra RBD, nombre de sede e inventario. NC muestra categoría e
  inventario. Ambas conservan identificación de SLEP Barrancas/Unidad TIC.
- El usuario corrigió la elección inicial de abrir una ficha: **el QR contiene
  texto de datos básicos, solo lectura**, sin depender de localhost, dominio,
  sesión o conexión. Campos seleccionables: inventario (obligatorio), categoría,
  marca, modelo, serie y RBD; identifica NC/P02. No incluye nombres, RUN, correos,
  contraseñas, responsables ni enlaces. No abre una pantalla pública del sistema.
- Es una fotografía de esos datos al preparar el PDF; no es consulta en tiempo
  real. Leerlo no permite modificar el inventario. Usar un lector compatible con
  QR de texto; algunas cámaras de teléfono muestran texto/copia en lugar de una web.
- No se trunca el QR. Si queda demasiado denso para el tamaño físico o supera el
  límite, se pide reducir campos. El texto impreso puede abreviarse con puntos
  suspensivos para caber; esa abreviación no altera el contenido del QR.
- Preparar y abrir/descargar un PDF **no declara impresión física**. Después de
  verificar la salida se pulsa Confirmar que imprimí. También se puede cancelar.
  El registro indica confirmación del usuario, no recepción de la impresora.
- Mis últimos lotes conserva el PDF original y permite volver a obtener los mismos
  bytes. Un cambio de datos, versión o permisos obliga a preparar otro lote. Una
  petición repetida no vuelve a generar el número ni suma otra confirmación.
- Imprimir en tamaño real/100 %, hoja Carta, sin Ajustar a página. La calibración
  física de la impresora y el papel Adetec debe comprobarse primero en una hoja de
  prueba; el desarrollo verifica geometría y lectura del QR, no ese hardware.

## Permisos y persistencia

Recursos dinámicos:

- numeracion_inventario: consultar/confirmar. Solo clase Sistema o UTIC con alcance
  global y equipos.consultar; confirmar requiere equipos.editar. Configurar
  prefijos requiere además categorias.editar. SQL impide conceder este recurso a
  un perfil operativo/personal por un nombre semejante o una petición directa.
- etiquetas_inventario: consultar/imprimir/descargar, junto a equipos.consultar.
  Sistema y Gestor TIC completo lo reciben por defecto. Otros perfiles conservan
  sus accesos anteriores; el Administrador puede configurar un perfil operativo
  especializado con alcance global o de sede. No habilita edición de equipos.
- No amplía automáticamente un Gestor TIC previamente reducido ni perfiles
  personalizados. Se conserva auditoría SQL de la migración y de sus cambios.

Servidor y SQL comprueban permisos vigentes, cuenta activa, origen, versiones,
selección e idempotencia. La siguiente petición aplica revocaciones a cookies
abiertas. Selección, PDF y consultas aplican alcance por sede; los lotes solo están
disponibles para su autor y dentro de su alcance actual. No se concede acceso por
conocer un UUID. Los permisos Imprimir y Descargar controlan las acciones del
sistema; un visor/impresora del navegador puede guardar los datos que ya recibió.

Las tablas nuevas de secuencias, configuración, auditoría, asignaciones y PDF no
conceden lectura/escritura directa al usuario de aplicación. Conserva los PDF en
PostgreSQL con los respaldos existentes; no escribe en public ni envía datos o
correos a servicios externos. Generar números no cambia sedes, custodia, estados,
fechas de entrega, personas ni documentos históricos.

## Validación y reversión

Pruebas de OC, campos QR permitidos, límites, páginas Carta/posición 30/copia/saltos,
QR denso sin truncar, permisos protegidos, correlativos compartidos, números previos
de equipos/celulares, concurrencia, reintentos, agotamiento, rollback, versiones,
permisos revocados, aislamiento por sede y conservación del PDF. El QR del PDF se
rasteriza y se decodifica con un lector independiente en el entorno local.
Chromium comprueba modales, selección, configuración y vista previa en móvil y
escritorio. Los datos son ficticios. La migración se ensaya desde esquema 42 con
comparación SHA256 de tablas anteriores, sin cambiar bienes, fichas ni documentos.

Para desplegar: verificar árbol/revisión/servicios, detener escrituras, crear y
comprobar respaldo, actualizar main, migrar y construir/recrear web con revisión.
El usuario realiza el despliegue en su servidor. Primero hacer prueba física de
etiquetas y revisar prefijos/categorías antes de una numeración masiva.

Para revertir la aplicación, volver a la imagen anterior conservando tablas y
números emitidos. No ejecutar down ni resetear contadores: podría reutilizar un
número ya impreso. Una reversión de datos requiere detener escrituras y ensayar la
restauración del respaldo verificado, considerando operaciones posteriores. No
borrar automáticamente equipos, números, lotes ni historial para deshacer una prueba.
