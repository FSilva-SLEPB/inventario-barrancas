# Estados integrados y flujo de actas

## Dónde se utilizan

UTIC abre Ver desde la columna Acciones de Inventario NC/P02, Celulares o Bodega TI. El mismo panel **Estados del activo** aparece en los registros de equipos y celulares. La condición también usa un selector compartido en la edición de información.

| Administrativo | Condición | Comportamiento |
| --- | --- | --- |
| Activo | Operativo, Bodega de TI, Mantención, Mal estado u Obsoleto | Ambos selectores habilitados |
| Robado / No encontrado | Vacía | Condición bloqueada; callback de seguridad simulado |
| Dado de baja | Obsoleto | Registro histórico completo de solo lectura |

Las altas exigen elegir una de las cinco condiciones; no se propone Operativo por defecto. Un registro anterior conserva Sin verificar, En reparación o Fuera de servicio hasta que se clasifique. Esos valores anteriores no se ofrecen como opciones nuevas.

## Guardado real

- Cambiar el administrativo guarda la transición en servidor. Durante la solicitud los controles se bloquean. Solo tras confirmarse la escritura se presenta el histórico de baja; un error conserva el estado anterior y permite corregir o reintentar.
- Para cambiar únicamente la condición, seleccionar y usar Guardar cambios. El éxito usa la confirmación visual compartida.
- Volver de Robado/No encontrado a Activo deja la condición vacía, habilitada y pendiente de selección; no inventa la condición anterior. Sin condición no se permiten salidas.
- Seleccionar Obsoleto mientras el administrativo sigue Activo no da de baja automáticamente.
- La base exige UTIC, versión vigente, solicitud idempotente y conserva actor, instante e instantáneas antes/después. Un reintento idéntico no crea otra transición.
- La baja bloquea también la edición general y los movimientos invocados directamente, no solo sus controles de pantalla. No hay reactivación desde este flujo.
- El teléfono de un celular dado de baja se conserva como antecedente y puede utilizarse en su reemplazo. El registro original sigue siendo histórico e inmutable; no se cambia su vigencia para liberar el número. Los filtros de vigentes excluyen las bajas y las consultas de históricos las incluyen.

Préstamos abiertos mantienen la restricción existente de editar estados: primero se registra su devolución vinculada. No se cierran préstamos por cambiar fechas o por estar vencidos.

El callback `ejecutarProtocoloSeguridad(activoId)` sigue siendo una simulación local. No genera denuncias, mensajes ni incidentes reales. Los reportes/validaciones/recuperaciones del módulo Robos conservan su flujo y sus bloqueos; el selector no los valida ni los cierra, y un incidente abierto impide volver a Activo.

## Custodia y salidas

Administrativo, condición y custodia son datos distintos. Elegir Bodega de TI en condición no registra una devolución ni cambia la pertenencia del bien. Para eso se utiliza Devolver a Bodega TI.

- Robado, No encontrado y Dado de baja impiden movimientos nuevos.
- Mantención, Mal estado, Obsoleto y los valores anteriores En reparación/Fuera de servicio impiden entregar, prestar y traspasar.
- Un bien averiado asignado puede devolverse a Bodega TI conservando su condición, o devolverse dentro de un cambio de equipamiento. Los reemplazos deben ser aptos para salir.
- Los ingresos antiguos Sin verificar conservan la compatibilidad de los movimientos anteriores; no se convierten en Operativo ni se acredita por ello disponibilidad técnica. Su clasificación y el criterio de stock libre de los dashboards son trabajos posteriores.

## Actas

1. La operación empieza desde el bien en Inventario o Bodega TI.
2. Se seleccionan destino y participantes. Los datos conocidos se precargan; lo que falta se revisa sin inventar nombres o RUN.
3. Confirmar guarda operación, historial, folio, datos del acta y PDF en una transacción. Si falla la composición o el guardado del PDF, se revierte la operación completa.
4. El acta queda disponible para Ver, Imprimir, Descargar PDF y Enviar por correo, y se consulta desde Movimientos y actas o el registro del bien.
5. Los documentos nuevos capturan condición y administrativo del momento de la operación, tanto para equipos como celulares. Cambiar después un estado no cambia folio, participantes, emisor ni bytes de un PDF emitido.

Cambiar un estado no emite por sí solo un acta de baja patrimonial ni acredita una operación contable. Ese documento formal requiere su proceso específico.

En desarrollo no se envían correos reales. Las pruebas de correo existentes usan SMTP local aislado; el buzón institucional de ensayo autorizado sigue siendo `correoprueba@slepb.gob.cl`. El transporte institucional aún requiere configuración en CentOS.

## Verificación

La batería incorpora regresión de permisos, tres reglas, cinco condiciones, concurrencia, reintentos, baja terminal, reutilización de teléfono, incidentes, préstamos, salidas y devolución de averiados. Se emiten PDFs por HTTP y se comparan bytes/SHA después de modificar estados y archivar el bien.

La recuperación incluye un equipo dado de baja, un celular Robado y sus transiciones con datos anteriores Sin verificar, además de los documentos/préstamos/traspasos de la batería existente.

La instalación en CentOS es una etapa posterior: respaldo verificado, migración 20, imagen compilada y revisión de instalación. Fusionar el PR no acredita que esté instalado.
