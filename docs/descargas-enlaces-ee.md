# Descarga del inventario de Enlaces EE

Corrección solicitada por Felipe: Enlaces EE debe descargar el inventario de su
única sede, incluidos sus celulares asignados. No concede otras sedes, Nivel
Central, edición de celulares ni facultades administrativas.

La migración 40 amplía el límite de Enlaces EE con equipos/celulares exportar y
descargar. Habilita ambos en el perfil predefinido completo; respeta una reducción
previa realizada por el Administrador. En ese caso, el Administrador puede activar
las nuevas acciones desde Perfiles y permisos. No reasigna usuarios ni transforma
los perfiles anteriores o de jardines por semejanza de nombre. Audita antes y
después y actualiza la revisión del perfil para las sesiones abiertas.

Descargar permite obtener el inventario PDF. Las planillas CSV requieren Exportar
y Descargar. La interfaz y el servidor aplican los mismos permisos; no se exige
Exportar para el PDF. Los botones se ubican junto a Volver a Inventario, Consolidado
de robos y Registrar equipo; el componente compartido conserva los filtros y se
ajusta en varias líneas. También aparece en la barra superior de celulares.

Las planillas generales respetan el alcance de la cuenta. Forzar sede, tipo o
ámbito no amplía datos. En celulares, los perfiles de sede solo descargan equipos
asignados a su sede, también al pedir vista todos; la intersección con pendientes
queda vacía. Se mantiene el control de permisos antes de responder y la revocación
con la sesión abierta, CSV seguro y respuesta privada sin caché.

El formulario denomina el campo **Tipo de perfil** y explica que define sus límites
de seguridad; el tipo existente no cambia al renombrar. **Perfil activo** es su
estado habilitado/desactivado. Mensajes separados para límites predefinidos,
facultades UTIC y cambio de tipo. El rótulo Modo solo lectura se calcula con las
acciones efectivas, evitando marcar como lector a Enlaces por su rol anterior de
compatibilidad.

Ensayo: pruebas de permisos de sede, cambio de identificador, CSV general/filtrado,
PDF sin Exportar, revocación con la misma sesión, celulares asignados y límites
UTIC. Migración transaccional en copia39: 51 tablas idénticas por SHA256 y perfiles
reducidos conservados; se ejecuta también en CI. Chromium en 1440/900/390 px con
CSV descargado realmente y comprobación del formulario. Producción sin cambios.

Despliegue: respaldo y restauración comprobada, aplicar migración40 y compilar web.
Reversión: web anterior compatible con la ampliación SQL; no ejecutar down ni
borrar permisos/historial. Para restauración integral, conservar primero los
cambios posteriores al respaldo, ensayar restauración aislada y conciliar antes
de reabrir escrituras.
