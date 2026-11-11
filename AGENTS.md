# Regla de homologación del inventario

Felipe estableció esta regla funcional: **un mismo proceso debe verse y funcionar
igual en todos los módulos**. Todos los trabajos deben mantener el mismo estilo visual y reutilizar componentes compartidos; no diseñar una variante por pantalla. Se aplica a cambios nuevos y al corregir pantallas
existentes, incluyendo equipos, celulares, Bodega TI, Robos y directorios.

- Usar los componentes compartidos de filtros, resultados, paginación, fichas,
  ventanas de edición y confirmaciones. No crear otra variante local para el
  mismo proceso. Ampliar el componente común cuando falte una capacidad.
- Mantener panel de filtros, Buscar/Limpiar, estados, espaciados, etiquetas y
  selector Mostrar 50/100/150 registros con el patrón aprobado en Inventario.
  Los criterios específicos de cada consulta pueden variar; su interacción no.
- Conservar filtros, tamaño de página y página al consultar, cancelar o guardar.
  Cambiar criterios inicia la primera página y limpia dependencias incompatibles.
- Nuevo criterio indicado por Felipe y su jefatura: los listados usan columna
  Acciones con botones Ver, Editar y acciones de documentos cuando correspondan.
  Sustituye la regla anterior de una sola entrada Ver ficha. Reutilizar el mismo
  componente de acciones y conservar permisos, filtros y navegación de modales.
  Guardar cierra la edición y confirma éxito; los errores conservan los valores.
- Asignación y devolución de equipos/celulares usan el mismo flujo de movimientos
  y el estado lógico En Bodega TI. Las cinco ubicaciones físicas confirmadas por
  Felipe se detallan al final; la migración 28 y el flujo compartido de Bodega TI incorporan su ubicación física, con instalación pendiente. No crear sedes,
  direcciones ni bodegas ficticias.
- Respetar permisos, versiones, historial e idempotencia en servidor y base.
  Archivar una ficha, su funcionamiento y su custodia son conceptos distintos.
- Verificar cambios de proceso con permisos, estados, concurrencia, datos previos,
  filtros y navegación de teclado/móvil. No dar una instalación por realizada
  solamente porque se fusionó un PR.

Consultar la guía actual en docs/homologacion-y-bodega-ti.md y las instrucciones
específicas de web/AGENTS.md para desarrollar con la versión instalada de Next.js.

- Todas las actas deben reutilizar las acciones de Imprimir, Descargar PDF y Enviar
  por correo. Se conserva el PDF emitido: imprimir o reenviar no cambia su folio,
  versión ni datos. La numeración acordada el 4/11/2026 comienza en 0 con una sola
  secuencia, y el remitente será una cuenta institucional de no responder.
- No enviar correos reales desde el entorno de desarrollo. Los ensayos de correo
  usan destinatarios ficticios y transporte local aislado; las credenciales reales
  se configuran exclusivamente en CentOS. No confundir aceptación SMTP con lectura
  o entrega confirmada, ni reintentar automáticamente un resultado indeterminado.

- Asignar/entregar y devolver se inician desde el bien en Inventario o Bodega TI.
  Confirmar guarda movimiento y acta juntos; Movimientos y actas es consulta de
  operaciones realizadas. Documentar un antecedente previo se inicia desde el bien.
- Usar el contenido y estructura de los modelos Word enviados por Felipe (datos
  de receptor, detalle de bienes, condiciones y firmas), junto con el logo oficial.
  Mantener el estilo institucional aprobado y los PDFs ya emitidos conservados.

- Acciones de listados con iconos (ojo, lápiz y flechas), nombre accesible y ayuda.
- Entregas: motivo opcional, emisor desde la cuenta autenticada, participantes precargados y editables con lápiz. Separar institución y director/a; NC selecciona funcionario y muestra unidad/subdirección, sin campos de colegio. No inventar nombres ni RUN que no existen en las fichas. Reimprimir conserva el emisor original.

- En los ensayos de correo usar únicamente el buzón de prueba/Barranquín confirmado por Felipe; nunca los correos reales de establecimientos. Modo prueba por defecto, lista explícita y validación antes de auditoría y transporte. No habilitar modo producción sin una nueva instrucción.

- Préstamos temporales: salen únicamente de Bodega TI, con fecha límite y confirmación de UTIC. Conservan la sede de pertenencia; el destino temporal no reemplaza el inventario original. La devolución exige el ID del préstamo exacto y vuelve a Bodega TI. Vencer no devuelve ni prorroga automáticamente. Movimientos, préstamo, acta y folio comparten transacción e idempotencia. Consulta de prestatarios y actas solo UTIC en esta etapa.

- Próximos trabajos solicitados el 6/11: continuar el ciclo de equipos (cambios/reemplazos, traspasos y luego reparación/baja). Dejar la subida/carga del inventario para después. El dashboard de información de P02 se definirá más adelante: año, robos, tipo de compra, empresa y OC son criterios iniciales; todavía no se fija qué fecha representa el año ni las métricas. No reactivar el dashboard específico de Robos como sustituto.
- Traspasos, regla confirmada el 6/11: cuando el origen o destino sea Nivel Central, el bien debe pasar por Bodega TI. Entre sedes educativas se permite entrega directa, confirmada por UTIC. Registrar la ruta real; no simular una devolución a Bodega para representar un traspaso directo.

- Definición posterior a instalar PR53: habrá dos dashboards homologados, Nivel Central y establecimientos/JI-SC (P02). Las ubicaciones físicas son compartidas; la pertenencia de cada bien a un inventario se conserva por separado. Libre significa disponible para asignar, excluyendo espera de reparación o baja; no deducirlo solo de estar en bodega.
- Bodegas reales confirmadas por Felipe: Bodega TI Primer Piso, Bodega TI Segundo Piso, Bodega BOX 3 y Bodega BOX 4 en dependencias de SLEP Barrancas; Bodega TI Bicentenario en el antiguo Liceo Bicentenario, RBD 31288, Av. Cardenal Raúl Silva Henríquez #1185, Cerro Navia. Ya no es establecimiento activo según Felipe. Conservar registro, referencias e historial al regularizarlo; no borrar sedes ni trasladar masivamente sus bienes por suposición. Bicentenario recibe por lo general equipos destinados a baja; ubicación no equivale a baja formal.
- Especificación más reciente para el componente React: condición Operativo/Bodega de TI/Mantención/Mal estado/Obsoleto; administrativo Activo/Robado/No encontrado/Dado de baja. Regla 1: cambiar a Robado o No encontrado vacía y deshabilita condición, y ejecuta el callback simulado ejecutarProtocoloSeguridad(activoId). Regla 2: cambiar a Dado de baja fija Obsoleto y deja todo el registro solo lectura como histórico. Regla 3: Activo habilita ambos selectores. No agregar una regla inversa que dé de baja por seleccionar Obsoleto.
- El ejemplo aislado de estados conserva la simulación; la integración operativa de equipos/celulares debe guardar con acción UTIC, versión, idempotencia e historial antes de mostrar la baja histórica. El callback de seguridad sigue simulado y no reemplaza los incidentes reales. Las condiciones antiguas Sin verificar/Fuera de servicio no se convierten automáticamente en Operativo, Obsoleto o Baja.
- Felipe decidió no usar Inactivo como opción nueva; antes lo usaba aproximadamente para dejar un bien guardado. Usar En bodega y ubicación para ese caso; conservar y revisar las filas antiguas Inactivo. La última lista explícita de los dos selectores no incluye Inactivo ni Pendiente de inventario. No inferir alta contable ni depreciación a partir de un registro del sistema.

- Estados integrados: la migración 20 y el adaptador operativo guardan la transición administrativa antes del bloqueo histórico; errores conservan el estado anterior. Compartir controles, confirmación y guardas de salidas. Mantener devolución de averiados, datos anteriores sin reclasificación automática y PDFs emitidos. Una baja de celular conserva su teléfono histórico y permite reutilizar el número en su reemplazo. Ver docs/estados-integrados-y-flujo-actas.md.

- Insumos: lectura de solicitudes limitada a la sede autorizada; catálogo/stock y confirmación de entregas por los dos administradores o el perfil Gestor de insumos, limitado a este módulo. Una entrega parcial cierra la solicitud y libera su reserva restante. Entrega, cantidades y acta se confirman juntas. Fotos persistentes en PostgreSQL, sin escribir en public; conservar originales al importar fotos anteriores. No reintroducir acceso sin OAuth. Ver docs/auditoria-insumos-2026-11-10.md.

- Ingreso de insumos: botón y modal compartido con categoría, producto, unidad, cantidad, OC y fecha de compra. Código automático por abreviatura y correlativo al crear, permanente al editar. Reutilizar la ficha del mismo producto/categoría/unidad y conservar cada compra por separado; no duplicar stock por reintentos. Datos anteriores sin OC/fecha se conservan como saldo anterior sin volver a sumar existencias. Ver docs/insumos-compras-oc.md.

- Ubicaciones físicas: confirmar desde Ubicar en Bodega TI para equipos/celulares, solo UTIC, versión e idempotencia. Pertenencia y estados se conservan; salir a asignación/préstamo/entrega limpia ubicación, y devolver no recupera una anterior por suposición. Confirmar Bicentenario no da de baja. No asignar ubicaciones a datos anteriores ni regularizar RBD 31288 sin revisar su registro. Ver docs/bodegas-fisicas.md.

- Gestor de insumos, confirmado el 11/11: puede crear productos, ingresar compras/stock, validar, aprobar, cancelar y entregar solicitudes de todas las sedes, y consultar/imprimir/descargar/enviar sus actas de insumos. No concede administración de usuarios, inventarios, Bodega TI de equipos, funcionarios ni otras actas. Asignación explícita desde Usuarios y perfiles; nunca convertir cuentas existentes automáticamente. Preservar permisos en servidor y SQL, reservas, idempotencia y PDFs. Ver docs/gestor-y-flujo-insumos.md.
- Las portadas e Inicio comparten tarjetas; Solicitudes de insumos usa PortadaModulo, filtros/resultados/modales comunes y los accesos corresponden a los permisos. Quitar el rótulo «Gestión institucional» de las portadas. No confundir el nuevo gestor con Administrador de gestión.

- Corrección de Felipe: Catálogo de insumos aparece únicamente en Mantenedores, nunca duplicado en Solicitudes. El Gestor de insumos conserva acceso a Mantenedores, con solo ese catálogo; no recibe permisos de otros mantenedores.
- Inicio de los perfiles vinculados a EE/JI muestra la identificación de su sede autorizada, cargada desde el registro existente, sin elegir otra por URL ni inferirla por correo/IP. Campos faltantes se muestran sin inventar datos. Atajo institucional a https://soporteti.slepb.gob.cl/ en otra pestaña, sin enviar datos de la sede o sesión ni prometer inicio de sesión automático.
