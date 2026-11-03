# Fichas de funcionarios de Nivel Central

Primera parte del módulo NC: registrar datos administrativos de la persona y
conservar su historial. Se mantiene separada de usuarios/perfiles, directores de
EE/JISC, habilitación de cuentas y asignaciones de equipos.

## Flujo disponible

Mantenedores → Funcionarios de Nivel Central permite buscar, ver ficha, editar y
marcar activo/inactivo. Solo Administrador del sistema y Administrador de gestión
pueden consultar o guardar esta información. Encargados y perfiles de consulta
no acceden a las fichas por menú, URL o reutilización de acciones.

El nombre es obligatorio. RUN, correo institucional existente, unidad,
subdirección, cargo y fecha de ingreso prevista o real son opcionales. No se
inventan contactos o identificadores para completar una ficha. Los RUN informados
se normalizan y validan; la fecha puede ser futura porque admite un ingreso previsto.

RUN y correo, cuando están informados, son únicos también en fichas inactivas.
Si una dirección se reutiliza para otra persona, se revisa la ficha anterior y se
corrige su contacto con motivo; el historial conserva los datos previos. Un nombre
repetido no se considera por sí solo una identidad duplicada.

Cada ficha tiene UUID y versión. El guardado controla cambios concurrentes;
repetir un alta con el mismo identificador y datos no crea otra persona ni otro
historial. El cambio de vigencia conserva la ficha. Cada cambio real registra
actor, fecha, motivo y valores anteriores/posteriores.

La tabla abre la ficha de lectura; la acción de editar está dentro de ella.
Los filtros se conservan al abrir, editar y volver. La tabla muestra 50 filas por
página. La ficha conserva todo su historial; se muestran los 50 eventos recientes.

## Persistencia y permisos

La migración `1794009600000_funcionarios-nivel-central` crea `funcionarios_nc` y
`funcionarios_nc_historial`. La segunda referencia al funcionario mediante FK.
La escritura de la cuenta web se limita a una función SQL con autorización,
validación, bloqueo, control de versión e historial dentro de la misma transacción.
No tiene INSERT/UPDATE/DELETE directo sobre las tablas.

El módulo no crea cuentas de Google/Microsoft, no concede acceso al inventario,
no guarda contraseñas o PIN y no ejecuta asignaciones ni actas. Las claves extra
no admitidas se rechazan. La vigencia de la ficha y la autorización del usuario
se gestionan de forma independiente.

## Próxima parte del flujo NC

Falta concretar el checklist de habilitación y las reglas de propuestas de
cuenta/homónimos, datos sensibles, documentos y firmas. Las asignaciones,
devoluciones, reasignaciones y reparación se implementarán como operaciones
propias vinculadas al equipo y al UUID del funcionario; no se simulan cambiando
un texto de esta ficha.

## Pruebas

Validación de RUN, correo, fechas y campos; permisos de consulta/escritura;
duplicados; idempotencia; versiones concurrentes; historial; filtros y vigencia;
acciones HTTP reales; rechazo de campos no admitidos y revocación de un administrador.
El modelo de datos se regenera desde una base con las diez migraciones.
