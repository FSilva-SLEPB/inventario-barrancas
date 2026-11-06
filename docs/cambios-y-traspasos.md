# Cambios y traspasos de inventario

Implementación para equipos y celulares. UTIC confirma las operaciones desde el bien en Inventario o Bodega TI. Movimientos y actas conserva la consulta de lo ejecutado.

## Cambio de equipamiento

1. En un bien asignado, elegir el icono **Cambiar equipamiento**.
2. Seleccionar los bienes que se devuelven y los que se entregan en reemplazo desde Bodega TI. Todos son equipos o todos son celulares; las cantidades pueden ser distintas. Se admiten hasta 100 por grupo.
3. Revisar la misma sede receptora, la fecha y los participantes precargados. En Nivel Central se selecciona funcionario o se completa otra persona. El lápiz permite corregir a quienes efectivamente participan; el emisor sigue siendo la cuenta autenticada.
4. Confirmar. Los devueltos quedan en Bodega TI, los reemplazos se asignan a la sede y se conserva una sola acta con ambas listas.

El cambio no da de baja ni archiva el equipo devuelto, no afirma que esté reparado y no intercambia números telefónicos entre celulares. Estado y accesorios se pueden describir por grupo; motivo y RUN no registrado siguen siendo opcionales.

## Traspaso entre sedes

- Si el origen o destino es **Nivel Central**, el bien debe estar en Bodega TI antes de traspasarlo. Desde un bien asignado de NC se utiliza primero la devolución común.
- Entre **establecimientos, jardines infantiles y salas cuna** se admite entrega directa, confirmada por UTIC. El historial registra esa ruta sin una devolución ficticia a bodega.
- Elegir el icono **Traspasar a otra sede**, seleccionar bienes de la misma procedencia y ruta, elegir otra sede activa y revisar receptor y entrega. Se admite un máximo de 100 bienes del mismo tipo por operación.
- Un préstamo activo debe devolverse mediante su préstamo exacto. Un robo abierto impide mover el equipo; un celular archivado no puede traspasarse.

## Documentos, consulta y controles

Una operación conserva un acta común que se consulta desde cualquiera de sus bienes o desde Movimientos. Imprimir, descargar PDF o reenviar utilizan los mismos bytes, folio, participantes y huella SHA-256 de la emisión. Los PDFs anteriores no se regeneran. El envío institucional sigue pendiente de definir transporte y remitente; no se habilita correo real con este cambio.

Bienes, historiales, cabecera, detalle, folio y PDF comparten transacción. Si cambia una versión o falla el PDF, no queda un movimiento parcial. Reintentar la misma solicitud no repite los movimientos ni consume otro folio; modificar una solicitud ya utilizada se rechaza. Los datos globales y las actas se consultan solo por UTIC en esta etapa.

Buscar/Limpiar, Mostrar 50/100/150, selección entre páginas, edición en ventana y confirmación de éxito reutilizan los componentes comunes. La migración `1794787200000_operaciones-compuestas-inventario` agrega cabecera y detalle y una tercera fuente exclusiva de acta. Se instala con el procedimiento habitual de respaldo comprobado, migración y nueva imagen compilada.

## Trabajos posteriores acordados

La carga/subida de inventario y el dashboard informativo de P02 se definirán después. Año, robos, tipo de compra, empresa y OC son los criterios iniciales del futuro tablero; aún falta acordar qué fecha representa el año y las métricas. Reparación, bajas formales y ubicaciones físicas de Bodega TI también requieren definición posterior.
