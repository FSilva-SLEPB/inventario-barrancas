# Solicitudes, reservas y entrega de insumos

Reglas acordadas con Felipe Silva, 29 de octubre de 2026, hora de Chile.
Complementa el [alcance del sistema](alcance-y-plan.md) y la
[matriz de perfiles](matriz-perfiles.md).

**Estado: diseño funcional acordado; módulo pendiente de implementación.**
No se han importado datos de las planillas ni modificado existencias.

## 1. Alcance y fuente revisada

La primera versión atenderá solicitudes de establecimientos educacionales y
jardines infantiles desde la bodega de TIC. Las solicitudes individuales de
Nivel Central quedan para una ampliación posterior.

Se revisó `INV_EE.EE_V1.2.xlsx`, compartido como material de EE/JI:

| Hoja | Interpretación |
| --- | --- |
| Catalogo_Insumos | Referencia de productos, categorías, unidad y estado activo; se observaron 46 códigos únicos |
| Stock_Insumos | Representa los insumos de la bodega de TIC, según confirmación del usuario |
| Solicitudes_Insumos | Referencia histórica de solicitudes, sus productos, entregas y actas |
| Copia | Copia auxiliar para prorrateo; el usuario confirmó que no es relevante para la importación |
| Resumen y demás hojas | Se revisarán dentro de los módulos correspondientes; no equivalen a stock de insumos |

`Solicitud de Insumos (1).xlsx` fue un envío equivocado y queda excluido como
fuente de datos. El archivo `INV_P02_v01 (3).xlsx` se mantiene como referencia
separada del inventario de equipos, sin incorporarlo a las existencias de insumos.

La referencia a una ubicación de bodega en Nivel Central no convierte sus
existencias en inventario de equipos de Nivel Central. Destino y custodia física
son conceptos separados, como se acordó en el alcance.

## 2. Flujo acordado

1. El EE/JI arma un carrito con los insumos y cantidades que considera necesarios.
   La solicitud queda vinculada a su sede y a la cuenta que la envía.
2. TI revisa cada producto y determina su cantidad aprobada según la necesidad
   y la disponibilidad. Toda reducción o rechazo deberá dejar un motivo.
3. Al aprobar, se reservan las cantidades autorizadas para esa solicitud.
4. TI prepara y realiza **una única entrega**, por todas las cantidades aprobadas.
5. Al confirmar la entrega, se registra el receptor, el responsable TI, la fecha
   y el acta vinculada; se descuenta la existencia física y se consume la reserva.
6. La solicitud queda cerrada por entrega. Las cantidades no aprobadas no generan
   compromisos ni saldos pendientes automáticos.

**No se admiten entregas parciales de una misma solicitud ni varias entregas
usando la misma acta.** Cada solicitud entregada tendrá su entrega y su propia
acta. Si la sede necesita después otras unidades, generará una nueva solicitud.
El acta reflejará lo efectivamente entregado.

## 3. Cantidades y motivos

Se conservarán por producto las cantidades solicitada, aprobada y entregada.
La cantidad solicitada original no se sobrescribirá para ocultar una reducción.

Ejemplo acordado:

| Concepto | Cantidad de mouse |
| --- | ---: |
| Solicitada por la sede | 20 |
| Aprobada por TI con disponibilidad de 10 | 10 |
| Entregada y registrada en el acta | 10 |

Motivo de ejemplo: "Se aprueban y entregan 10 unidades por disponibilidad de stock".
Las otras 10 no quedan pendientes en esa solicitud.

La regla al confirmar es **cantidad entregada = cantidad aprobada** para todos
los productos aprobados. Antes de la entrega, lo aprobado es una reserva, no una
salida física ya ocurrida.

Si TI había aprobado 20 pero debe entregar 10, revisará la aprobación antes de
confirmar: conservará la aprobación anterior en el historial, justificará la
reducción y ajustará la reserva. No se registrará una entrega parcial de 10
dejando 10 pendientes bajo la aprobación anterior.

## 4. Existencia, reserva y disponibilidad

- **Existencia física:** cantidad que permanece en bodega.
- **Reservado:** cantidad aprobada y comprometida en solicitudes no entregadas
  ni canceladas.
- **Disponible:** existencia física menos las reservas vigentes.

Ejemplo: con 30 mouse en bodega, aprobar 20 deja 30 de existencia, 20 reservados
y 10 disponibles. Confirmar la entrega deja 10 de existencia, libera por consumo
la reserva de 20 y mantiene 10 disponibles.

Si se cancela antes de entregar, la existencia sigue en 30 y se libera la reserva,
dejando 30 disponibles. Una cancelación no es una salida ni un ingreso ficticio.

La aprobación deberá comprobar y reservar disponibilidad de forma atómica,
incluso ante dos revisiones simultáneas. No se aprobarán las mismas unidades para
dos sedes. La confirmación de entrega y la cancelación serán mutuamente
excluyentes y no podrán descontar o liberar dos veces por un doble clic/reintento.

Si cambia una cantidad aprobada, la disponibilidad y la reserva se deberán
revalidar juntas. Una operación fallida conservará el estado anterior íntegro.
No se crearán ingresos ficticios ni se permitirán salidas negativas para forzar
una entrega. Las diferencias de conteo se resolverán mediante un procedimiento
de ajuste que deberá definirse y quedar trazado.

## 5. Cancelación e historial

TI podrá cancelar una solicitud aprobada antes de su entrega, registrando motivo,
responsable y fecha. La cancelación liberará la reserva y conservará la solicitud
y sus antecedentes. No se borrará el registro.

El historial identificará:

- Quién solicitó, cuándo, para qué sede y las cantidades originales.
- Quién aprobó, cuándo, las cantidades autorizadas y motivos de reducción/rechazo.
- Las reservas, sus ajustes y sus liberaciones o consumos.
- Quién entregó, el receptor, las cantidades, la fecha y el acta.
- Quién canceló, cuándo y por qué.

Una entrega confirmada no se anulará como si nunca hubiese ocurrido ni liberará
otra vez la reserva ya consumida. La devolución o rectificación posterior deberá
tener su propio procedimiento y evidencia, pendiente de definición.

Los permisos deberán distinguir solicitar desde la sede de aprobar, entregar y
cancelar desde TI, conforme a la matriz acordada. El solicitante no podrá aprobar
su propia petición por tener acceso al carrito. El alcance de auditoría respetará
los permisos sobre documentos y datos personales.

## 6. Precauciones de migración

La hoja de stock incluye varias filas para un mismo código y filas con entregas
sin ingresos registrados que producen saldos negativos. No se asumirán como
duplicados ni se sumarán como existencias independientes sin conciliarlas.
Felipe confirmó que la hoja está actualizada y representa el stock de bodega TIC.
La carga inicial tomará los saldos disponibles revisados por producto, sin volver
a sumar los ingresos ni descontar las entregas anteriores. La conciliación de
filas repetidas o negativas seguirá siendo necesaria antes de importar.

### Antecedentes históricos sin stock previo

Según aclaración de Felipe, existen entregas registradas sin stock previo y sin
información de quién las solicitó o a quién se entregaron. Se conservarán **solo
como antecedentes históricos**, separados de las operaciones nuevas del sistema.

- Se mantendrán producto, cantidad y demás datos que realmente existan, junto
  con su procedencia (archivo, hoja y fila) para permitir su revisión.
- Solicitante y destinatario desconocidos quedarán sin identificar. No se
  deducirán de otros registros ni se inventarán sedes, personas o fechas.
- La observación será: "Entrega registrada sin stock previo y sin información
  del solicitante o destinatario".
- No generarán solicitudes, aprobaciones, reservas ni actas retroactivas.
- No volverán a descontar stock ni se cargarán como existencias negativas
  disponibles. Tampoco se crearán ingresos ficticios para compensarlos.
- Un saldo negativo histórico no prueba que el saldo físico actual sea cero.
  Si no hay un saldo actual válido para ese producto, quedará pendiente de
  confirmar antes de habilitar su disponibilidad.

Los switches y puntos de acceso entregados como insumos conservarán ese
tratamiento histórico, según confirmación de Felipe. No se convertirán
automáticamente en equipos del inventario ni se crearán registros duplicados.
El seguimiento individual de futuras compras se definirá por separado.

Las solicitudes históricas incluyen identificadores anteriores al catálogo y
algunas unidades vacías. Se preparará una correspondencia revisable, sin asignar
productos por aproximación silenciosa. Metro/Metros, caja, kit y unidad requieren
normalización; no se convertirán cajas a unidades sin una equivalencia acordada.

Los formatos antiguos no deben imponer estados o entregas parciales a la nueva
operación. Se conservará la procedencia de los antecedentes históricos y se
definirá su tratamiento antes de cargar datos. No se cargarán a la vez saldos
iniciales e ingresos/entregas históricos que vuelvan a contar la misma existencia.
No se copiarán los archivos originales ni sus datos personales al repositorio.

## 7. Pendientes antes de implementar

- Definir el procedimiento de conciliación, carga inicial y ajustes de stock.
- Confirmar unidades fraccionables, cantidades mínimas y equivalencias de envase.
- Definir numeración, contenido y mecanismo de firma/custodia de las actas.
- Precisar la edición o retiro de solicitudes antes de aprobarlas y la
  cancelación solicitada por la sede; la cancelación de TI ya está acordada.
- Definir devolución y corrección después de una entrega confirmada.
- Definir si una reserva tendrá vencimiento. No se acordó liberación automática.
- Implementar y probar el transporte de correo antes de considerar activos los avisos.

Los nombres técnicos de estados y su interfaz se propondrán al diseñar el módulo;
las transiciones deberán respetar las reglas anteriores.
