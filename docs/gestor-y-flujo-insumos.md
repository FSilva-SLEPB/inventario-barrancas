# Gestor de insumos y solicitudes

Reglas confirmadas por Felipe el 11/11/2026. Misma presentación e interacción que
el resto del sistema: portadas y tarjetas compartidas, filtros Buscar/Limpiar,
resultados con Mostrar 50/100/150, acciones con iconos, ventanas compartidas y
confirmaciones de guardado. Las portadas ya no muestran «Gestión institucional».
Inicio reutiliza las mismas tarjetas; el catálogo del carrito conserva su
presentación de productos con fotos y usa filtros/resultados comunes.

## Perfil Gestor de insumos

Es un sexto perfil, separado de Administrador de gestión. Los dos administradores
pueden asignarlo, activarlo o desactivarlo desde **Mantenedores → Usuarios y perfiles**.
No requiere una sede; gestiona Insumos de todos los establecimientos, jardines y
Nivel Central. No se asigna a ninguna persona por suposición ni cambia cuentas existentes.

Puede crear y editar productos, registrar compras con código automático/OC/fecha,
consultar stock y compras, cargar fotos, crear solicitudes, validar, aprobar,
cancelar y confirmar entregas. Puede consultar, imprimir, descargar y enviar las
actas de insumos mediante los controles de correo existentes. No accede a otras
actas, usuarios, funcionarios, directorios ni inventarios de equipos/celulares,
Bodega TI, robos o préstamos. Los dos administradores mantienen sus permisos.
La autorización se comprueba también en servidor, SQL y peticiones directas.

El menú y su Inicio muestran Solicitudes de insumos y Mantenedores. Solicitudes
contiene Solicitud, Gestor de insumos (Seguimiento para consultas) e Historial. El catálogo aparece únicamente en
Mantenedores, también para el gestor: conserva su pantalla canónica y este perfil
no ve ni puede abrir los otros mantenedores. Esta corrección evita duplicar el acceso.
El Auditor y Consulta de establecimiento ven Seguimiento e Historial según su
alcance, sin enlace a crear solicitudes ni botones de aprobación o entrega.

## Validar, aprobar y entregar

1. El solicitante arma su carrito y envía. Queda **Solicitada**, sin reservar stock.
2. En **Gestor de insumos**, el gestor abre el icono **Validar**. Revisa sede,
   solicitante y productos; puede dejar una observación. **Pasar a aprobación**
   registra quién revisó y cambia a **En validación**.
3. El icono **Aprobar** permite revisar las cantidades solicitadas y disponibles.
   **Aprobar y reservar** descuenta disponibilidad mediante la reserva, sin restar
   todavía existencias. No permite aprobar más de lo solicitado o disponible;
   una reducción conserva su motivo.
4. El icono **Entregar** permite confirmar receptor, emisor, fecha y cantidades
   reales. El emisor se precarga desde la cuenta autenticada y puede revisarse.
   **Confirmar entrega y generar acta** guarda cantidades y PDF juntos.
5. La solicitud queda **Entregada**, pasa al Historial y conserva su acta para
   imprimir, descargar o enviar. Una entrega parcial cierra la solicitud y libera
   la reserva sobrante; no deja cantidades pendientes ocultas. Cancelar también
   libera las reservas y conserva el motivo.

Las compras agregan existencias; aprobar reserva; entregar consume únicamente la
cantidad efectivamente entregada. No se emite otra acta al imprimir ni reenviar.
Los errores conservan el formulario y las operaciones no se guardan parcialmente.
Los filtros y tamaño de página permanecen al volver de las ventanas y documentos.
Los envíos siguen en modo de prueba: no se habilita correo institucional real.

## Instalación

Requiere respaldo con restauración comprobada, migración 30
(`1795795200000_gestor-insumos`), compilación y arranque de web según la guía de
despliegue. Conserva datos, perfiles previos, folios y PDFs. Después de instalar,
un administrador debe asignar el perfil al correo institucional correspondiente;
no crea la cuenta de Google ni recibe una contraseña.

## Verificación

159 pruebas unitarias y doce escenarios nuevos SQL/HTTP/PDF/SMTP comprueban perfil,
delegación, compras, permisos directos, validación, reservas, entrega parcial,
documentos acotados, correo local y revocación. En navegador se comprobó el ciclo
completo desde dos perfiles, catálogo de 51 productos con paginación, carrito,
avisos, ventanas, menús y vista móvil. La actualización 29→30 conservó las huellas
de catorce tablas existentes; el respaldo restauró el perfil ficticio de prueba,
compras, existencias, reservas, fotos y documentos. No se cambió CentOS ni se
usaron cuentas reales o correos de establecimientos para los ensayos.

## Inicio de establecimientos y jardines

Los perfiles Encargado EE/JI y Consulta de establecimiento ven en Inicio la
identificación de su sede autorizada: nombre, RBD, tipo, comuna, dirección y correo
institucional. Los datos se leen del registro existente; no se selecciona otra sede
mediante URL ni se toma la primera sede global. Los faltantes dicen Sin informar.
Los perfiles globales conservan Inicio general, sin atribuirles una sede ficticia.

El atajo Sistema de tickets abre https://soporteti.slepb.gob.cl/ en otra pestaña,
sin enviar datos de la sede, credenciales ni sesión del inventario. Es un enlace al
servicio existente; no incorpora sincronización de tickets ni autenticación única.

Para habilitar a una persona como gestor: un administrador entra en Mantenedores
→ Usuarios y perfiles, registra o edita su cuenta institucional, elige Gestor de
insumos y guarda. El perfil no se asigna automáticamente a ninguna cuenta. Estos
ajustes de Inicio y navegación no agregan migraciones ni cambian perfiles existentes.

## Acceso visible al gestor

Los dos administradores y el perfil Gestor de insumos ven una tarjeta **Gestor de
insumos** en Inicio y una entrada con ese nombre dentro de Solicitudes de insumos.
Abre `/insumos/seguimiento`, cuya pantalla de gestión también muestra ese título.
Es el mismo flujo de validar, aprobar y entregar; no se duplica la operación.
Las cuentas sin facultades de gestión mantienen **Seguimiento de insumos**.
La gestión no requiere cambiar un perfil administrador a Gestor de insumos.

El título de la identificación local ahora es **Datos del establecimiento**, con
[espacio para fotografía persistente](fotografias-establecimientos.md).
