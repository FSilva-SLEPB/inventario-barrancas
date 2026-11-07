# Componente React de estados del activo

Implementa las tres reglas especificadas por Felipe. Es un componente reutilizable y un ejemplo con datos ficticios. La integración con los formularios operativos y la persistencia del inventario sigue pendiente.

| Administrativo | Condición en pantalla | Selector administrativo | Selector de condición | Resto del formulario |
| --- | --- | --- | --- | --- |
| Activo | Seleccionable | Habilitado | Habilitado | Editable |
| Robado | Vacía | Habilitado | Deshabilitado | Editable |
| No encontrado | Vacía | Habilitado | Deshabilitado | Editable |
| Dado de baja | Obsoleto | Deshabilitado | Deshabilitado | Solo lectura |

Condiciones: Operativo, Bodega de TI, Mantención, Mal estado y Obsoleto. Administrativos: Activo, Robado, No encontrado y Dado de baja.

## Uso

```tsx
'use client';

import FormularioEstadosActivo from '@/components/formulario-estados-activo';

export default function MiActivo() {
  function ejecutarProtocoloSeguridad(activoId: string) {
    console.info('Protocolo simulado para', activoId);
  }

  return <FormularioEstadosActivo
    activoId="ACTIVO-001"
    inicial={{
      descripcion: 'Pantalla de ejemplo',
      estadoAdministrativo: 'activo',
      estadoCondicion: 'operativo',
    }}
    ejecutarProtocoloSeguridad={ejecutarProtocoloSeguridad}
    onCambio={(actual, anterior) => {
      console.info({anterior, actual});
    }}
    onGuardar={async registro => {
      console.info('Guardado simulado', registro);
    }}
  />;
}
```

También se puede montar `EjemploEstadosActivo` desde un componente cliente para ver el formulario y su lista de eventos. Ambos reutilizan las clases de formularios del proyecto. No se añade una ruta pública ni una opción al menú de producción.

## Comportamiento

- El protocolo se llama una vez por transición efectiva a Robado o No encontrado. No se ejecuta al cargar, renderizar o escribir en otros campos. Pasar de Robado a No encontrado constituye otra transición.
- El callback de seguridad puede devolver una promesa. Si falla, se conserva el bloqueo y se muestra un error; no se reintenta automáticamente. Un error tardío de una transición anterior no reemplaza el estado de una transición posterior.
- Volver a Activo habilita los dos selectores. La condición que estaba vacía queda disponible para seleccionarla; no se deduce su estado físico.
- Seleccionar Obsoleto mientras sigue Activo no produce una baja administrativa.
- La baja conserva descripción y observaciones, fija Obsoleto, registra fecha y emite `onCambio(actual, anterior)`. Desde ese momento bloquea ediciones, selectores, guardado, reset y nuevas transiciones. Un histórico cargado sin fecha no recibe una fecha inventada.
- `onCambio` recibe registros inmutables. El consumidor puede conservar allí la transición de baja; el botón Guardar queda bloqueado por la regla 2. El ejemplo solo conserva eventos en memoria.
- `inicial` se aplica al montar. Un `activoId` distinto monta una instancia independiente; para cargar otra versión del mismo activo, el consumidor puede usar una `key` de versión.

## Alcance y validación

La aplicación instalada conserva su funcionamiento actual: sin migraciones, protocolos reales ni cambios en PDFs/historiales. La persistencia de una baja real necesita la operación de servidor autorizada, sus versiones y antecedentes; deshabilitar controles en React no reemplaza esa autorización.

Se añaden pruebas de catálogos exactos, las tres reglas, inmutabilidad, datos históricos, estados inválidos y renderizado del componente con React real. GitHub Actions ejecuta este archivo además de la verificación existente.

El entorno local no estuvo disponible al publicar este cambio. La validación del commit publicado se realiza en GitHub Actions; el renderizado estático no sustituye una comprobación interactiva en navegador de la integración futura.

Los siguientes trabajos quedan definidos en [Dashboards y bodegas TI](definicion-dashboards-y-bodegas.md).
