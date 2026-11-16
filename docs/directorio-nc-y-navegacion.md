# Directorio interno de Nivel Central y navegación

## Directorio

`Directorio → Funcionarios de Nivel Central` es una consulta paginada de fichas activas: miniatura, nombre, subdirección, unidad, cargo y correo. No muestra RUN, fecha de ingreso, estado contractual, motivos ni historial personal, y no permite editar. Las fichas se administran en Mantenedores.

El nuevo permiso configurable es `directorio_nc.consultar`. El permiso no basta: SQL y servidor exigen cuenta autorizada vigente y pertenencia interna. Se admite UTIC de alcance global (tipos protegidos Sistema/UTIC) o cuenta de alcance propio explícitamente vinculada a una ficha activa de funcionarios NC con el mismo correo institucional. No se deduce pertenencia por nombre, dominio del correo, IP ni alcance global. Auditor, Enlaces EE, directores, jardines y Gestor de insumos no reciben acceso por esos perfiles. Otras cuentas de NC sin ficha vinculada requieren revisión del Administrador; no se reasignan automáticamente.

La migración 44 habilita el nuevo permiso en Sistema y en los perfiles predeterminados completos Gestor TIC/Funcionario. Conserva las reducciones ya configuradas. Los perfiles personalizados requieren asignación explícita del permiso y la misma comprobación de pertenencia. El permiso sigue siendo modificable por el Administrador, incluso al renombrar un perfil. La revocación se comprueba en cada petición; la interfaz mantiene su refresco de permisos de hasta 60 segundos.

Las fotos del directorio usan una API privada distinta de la ficha: solo la última fotografía de personas activas, sin lectura de versiones anteriores. Se conserva la carga exclusiva de UTIC, sus originales, versiones e idempotencia. El directorio no amplía el acceso al endpoint de fotografías personales ni al mantenedor.

## Navegación y registros

Inventario agrupa los accesos autorizados en Equipamiento, Bodega TI, Entregas/devoluciones/préstamos e Incidentes. Las operaciones se siguen iniciando desde el bien. Los accesos de números/QR salen del menú repetido y quedan en el listado de equipos, agrupados en Numeración y etiquetas; la selección y confirmación siguen en sus pantallas. Las acciones superiores se agrupan en Ingresar bienes y Descargar. Los desplegables son nativos, utilizables con teclado y en el flujo de la página, sin tapar tablas.

Se elimina del menú rutinario Vínculos de inventario personal. Su ruta anterior conserva la guarda y los datos para compatibilidad; no se borran antecedentes ni se exige una regularización general. El historial de asignaciones y movimientos reúne vínculos vigentes y anteriores con fecha, responsable, motivo y acta cuando existe. Consultar esos vínculos exige en SQL `movimientos.consultar`, `funcionarios.consultar` y alcance global; no habilita préstamos al Auditor. El nombre mostrado proviene de la ficha vinculada actual; no se inventa una identidad histórica que no fue conservada.

Se corrige el vínculo automático de todos los bienes entregados a un funcionario NC en operaciones compuestas. Requiere seleccionar una ficha válida, se guarda en la transacción del movimiento y PDF, y no se duplica al reintentar. Un receptor manual no identifica una cuenta y no genera vínculo por coincidencia de nombre. Las entregas individuales conservan su implementación existente.

Se retira el rótulo redundante Gestión de inventario. La sesión usa tipografía legible y rótulo de perfil comprensible, sin modificar perfiles anteriores. La fotografía personal queda compacta (máximo 18 rem de ancho y 15 rem de alto), conservando proporciones y original; el ajuste no cambia la fotografía de establecimientos.

El motivo inicial de funcionarios y celulares se establece en servidor como Registro inicial, sin pedirlo en pantalla; la edición mantiene el motivo obligatorio. Equipos ya distinguía creación de edición. No se eliminan motivos de decisiones administrativas, incidentes, permisos o correcciones auditadas.

## Desplegables y cargas pendientes

[Inventario completo de 82 controles y listas fijas](desplegables-del-sistema.md), regenerable con `node scripts/listar-desplegables.mjs`. Registra archivo, control, opciones estáticas y expresión que obtiene los datos dinámicos. Subdirección, unidad y cargo de la ficha de funcionarios son texto libre actualmente, no catálogos incompletos.

`scripts/consultar-catalogos.mjs` usa una transacción de solo lectura para obtener categorías, sedes, dependencias, bodegas, productos/categorías de insumos y estructura activa de funcionarios de la instalación indicada por DATABASE_URL. Su salida contiene estructura interna y no se versiona. Las opciones finales de una pantalla también dependen de los permisos, alcance y estado del bien; este informe no certifica valores reales de producción.

Los tres Excel entregados previamente no se importan automáticamente con esta versión. La importación real sigue requiriendo vista previa contra los catálogos existentes y confirmación de las filas aptas en el servidor. No se incorporan archivos con datos personales al repositorio ni se eligen duplicados históricos por suposición.

## Validación y despliegue

- Compilación y 186 pruebas unitarias.
- 34 suites HTTP/SQL: URL/API, campos mínimos, lectura de fotos ajenas dentro del directorio autorizado, rechazo de EE/Auditor/perfiles globales personalizados, escritura denegada, fotos históricas ocultas y revocación con la misma cookie.
- Operaciones compuestas de equipos/celulares hacia NC: vínculo automático, reintento y rollback del vínculo cuando falla PDF.
- Ensayo transaccional de migración desde esquema 43: SHA256 de 59 tablas previas conservado, salvo versiones de acceso; perfiles reducidos sin ampliación. El ensayo revierte sus cambios.
- Chromium en 1440, 768 y 390 px: directorio, miniaturas, ficha, agrupación y descargas. Sin desborde exterior de la página; tablas con desplazamiento interior.

Antes de desplegar: conservar configuración, detener web, respaldar PostgreSQL y comprobar restauración; actualizar código; ejecutar migraciones y reconstruir web. Mantener 127.0.0.1:3000 y verificar salud/revisión. Confirmar el directorio con cuentas NC y rechazo de EE/JI antes de dar por instalada la función.

Reversión: detener web. Si solo se necesita retirar la función, deshabilitar su permiso desde Sistema conservando los registros. Para regresar al esquema anterior, restaurar el respaldo verificado en una base aislada y comprobarlo antes del reemplazo coordinado; reconstruir la revisión anterior. No ejecutar down destructivo ni restaurar encima de datos nuevos sin conciliación. No se fusiona ni se despliega automáticamente.
