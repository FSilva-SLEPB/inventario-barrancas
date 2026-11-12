# Flujo de sede y validación de incidentes

Inicio muestra datos y fotografía en dos columnas del mismo recuadro, apiladas en móvil. Solo los dos administradores modifican la imagen desde Directorio → establecimiento/jardín → Ver registro. Se conservan originales y versiones anteriores.

Inventario abre una portada de opciones. Registrar equipo es un botón que abre el modal común; la carga masiva administrativa conserva acceso propio. La serie puede faltar si Observaciones explica por qué; el número de inventario es opcional. Los datos de adquisición/origen previos se conservan y no se solicitan en este formulario.

La sede solo consulta celulares asignados a su sede. Los cambios, archivo y alta requieren UTIC, también en SQL. Puede reportar robo, sustracción o daño de uno o varios equipos/celulares.

## Estados del reporte

1. Guardar borrador conserva fecha, selección y antecedentes sin cambiar bienes ni generar incidente histórico.
2. Sin número de parte, Enviar guarda borrador y explica el pendiente con la confirmación compartida. Para robo/sustracción, el envío requiere parte, denunciante y RUT válido.
3. Enviado a TI; si no hay archivos muestra Pendiente de informe. El informe puede adjuntarse después, incluso tras revisión, sin sustituir archivos anteriores.
4. Solo los administradores validan o rechazan con motivo. Validar cambia el estado a Robado (condición vacía), o a Mal estado/Activo para daños. Rechazar conserva los estados de bienes. No se produce baja ni transferencia.
5. TI revalida sede, custodia, estado y versión del bien. Si cambió, debe rechazar el reporte obsoleto con explicación y preparar otro con la ficha actual; no se fuerza la versión.

Cada operación y archivo tiene UUID de reintento y autor. Selección duplicada, doble envío, solicitud reutilizada con otros datos y otro reporte enviado del mismo bien se rechazan. Los identificadores se canonicalizan. Se excluyen incidentes históricos abiertos, conservando su recuperación y consulta anterior. La validación de robo de equipos crea el antecedente histórico y estados en una transacción; los incidentes anteriores no se reclasifican ni se reescriben.

## Adjuntos y acceso

PDF hasta 10 MB; JPG/PNG/WEBP hasta 5 MB. Cinco archivos/25 MB por reporte. Se comprueban cabecera de formato, sesión, origen y alcance por sede. Descarga como archivo, caché privada/no-store; consultas y gestor de insumos no leen los documentos ni modifican reportes. PostgreSQL conserva los bytes junto con los respaldos existentes; nada se escribe en public.

## Instalación

Migraciones 1795968000000_flujo-local-inventario y 1796054400000_reportes-incidentes-ti. Preparar respaldo verificado antes de migrar. No reescriben filas anteriores ni PDFs. Compilar la web y comprobar la revisión efectiva tras instalar. Los ensayos usan datos ficticios en una base aislada, sin correo real.
