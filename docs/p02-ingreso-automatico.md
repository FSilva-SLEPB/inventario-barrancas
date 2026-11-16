# P02: importación propia y numeración automática

## Alcance de esta entrega

P02 tiene ingreso individual e importación `.xlsx` propios. Esta entrega implementa
las etapas de ingreso y numeración del plan aprobado; no completa todavía la
configuración diferenciada del contenido QR ni el rediseño de entregas por lotes.
Nivel Central conserva su importación, numeración y flujo de funcionarios.

No carga automáticamente planillas reales al instalar. Una importación histórica
no crea cuentas, entregas nuevas, actas, folios ni asignaciones a funcionarios.

## Uso

1. UTIC revisa **Mantenedores → Numeración P02**. Cada categoría que necesite
   números nuevos debe tener un prefijo activo de 2 a 5 letras mayúsculas.
   Cambiarlo afecta las altas siguientes, nunca renumera bienes existentes. Se
   conservan autor, solicitud, versión y valores anteriores/posteriores.
2. En **Inventario → Inventario P02**, usar **Registrar equipo** o **Importar Excel
   P02**. La carga masiva Excel es exclusiva de UTIC global con permiso de registro.
   Enlaces puede registrar individualmente solo en su sede autorizada.
3. Para Excel, descargar la plantilla vacía o usar una hoja con los encabezados
   reconocidos. No es una plantilla NC: la identificación territorial es RBD, no el
   RUN de un funcionario. Seleccionar archivo y hoja, resolver categorías y revisar
   filas aptas/excluidas. Máximo 5 MB y 5.000 unidades por confirmación.
4. Conservar los números ya existentes. Los vacíos se generan al guardar:
   **prefijo + AA de OC + correlativo de cuatro dígitos**; por ejemplo `PRO250001`.
   El año de OC de cada fila tiene prioridad sobre el año confirmado del lote.
   Si se desconoce la OC/año, confirmar expresamente el año de numeración del
   registro o lote. No se crea una OC ni una fecha de compra ficticia.
5. Cantidad mayor a uno crea bienes individuales. No se admite una serie o número
   individual repetido para esas unidades. Sin serie, documentar la observación;
   no inventar identificadores. Los duplicados de la hoja se apartan completos.
6. Aceptar y confirmar solo las filas aptas. La vista previa vence en 30 minutos,
   pertenece a su autor y no reserva correlativos. Cambiar la revisión invalida la
   anterior. Si cambia la configuración/catálogo, aparece un duplicado, se revoca
   el permiso o se agota el correlativo, se cancela la operación completa.
7. Revisar los bienes guardados en Inventario P02. El número automático es
   permanente; reintentar la misma confirmación no genera bienes ni números nuevos.

Condiciones desconocidas o fechas escritas en condición quedan **Sin verificar**;
no se convierten en Operativo. Una baja histórica conserva el tratamiento pendiente
TI existente, sin inventar fecha de baja. La fecha de entrega se excluye; Año de
Entrega es un antecedente distinto del año de OC/numeración. Las columnas de claves
y PIN se excluyen también de los antecedentes persistidos. La carga no actualiza
el directorio a partir de datos que difieran de sus fichas vigentes.

## Servidor y SQL

Migración **45**: `1797091200000_p02-ingreso-automatico.cjs`.

- `p02_prefijos`: configuración independiente; copia inicial de la configuración
  vigente como punto de partida, sin modificar NC ni numerar bienes anteriores.
- `p02_numeros`: identidad permanente de los números generados.
- `p02_registros`: idempotencia del alta individual con UUID de solicitud.
- `p02_config_historial`: cambios de configuración auditados.
- `importaciones_excel.p02_numeracion`: año confirmado y versión de prefijos de la
  revisión P02. Las revisiones antiguas conservan el comportamiento anterior.

Las funciones públicas comprueban permiso y alcance vigentes; no basta ocultar
botones. El rol de aplicación no escribe directamente estas tablas ni ejecuta los
ayudantes privados o el confirmador antiguo renombrado. La confirmación dedicada
rechaza revisiones NC, ajenas o no preparadas en P02.

El contador se comparte por prefijo y AA con la numeración existente: se consideran
números de equipos/celulares y registros de numeración conservados. Dos categorías
con el mismo prefijo/año comparten secuencia para evitar colisiones. No se reinicia
el contador al cambiar de sede, reintentar o cambiar de categoría. Al llegar a 9999
se rechaza la operación; no se amplía el formato por suposición.

Registro, asignación del número e historial son una transacción. La importación
usa el confirmador previo, sus lotes internos de hasta 2.500 unidades y su control
de hash entre cuentas; todos los lotes y números comparten una transacción. La
versión del bien aumenta al asignarse el número. Un trigger impide reemplazar un
número generado, incluso después de un traspaso. La migración no amplía permisos de
perfiles operativos ni convierte perfiles anteriores.

Compatibilidad: el formulario genérico también dirige las altas nuevas educativas
al procedimiento P02. La importación CSV y las funciones históricas de mantenimiento
siguen disponibles por compatibilidad; no constituyen el nuevo ingreso automático
P02. Deben retirarse del flujo rutinario en una etapa posterior, preservando sus
cargas e historial. No reutilizarlas para esta carga Excel.

## Validación reproducible en ensayo

Nunca ejecutar las suites de fixtures sobre producción.

- `tests/p02.test.mjs`: adaptador, año confirmado, prioridad de OC, conservación de
  números, duplicados, separación NC, cantidades y plantilla vacía.
- `tests/p02-ingreso-http.mjs`: SQL/API/URL, alcance de sede, lectores, acceso a
  tablas/funciones privadas, concurrencia, reintentos, permanencia, cambio de
  prefijo, contador agotado con rollback, descargas privadas y sesión revocada.
- `tests/importacion-excel-http.mjs`: importación ficticia de 2.656 unidades,
  cruce de lotes internos, atomicidad e idempotencia entre cuentas, entre otros.
- `tests/p02-migracion.mjs`: desde esquema 44, SHA-256 de todas las tablas previas,
  copia de prefijos y ACL; aplica y revierte la prueba dentro de una transacción.
- Las suites HTTP/SQL se ejecutan también sobre la imagen de producción en CI.

La planilla real se revisa únicamente en lectura fuera de Git y de las bases de
ensayo. Una validación con catálogos temporales no certifica los catálogos ni los
duplicados del servidor instalado. Ninguna fila real se incorpora a fixtures/CI.

## Instalación y reversión

1. Revisar el PR y CI exacto; no fusionar ni desplegar automáticamente. Comprobar
   árbol limpio y revisión actual del servidor.
2. Detener escrituras/web, respaldar PostgreSQL y verificar su restauración en
   contenedor aislado. Conservar configuración y revisión/imagen anterior.
3. Actualizar código aprobado por avance rápido, aplicar migración 45 y construir
   la imagen web con el procedimiento de producción existente. Iniciar web en
   `127.0.0.1:3000`; verificar `/api/salud` y `revisar-instalacion.py`.
4. Comprobar con cuentas autorizadas las nuevas rutas, configuración copiada y
   alcance local; recién después revisar la planilla real. Instalar no la importa.

Reversión: si falla la migración, su transacción se revierte; conservar el respaldo
verificado y recuperar el servicio con la revisión anterior. Si la migración terminó
pero la interfaz falla, detener escrituras y volver a la imagen anterior conservando
el esquema 45: los campos agregados no eliminan columnas ni contratos anteriores,
los números ya generados y sus guardas permanecen. El formulario anterior no ofrece
el flujo P02 nuevo. Ensayar esta compatibilidad antes del despliegue.

No ejecutar un `down` destructivo. Restaurar la base previa exige detener escrituras
y conciliar cualquier dato posterior; no restaura solo la interfaz y podría perder
nuevos registros. El historial, PDFs, números y usuarios no deben eliminarse para
resolver un problema de presentación.
