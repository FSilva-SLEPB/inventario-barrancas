# Ficha, historial y carga de equipos

Primera implementación preparada para revisión. No instala ni importa datos en
el servidor por crear o fusionar el PR. Las entregas nuevas con actas, los
traspasos, préstamos, asignaciones a funcionarios, incidentes y bajas corresponden
a las siguientes etapas del [plan](alcance-y-plan.md).

## Ficha e identificación

Cada fila representa un equipo, con una identidad interna estable. Se registran
sede, categoría, marca, modelo, serie, número de inventario, origen, condición
técnica, datos de adquisición disponibles y observaciones. Los identificadores
conservan ceros y guiones. Serie y número de inventario no pueden repetirse en
NC, EE ni JI, incluso cambiando mayúsculas/minúsculas.

Felipe confirmó que los equipos antiguos podrán tener serie o número de
inventario pendiente, con un motivo. No se crean series ni códigos ficticios.
Los valores genéricos como S/N, N/A o 0 deben dejarse pendientes con su motivo.
Completar o corregir un identificador mantiene el mismo equipo y su historial.

Las correcciones exigen motivo y versión vigente, y conservan actor, fecha,
valores anteriores y posteriores. El servidor rechaza una edición obsoleta.
La cuenta web no tiene INSERT, UPDATE ni DELETE directo sobre equipos,
cargas ni historial: utiliza las funciones controladas. Estas funciones confían
en la identidad comprobada por el servidor, igual que el mantenedor de usuarios.

## Alcance y pertenencia

- Administrador del sistema y Administrador de gestión registran y corrigen en
  todos los ámbitos. El formulario inicial se limita al ámbito de la vista.
- El encargado registra compra propia, donación u otro origen de su única sede;
  se incorpora de inmediato como recibido. Puede corregir los equipos recibidos
  de esa sede, pero no registrar entregas de UTIC como si ya hubiesen ocurrido.
- Una compra UTIC destinada a EE/JI queda en Pendientes de entrega. Es visible
  para la sede, separada de su inventario recibido y sin edición para el encargado.
- Nivel Central mantiene su vista separada. El alta se denomina Registrado en
  Nivel Central: no afirma asignación a un funcionario ni entrega interna.
- Consulta general / Auditor tiene lectura global; Consulta de establecimiento
  solo lee su sede. Los filtros también se aplican a fichas e historial por URL.

La ficha no permite cambiar sede, origen, situación o entrega mediante una
corrección. No hay eliminación, baja ni validación de robo en esta etapa.
Fuera de servicio es una condición técnica y no equivale a baja formal.

## Carga con vista previa

La carga histórica está reservada a los dos perfiles administrativos. Desde
Inventario → Carga histórica se descarga una plantilla CSV y se sube un archivo
CSV UTF-8 de hasta 2 MB, con separador coma o punto y coma y hasta 2.500 equipos.
También se admite la hoja InventarioTotal exportada a ese formato. No se sube el
libro completo ni se suman las hojas anuales al consolidado.

La revisión comprueba:

- Encabezados y cantidad de columnas; comillas y texto UTF-8 válidos.
- Correspondencia exacta del RBD con una sede activa (NC identifica el único
  registro activo de Nivel Central) y de categoría con un catálogo activo.
- Marca, modelo, identificadores, datos pendientes y duplicados dentro del
  archivo o ya existentes en el sistema.
- Cantidad igual a uno por equipo, situación histórica reconocida, fechas
  y enlaces válidos. No se ejecutan fórmulas ni se consultan los enlaces.

La plantilla admite los campos de compra opcionales. La versión histórica de
InventarioTotal se reconoce por sus encabezados originales, incluido su uso de
Adquision. No se importan RUN, nombres ni correos de directores de esa hoja.
Los datos de sede se resuelven por RBD: no se sobrescriben con los del equipo.

Activo se conserva como Recibido según registro histórico y En Bodega del SLEP
como Pendiente de entrega. La condición técnica queda Sin verificar: Nuevo en
la columna Tipo de Estado describe el ingreso, no garantiza su condición actual.
Una fecha o acta vacía, o marcada como -- o -, queda sin informar y genera un
aviso. No se inventan fechas, receptores ni actas. La ausencia de identificador
recibe el motivo explícito de dato no informado en la planilla histórica.

La pantalla muestra totales, los primeros errores/avisos y las primeras 20 filas.
El administrador revisa, acepta los avisos y confirma. El servidor relee y valida
el archivo en la confirmación, compara su SHA-256 y vuelve a comprobar permisos,
sedes, categorías e identificadores. Los equipos se crean en una transacción:
una fila que falla cancela la carga entera, incluido su lote e historial.

El mismo archivo confirmado no se vuelve a importar por un reintento. Otro
archivo con identificadores ya usados se rechaza y nunca sobrescribe equipos.
Cada equipo cargado conserva lote, fila de origen y los datos de compra; el lote
identifica archivo, hash, actor, fecha y cantidad. El CSV original no se almacena
en Git ni en el servidor web. La organización debe conservarlo en su custodia
institucional si necesita reconstruir exactamente los antecedentes de origen.
Las filas de origen se cuentan como registros CSV; una celda multilínea no crea
un equipo adicional.

## Revisión de la fuente compartida

La revisión privada de InventarioTotal encontró 1.178 equipos, sin duplicados
individuales de serie o número de inventario: 1.155 activos y 23 en bodega.
Las categorías son All In One, Proyector, Impresora y Laptop. Antes de la carga
real se debe comprobar su correspondencia con los catálogos del servidor.

Se detectaron 999 celdas de fecha vacías y 1.159 celdas de enlace vacías; otras
19 filas tienen -- en ambos campos. La vista previa transforma esos marcadores
en información pendiente y genera avisos; la importación real aún no se ejecutó.
Consolidado Robos y las hojas anuales no se importan en esta operación.

## Instalación y comprobación

Después de fusionar y con un respaldo comprobado, detener web, actualizar main,
aplicar migraciones con `docker compose run --build --rm migrar` e iniciar web.
La migración crea tablas vacías: no carga equipos ni modifica los 78 registros
de sedes ya instalados. Las credenciales OAuth y las dependencias npm se conservan.

Probar primero una ficha ficticia, la corrección con historial y el rechazo de
un identificador repetido. Comprobar que Consulta no escribe, el encargado no ve
otra sede y Pendientes no se mezcla con recibido. La carga real de la planilla
requiere una revisión posterior y se hará paso a paso con Felipe.

Las pruebas automáticas usan datos sintéticos y verifican funciones SQL, páginas
Next.js reales, cookies de prueba, alcance, versiones, auditoría, concurrencia,
idempotencia y cancelación completa de una carga fallida.
