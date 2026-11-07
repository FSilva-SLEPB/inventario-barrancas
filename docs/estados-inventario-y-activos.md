# Estados del inventario y activos

La última especificación de Felipe para el componente React es:

| Selector | Valores |
| --- | --- |
| Estado de condición | Operativo; Bodega de TI; Mantención; Mal estado; Obsoleto |
| Estado administrativo | Activo; Robado; No encontrado; Dado de baja |

1. Robado y No encontrado: condición vacía y bloqueada, con callback simulado `ejecutarProtocoloSeguridad(activoId)`.
2. Dado de baja: condición Obsoleto y formulario completo de solo lectura como histórico.
3. Activo: ambos selectores habilitados.

El [componente reutilizable](componente-estados-activo.md) implementa estas reglas de interfaz. Su [integración operativa](estados-integrados-y-flujo-actas.md) guarda estados mediante acciones UTIC y la migración 20. No sustituye la validación y recuperación de incidentes reales.

## Datos anteriores

- **Sin verificar** fue el valor inicial de Funcionamiento del sistema. Se conserva pendiente de clasificación, sin convertirlo automáticamente en Operativo.
- **Fuera de servicio (sin baja formal)** no permite distinguir por sí solo Mal estado de Obsoleto. Se conserva ese antecedente al revisarlo.
- **Inactivo** ya no lo utiliza Felipe. Antes era aproximadamente para dejar un equipo guardado; se retira de opciones nuevas. Las filas antiguas se conservan para revisión, sin deducir una baja o una bodega.
- **Pendiente de inventario** de la planilla no se añade a los dos catálogos actuales porque la última lista explícita no lo incluye. Tampoco equivale a Sin verificar.
- **Activo** no acredita funcionamiento físico, incorporación contable ni depreciación.
- **Equipo Robado** en una planilla conserva un antecedente; la validación del incidente real requiere seguimiento y permisos.
- **En Bodega del SLEP** no identifica por sí solo el piso, BOX o Bicentenario.

No se reinterpretan retroactivamente las cargas efectuadas ni se sustituyen PDFs emitidos. Archivar una ficha de celular conserva su propósito actual y es distinto de una baja patrimonial.

Al integrar el componente se conservarán versiones, permisos, historial y la diferencia entre estado de interfaz, ubicación física, custodia y pertenencia. La definición de los dos dashboards y cinco ubicaciones compartidas está en [Dashboards y bodegas](definicion-dashboards-y-bodegas.md).
