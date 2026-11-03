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
- En listados, una acción Ver ficha. Dentro de la ficha se edita. Guardar cierra
  la edición y confirma el éxito; un error conserva los valores sin confirmar éxito.
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
