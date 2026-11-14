# Importación directa de Excel

Implementación propuesta; requiere desplegar la aplicación y aplicar migración 42.
No se ha ejecutado ninguna carga ni cambio en el servidor institucional.

## Acceso y recorrido

- Inventario → **Importar Excel (.xlsx)**. También desde Carga masiva.
- Mantenedores → Funcionarios → **Importar Excel (.xlsx)**.
- Solo Sistema o UTIC global, con las acciones efectivas correspondientes.
  Inventario requiere equipos.consultar/registrar. Personas requiere
  funcionarios.consultar/registrar. Vínculos requiere equipos.consultar/editar y
  funcionarios.consultar/editar. No se amplían perfiles existentes.
- Seleccionar archivo, leer hojas visibles y elegir la hoja principal. Las
  cabeceras se reconocen por los alias de las tres planillas analizadas. Una hoja
  auxiliar que no tenga las columnas necesarias se rechaza, sin adivinar su uso.
- Preparar vista previa: filas aptas, acciones, avisos y exclusiones. Las categorías
  desconocidas se relacionan explícitamente con categorías activas existentes;
  cambiar una correspondencia obliga a preparar una nueva revisión.
- Confirmar **solo las filas aptas**, aceptando expresamente que las excluidas no
  se guardarán. Vista previa de 30 minutos, privada del autor y revocable. Una nueva
  revisión invalida el identificador anterior. La confirmación es atómica, incluso
  si requiere varios lotes internos: un conflicto revierte todo lo confirmado en
  esa operación. No es necesario dividir las 2.656 filas de establecimientos.

## Orden y datos admitidos

1. **Funcionarios**: RUN, nombre completo, correo institucional, unidad,
   subdirección y cargo. Normaliza RUN y comprueba dígito verificador/dominio.
   Crea fichas nuevas, sin cuentas ni roles. Las fichas existentes por RUN o correo
   se excluyen de esta carga y se revisan desde Funcionarios, preservando sus datos.
   Estados de cese distintos de Vigencia Normal se excluyen para revisión. No
   convierte fecha de cese en fecha de ingreso ni reutiliza actores/fechas del Excel
   como auditoría del sistema.
2. **Nivel Central / establecimientos**: columnas de Inventario completo y los
   alias de Inventario General. Usa N° SERIE COMPLETO cuando existe; el número
   corto derivado no lo sustituye. Cantidad crea unidades individuales; una fila
   agrupada no puede repetir una única serie/inventario. Admite hasta 5.000 unidades
   por hoja, con lotes internos de hasta 2.500 dentro de una sola transacción.
3. **Vínculos**: revisión separada de la hoja de Nivel Central después de las otras
   cargas. Requiere RUN válido, ficha activa y serie completa de un único equipo
   existente, asignado, Activo, de Nivel Central y sin vínculo previo. Se muestra
   la serie en la revisión y se confirma expresamente. No vincula por nombre,
   hostname, correo inferido ni número corto. No reasigna vínculos anteriores.
   Cada vínculo conserva actor y motivo de origen; incrementa versión y se cierra
   mediante el flujo de movimientos existente. No genera un movimiento ni un acta.

**Fecha de entrega excluida**, conforme a la confirmación de Felipe. No se valida,
no se copia a antecedentes y no se modifica la fecha de una ficha existente. El año
de entrega y la fecha de OC son datos distintos y se conservan cuando son válidos.
Fechas erróneamente colocadas en Estado condición se descartan: condición inicial
Sin verificar, con aviso de revisión; nunca se supone Operativo.

No se importan claves de candado, usuarios/PIN de impresora, columnas desconocidas,
hojas ocultas ni el Log del archivo. Se almacena hash/nombre de archivo y un conjunto
cerrado de campos; **no se conserva el libro original** en PostgreSQL ni en public.
El actor y la hora reales proceden de la cuenta y del servidor.

## Reconciliación y límites intencionales

- Series/inventarios repetidos dentro de la hoja: se excluyen todas sus filas;
  no se elige arbitrariamente una versión histórica. Un identificador ya existente
  en la base se excluye sin sobrescribir su ficha ni mostrarla a otros perfiles.
- No combinar Inventario General con Bodega, Historial Robos o PC Robados. Son
  antecedentes parcialmente superpuestos y requieren reconciliación TI.
- Inactivo, Pendiente de Inventario, devolución anterior, Dar de Baja, robo o
  pérdida quedan excluidos para revisar. La importación no valida denuncias.
- Dado de baja explícito usa el mecanismo existente de antecedente pendiente TI:
  no ejecuta baja formal, no inventa fecha y bloquea movimientos hasta resolver.
- No crea sedes, categorías, bodegas, folios ni PDFs. No actualiza el directorio
  a partir de nombres, direcciones o directores copiados en una compra.
- Fichas nuevas y vínculos son operaciones separadas. Actualización masiva de
  fichas existentes y reconciliación histórica automática quedan fuera de esta
  versión para evitar reemplazar registros vigentes por antecedentes ambiguos.
- Un archivo/hoja/modalidad ya confirmado no se aplica de nuevo, aun con otra
  cuenta. No completar automáticamente las filas excluidas al reenviar el mismo
  libro: preparar un libro de corrección con solo las filas resueltas.

## Seguridad y persistencia

OOXML .xlsx hasta 5 MB, máximo 40 MB descomprimidos, 1.000 entradas ZIP,
20 hojas visibles, 128 columnas y 200.000 celdas por hoja. No evalúa fórmulas: lee
exclusivamente valores cacheados; campos utilizados sin caché o con error se
excluyen. No ejecuta macros, DTD, entidades, enlaces ni objetos incrustados. Los
vínculos de actas se conservan como antecedentes HTTP(S), sin consultarlos.

Servidor comprueba sesión, origen, clase protegida, alcance global y acciones.
SQL repite permisos y alcance al preparar y confirmar; la tabla de vistas previas
no concede SELECT/INSERT/UPDATE/DELETE al usuario de aplicación. La solicitud solo
puede confirmar la vista previa privada de su actor. Revisa versiones y conflictos,
con bloqueos en el mismo orden que RBAC/equipos/funcionarios. Revocación efectiva en
la siguiente petición, aun con una cookie abierta. Confirmación repetida también
requiere permiso vigente.

La migración solo agrega una tabla y funciones; no altera datos anteriores.
Los planes vencidos se eliminan al preparar otra carga; tras confirmar se vacían
sus datos temporales y se conserva el registro de archivo/autor/resultado. Los
campos importados permanecen en las fichas y su historial de creación existente.

## Validación y despliegue

Pruebas con libros ficticios: formatos reales de cabeceras, fórmulas cacheadas,
fechas, duplicados, exclusión de secretos, RUN/dominio, categorías y cantidad.
Integración HTTP/SQL: accesos directos, permisos de lectura/sede, origen, actor de
vista previa, revocación de cuenta y permiso con sesión abierta, caducidad,
confirmación concurrente, 2.656 unidades, conflicto posterior con rollback,
funcionarios sin cuentas, vínculos y registros propios sin crear actas.
Migración: comparar por SHA256 las 57 tablas del esquema 41, incluidas fotos,
PDFs, asignaciones e historial, y revertir el ensayo mediante ROLLBACK.
Las planillas reales se inspeccionan solo en lectura; nunca son fixtures de CI.

Antes de desplegar: árbol limpio, respaldar y verificar restauración, detener web,
actualizar código, ejecutar migración 42 y construir/recrear web con APP_REVISION.
Revisar salud, instalación y acceso con un perfil autorizado antes de cargar datos.
No se debe reenviar un archivo hasta revisar la vista previa y sus exclusiones.

Reversión de aplicación: volver a la revisión anterior y reconstruir web dejando
la tabla/historial nuevos intactos. No ejecutar down ni borrar cargas. Si fuera
necesario revertir datos importados, detener escrituras y restaurar el respaldo
verificado previo, considerando todas las operaciones posteriores al respaldo;
ensayarlo primero en una base aislada. No hay borrado masivo automático de bienes,
funcionarios o vínculos, porque podrían tener uso e historial posterior.
