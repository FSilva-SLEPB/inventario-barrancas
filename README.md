# Sistema de Inventario 2.0 EE y TI — SLEP Barrancas

## Objetivo

Desarrollar una aplicación web para gestionar solicitudes de insumos,
registrar inventario, generar actas y permitir su firma.

## Alcance inicial

- Gestión de usuarios y permisos.
- Solicitudes de insumos.
- Registro de bienes y movimientos de inventario.
- Generación de actas.
- Firma y consulta de documentos.

## Base tecnológica prevista

- React y Next.js con TypeScript.
- Node.js.
- PostgreSQL.
- Docker Engine y Docker Compose.
- CentOS Stream 9 como entorno de desarrollo.

## Diseño y requisitos institucionales

El diseño tomará como referencia el UI Kit de Gobierno de Chile
y la identidad institucional del SLEP Barrancas.

Se revisarán las normas y políticas institucionales aplicables a
accesibilidad, protección de datos personales, ciberseguridad
y documentos electrónicos.

El mecanismo de firma se definirá según los requisitos de cada acta.

Referencia de diseño: https://kitdigital.gob.cl/

## Forma de trabajo

El desarrollo será paso a paso, con explicación y comprobación de
cada avance. Los cambios se registrarán con Git y GitHub.

Durante el desarrollo se utilizarán datos ficticios.
Las contraseñas, credenciales y respaldos quedarán fuera del repositorio.

## Estado

Base de Next.js funcionando con Docker Compose. ESLint, TypeScript y compilación de producción verificados.

## Desarrollo local

Requisitos: Git, Docker Engine y Docker Compose.

Para preparar una copia nueva, ejecutar desde la raíz del repositorio:

1. Crear la configuración local: `bash scripts/preparar-entorno.sh`
2. Instalar las dependencias: `docker compose run --rm web npm ci`
3. Iniciar la aplicación: `docker compose up -d --wait`
4. Preparar el usuario de la aplicación: `docker compose exec -T db psql -X -U inventario_admin -d inventario -v ON_ERROR_STOP=1 --single-transaction -f - < database/preparar-usuario.sql`
5. Aplicar las migraciones: `docker compose run --build --rm migrar`

Comandos de trabajo:

- Revisar el código: `docker compose exec web npm run lint`
- Compilar para producción: `docker compose exec web npm run build`
- Consultar los registros: `docker compose logs --tail=40 web`
- Detener la aplicación: `docker compose stop web`

El servicio escucha en `127.0.0.1:3000` del equipo CentOS.
El acceso desde otro equipo se realizará mediante un túnel SSH.

## Base de datos de desarrollo

El servicio `db` utiliza PostgreSQL 18. Los datos se conservan en el
volumen `postgres_data` y la contraseña local se guarda en `.env`.

El script `scripts/preparar-entorno.sh` conserva una contraseña ya configurada.

Para detener ambos servicios conservando los datos: `docker compose stop`.

## Verificaciones automáticas

GitHub Actions revisa dependencias, ESLint, migraciones, permisos,
integridad de los catálogos y compilación en los pull requests hacia
`main` y al actualizar esa rama.

Las pruebas utilizan una base temporal con credenciales de prueba.
Los registros ficticios se crean dentro de una transacción que se revierte.

Para verificar los catálogos localmente: `bash scripts/verificar-base-datos.sh`.
