# Ubicaciones físicas de Bodega TI

Implementación preparada, pendiente de instalación en CentOS. Requiere la migración `1795622400000_ubicaciones-bodega-ti`; no modifica migraciones aplicadas.

En Bodega TI, el filtro **Ubicación física** distingue las cinco bodegas acordadas y **Sin ubicación confirmada**. La columna **Ubicación registrada** muestra el dato del bien. El icono Ubicar abre la misma ventana para equipos y celulares, con historial de las últimas 30 confirmaciones. Solo UTIC confirma cambios; guardar cierra y muestra la confirmación compartida, conservando filtros y paginación. Las fichas mantienen su historial autorizado por sede.

Se incluyen Primer Piso, Segundo Piso, BOX 3 y BOX 4 en dependencias de SLEP Barrancas y Bicentenario en el antiguo liceo, con la referencia indicada por Felipe. No se crean sedes ficticias ni se desactiva automáticamente el registro RBD 31288: esa regularización necesita revisar los datos instalados.

Ubicación, custodia, inventario, condición y administrativo son datos distintos. Confirmar una ubicación conserva la pertenencia y los estados. Bicentenario no produce una baja. Una confirmación de ubicación no acredita disponibilidad para asignar ni constituye un traspaso entre inventarios. Los dashboards siguen pendientes.

Los registros anteriores conservan ubicación desconocida. Se permite registrar una corrección como Sin ubicación confirmada, con autor, fecha y valores antes/después. No se distribuyen bienes masivamente entre pisos o BOX por suposición.

La base exige usuario UTIC vigente, versión actual y una solicitud idempotente. Repetir una solicitud idéntica no duplica cambios; una edición concurrente no sobrescribe la ubicación confirmada. Robado, No encontrado, Baja, préstamo o custodia fuera de bodega impiden confirmar una ubicación nueva. Un bien averiado que continúa en bodega puede trasladarse sin declararlo operativo.

Al asignar, prestar o regularizar una entrega se limpia la ubicación actual en la misma escritura de custodia. El antecedente queda en las instantáneas del movimiento; devolver requiere confirmar de nuevo la ubicación física. Se conservan las operaciones y PDFs anteriores. Cambiar de ubicación dentro de bodega no emite una asignación ni otro PDF.

El respaldo incluye catálogo, ubicaciones de los bienes e historial. La prueba de recuperación contiene un equipo en BOX 3 y un celular en Bicentenario que continúa Activo y Operativo, además de las guardas y permisos del rol limitado. Antes de instalar, crear y verificar el respaldo existente; después comprobar filtros, ventana, permisos, conservación de estados y salida/devolución con registros de ensayo controlados.

## Verificación de esta entrega

156 pruebas unitarias y 19 escenarios SQL/HTTP de bodegas aprobados, con el rol limitado. Chromium comprobó ambos tipos de bien, filtros, historial, rechazo de versión anterior sin perder valores, Bicentenario sin baja, móvil y teclado. La actualización desde las primeras 27 migraciones conserva registros, movimientos, entregas y PDFs anteriores. Respaldo y recuperación aislada aprobados con las ubicaciones de ensayo. Revisión estática independiente de QA sin P1/P2 pendientes; ninguna operación se ejecutó en CentOS.
