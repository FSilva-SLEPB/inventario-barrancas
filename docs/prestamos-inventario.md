# Préstamos temporales desde Bodega TI

Corte: 5 de noviembre de 2026. Requiere migración
`1794700800000_prestamos-inventario` y reconstruir la web compilada. Esta guía
describe la actualización preparada; su publicación no acredita instalación en CentOS.

## Recorrido común

1. UTIC localiza un equipo o celular **En Bodega TI**. En Acciones el reloj abre
   **Prestar desde Bodega TI**; se reutilizan la ventana y los participantes de las entregas.
2. Selecciona destino temporal, fecha real y fecha límite. Para EE/JISC se separan
   institución y director/a; para NC se selecciona funcionario y unidad/subdirección.
   El emisor es la cuenta autenticada; el lápiz corrige participantes de esta acta.
   Motivo, observaciones, accesorios y RUN no informado pueden quedar vacíos.
3. Confirmar guarda préstamo, movimiento, historial y PDF en una sola transacción.
   Se muestra confirmación y el documento, con Imprimir, Descargar y Enviar por correo.
4. **Préstamos** permite consultar activos (incluidos vencidos), vencidos y devueltos,
   buscar y mostrar 50/100/150 filas con el mismo patrón del inventario. No añade un dashboard.
5. La flecha **Devolver préstamo a Bodega TI** identifica el préstamo original.
   Propone sus participantes conservados, aunque cambie el directorio, y genera
   otro movimiento/PDF. El documento de retorno referencia el folio de salida.
   Cancelar o guardar conserva los filtros y el tamaño de página.

Movimientos y actas continúa como consulta de operaciones realizadas. No se inicia
un préstamo desde esa consulta ni se reemplaza por una asignación definitiva.

## Pertenencia, fechas y permisos

- `sede_id`, número de inventario, serie/IMEI, teléfono, situación/fecha de entrega
  anterior y responsable original permanecen. El destino temporal vive en el préstamo.
- Custodias: `en_bodega → en_prestamo → en_bodega`. Un bien prestado no figura como
  disponible en bodega ni como inventario propio recibido por la sede prestataria.
- Una salida real no puede ser futura. El plazo debe ser igual o posterior a ella.
  Se aceptan antecedentes históricos ya vencidos: no se inventa una fecha futura.
  La fecha límite es inclusiva; vence al día siguiente según **America/Santiago**.
  No se devuelve, renueva ni prorroga automáticamente.
- Solo los dos perfiles administradores UTIC operan y consultan préstamos/actas
  en esta etapa. Las sedes conservan sus permisos habituales sobre su inventario;
  no reciben RUN, correo ni datos de prestatarios de otras sedes.
- Solo un préstamo abierto por bien, protegido con índices y bloqueos SQL. Las
  versiones, autorización vigente e idempotencia se comprueban también en la base.
- Editar, archivar, asignar, devolver por el flujo ordinario o regularizar una
  entrega mientras está prestado se bloquea. Un celular archivado no se presta.
  Un equipo con incidente de robo abierto no se mueve por este flujo.
- Se admite devolver aunque la sede original o temporal ya esté desactivada.
  El retorno exige el ID original: una solicitud antigua nunca cierra un préstamo nuevo.

## Actas y recuperación

Se utilizan el contenido de los ejemplos Word 05 (EE) y 06 (NC), logo oficial,
plazo, bienes, condiciones y firmas, con el estilo institucional aprobado. Un PDF
emitido no certifica firma. Reimprimir o reenviar utiliza sus bytes y SHA-256
conservados; la devolución no reescribe la salida. Si falla la composición o
persistencia del PDF, se revierte la operación completa, incluido el folio.

El respaldo incluye préstamos abiertos/cerrados, vínculos de salida/retorno,
PDFs y contador. El ensayo de recuperación utiliza PostgreSQL aislado, datos
ficticios no vacíos, cifrado y rechazo de claves incorrectas o archivos alterados.

Los correos locales se capturan en SMTP TLS ficticio. En CentOS solo está
autorizado `correoprueba@slepb.gob.cl`, con modo prueba; falta configurar el
transporte institucional. Ningún ensayo local envía a esa cuenta ni a las sedes.

## Alcance siguiente

No incluye prórrogas, cierre automático, bajas formales, cambios/traspasos compuestos
ni ubicaciones físicas de las bodegas TI. Esas operaciones requieren acuerdos y
validaciones propios. Bodega TI continúa como estado lógico, sin crear sedes ficticias.
