# Revisión de QA y seguridad — 5 de noviembre de 2026

Se revisó la base funcional del PR #50 (`034df6f`) y la actualización de correo
restringido/préstamos. Participó un agente QA separado del implementador, solicitado
por Felipe. No es una certificación ni una auditoría externa del servidor instalado.

## Resultado y evidencia

No se confirmó una vulnerabilidad nueva de prioridad alta en los componentes
revisados. Permanecen riesgos conocidos y comprobaciones del host pendientes.
Las pruebas usan únicamente datos ficticios, cookies de ensayo y SMTP local TLS;
no se accedió a CentOS ni se enviaron correos institucionales desde desarrollo.

| Responsable y comprobación | Resultado |
| --- | --- |
| Agente QA: autenticación, permisos y validación de sedes, movimientos y actas | 55 pruebas unitarias aprobadas |
| Agente QA: revisión posterior del correo restringido | 11 pruebas aprobadas, solapadas con el conjunto anterior |
| Agente QA: validación de préstamos | 5 pruebas aprobadas |
| Agente QA: dependencias web de ejecución y paquete de migraciones | 0 avisos reportados en esas consultas |
| Agente QA: web incluyendo desarrollo | 10 paquetes afectados directa o indirectamente, moderados; 0 altos/críticos |
| Implementador: conjunto unitario completo | 125 pruebas aprobadas |
| Implementador: suite HTTP, servidor compilado, SQL y SMTP local | 560 comprobaciones aprobadas; 42 específicas de préstamos |
| Implementador: navegador Chromium con equipos/celulares y NC/EE/JI | 4 préstamos y 4 retornos, ocho PDFs, iconos, filtros, validación, teclado, móvil e impresión |
| Implementador: actualización 14→18 y repetición | Datos, entregas, custodia, PDFs, folios e idempotencia anteriores conservados |
| Implementador: recuperación con préstamos abiertos/cerrados | Cifrado, rechazo de claves/archivos alterados y restauración aislada aprobados |

Los conjuntos se solapan y **no se suman como casos únicos**. Los logs técnicos de
los ensayos se conservan en el espacio privado de trabajo. La revisión independiente
alcanzó análisis estático y pruebas unitarias; el agente QA agotó su cuota de sesión.
Las comprobaciones web, SQL, navegador y recuperación fueron completadas por el
implementador, sin atribuirlas a una ejecución independiente.

## Controles comprobados

- Google exige correo verificado, dominio institucional y `sub`. La autorización
  y vigencia se consultan por petición; el formulario no decide perfil o sede.
- Préstamos, movimientos y actas requieren UTIC en servidor y funciones SQL.
  Los perfiles locales no reciben datos de prestatarios de otras sedes en HTML/RSC,
  detalles o PDF. Cambiar IDs o filtros no amplía el alcance.
- Escrituras por funciones limitadas, campos enumerados, versiones, bloqueos y
  solicitudes idempotentes. Índices evitan préstamos activos duplicados.
- Salida y retorno requieren estado y fechas coherentes. El retorno referencia el
  préstamo exacto. Las carreras y el reenvío de una devolución vieja no cierran
  otro préstamo. Se bloquean edición/archivo/regularización incompatibles.
- Movimiento, préstamo y PDF se confirman juntos. Fallos del PDF revierten también
  custodia, historial y folio. Originales y participantes quedan conservados.
- Modo de correo prueba por defecto, cerrado sin configuración válida. Lista
  exacta validada antes de auditoría y transporte; rechazo de destinatarios ajenos,
  mezcla con uno ajeno o modo desconocido. Sin CC/BCC derivados del acta.
- SMTP con TLS y certificado válido; adjunto conservado, sin acceso a archivos o
  URLs de Nodemailer. El ensayo se identifica como `[PRUEBA]`.
- PDF privado sin almacenamiento en caché. Datos de usuario escapados; rutas de
  retorno locales permitidas y rechazo de origen cruzado en Server Actions.
- Compose compilado con loopback, usuario sin privilegios, raíz de solo lectura,
  capacidades retiradas y `no-new-privileges`; su efectividad en CentOS sigue pendiente.

Durante el desarrollo QA detectó dos errores de la migración nueva: una columna
inexistente en un UPDATE de equipos y un CHECK que admitía una fecha de cierre nula.
Se corrigieron antes de publicar y se aplicó/probó la migración final. Son defectos
de implementación corregidos, no incidentes demostrados en producción.

## Riesgos y tareas pendientes

| Prioridad | Riesgo o tarea | Tratamiento |
| --- | --- | --- |
| Media | Autorización ligada al correo, sin vínculo persistente al `sub` de Google | Desactivar acceso antes de reutilizar cuentas Workspace; evaluar vínculo persistente en la siguiente etapa de identidad. |
| Media | Rol SQL compartido con lectura amplia, sin aislamiento de lectura por fila | Mantener PostgreSQL privado; las consultas web deben conservar filtros de autorización. No se reprodujo inyección SQL ni extracción de credenciales. |
| Media, desarrollo | Aviso minimatch [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), propagado por herramientas de desarrollo | Evaluar actualización compatible del árbol de ESLint y repetir verificaciones; no usar `audit fix --force`. Los diez paquetes no son diez fallos HTTP independientes. |
| Por verificar en host | HTTPS/proxy, cookies Secure, OAuth real, puertos, firewall, SELinux, secretos y parches | Requiere evidencia de CentOS; no se aprueba con pruebas locales. |
| Por configurar | SMTP institucional y remitente no responder | Solo CentOS, destinatario autorizado único `correoprueba@slepb.gob.cl`. Aceptación SMTP no acredita lectura ni llegada final. |
| Por verificar tras instalar | Recuperación programada y uso real del flujo | Nuevo respaldo verificado, migración 18, imagen compilada, salud y recorrido UTIC. |

No se habilita correo de producción general ni se modifica la instalación desde
este entorno. El corte debe acompañarse del resultado de CI del commit del PR y
de la evidencia de instalación cuando se ejecute en CentOS.
