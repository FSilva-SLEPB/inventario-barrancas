# Navegación, tablas y fichas

Inventario y Mantenedores comparten el catálogo de accesos de
`web/src/lib/modulos.ts`. Sus portadas y el menú lateral usan las mismas entradas,
filtradas por perfil y alcance. El título de cada módulo abre su portada; el botón
adyacente despliega o contrae el submenú sin navegar. Al entrar en otra sección se
abre su grupo. En móvil, seleccionar un enlace cierra el menú.

El directorio pertenece exclusivamente a Mantenedores. Inventario reúne NC, P02,
registro, bodega, movimientos y robos según autorización. Mantenedores ofrece
portada de tarjetas, directorio, usuarios, categorías, sedes, dependencias y modelo
de datos, con las restricciones de perfil existentes. Solicitudes conserva su
estado pendiente y el mismo componente de portada; sus opciones se añadirán al
catálogo cuando existan los flujos, sin presentar enlaces de funciones ficticias.

La tabla del directorio abre la ficha de lectura. La acción de editar está dentro
de esa ficha; no se repite el lápiz en cada fila. La carga de listados tiene una
página separada, accesible desde el directorio. «Sin cargar» significa que aún no
hay ficha del responsable incorporada; es distinto de «Responsable pendiente» o
«Cargo vacante», que son situaciones expresamente guardadas.

Las tablas usan la clase común `tabla-datos` y la capa visual
`web/src/app/experiencia.css`: tipografía, encabezados, filas, bordes, selección y
estados de foco uniformes. Cada tabla conserva las columnas y los mínimos de
anchura que requiere su contenido; los contenedores permiten desplazamiento
horizontal en pantallas pequeñas. Los enlaces, campos y botones conservan sus
etiquetas y navegación con teclado.

Las entradas de página, tarjetas, botones y cambios de fondo tienen transiciones
breves y sin animaciones continuas. Estas animaciones se aplican únicamente con
`prefers-reduced-motion: no-preference` y usan las variables de contraste vigentes.

## Reporte de robo simplificado

Se puede buscar por serie, número de inventario, marca o modelo entre los equipos
autorizados, o filtrar por sede. La selección identifica automáticamente el
establecimiento; se permite un grupo de equipos de la misma sede. Los equipos de
otras sedes se bloquean mientras haya selección, y los que tienen un incidente
abierto no pueden repetirse.

Después de seleccionar se muestran dos datos obligatorios: fecha del robo y una
descripción breve. Lugar específico y enlace a denuncia son opcionales y quedan
bajo un desplegable. No informar el lugar guarda «No informado», sin afirmar que
el robo ocurrió en el establecimiento. La identificación de bienes, sede y actor
se conserva desde la base y la sesión. La validación administrativa, las versiones,
la recuperación individual y el historial mantienen sus reglas anteriores.

## Modelo de datos de la instalación

Mantenedores → Modelo de datos está restringido a administradores. Consulta el
catálogo PostgreSQL, las columnas, claves primarias, FK, nulabilidad y unicidad; no
lee valores de filas personales para dibujar el modelo. El recuento de tablas con
permiso SELECT muestra los registros actuales, y el catálogo documenta qué parte
del código utiliza cada tabla. Una tabla vacía no se declara automáticamente sin uso.

El gráfico distingue las relaciones uno a uno y uno a varios, permite filtrar por
área, seleccionar una entidad, ampliar y descargar SVG. Los datos históricos JSON
no se representan como FK al directorio vigente. El documento
[modelo-entidad-relacion.md](modelo-entidad-relacion.md) se genera con las mismas
consultas y su gráfico se compara con la base temporal durante las pruebas HTTP.
