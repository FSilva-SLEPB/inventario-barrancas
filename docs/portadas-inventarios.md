# Portadas separadas para Nivel Central y P02

La portada anterior seguía agrupando ambos inventarios bajo Equipamiento, con un
único ingreso genérico. PR81 separó el ingreso Excel P02, pero no modificó esa
portada. Esta entrega hace visible la separación en la navegación.

- **Inventario** ofrece dos tarjetas principales: Nivel Central y P02. Los perfiles
  de sede solo ven su entrada P02. El resto de procesos autorizados se agrupa
  debajo en desplegables; entregas, devoluciones y préstamos permanecen juntos.
- El menú lateral abre `/inventario/nivel-central/inicio` o
  `/inventario/p02/inicio`. Cada portada ofrece consulta, registro e importación
  del contexto correcto, según los permisos efectivos. El menú conserva marcado
  el inventario al pasar al listado o abrir el registro.
- Nivel Central registra desde `/inventario/nivel-central/registro`, sin selector
  P02; solo se ofrecen sedes NC. Su Excel abre
  `/inventario/nivel-central/importar` y mantiene la preparación NC y los vínculos
  por RUN y serie completa. No modifica la numeración NC ni crea asignaciones por
  introducir un nombre o un RUN en un registro de equipo.
- P02 conserva su registro, Excel y numeración automática instalados por PR81. Sus
  accesos están en su portada propia; ya no se entra al Excel NC desde la portada
  general para encontrar después el enlace P02.
- Los listados conservan `/inventario/nivel-central` y `/inventario/p02`, con todos
  sus filtros, fichas, exportaciones y enlaces anteriores. El regreso del listado
  lleva a su portada; guardar/cancelar un registro conserva el origen autorizado.
- Los marcadores anteriores al registro e importación genéricos siguen siendo
  compatibles; los accesos nuevos utilizan las rutas propias.

Se reutilizan PortadaModulo, AccesosModulo, MenuAcciones, ModalFicha y
FormularioEquipo. No se crean dos bases de datos, no se reclasifican bienes ni se
amplían permisos. La configuración diferenciada del contenido QR y el rediseño de
entregas por lotes siguen siendo trabajos distintos; los enlaces a etiquetas
abren el flujo existente prefiltrado por inventario.

## Comprobación y despliegue

`tests/portadas-inventario-http.mjs` comprueba portadas, formularios sin mezcla de
sedes, POST real de registro NC con regreso a su portada, lectura, aislamiento de
Enlaces por URL, navegación activa y revocación con sesión abierta. Se incluye en
las suites sobre servidor e imagen de producción. Las pruebas existentes conservan
la comprobación de filtros, modales, permisos y numeración/importación P02.

Esta entrega **no requiere una migración nueva**; requiere la base con PR81
(migración 45). Respaldar y comprobar la restauración antes del despliegue conforme
al procedimiento habitual. Compilar la imagen con la revisión aprobada y comprobar
salud e instalación. No importa planillas reales ni envía correos.

Para revertir esta interfaz se puede volver a la imagen anterior de PR81 manteniendo
la base y los datos. Los listados previos permanecen compatibles. No ejecutar down
ni restaurar la base para revertir una portada. No fusionar ni desplegar automáticamente.
