# Trabajo preparado y próxima instalación

Corte: 10 de noviembre de 2026, hora de Chile. Felipe trabaja desde casa y la instalación en CentOS queda para cuando recupere el acceso. La auditoría y la homologación están integradas en main mediante los PR63 y PR64. La instalación real sigue pendiente de comprobar; una prueba en GitHub no acredita que el servidor esté actualizado.

## Preparado en el proyecto

- Estados administrativos y de condición integrados con historial, permisos y protección de bajas; conservación de clasificaciones anteriores.
- Equipos, celulares, movimientos, préstamos y actas con documentos conservados.
- Insumos: catálogo/fotos, carrito, validación, reserva, entrega única y acta; aislamiento por sede y escrituras con el rol limitado de producción.
- Homologación de detalle/gestión de insumos en la ventana común, acciones con iconos y participantes precargados y editables. Volver/cerrar conserva filtros, página y tamaño; un error de cantidad no registra una entrega incompleta por omisión.
- Fotografías nuevas en PostgreSQL, incluidas en sus respaldos. Importador opcional para archivos anteriores, con revisión antes de aplicar.

## Pendientes que necesitan el servidor o una definición posterior

| Pendiente | Qué falta |
| --- | --- |
| Instalar lo aprobado | Revisar el estado real, respaldar, migrar, compilar y comprobar Google/perfiles y operación |
| Correo institucional | Proveedor y remitente exacto de no responder; configurar credenciales solo en CentOS y ensayar únicamente con `correoprueba@slepb.gob.cl` |
| Publicación HTTPS | Dominio, DNS, proxy/TLS, callback Google y cookies del origen definitivo |
| Fotos anteriores | Confirmar si sus archivos existen y respaldarlos; una URL no recupera un archivo perdido |
| Carga del inventario | Revisar la planilla actual y duplicados; previsualizar antes de confirmar, sin inventar datos |
| Bodegas físicas | Instalar la migración 1795622400000 y confirmar ubicaciones reales; las anteriores siguen desconocidas. La regularización por RBD 31288 se revisará por separado, sin borrar historial |
| Dos dashboards NC/P02 | Misma presentación y separación de pertenencia; disponibilidad exige condición y custodia adecuadas. Definir fecha del filtro Año y fuente de Empresa/OC antes de métricas de compras |
| FirmaGob | Evaluar más adelante el servicio conservado; todavía no se afirma integración ni firma electrónica |

No se modifican datos reales, configuraciones del host, credenciales ni destinatarios durante el trabajo sin servidor. La guía de auditoría detalla los datos anteriores que necesitan revisión: [auditoria-insumos-2026-11-10.md](auditoria-insumos-2026-11-10.md).

## Secuencia para cuando haya acceso

Ejecutar los bloques por separado y revisar cada resultado antes de avanzar. No ejecutarlos ahora desde otro equipo. Primero fusionar únicamente el código revisado y con verificaciones aprobadas.

### 1. Identificar instalación y cambios locales

```bash
cd /home/slepb/inventario-barrancas
git status --short --branch
git log -1 --oneline
docker compose -p inventario-barrancas -f compose.produccion.yaml ps -a
df -h /
python3 scripts/verificar-produccion.py --prueba-local \
  --project-name inventario-barrancas
```

Si hay cambios locales, conservarlos y revisarlos antes de actualizar. No usar reset, clean ni borrar volúmenes. Confirmar bind `127.0.0.1`, proyecto y volumen actuales. Conservar también `.env` y otras configuraciones privadas en un respaldo protegido; no pegarlas en el chat. Retirar la configuración temporal de revisión sin OAuth: ya no concede acceso y el ingreso exige Google y una cuenta autorizada.

Si existen fotos antiguas en `web/public/uploads/insumos` o dentro del contenedor anterior, copiarlas antes de reemplazarlo. No basta con un respaldo de PostgreSQL para recuperar fotos que antes se escribían en el contenedor.

### 2. Detener web y verificar respaldo

```bash
contenedor_db_instalacion="$(docker compose -p inventario-barrancas -f compose.produccion.yaml ps --quiet db)" &&
test -n "$contenedor_db_instalacion" &&
docker compose -p inventario-barrancas -f compose.produccion.yaml stop web &&
respaldo_pre_instalacion="$(RESPALDO_DB_CONTAINER="$contenedor_db_instalacion" bash scripts/respaldar-postgresql.sh)" &&
bash scripts/verificar-respaldo-postgresql.sh "$respaldo_pre_instalacion"
```

Continuar solo después de ver restauración comprobada. Conservar la ruta del respaldo y la revisión anterior.

### 3. Actualizar y migrar

```bash
git pull --ff-only origin main &&
git log -1 --oneline &&
docker compose -p inventario-barrancas -f compose.produccion.yaml \
  run --build --rm migrar
```

Las migraciones de insumos y `1795536000000_auditoria-estados-insumos` deben quedar aplicadas. La homologación de insumos no añade otra migración; las bodegas físicas requieren además `1795622400000_ubicaciones-bodega-ti`. Si un paso falla, revisar la salida antes de continuar. No editar una migración registrada ni ejecutar una reversión improvisada: las actas emitidas y la existencia física deben conservarse.

### 4. Compilar y comprobar

```bash
APP_REVISION="$(git rev-parse HEAD)" docker compose \
  -p inventario-barrancas -f compose.produccion.yaml build web &&
docker compose -p inventario-barrancas -f compose.produccion.yaml \
  up -d --no-deps --no-build --wait --wait-timeout 90 web &&
curl -fsS --max-time 15 -w '\nHTTP %{http_code}\n' \
  http://127.0.0.1:3000/api/salud &&
python3 scripts/revisar-instalacion.py --prueba-local \
  --project-name inventario-barrancas
```

La salud HTTP no sustituye la prueba de Google: entrar con una cuenta autorizada, comprobar UTIC y cuentas de sede, ventanas y filtros, conservar datos al fallar, consultar PDFs anteriores e imprimir. Las pruebas de entrega/stock deben hacerse con registros de ensayo identificados; no modificar stock real para probar. Antes de cualquier envío, comprobar modo de prueba y la lista explícita del buzón autorizado.

### Comprobación funcional después de instalar

| Proceso | Resultado esperado |
| --- | --- |
| Acceso y perfiles | Google permite cuentas autorizadas; una cuenta de sede no consulta datos de otra |
| Estados | Robado/No encontrado vacían y bloquean condición; Baja fija Obsoleto y solo lectura; Activo permite seleccionar condición |
| Datos anteriores | Guardar sin seleccionar condición no borra la clasificación anterior; PDFs antiguos conservan su contenido |
| Insumos | Solicitante/emisor precargados, cantidades inválidas conservadas para corregir, reserva y existencia coherentes al entregar o cancelar |
| Navegación | Ventanas, iconos, confirmación real de éxito y retorno con filtros; Todos incluye finalizadas |
| Documentos y fotos | PDF con producto, unidad y cantidad; imágenes disponibles después de reemplazar el contenedor |

Las comprobaciones que escriban se hacen únicamente con registros de ensayo controlados. No enviar correos a establecimientos para comprobar botones. Registrar cualquier diferencia y su revisión instalada antes de corregirla; no borrar el historial de las pruebas.

### 5. Fotos anteriores y cierre

El importador es opcional, necesita Node.js 24 y conexión PostgreSQL ya configurada de forma privada. Desde la raíz, revisar primero:

```bash
node web/scripts/importar-fotos-insumos.mjs \
  --actor CORREO_UTIC_AUTORIZADO --directorio RUTA_FOTOS_RESPALDADAS
```

Solo después de comprobar los archivos y el resultado, repetir con `--aplicar`. Conservar originales y respaldo. Registrar revisión instalada, migraciones, salud, acceso por perfiles y resultado de las pruebas; mantener como pendientes correo, HTTPS y datos todavía no comprobados.
