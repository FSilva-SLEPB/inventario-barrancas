# Acceso con Google Workspace

La web requiere sesión para ver los módulos y los catálogos, incluso en desarrollo.
Solo pueden entrar cuentas expresamente autorizadas en `public.usuarios_acceso`.
La migración inicial autoriza a `felipe.silva@slepb.gob.cl` como administrador.

| Rol | Consultar módulos y catálogos | Crear/editar/activar catálogos |
| --- | --- | --- |
| administrador | Sí | Sí |
| consulta | Sí | No |
| Sin autorización o cuenta inactiva | No | No |

La aplicación solo tiene SELECT en la tabla de accesos: los permisos se gestionan
por ahora mediante el administrador de PostgreSQL, no mediante formularios web.
El correo de Google debe estar verificado y el perfil debe declarar exactamente
`hd=slepb.gob.cl`. El parámetro visual `hd` no se usa como prueba de identidad.
NextAuth estable 4.24.15 verifica OIDC y utiliza PKCE, state, nonce y CSRF.
La identidad y los permisos enviados por el navegador no conceden acceso.
La sesión está cifrada en una cookie HttpOnly, SameSite=Lax, Secure con HTTPS,
con duración máxima de ocho horas. No se guardan tokens OAuth de Google.

Cada consulta/acción vuelve a comprobar el permiso vigente del usuario.
Desactivar una cuenta o cambiar su rol afecta la siguiente petición; no es
necesario esperar a que caduque la cookie. Una operación ya iniciada puede
terminar. Si la consulta de permisos falla, se rechaza el acceso.
La autorización se basa en el correo institucional: si Workspace reasigna ese
correo a otra persona, hay que retirar/revisar también su autorización aquí.

## Configuración de Google Cloud

Crear un cliente OAuth **Aplicación web**, separado del cliente de escritorio
de respaldos. Puede estar en un proyecto institucional aprobado, con audiencia
**Interno**. No cambiar ni reutilizar los tokens, claves o configuración de Drive.
Solo se solicitan `openid email profile`, sin permisos de Drive ni de correo.

Para desarrollo mediante el túnel SSH ya utilizado:

- Origen autorizado: `http://localhost:3000`.
- URI de redirección: `http://localhost:3000/api/auth/callback/google`.
- Abrir la web con ese mismo nombre (`localhost`), no con la IP privada de CentOS.

Google no admite una IP privada con HTTP como URI web de redirección ordinaria.
Cuando exista dominio definitivo, registrar su origen HTTPS y su callback
`https://DOMINIO/api/auth/callback/google`; ajustar NEXTAUTH_URL y recrear web.
Una IP pública fija no es un requisito para la prueba por localhost y SSH.

## Preparación en CentOS después de fusionar el PR

Desde `/home/slepb/inventario-barrancas`:

```bash
git switch main && git pull --ff-only origin main
bash scripts/preparar-acceso.sh
```

El script conserva las claves existentes y genera NEXTAUTH_SECRET aleatorio en
el `.env` privado. Añade nombres vacíos del cliente OAuth sin imprimir secretos.
Editar `.env` **en el servidor** con un editor local e ingresar:

- `GOOGLE_CLIENT_ID`: identificador del cliente web creado en Google Cloud.
- `GOOGLE_CLIENT_SECRET`: secreto de ese cliente.
- `NEXTAUTH_URL=http://localhost:3000` para el túnel local.

No pegar el secreto en el chat, Git, capturas ni comandos compartidos. No usar
prefijos NEXT_PUBLIC_. Mantener NEXTAUTH_SECRET estable entre reinicios; rotarlo
invalida las sesiones. Guardar una copia bajo custodia institucional, separada
de los respaldos cifrados. No confundirlo con las claves de cifrado de Drive.

Instalar las dependencias fijadas, aplicar la migración y recrear solo la web:

```bash
docker compose stop web &&
docker compose run --rm --no-deps web npm ci &&
docker compose run --build --rm migrar &&
docker compose up -d --wait web
```

La migración crea la lista de acceso y el administrador inicial. No modifica
los catálogos existentes ni los respaldos. Si migración o instalación falla,
resolverlo antes de continuar. No borrar el volumen de PostgreSQL.
Si faltan URL, secreto o cliente, la web muestra configuración pendiente y
rechaza el acceso; no existe un modo de desarrollo que omita la autenticación.
En despliegues HTTPS configurar TLS y origen canónico correctamente antes de
abrir acceso externo. No usar esta configuración de desarrollo como despliegue
productivo certificado.

## Administración inicial de autorizaciones

Como administrador de PostgreSQL, con `docker compose exec db psql -X -U
inventario_admin -d inventario`, ejecutar SQL revisado. Ejemplo de cuenta ficticia
(reemplazar por la cuenta aprobada antes de usar):

```sql
INSERT INTO public.usuarios_acceso (correo, rol)
VALUES ('persona.autorizada@slepb.gob.cl', 'consulta');

-- Para revocar una cuenta aprobada anteriormente:
UPDATE public.usuarios_acceso SET activo = false
WHERE correo = 'persona.autorizada@slepb.gob.cl';
```

No conceder el rol administrador a toda la organización. Revisar también la
auditoría y el futuro mantenedor de usuarios en una tarea posterior; esta etapa
no implementa asignaciones por sede ni roles para módulos todavía pendientes.

## Comprobación real en CentOS

1. Abrir una ventana privada con el túnel activo. Los módulos deben llevar a
   Ingresar antes de mostrar datos.
2. Ingresar con Felipe y comprobar consulta y edición de un registro ficticio.
3. Una cuenta de dominio ajeno o institucional sin autorización debe rechazarse.
4. Autorizar una cuenta de prueba como consulta, comprobar ausencia de edición,
   desactivarla y verificar que la siguiente petición pierde acceso.
5. Cerrar sesión y verificar que las páginas protegidas vuelven a pedir ingreso.

La prueba local con cookies ficticias no reemplaza la prueba real del
consentimiento y callback de Google. Estos últimos requieren el cliente OAuth
y la sesión del usuario; no se afirman completados por la compilación o CI.

## Pruebas automatizadas

Desde `web/`:

```bash
node --experimental-vm-modules --test tests/acceso.test.mjs
node --test tests/validacion-sedes.test.mjs tests/validacion-dependencias.test.mjs
npm run lint
npm run build
```

CI comprueba además la migración repetida, los permisos SQL y 21 comprobaciones
HTTP con sesiones cifradas ficticias contra Next.js real y una base temporal.
El runner `node tests/ejecutar-acceso-http.mjs` requiere DATABASE_URL de aplicación
y TEST_ADMIN_DATABASE_URL de una base **de prueba**; crea y retira una cuenta
ficticia de consulta. No ejecutarlo contra una base institucional compartida.
El proceso web no recibe la conexión administrativa del runner.
