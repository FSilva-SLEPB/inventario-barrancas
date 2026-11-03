import assert from 'node:assert/strict';
const origen=process.env.ACCESO_HTTP_URL;assert.ok(origen&&process.env.TEST_ADMIN_DATABASE_URL,'Usar solo un servidor y base temporales de prueba.');
const r=await fetch(origen+'/api/salud');assert.equal(r.status,200);assert.deepEqual(await r.json(),{estado:'ok'});assert.match(r.headers.get('cache-control'),/no-store/);assert.equal(r.headers.get('x-content-type-options'),'nosniff');
const cabeza=await fetch(origen+'/api/salud',{method:'HEAD'});assert.equal(cabeza.status,200);assert.equal(await cabeza.text(),'');
const escritura=await fetch(origen+'/api/salud',{method:'POST'});assert.equal(escritura.status,405);
console.log('3 comprobaciones de operación: salud mínima sin caché, HEAD y rechazo de escritura.');
