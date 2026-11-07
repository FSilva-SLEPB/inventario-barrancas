import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url), cache = new Map();
function cargar(nombre) {
  if (!nombre.startsWith('@/')) return require(nombre);
  if (cache.has(nombre)) return cache.get(nombre);
  const extension = nombre.startsWith('@/components/') ? '.tsx' : '.ts';
  const js = ts.transpileModule(readFileSync(new URL('../src/' + nombre.slice(2) + extension, import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX},
  }).outputText;
  const exports = {};
  cache.set(nombre, exports);
  new Function('exports', 'require', js)(exports, cargar);
  return exports;
}
const {ESTADOS_CONDICION_ACTIVO, ESTADOS_ADMINISTRATIVOS_ACTIVO, crearRegistroEstadoActivo,
  cambiarEstadoAdministrativo, cambiarCondicionActivo, cambiarTextoActivo,
  condicionBloqueada, registroSoloLectura, ejecutarProtocoloSeguridad} = cargar('@/lib/estados-activo');
const inicial = () => crearRegistroEstadoActivo('ACTIVO-TEST-1', {
  descripcion: 'Pantalla de prueba', estadoCondicion: 'operativo', observaciones: 'Antecedente conservado',
});

test('el catálogo contiene exactamente los dos conjuntos de estados solicitados', () => {
  assert.deepEqual(Object.values(ESTADOS_CONDICION_ACTIVO), ['Operativo', 'Bodega de TI', 'Mantención', 'Mal estado', 'Obsoleto']);
  assert.deepEqual(Object.values(ESTADOS_ADMINISTRATIVOS_ACTIVO), ['Activo', 'Robado', 'No encontrado', 'Dado de baja']);
});
test('regla 1: Robado y No encontrado vacían y bloquean la condición y solicitan protocolo', () => {
  for (const condicion of Object.keys(ESTADOS_CONDICION_ACTIVO)) for (const admin of ['robado', 'no_encontrado']) {
    const anterior = crearRegistroEstadoActivo('ACTIVO-TEST-1', {estadoCondicion: condicion});
    const cambio = cambiarEstadoAdministrativo(anterior, admin);
    assert.equal(cambio.registro.estadoCondicion, '');
    assert.equal(condicionBloqueada(cambio.registro.estadoAdministrativo), true);
    assert.equal(registroSoloLectura(cambio.registro), false);
    assert.equal(cambio.protocoloSeguridad, true);
    assert.equal(anterior.estadoCondicion, condicion);
    assert.equal(cambiarCondicionActivo(cambio.registro, 'operativo'), cambio.registro);
  }
});
test('una transición repetida no vuelve a solicitar el protocolo; cambiar entre incidentes sí', () => {
  const a = cambiarEstadoAdministrativo(inicial(), 'robado');
  assert.equal(cambiarEstadoAdministrativo(a.registro, 'robado').protocoloSeguridad, false);
  const b = cambiarEstadoAdministrativo(a.registro, 'no_encontrado');
  assert.equal(b.protocoloSeguridad, true);
  assert.equal(b.registro.estadoCondicion, '');
});
test('regla 2: la baja fija Obsoleto y conserva un registro histórico inmutable', () => {
  for (const admin of ['activo', 'robado', 'no_encontrado']) {
    const anterior = crearRegistroEstadoActivo('ACTIVO-TEST-1', {estadoAdministrativo: admin, descripcion: 'Descripción anterior', observaciones: 'Observación anterior'});
    const cambio = cambiarEstadoAdministrativo(anterior, 'dado_de_baja', '2026-11-06T12:00:00.000Z');
    assert.equal(cambio.registro.estadoCondicion, 'obsoleto');
    assert.equal(cambio.registro.fechaBaja, '2026-11-06T12:00:00.000Z');
    assert.equal(cambio.registro.descripcion, anterior.descripcion);
    assert.equal(cambio.registro.observaciones, anterior.observaciones);
    assert.equal(registroSoloLectura(cambio.registro), true);
    assert.equal(cambio.protocoloSeguridad, false);
    assert.ok(Object.isFrozen(cambio.registro));
    assert.throws(() => {cambio.registro.estadoCondicion = 'operativo';}, TypeError);
    for (const siguiente of Object.keys(ESTADOS_ADMINISTRATIVOS_ACTIVO)) {
      assert.equal(cambiarEstadoAdministrativo(cambio.registro, siguiente).registro, cambio.registro);
      assert.equal(cambiarEstadoAdministrativo(cambio.registro, siguiente).protocoloSeguridad, false);
    }
    assert.equal(cambiarCondicionActivo(cambio.registro, 'operativo'), cambio.registro);
    assert.equal(cambiarTextoActivo(cambio.registro, 'descripcion', 'Cambio'), cambio.registro);
    assert.equal(cambiarTextoActivo(cambio.registro, 'observaciones', 'Cambio'), cambio.registro);
  }
});
test('regla 3: Activo habilita condición y admite todos sus valores sin forzar una baja', () => {
  for (const anterior of ['activo', 'robado', 'no_encontrado']) {
    const cambio = cambiarEstadoAdministrativo(crearRegistroEstadoActivo('ACTIVO-TEST-1', {estadoAdministrativo: anterior}), 'activo');
    assert.equal(condicionBloqueada(cambio.registro.estadoAdministrativo), false);
    assert.equal(registroSoloLectura(cambio.registro), false);
    assert.equal(cambio.protocoloSeguridad, false);
    for (const condicion of Object.keys(ESTADOS_CONDICION_ACTIVO)) {
      const r = cambiarCondicionActivo(cambio.registro, condicion);
      assert.equal(r.estadoCondicion, condicion);
      assert.equal(r.estadoAdministrativo, 'activo');
    }
  }
});
test('volver de un incidente a Activo habilita el selector sin inventar una condición', () => {
  const perdido = cambiarEstadoAdministrativo(inicial(), 'no_encontrado').registro;
  const activo = cambiarEstadoAdministrativo(perdido, 'activo').registro;
  assert.equal(activo.estadoCondicion, '');
  assert.equal(cambiarCondicionActivo(activo, 'mantencion').estadoCondicion, 'mantencion');
});
test('cargar datos previos aplica restricciones sin inventar fecha de archivo', () => {
  for (const admin of ['robado', 'no_encontrado']) assert.equal(crearRegistroEstadoActivo('A', {estadoAdministrativo: admin, estadoCondicion: 'operativo'}).estadoCondicion, '');
  const archivado = crearRegistroEstadoActivo('A', {estadoAdministrativo: 'dado_de_baja', estadoCondicion: 'operativo'});
  assert.equal(archivado.estadoCondicion, 'obsoleto');
  assert.equal(archivado.fechaBaja, null);
  assert.equal(registroSoloLectura(archivado), true);
});
test('rechaza estados ajenos al catálogo y las transiciones no mutan la entrada', () => {
  for (const x of ['inactivo', 'pendiente', '__proto__', '']) assert.throws(() => crearRegistroEstadoActivo('A', {estadoAdministrativo: x}));
  for (const x of ['sin_verificar', 'fuera_de_servicio', '__proto__']) assert.throws(() => cambiarCondicionActivo(inicial(), x));
  const a = inicial(), copia = JSON.stringify(a);
  cambiarEstadoAdministrativo(a, 'robado');
  cambiarTextoActivo(a, 'descripcion', 'Otra descripción');
  assert.equal(JSON.stringify(a), copia);
  assert.throws(() => crearRegistroEstadoActivo('  '));
});
test('el protocolo predeterminado es una simulación local con el identificador indicado', () => {
  const anterior = console.info, llamadas = [];
  try {console.info = (...args) => llamadas.push(args); ejecutarProtocoloSeguridad('ACTIVO-FICTICIO');}
  finally {console.info = anterior;}
  assert.deepEqual(llamadas, [['[Simulación] ejecutarProtocoloSeguridad', 'ACTIVO-FICTICIO']]);
});

const React = require('react'), {renderToStaticMarkup} = require('react-dom/server');
const Formulario = cargar('@/components/formulario-estados-activo').default;
function renderizar(admin) {
  const llamadas = [];
  const html = renderToStaticMarkup(React.createElement(Formulario, {
    activoId: 'ACTIVO-SSR-FICTICIO',
    inicial: {descripcion: 'Pantalla', estadoAdministrativo: admin, estadoCondicion: 'operativo'},
    ejecutarProtocoloSeguridad: id => llamadas.push(id),
    onGuardar() {},
  }));
  return {html, llamadas};
}
function select(html, nombre) {
  return html.match(new RegExp('<select\\b[^>]*name="' + nombre + '"[^>]*>[\\s\\S]*?<\\/select>'))?.[0];
}
test('el componente renderiza Activo editable e incidentes con condición vacía sin disparar callbacks al cargar', () => {
  const activo = renderizar('activo');
  assert.ok(!/\bdisabled(?:=|\s|>)/.test(select(activo.html, 'estadoAdministrativo')));
  assert.ok(!/\bdisabled(?:=|\s|>)/.test(select(activo.html, 'estadoCondicion')));
  for (const a of ['robado', 'no_encontrado']) {
    const {html, llamadas} = renderizar(a), condicion = select(html, 'estadoCondicion');
    assert.match(condicion, /\bdisabled=""/);
    assert.match(condicion, /<option value="" selected=""><\/option>/);
    assert.ok(!/\bdisabled=""/.test(select(html, 'estadoAdministrativo')));
    assert.deepEqual(llamadas, []);
  }
});
test('el componente renderiza el histórico con Obsoleto, selectores bloqueados y textos de solo lectura', () => {
  const {html, llamadas} = renderizar('dado_de_baja');
  assert.match(html, /<fieldset\b[^>]*disabled=""/);
  assert.match(select(html, 'estadoAdministrativo'), /\bdisabled=""/);
  assert.match(select(html, 'estadoCondicion'), /<option value="obsoleto" selected="">Obsoleto<\/option>/);
  assert.match(html, /<input\b(?=[^>]*name="descripcion")(?=[^>]*readonly="")[^>]*>/i);
  assert.match(html, /<textarea\b(?=[^>]*name="observaciones")(?=[^>]*readonly="")[^>]*>/i);
  assert.match(html, /<button\b[^>]*disabled=""/);
  assert.match(html, /Fecha de archivo no informada/);
  assert.deepEqual(llamadas, []);
});

const CampoCondicion = cargar('@/components/campo-condicion-activo').default;
test('las altas ofrecen solo las cinco condiciones y requieren selección sin marcar Operativo', () => {
  const html = renderToStaticMarkup(React.createElement(CampoCondicion, {id:'alta', valor:'sin_verificar', existente:false}));
  assert.ok(!html.includes('value="sin_verificar"'));
  assert.deepEqual([...html.matchAll(/<option value="([^"]*)"/g)].map(m=>m[1]), ['',...Object.keys(ESTADOS_CONDICION_ACTIVO)]);
  assert.match(html, /required=""/);
  assert.match(html, /<option value="" selected="">Selecciona una condición/);
});
test('el selector compartido conserva condición anterior y bloquea la vacía de incidentes', () => {
  const previo = renderToStaticMarkup(React.createElement(CampoCondicion, {id:'anterior', valor:'sin_verificar', existente:true}));
  assert.match(previo, /<option value="sin_verificar" selected="">/);
  const incidente = renderToStaticMarkup(React.createElement(CampoCondicion, {id:'incidente', valor:'operativo', administrativo:'robado'}));
  assert.match(incidente, /<select[^>]*disabled=""/);
  assert.match(incidente, /<option value="" selected=""><\/option>/);
  assert.match(incidente, /<input type="hidden" name="condicionTecnica" value=""/);
});
