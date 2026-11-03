# Dashboard de robos

La página `/inventario/robos/dashboard` consulta incidentes y equipos afectados con
los mismos perfiles y alcance de sede del consolidado. Permite filtrar inventario,
sede, comuna, estado, identificación y fechas del incidente. El período inicial
comprende doce meses, hasta la fecha actual de Chile. Un rango inválido se informa
sin ejecutar el resumen; la exportación rechaza ese rango con HTTP 400.

## Cantidades y gráficos

- Las tarjetas de estado cuentan equipos distintos. Un equipo con incidentes
  históricos diferentes puede aparecer en más de un estado; las tarjetas no se suman.
- El total de equipos usa identificadores distintos en todo el conjunto filtrado,
  no la suma de agrupaciones. Incidentes usa identificadores de incidentes distintos.
- Los reportes rechazados se incluyen en el total de registros filtrados, pero
  nunca se presentan como robos validados.
- Los gráficos por sede, comuna y categoría cambian entre validado sin recuperar,
  pendiente de validación y recuperado. Muestran hasta diez grupos con cantidades
  positivas; la tabla y CSV contienen el resumen completo por sede.
- El gráfico temporal cuenta incidentes por su fecha declarada. No es una serie de
  fechas de recuperación. Usa meses para períodos de hasta 24 meses y años para
  rangos mayores; los períodos sin incidentes muestran cero.
- Una sola consulta con una instantánea PostgreSQL produce tarjetas y grupos.
  No se mezclan resultados obtenidos antes y después de un cambio concurrente.

Cada sede se agrupa por UUID, aunque existan nombres históricos distintos. El nombre
y RBD corresponden al incidente con fecha más reciente dentro del filtro; a igual
fecha, se utiliza el último registro. Las comunas son las de los incidentes filtrados.
Los nombres y categorías de los antecedentes históricos no se reemplazan en la base.

## Exportación y acceso

`/inventario/robos/dashboard/exportar` consulta nuevamente permiso y datos; devuelve
un CSV UTF-8 con BOM y separador punto y coma, apto para revisión en una planilla.
Contiene agregados por sede y un total global calculado por PostgreSQL. Las celdas
que podrían iniciar fórmulas se protegen como texto. La respuesta no se almacena en
caché y no incluye lugar, descripción, denuncia, actor ni datos personales.

Los perfiles locales conservan su única sede aunque se manipulen los parámetros
Inventario o sede. Una cuenta revocada no puede descargar una exportación nueva.
Consulta general puede ver agregados; los antecedentes restringidos de los
incidentes mantienen sus permisos anteriores. No hay un mapa geográfico ni una
valoración monetaria inventada.

Los valores y gráficos corresponden a la consulta y filtros indicados. No son
estadísticas oficiales certificadas; se debe informar el período y la fecha de consulta.

## Verificación

Pruebas de filtros, calendario y seguridad CSV; integración HTTP con repetición
histórica del mismo equipo, perfiles globales y de sede, revocación, filtros,
privacidad y protección ante fórmulas. Revisión de navegador con datos ficticios,
indicadores interactivos, descarga, vista móvil y movimiento reducido.
