# Regla de homologación del inventario

Felipe estableció esta regla funcional: **un mismo proceso debe verse y funcionar
igual en todos los módulos**. Se aplica a cambios nuevos y al corregir pantallas
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
  y el estado lógico En Bodega TI. Las ubicaciones físicas de bodegas se definirán
  después; no crear sedes, direcciones ni bodegas ficticias.
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
