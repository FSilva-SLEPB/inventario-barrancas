# Avance para jefatura — 5 de noviembre de 2026

**Inventario 2.0 EE y TI · SLEP Barrancas · Unidad de Tecnologías de la Información y Comunicaciones**

El sistema centraliza el inventario, directorios y trazabilidad de entregas y
devoluciones. Este corte distingue lo instalado de los cambios preparados y de
los procesos que todavía requieren desarrollo. No reemplaza el informe histórico
del 2 de noviembre.

## Estado comprobado

| Situación | Evidencia y alcance |
| --- | --- |
| Última versión instalada informada por Felipe | PR #50, `034df6f`, en CentOS; web compilada, PostgreSQL saludable y API de salud HTTP 200 según la evidencia compartida. |
| Protección previa a esa instalación | Respaldo del 5/11 verificado por restauración aislada, antes del PR #50. No se afirma que incluya operaciones posteriores. |
| Nueva actualización preparada | Préstamos temporales desde Bodega TI, devolución vinculada, correo restringido de prueba y revisión de QA/seguridad. Requiere migración 18 e instalación; no se declara desplegada. |
| Modelo de la actualización preparada | 27 tablas totales: 26 de negocio y 1 de control de migraciones; 37 relaciones por clave foránea. Generado de las migraciones, sin exportar registros personales. |

## Capacidades operativas

- Inventario de equipos de Nivel Central y establecimientos/JISC; registro y
  entrega, datos técnicos, historial, búsqueda y cargas controladas.
- Inventario dedicado de celulares: un número por equipo. Dos por sede es la
  referencia habitual; se permiten excepciones y también equipos de Nivel Central.
- Bodega TI como estado común. UTIC confirma asignación y devolución desde el bien;
  las ubicaciones físicas de las distintas bodegas se definirán posteriormente.
- Directorio agrupado en cuatro consultas: establecimientos, directores/as EE,
  jardines/salas cuna y directoras JI/SC. Datos institucionales separados de personas.
- Funcionarios de Nivel Central con contacto, unidad y subdirección, separados de
  las cuentas que autorizan acceso al sistema.
- Actas generadas con logo oficial, folio común desde cero, participantes y bienes,
  condiciones y firmas basados en los modelos entregados. Impresión, PDF conservado
  e infraestructura de envío por correo; no se acredita firma con la emisión.
- Acciones con iconos, filtros, paginación 50/100/150, ventanas y confirmaciones
  compartidas. Los permisos se vuelven a validar en servidor y base de datos.
- Reporte y trazabilidad de robos/recuperaciones con permisos, sin agregar otro
  tablero como requisito operativo.

## Actualización de este corte

Los préstamos salen solo desde Bodega TI, con fecha límite y confirmación UTIC.
Conservan la sede de pertenencia del bien y registran por separado su destino
temporal. La devolución identifica el préstamo original y vuelve a Bodega TI.
El vencimiento informa el atraso; no cambia automáticamente la custodia.

Cada salida y retorno genera su propia acta. Un reintento no duplica documentos
y un fallo del PDF revierte toda la operación y su folio. Las actas ya emitidas
conservan sus bytes y participantes aunque después cambien los directorios.

El correo se mantiene en **modo prueba**, cerrado sin configuración válida y con
lista exacta. El único buzón institucional autorizado es `correoprueba@slepb.gob.cl`.
Su transporte se configurará en CentOS; no se enviaron correos institucionales
desde desarrollo ni se usaron destinatarios reales de establecimientos.

## Calidad y seguridad

Se ejecutaron 125 pruebas unitarias y 562 comprobaciones HTTP en la aplicación
compilada con datos ficticios, incluidas 44 de préstamos. Chromium comprobó cuatro
salidas y cuatro retornos de equipos/celulares entre NC, EE y JI, ocho PDFs,
impresión, precargas, validaciones, filtros, teclado y móvil. Se comprobó la
actualización repetible desde una base anterior y la recuperación cifrada con
préstamos abiertos/cerrados. Los conjuntos se solapan; no se suman como casos únicos.

Un agente QA separado revisó código, dependencias y validaciones. No confirmó
vulnerabilidades nuevas de prioridad alta en lo revisado. Su ejecución fue estática
y unitaria; las pruebas SQL/web/navegador/recuperación las completó el implementador.
El agente agotó su cuota de sesión y no se atribuye revisión independiente completa.
La auditoría documenta diez paquetes de desarrollo afectados por un aviso moderado,
la identidad ligada al correo y el rol SQL compartido como asuntos de seguimiento.
No equivale a certificación ni inspección del host CentOS.

## Pendientes y siguiente instalación

1. Revisar CI y fusionar el PR de este corte; preparar respaldo verificado reciente,
   migrar, reconstruir la imagen compilada y comprobar salud y flujo real en CentOS.
2. Configurar remitente no responder y SMTP solo en CentOS; ensayar únicamente al
   buzón autorizado, con PDF y auditoría del resultado. Aceptación SMTP no prueba lectura.
3. Verificar HTTPS/proxy, cookies seguras, OAuth real, firewall/SELinux, secretos,
   parches y recuperación programada en el servidor.
4. Definir ubicaciones físicas de bodegas y siguientes procesos: cambios/traspasos
   compuestos, insumos, bajas, habilitación y solicitudes. Su aparición en modelos
   Word o en menús anteriores no acredita un flujo completo implementado.

## Material técnico

- [Modelo entidad relación y catálogo de tablas](modelo-entidad-relacion.md).
- [Diagrama SVG exportable de este corte](jefatura/2026-11-05/modelo-entidad-relacion.svg).
- [Préstamos y devolución vinculada](prestamos-inventario.md).
- [Revisión de QA y seguridad](auditoria-seguridad-2026-11-05.md).
- [Operación y mantenimiento](operacion-y-mantenimiento.md).

El diagrama SVG excluye `pgmigrations`, muestra 26 tablas de negocio y 37 relaciones.
La documentación técnica sigue fuera de Mantenedores, en `/documentacion/modelo-datos`
para administradores. Las cantidades de datos usadas en los ensayos son ficticias
y no se presentan como indicadores de uso del servicio.
