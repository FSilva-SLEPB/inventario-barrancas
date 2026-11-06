# Validación de cambios y traspasos — 6 de noviembre de 2026

Evidencia local sobre PostgreSQL temporal, cuentas ficticias y servidor compilado. No se utilizó CentOS ni correo institucional para estas pruebas.

| Comprobación | Resultado local |
| --- | --- |
| ESLint, TypeScript y compilación Next.js | Aprobados |
| Pruebas unitarias | 135 aprobadas |
| Suite HTTP/SQL/PDF completa | 612 escenarios aprobados; incluye 50 nuevos de operaciones compuestas |
| Navegador real | Cuatro operaciones: equipo EE→JI directo, celular JI→EE directo, cambio de equipos NC y cambio de celulares JI |
| Actualización 18→19 y repetición | Cinco actas/PDF y dos préstamos previos conservados |
| Respaldo y recuperación | Cifrado con claves temporales, rechazo de clave incorrecta/datos alterados y restauración aislada con traspaso, detalle y acta compartida no vacíos |
| PDF extenso | 100 devueltos + 100 reemplazos, 14 páginas, 200 identificadores, ambos grupos, logo y numeración comprobados |

Las regresiones cubren permisos UTIC, rechazo de directos hacia/desde NC, versiones, concurrencia, reintentos, fallo de PDF sin cambios parciales, bloqueo de préstamos y celulares archivados, consulta del acta desde cada bien, impresión/descarga y conservación de originales. El navegador comprobó además selección entre páginas, Buscar/Limpiar y Mostrar 50/100/150 compartidos, conservación de filtros y selección ante error, participantes precargados, teclado, móvil y envío únicamente mediante SMTP ficticio.

La revisión QA independiente detectó y cerró defectos en la recuperación de participantes de actas compuestas/directas, validación del receptor NC en servidor, conservación de filtros al fallar y selección del funcionario por correo. La precarga exige un correo no vacío con coincidencia única; no resuelve homónimos por nombre.

## Alcance y seguimiento

La matriz exploratoria de QA contiene escenarios adicionales; este informe no afirma que todos hayan sido ejecutados. La recuperación comprueba una operación de traspaso directa no vacía; el cambio N:M se prueba en SQL/HTTP/navegador y PDF, sin una restauración específica de ese cambio.

Queda como mejora de rendimiento paginar la búsqueda de candidatos en el servidor: la ventana actualmente recibe los candidatos autorizados y pagina su selección en el cliente. No hay una medición de carga sobre el volumen definitivo.

Las comprobaciones remotas de GitHub corresponden al commit del PR. Aprobar o fusionar el PR no acredita su instalación en CentOS. No se certifica la seguridad completa del host ni se realiza una prueba de penetración externa con este bloque.
