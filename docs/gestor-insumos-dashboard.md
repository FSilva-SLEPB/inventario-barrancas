# Gestor de insumos e informes

La opción independiente **Gestor de insumos** permite revisar solicitudes globales,
pendientes, validadas por TI, aprobadas listas para entregar y entregadas. Reutiliza
la validación, aprobación, reserva, entrega parcial y acta del flujo existente.
Validar no reserva stock: aprobar reserva; entregar descuenta existencia y libera
la reserva sobrante. Catálogo y compras permanecen únicamente en Mantenedores.

## Dashboard y consolidado

- Solicitudes ingresadas incluye canceladas; pendientes incluye solicitadas,
  en validación y aprobadas. Validadas pendientes y listas para entregar son
  subconjuntos, no métricas para sumar entre sí.
- Cantidades solicitadas excluyen cancelaciones. Aprobado incluye aprobadas y
  entregadas; entregado usa las unidades realmente entregadas.
- No sumar cajas y unidades. Los totales se separan por unidad de medida;
  los informes de productos conservan código, producto y unidad.
- Ranking de diez sedes por número de solicitudes no canceladas, con enlace al
  detalle. No compara cantidades de unidades de medida diferentes.
- Fecha seleccionable de solicitud o entrega, en America/Santiago. El primer
  criterio selecciona solicitudes ingresadas en el período y sus entregas;
  el segundo solo solicitudes entregadas en el período. Extremos inclusivos.
- Consolidado entregado por sede y producto, detalle de solicitudes, solicitudes
  por sede y cantidades por producto, con filtros y páginas de 50/100/150.
- Stock es global y actual, no histórico ni propiedad de una sede. Solo producto,
  categoría y búsqueda lo filtran. Existencia incluye reservado y disponible es
  existencia menos reservado. No se modifica por fechas o sede.

## Permisos y descargas

Nuevo recurso configurable `gestion_insumos`: consultar, exportar y descargar.
Requiere alcance global y la consulta del recurso de origen: seguimiento o stock.
Sin stock.consultar no muestra ni exporta existencias. Sin aprobar/confirmar no
habilita acciones operativas. Las comprobaciones se repiten en servidor y RPC SQL.
Los permisos de impresión/envío/descarga de actas siguen siendo independientes.
No concede dashboard ni exportaciones a Auditor/Director/Encargado por semejanza.

La migración 39 habilita el módulo en Sistema y en plantillas predefinidas completas
de Gestor TIC/Gestor de insumos, y en sus equivalentes anteriores. Si un Administrador
ya redujo un perfil operativo, conserva esa reducción: debe habilitar expresamente
los nuevos permisos desde Perfiles y permisos. No reasigna cuentas ni sedes.
Registra antes/después y actor SQL en `rbac_cambios_migracion`, visible en historial
de perfiles, sin inventar una identidad humana. Invalida las revisiones afectadas.

Planillas CSV compatibles con Excel (UTF-8 BOM, separador punto y coma, protección
contra fórmulas); PDF para informe. General omite criterios de búsqueda, conservando
el alcance autorizado; filtrada conserva los criterios. Máximo 10000 filas sin
truncado silencioso. Revocación comprobada nuevamente antes de responder y cabeceras
private/no-store. No incluye RUT ni contactos personales en informes de insumos.
Inventario permite planilla filtrada y general: general incluye todas las custodias
y vigencias, conserva el ámbito Nivel Central/P02 y aplica el alcance del usuario.
La planilla de inventario conserva las columnas del informe existente; no es la
plantilla de importación de 23 columnas ni exporta datos de director/a.

## Ensayo y despliegue

1. Ejecutar migraciones hasta 39 en base desechable y comprobar perfiles reducidos,
   usuarios previos y documentos intactos. Compilar y ejecutar pruebas SQL/HTTP,
   flujo real de aprobación/entrega/PDF, exportaciones, filtros y revocación.
2. Revisar escritorio y móvil con datos ficticios. Sin transporte institucional ni
   correos reales. CI repite con PostgreSQL 18 y la imagen de producción.
3. Entregar PR y resultados; producción se actualiza después, con respaldo cuya
   restauración haya sido verificada y ventana de mantenimiento.

## Reversión

No ejecutar down: conservar auditoría y asignaciones. Una reversión del frontend a
PR73 puede dejar la ampliación SQL instalada (nuevos permisos sin rutas antiguas).
Si se necesita volver toda la base a PR73, detener escrituras, respaldar el estado
actual y restaurar el respaldo previo en una base aislada; comprobar cuentas,
solicitudes, stock, documentos e historial antes de sustituir. Restaurar implica
perder escrituras posteriores al respaldo: conciliarlas antes de reabrir. Nunca
borrar solicitudes o PDFs para revertir una pantalla.

## Evidencia de ensayo

- Compilación Next y ESLint sin errores (avisos previos de imágenes persistentes).
- 164 pruebas unitarias; 30 suites de integración SQL/HTTP. El nuevo conjunto
  comprueba métricas, varias líneas por solicitud, unidades diferentes,
  consolidado, fechas de solicitud/entrega, stock independiente del período,
  CSV/PDF, fórmulas, acceso directo y revocación con la misma sesión.
- Flujo real desde la nueva bandeja: validar, aprobar, reservar, entrega parcial,
  PDF conservado y retorno con filtros; transporte SMTP local de ensayo.
- Chromium a 1440, 900 y 390 px: cinco páginas sin desborde exterior,
  filtro interactivo de fechas y descarga real del dashboard.
- Ensayo transaccional sobre copia en esquema 38: perfil reducido conservado,
  plantilla completa habilitada, cuentas sin reasignaciones y 48 tablas de datos
  e historial con SHA256 idéntico. Se ejecuta también en CI antes de migrar a 39.
- Respaldo de la base ficticia en esquema 39 y restauración en contenedor aislado.

Estas comprobaciones corresponden al entorno de ensayo; producción permanece
sin cambios y requiere su propia verificación después de desplegar.
