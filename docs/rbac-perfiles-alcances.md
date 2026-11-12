# Perfiles, permisos y alcances

Implementación de ensayo de la definición aprobada por Felipe. No constituye una instalación en producción. La fuente del catálogo es `web/src/lib/rbac-definicion.json`; las migraciones incorporan su instantánea para poder ejecutarse sin el código web.

Cada cuenta conserva una identidad institucional y un solo perfil. El alcance se asigna por separado: global, una sede o registros propios. Un perfil desactivado conserva sus usuarios y todo el historial; deniega la siguiente petición autenticada. No exige reasignarlos antes. La interfaz comprueba su revisión cada 60 segundos y al recuperar el foco; las autorizaciones del servidor no esperan ese refresco. Una petición ya confirmada antes de revocar conserva su resultado e historial.

La clase protegida y los límites no dependen del nombre visible. Solo Sistema administra perfiles y cuentas administrativas. GT administra usuarios operativos dentro de sus propias facultades; no modifica su propia cuenta ni cuentas administrativas, incluso si el perfil de destino está desactivado. Los perfiles personalizados no permiten eludir estas restricciones. Los perfiles predefinidos tienen un máximo de permisos conforme a su definición; se pueden reducir y restituir hasta ese máximo.

El último Sistema activo no puede perder su acceso por edición de cuenta o desactivación de perfil. Las operaciones administrativas comparten un bloqueo transaccional y vuelven a comprobar la autorización. Cambios de cuenta/perfil incluyen versión, solicitud idempotente, motivo y valores anteriores/posteriores.

## Decisiones cerradas

| Tema | Comportamiento aprobado | Efecto |
|---|---|---|
| Celulares locales | Consulta y reportes de incidentes | No registrar, corregir ni retirar celulares |
| Jardines | Encargado operativo separado de Directora J.I. | El encargado solicita insumos; la directora no accede a insumos |
| Auditor e insumos | Seguimiento e historial global de lectura | Sin aprobar, entregar, cancelar ni enviar actas |
| Director EE | Seguimiento e historial de su sede | Sin modificaciones |
| Funcionario y directorio | RBD, nombre, tipo, comuna, dirección y correo institucional | Sin RUT, teléfono o correo personal del director |
| Correcciones propias | Solicitud y resolución por Sistema o GT autorizado | Solicitar no modifica la ficha |
| Perfiles anteriores | Conservar cuentas, rol, sede e historial | Asignación nueva únicamente explícita |
| Desactivar perfil | Bloquear la siguiente petición; conservar asignaciones | Reasignación posterior manual |

Ejemplos: Enlaces ve marca, modelo, número institucional, IMEI, inventario y estado del celular asignado; reporta daño o robo mediante el flujo TI, sin editar la ficha. El directorio autorizado muestra “RBD 12345, Escuela Ejemplo, establecimiento, comuna, dirección, escuela@example.org”; no muestra el RUN ni el móvil de su director.

## Funciones nuevas y existentes

Se conservan los flujos de inventario, movimientos, documentos, préstamos e insumos. Son nuevos: administración de perfiles/permisos, cuentas con alcance explícito, portal propio, vínculo explícito de asignaciones con funcionarios, solicitudes de corrección y descargas CSV/PDF de equipos, celulares, asignaciones propias y directorio autorizado. Las exportaciones aplican el alcance antes de generar el archivo; CSV escapa fórmulas para Excel. No se ofrece un permiso para una exportación de incidentes que aún no existe.

Consultar/descargar un PDF no puede impedir que su destinatario imprima o conserve los bytes localmente. Las acciones de impresión/descarga del sistema sí se autorizan en servidor. Permitir actas de préstamos al Auditor no concede el módulo de préstamos ni sus datos operativos.

## Implementación y validación

1. Restaurar el respaldo de la versión anterior en ensayo. Aplicar migraciones 34–37 y repetirlas sin efectos adicionales. Comparar filas e instantáneas previas; nunca reclasificar datos anteriores por suposición.
2. Revisar cuentas anteriores, sin reasignación automática. Crear/asignar los nuevos perfiles explícitamente, empezando por una cuenta Sistema verificada y una cuenta ficticia por perfil.
3. Probar URL, API, acciones de servidor y funciones SQL usando la conexión de aplicación; negar escrituras de lectores, ID ajenos, documentos y exportaciones fuera de alcance. Probar GT contra cuentas/clases administrativas, nombres modificados, perfiles personalizados y último Sistema.
4. Probar con la misma cookie la retirada de registrar, el refresco por foco y la desactivación. Comprobar que un Funcionario no cambia su ficha al pedir corrección ni ve otra persona. Auditor consulta/imprime/descarga actas y no accede a préstamos.
5. Revisar navegación, iconos, modales, formularios y descargas en navegador. Ejecutar regresión y CI sobre el commit exacto antes de proponer despliegue.

Las consultas de aplicación agregan predicados de alcance; las escrituras SQL y funciones personales/documentales vuelven a autorizar. La conexión compartida `inventario_app` mantiene SELECT técnico sobre tablas: esto no es RLS por usuario PostgreSQL ni protege frente a quien obtenga esa credencial. Los usuarios finales no reciben credenciales de base de datos.

Las asignaciones históricas de Nivel Central se vinculan manualmente desde Mantenedores, con evidencia, versión y motivo. No se infiere identidad por coincidencia de nombres; el portal permanece sin equipos hasta que existan vínculos confirmados. Nuevas asignaciones confirmadas con funcionario conservan ese vínculo en la misma transacción.

## Despliegue y reversión

Producción queda pendiente de una instrucción posterior. Antes: árbol limpio, revisión exacta, resguardo privado de configuración, detener web, respaldo PostgreSQL y restauración comprobada. Aplicar migraciones, compilar con APP_REVISION, levantar y comprobar salud y revisión efectiva. Verificar con cuentas reales de cada perfil sin modificar sus datos durante la comprobación.

Reversión preferida: detener web y restaurar íntegramente el respaldo anterior junto con la revisión/configuración anterior. No ejecutar un down que borre auditorías, perfiles o vínculos creados desde el despliegue. Si ya hubo operaciones nuevas, conservar primero una copia de esa base y reconciliar sus transacciones antes de restaurar; nunca prometer una reversión sin pérdida mediante una aplicación antigua que ignore permisos RBAC. No arrancar la versión anterior sobre cuentas RBAC nuevas: sus roles de compatibilidad no sustituyen el control de acceso dinámico.

Pendientes operativos: revisar las asignaciones reales persona-equipo y los usuarios anteriores; transporte institucional de correo y origen HTTPS definitivo siguen fuera de este cambio. No se enviaron correos reales ni se modificó producción.

## Matriz inicial por recurso

C=consultar; R=registrar; E=editar; A=aprobar; F=confirmar; X=exportar; I=imprimir; D=descargar; V=enviar; M=administrar. Cada permiso se puede deshabilitar respetando los límites anteriores. Un guion deniega acceso.

| Recurso | Administrador del sistema | Gestor Administrador Unidad TIC | Encargado de Enlaces EE | Encargado operativo de jardín | Director de EE | Directora J.I. | Auditor | Funcionario | Gestor de insumos |
|---|---|---|---|---|---|---|---|---|---|
| Alcance | global | global | sede | sede | sede | sede | global | propios | global |
| Inventario de equipos | C R E X D | C R E X D | C R E | C R E | C | C | C X D | — | — |
| Inventario de celulares | C R E X D | C R E X D | C | C | C | C | C X D | — | — |
| Bodega TI | C F | C F | — | — | — | — | — | — | — |
| Movimientos | C F | C F | — | — | — | — | — | — | — |
| Prestamos | C F | C F | — | — | — | — | — | — | — |
| Actas | C R I D V | C R I D V | — | — | — | — | C I D | — | — |
| Actas de insumos | C R I D V | C R I D V | — | — | — | — | C I D | — | C R I D V |
| Robos e incidentes | C R E A | C R E A | C R E | C R E | C | C | C | — | — |
| Estados administrativos y bajas | C F | C F | — | — | — | — | — | — | — |
| Solicitudes insumos | C R | C R | C R | C R | — | — | — | — | C R |
| Seguimiento insumos | C A F | C A F | C | C | C | — | C | — | C A F |
| Historial insumos | C | C | C | C | C | — | C | — | C |
| Catalogo insumos | C R E | C R E | — | — | — | — | — | — | C R E |
| Compras insumos | C R | C R | — | — | — | — | — | — | C R |
| Stock insumos | C R | C R | — | — | — | — | — | — | C R |
| Dependencias | C R E | C R E | C R E | C R E | — | — | — | — | — |
| Funcionarios | C R E | C R E | — | — | — | — | — | — | — |
| Directorio institucional | C R E | C R E | — | — | — | — | — | — | — |
| Directorio personas | C R E | C R E | — | — | — | — | — | — | — |
| Categorias | C R E | C R E | C | C | C | C | C | — | — |
| Sedes | C R E | C R E | C | C | C | C | C | — | — |
| Fotos sedes | C E | C E | C | C | C | C | C | — | — |
| Usuarios operativos | C M | C M | — | — | — | — | — | — | — |
| Cuentas administrativas | C M | — | — | — | — | — | — | — | — |
| Perfiles | C M | — | — | — | — | — | — | — | — |
| Mis datos personales | C | — | — | — | — | — | — | C | — |
| Mi equipamiento | C D | — | — | — | — | — | — | C D | — |
| Correcciones de datos personales | C R A | C R A | — | — | — | — | — | C R | — |
| Directorio autorizado | C D | — | — | — | — | — | — | C D | — |

## Evidencia de ensayo del cambio

- Migraciones 34–37 aplicadas sobre restauración del esquema 33; repetición sin migraciones pendientes.
- Huellas iguales de las 46 tablas anteriores comparando todas sus columnas previas, incluidos bytes de archivos; las columnas nuevas de usuarios comienzan sin asignación.
- 161 pruebas unitarias y las 28 suites SQL/HTTP completas aprobadas. La suite RBAC incorpora 14 escenarios con múltiples aserciones de permisos, sesiones, alcance, documentos, correcciones y concurrencia.
- Navegador Chromium: renombrar un perfil, retirar registrar, refrescar una sesión abierta por foco, denegar URL directa, desactivar sin reasignar y consultar auditoría.
- Respaldo del esquema nuevo restaurado en un contenedor independiente y verificado con `--datos-ci`.
- Compilación correcta; ESLint sin errores. Quedan advertencias previas sobre imágenes HTML y navegación de Insumos.

La integración real de Google y los perfiles de las personas existentes deben verificarse en el servidor al desplegar. Las pruebas de ensayo usan identidades ficticias y un transporte SMTP local aislado.
