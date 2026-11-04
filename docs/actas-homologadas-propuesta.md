# Propuesta de homologación de actas

**Revisión: 4 de noviembre de 2026, hora de Chile.**

Se revisaron los 15 DOCX entregados por Felipe. Son ejemplos de necesidades y contenidos: esta propuesta define una composición propia para el sistema. No se utilizan los Word como archivos base de combinación de correspondencia. La primera integración desarrolla actas para asignaciones y devoluciones sobre movimientos ya confirmados, con PDF conservado, impresión y envío por correo. Las otras familias se incorporarán con sus procedimientos; generar o descargar un documento no vuelve a ejecutar movimientos ni cambia existencias.

## 1. Resultado: una presentación y cuatro familias

| Familia | Operaciones o variantes | Documentos de referencia |
| --- | --- | --- |
| Movimientos de bienes | Asignación, devolución, cambio y traspaso; equipos y celulares; NC, EE y JI/SC | 01, 02, 03, 04, 07, 09, 10, 11, 12, 13 y 15 |
| Préstamos | Entrega temporal, plazo y devolución del préstamo; NC, EE y JI/SC | 05 y 06 |
| Entrega de insumos | Solicitud, productos y cantidades efectivamente entregadas | 08 |
| Baja de bienes | Resolución, informe técnico, motivo y tratamiento de datos | 14 |

El sistema debe resolver la variante con el tipo de operación, ámbito de la sede y clase de bien. No se propone un menú con 15 formularios. Las cuatro familias comparten encabezado, identificación del documento, participantes, observaciones, referencias y espacios de firmas.

## 2. Correspondencia de los quince ejemplos

| N.º | Ejemplo recibido | Composición propuesta |
| --- | --- | --- |
| 01 | Asignación NC | Movimiento / asignación / NC |
| 02 | Asignación EE | Movimiento / asignación / EE |
| 03 | Cambio de equipo NC | Movimiento / cambio: devolución y entrega de reemplazo relacionadas |
| 04 | Devolución de equipo NC | Movimiento / devolución / NC |
| 05 | Préstamo EE | Préstamo / EE |
| 06 | Préstamo NC | Préstamo / NC |
| 07 | Asignación JISC | Movimiento / asignación / JI-SC |
| 08 | Entrega de insumos | Entrega de insumos vinculada a la solicitud |
| 09 | Asignación de celular JISC | Movimiento / asignación / JI-SC / celular |
| 10 | Asignación de celular EE | Movimiento / asignación / EE / celular |
| 11 | Asignación de celular NC | Movimiento / asignación / NC / celular |
| 12 | Traspaso desde NC a EE | Movimiento / traspaso / origen y destino explícitos |
| 13 | Traspaso desde NC a JISC | Movimiento / traspaso / origen y destino explícitos |
| 14 | Baja de equipos | Baja de bienes con sus antecedentes |
| 15 | Devolución de celulares | Movimiento / devolución / celular, aplicable a NC, EE y JI-SC |

## 3. Ajustes encontrados en los ejemplos

- **02 y 12 tienen el mismo contenido del cuerpo**, incluida la denominación «Acta de asignación». El 12 no identifica origen NC. El traspaso debe conservar origen y destino y referir a sus movimientos reales.
- **09, 10 y 11 son la misma asignación**, con identificación de la sede o unidad y datos del celular. No requieren tres desarrollos independientes.
- **04 y 15 son la misma devolución** con distintas columnas de bienes. En la devolución, la persona o sede entrega y UTIC recibe. El bloque superior «RECIBE» no debe identificar erróneamente a quien devuelve.
- **05 y 06 comparten el préstamo**. El texto introductorio de 06 no expresa el carácter temporal, aunque incluye una fecha límite. Se debe declarar el préstamo temporal de manera consistente.
- **03 contiene dos listas distintas**: bienes devueltos y bienes de reemplazo. No conviene reducirlas a una lista que oculte cuál salió y cuál volvió, ni asumir que ambas tienen igual cantidad.
- **09, 10 y 15 separan números del director y de la sede** y dejan dos filas de celulares. Cada teléfono debe asociarse al dispositivo correspondiente, por fila, permitiendo la cantidad real. Se mantiene el acuerdo de un número por celular y dos habituales por sede, con excepciones.
- **Serie e IMEI son identificadores diferentes**. El inventario de celulares actual guarda IMEI e inventario, pero no una serie independiente. Si se conserva la serie en el documento habrá que registrarla como campo propio; no copiar el IMEI como si fuera serie.
- **08 contiene cantidades de insumos**. Se utilizará cantidad entregada y unidad de medida, en lugar de exigir números de serie a los consumibles. La cantidad entregada debe coincidir con la aprobada según el flujo de solicitudes acordado.
- **14 contiene autorización y controles propios**: resolución, informe técnico, causa, respaldo y borrado de información. Una baja no equivale a archivar una ficha, reportar un robo ni devolver a Bodega TI.
- Los documentos incluyen cláusulas de uso, responsabilidad, denuncia y plazos. Su inclusión en estos ejemplos no se considera aprobación de una política ni de una regla automática del sistema. Se propone consolidar y acordar esos textos, conservar su versión y no prometer «nuevo» o «buen estado» sin registrar la condición real.
- Los pies contienen un campo PAGE de Word. El nuevo generador debe calcular su paginación, repetir encabezados de las tablas cuando corresponda y mostrar folio y versión; no copiar valores de página almacenados en el DOCX.

## 4. Campos comunes y datos específicos

Comunes: tipo de operación, folio, versión, fecha real del hecho, fecha de emisión, referencia del movimiento, origen, destino, participantes, RUN cuando corresponda, cargo o unidad, detalle, observaciones y espacios de firma. El emisor del documento y quien entrega físicamente son datos diferentes.

- **EE/JI-SC:** RBD, nombre, dirección, comuna y contacto institucional; persona que efectivamente recibe, con su cargo y RUN cuando corresponda. El directorio propone datos para una operación nueva y permite revisar el receptor real.
- **NC:** funcionario, RUN, unidad y subdirección. El destinatario de una entrega no se reduce a la sede «Nivel Central».
- **Equipos:** categoría/descripción, inventario, serie, marca, modelo, condición y accesorios. Identificadores desconocidos se indican como pendientes; no se inventan.
- **Celulares:** los mismos datos pertinentes, más IMEI y número telefónico por equipo. Serie separada solo si existe el dato correspondiente.
- **Devolución/cambio:** condición de recepción, accesorios entregados/faltantes y motivo; el cambio vincula los bienes devueltos y los de reemplazo.
- **Préstamo:** fecha de entrega, fecha límite y referencia del préstamo; la devolución debe cerrar o actualizar el préstamo correspondiente sin perder el antecedente. La custodia temporal no debe confundirse automáticamente con un cambio de pertenencia del equipo.
- **Insumos:** solicitud, código, descripción, unidad y cantidad entregada. Marca/modelo cuando sean pertinentes.
- **Baja:** resolución y fecha, informe técnico y fecha, motivo, tratamiento de información y estado de resguardo/disposición según el procedimiento que se defina.

## 5. Generación desde el sistema

1. UTIC prepara la operación desde el flujo común y selecciona sus bienes. Se reutilizan filtros, fichas y confirmaciones del inventario.
2. El sistema presenta una vista previa marcada como borrador, propone los datos disponibles y pide los faltantes pertinentes.
3. La confirmación valida permisos, versiones, estado de los bienes y datos del documento. La operación y el documento deben quedar vinculados de forma consistente, con reintentos que no generen duplicados.
4. La emisión asigna un folio único y conserva los datos usados: participantes, sedes, líneas, condición, accesorios y versión del texto/diseño. No se genera un folio diferente por cada descarga.
5. Se genera el PDF desde esa información conservada. Volver a imprimir reproduce la misma versión, sin recalcular nombres con el directorio vigente.
6. La vista previa o descarga no ejecuta por sí misma un movimiento, una entrega ni una baja. El documento generado deja los espacios de firma; no se atribuye una firma o aceptación que no se haya registrado.
7. Las correcciones de documentos emitidos deben conservar la versión anterior y su vínculo de reemplazo. La numeración, la anulación y el archivo del ejemplar firmado deben definirse como parte del flujo documental.

Las devoluciones y asignaciones siguen siendo confirmadas solo por los dos perfiles administradores de UTIC. El acceso a los documentos debe respetar el alcance y los datos de cada sede.

## 6. Datos disponibles y ampliaciones necesarias

| Área actual | Disponible | Ampliación para el documento |
| --- | --- | --- |
| Movimientos de equipos/celulares | Bien, acción, fecha, receptor como texto, actor, motivo, origen/destino e instantáneas | Folio/documento, participantes completos, condición/accesorios de entrega/recepción, versión documental, varios bienes vinculados |
| Directorio | Datos de sedes y responsables vigentes con historial | Propuesta revisable y conservación de la persona real de cada nueva entrega |
| Funcionarios NC | Ficha, RUN, contacto, unidad, subdirección e historial | Vincular el funcionario destinatario al movimiento y al documento |
| Celulares | Número, IMEI, inventario, marca/modelo, condición, responsable e historial | Serie independiente si corresponde y composición de líneas con teléfono por dispositivo |
| Entregas históricas | Grupo por jardín, equipos e instantáneas de receptor/sede | Documento histórico solo con los antecedentes disponibles, sin completar automáticamente con personas actuales |
| Préstamos | No existe un flujo específico de préstamos | Plazo, custodia, vencimiento y devolución vinculada antes de emitir actas operativas |
| Insumos | Diseño acordado, flujo aún pendiente | Solicitudes, aprobación, reservas y entrega real antes de emitir actas operativas |
| Bajas | No existe un flujo administrativo de baja | Resolución, informe, permisos y controles del procedimiento antes de emitir actas operativas |

El formato por sí solo no implementa el procedimiento. El primer desarrollo propuesto es la generación para asignación y devolución, sobre los movimientos existentes. Cambio/traspaso deben vincular sus operaciones; préstamos, insumos y bajas se incorporan con sus flujos respectivos, manteniendo la misma presentación.

## 7. Puntos que deben quedar definidos para implementar

- Numeración acordada el 4/11/2026: una secuencia nueva y única que comienza en 0 (ACT-000000). Esta última indicación sustituye la propuesta inicial de continuar numeraciones anteriores. Imprimir o reenviar no consume un folio.
- Qué participantes firman en cada operación y si el receptor puede ser una persona delegada del director/a.
- Texto institucional común y cláusulas específicas que corresponde incluir; los plazos de los ejemplos no se activan automáticamente.
- Momento de emisión, correcciones/anulaciones y tratamiento del documento firmado.
- Reglas de préstamos, cambio, baja y disposición, conservando los acuerdos existentes sobre custodia y solicitudes.

Se adjuntan muestras de las cuatro familias con datos ficticios y espacios por completar para revisar la presentación. No son actas emitidas ni documentos firmados.

## 8. Requisitos confirmados: impresión y correo

Todas las familias deben reutilizar las mismas acciones de **Imprimir**, **Descargar PDF** y **Enviar por correo**. El PDF emitido se conserva con su huella SHA-256: impresión y correo usan el mismo archivo y versión. El remitente será una cuenta institucional de **no responder**; su dirección exacta y el transporte se configurarán en CentOS, sin credenciales en el repositorio.

Antes de enviar se revisan hasta cinco destinatarios explícitos. Cada intento registra solicitante, destinatarios y resultado. La aceptación del servidor no se presenta como lectura ni como recepción confirmada. Los resultados inciertos requieren revisión antes de reenviar y no se reintentan automáticamente. Abrir la impresión tampoco se registra como prueba de que el usuario efectivamente imprimió.

La primera integración permite emitir desde asignación/devolución de equipos o celulares, consultar el PDF conservado y usar las acciones comunes. No autoriza todavía préstamos, bajas o entregas de insumos sin sus flujos respectivos.
