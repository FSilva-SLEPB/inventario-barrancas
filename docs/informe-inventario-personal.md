# Informe de Mi inventario asignado

La descarga de esta pantalla es un informe de consulta de los bienes vinculados
expresamente a la ficha personal. Las actas de entrega siguen siendo documentos
emitidos por UTIC y conservados por el flujo de movimientos; este cambio no las
modifica ni genera nuevas asignaciones.

Se retira CSV exclusivamente de Mi inventario asignado, también de su endpoint.
Las planillas de inventarios generales, directorios y Gestor de insumos conservan
sus permisos y formatos anteriores. La descarga personal permite únicamente PDF,
sin parámetros para elegir otra persona o sede.

Sin bienes vinculados no se ofrece el botón PDF. Una petición directa devuelve
409 con explicación para que UTIC revise los vínculos previos, evitando descargar
un documento vacío. No se deducen asignaciones por nombre ni se incorporan bienes
ajenos para llenar el informe. Con datos se exige consultar y descargar; retirar
el permiso de descarga oculta el botón y bloquea la petición.

El PDF utiliza logo y tipografía institucional, fecha en America/Santiago, correo
autenticado, datos propios del titular cuando tiene mis_datos.consultar, total de
bienes, tabla con estados legibles, encabezados repetidos y número de página.
Preserva series/inventarios y ceros iniciales; pagina filas y textos largos sin
recortar datos. La API mantiene consulta de registros propios, comprobación final
de revisión de acceso, respuesta privada y no-store. No guarda archivos en public
ni cambia documentos existentes. Se incluyen fuentes/logo en la imagen compilada.

Verificación: PDF vacío rechazado, CSV personal retirado, datos propios frente a
otra persona, botón condicionado a bienes/permisos, logo y paginación. Ejemplos
ficticios de dos y 80 bienes renderizados y revisados; los 80 identificadores se
conservan, con encabezado y pie en todas sus páginas. Sin migraciones ni cambios
en producción durante el desarrollo. La reversión consiste en volver a la imagen
anterior, conservando íntegra la base de datos.
