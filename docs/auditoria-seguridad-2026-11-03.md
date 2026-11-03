# Revisión de seguridad — 3 de noviembre de 2026 (UTC)

Revisión del código preparado sobre `main` del PR #39, con los nuevos módulos de
robos, funcionarios NC y producción. Se revisaron dependencias, autenticación,
autorización por sede, acciones de escritura, exportaciones, SQL y contenedores.
Todas las pruebas utilizaron PostgreSQL, personas y sesiones ficticias aisladas.
No se accedió a CentOS, a cuentas de Google reales ni a datos institucionales.

## Resultado y hallazgos

No se reprodujo acceso indebido ni ejecución de código mediante los casos
ensayados. Esto describe las pruebas realizadas; no garantiza ausencia de
vulnerabilidades ni constituye una certificación o una prueba externa completa.

| Hallazgo | Alcance y tratamiento |
| --- | --- |
| Dependencias de migraciones: `glob` y `minimatch`, severidad moderada | Avisos [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) y [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). Se fija `glob` 14.0.3 para `node-pg-migrate` en ambos paquetes, con su árbol actualizado. Se probaron las diez migraciones desde cero y su repetición. Los patrones de migración son locales del repositorio; no proceden de formularios web |
| Avisos moderados pendientes en herramientas de desarrollo | `npm audit` informa 15 paquetes afectados directa o indirectamente por `minimatch` en ESLint/plugins. No son 15 fallos independientes. No forman parte de las dependencias de ejecución web. Los patrones usados son del repositorio. Mantener seguimiento y evitar ejecutar herramientas sobre configuraciones no confiables; no se fuerzan cambios de API ni regresiones a versiones antiguas que propone el arreglo automático |
| Configuración de producción | Se prepara una imagen compilada sin credenciales de compilación, usuario no privilegiado, raíz de solo lectura, capacidades retiradas y publicación en loopback. Se ensayó localmente. La instalación actual de CentOS y su exposición real no fueron verificadas |
| Reutilización del correo institucional | El acceso se autoriza por correo verificado de Workspace y lista vigente. Si Workspace reasigna una dirección a otra persona, debe desactivarse/revisarse la autorización anterior antes de entregar esa cuenta. El `sub` de Google se conserva en la sesión, pero no está vinculado de forma persistente a la autorización. Queda como riesgo operativo y posible mejora de identidad |

Consulta de dependencias al realizar esta revisión:

| Consulta | Moderadas | Altas | Críticas |
| --- | ---: | ---: | ---: |
| Web, solo ejecución: `npm audit --omit=dev` | 0 | 0 | 0 |
| Paquete independiente de migraciones: `npm audit` | 0 | 0 | 0 |
| Web, incluyendo desarrollo: `npm audit` | 15 | 0 | 0 |

Los resultados dependen de la fecha y de los archivos de bloqueo. CI rechaza
avisos altos/críticos del paquete web y cualquier aviso moderado o mayor del
paquete de migraciones. No se utilizó `npm audit fix --force`. Los avisos de
compatibilidad del plugin React con ESLint 10 se mantienen identificados; lint
pasa, pero no equivalen a soporte declarado por todos los plugins.

## Controles comprobados

- Usuarios anónimos, cookies alteradas o caducadas y permisos revocados no
  acceden a las rutas privadas. Los roles enviados en una cookie de prueba no
  sustituyen el rol actual leído de PostgreSQL.
- Perfiles de EE/JI no leen ni escriben otras sedes mediante URL, filtros,
  identificadores o acciones reutilizadas. CSV del dashboard vuelve a comprobar
  el permiso actual; no incluye RUN, personas receptoras ni antecedentes privados.
- Una acción de edición enviada desde un Origin ajeno se rechaza sin cambiar
  datos. Google utiliza PKCE, state y nonce; el consentimiento real no se simuló.
- Texto almacenado como `<img src=x onerror=alert(1)>` se muestra escapado en la
  ficha; no se inserta como HTML. Una búsqueda con sintaxis SQL no amplía resultados.
  Se revisó el uso de parámetros en las consultas y el escape de identificadores
  obtenidos del catálogo PostgreSQL para el modelo.
- Se probaron cabeceras de protección, respuestas privadas sin caché y ausencia
  de `X-Powered-By`. CSV protege celdas que podrían interpretarse como fórmulas.
- La cuenta web no es superusuario, no crea roles/bases y no omite RLS. Las
  funciones SECURITY DEFINER del esquema público tienen search_path restringido
  y no conceden EXECUTE a PUBLIC. Las operaciones NC no permiten escritura
  directa ni borrado de su historial por la cuenta web.
- Versiones concurrentes con dos conexiones independientes, cargas atómicas,
  reintentos y rechazo de campos adicionales evitan sobrescrituras o duplicados.
- Salud publica solo un estado mínimo, sin diagnósticos ni datos. Configuración
  incompleta o conexión errónea producen HTTP 503; la base migrada produce 200.
- La imagen funciona como UID 1000 y rechaza escritura fuera de sus temporales.
  El ensayo de Compose conserva datos tras reiniciar PostgreSQL. El respaldo y
  su restauración incluyen funcionarios e historial con los permisos previstos.

`web/tests/seguridad-http.mjs` añade ocho comprobaciones reproducibles a la suite.
Se ejecutaron 96 pruebas unitarias y 283 comprobaciones HTTP, incluidas las de
seguridad, contra la imagen. También se revisó el navegador real en escritorio y
móvil con los nuevos módulos, sin errores de hidratación. CI vuelve a construir
y probar la imagen desde el commit del PR.

## Límites y pendientes antes de exposición institucional

1. Comprobar en CentOS: parches del sistema e imágenes base, puertos reales,
   firewall, SELinux, permisos de archivos privados, respaldo programado y
   recuperación. No se ejecutó un escáner de paquetes del sistema operativo.
2. Configurar y probar dominio, certificados, cadena TLS y proxy nginx. El archivo
   nginx es un ejemplo; no fue instalado ni probado con el dominio definitivo.
   Revisar HSTS cuando HTTPS esté operativo y estable.
3. Comprobar OAuth real, cookies Secure/SameSite, bajas de Workspace y sesión de
   cada perfil con el origen HTTPS definitivo. El proxy debe sobrescribir las
   cabeceras reenviadas y la web permanecer inaccesible desde interfaces públicas.
4. Revisar con la institución retención de datos e historiales, responsables,
   monitoreo y respuesta a incidentes. La auditoría de la aplicación no cubre
   cambios hechos por un administrador directamente en PostgreSQL.
5. La separación por sede se aplica en el servidor web; la cuenta SQL compartida
   puede leer tablas completas. La base debe permanecer privada y sus credenciales
   bajo custodia. Una filtración de esa cuenta exigiría contención y revisión;
   estas pruebas no constituyen aislamiento multiusuario mediante RLS.
6. Seguir las actualizaciones de las herramientas de desarrollo y evaluar CSP
   con nonces en una etapa propia, probando Next/Google y la interfaz. No se
   presenta la ausencia de CSP como prueba de XSS explotable.

Repetir la revisión ante cambios de autenticación, permisos, exportaciones o
nuevos módulos, además de mantener los avisos automáticos de dependencias.
