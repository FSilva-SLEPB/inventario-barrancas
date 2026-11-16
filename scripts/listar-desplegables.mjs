// Inventario verificable de controles: analiza JSX sin ejecutar el código fuente.
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
const raiz=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(path.join(raiz,'web/package.json')),ts=require('typescript');
const lineas=[];const escribir=(s='')=>lineas.push(s);
const archivos=[];function recorrer(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())recorrer(p);else if(/\.tsx$/.test(p))archivos.push(p);}}recorrer(path.join(raiz,'web/src'));
const limpio=s=>s.replace(/\s+/g,' ').trim().replaceAll('|','\\|').replaceAll('`','\\`');let n=0;
escribir('# Desplegables del sistema\n\nGenerado desde JSX con `node scripts/listar-desplegables.mjs`. Incluye controles condicionados por permisos: aparecer en esta lista no habilita acceso. Las expresiones entre llaves se resuelven con los catálogos y permisos de la petición. No son datos comprobados de producción.\n');
for(const archivo of archivos.sort()){
 const texto=fs.readFileSync(archivo,'utf8'),sf=ts.createSourceFile(archivo,texto,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 function visitar(node){if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(sf)==='select'){
  n++;const attrs=node.openingElement.attributes.properties,atrib=k=>{const a=attrs.find(a=>ts.isJsxAttribute(a)&&a.name.getText(sf)===k);return a?.initializer?.getText(sf)??'';},linea=sf.getLineAndCharacterOfPosition(node.getStart(sf)).line+1;
  escribir(`## ${n}. ${limpio(atrib('name')||atrib('id')||atrib('aria-label')||'Sin nombre fijo')}\n\nArchivo: [${path.relative(raiz,archivo)}:${linea}](../${path.relative(raiz,archivo)}#L${linea}).\n\n| Valor | Opción o fuente |\n|---|---|`);
  for(const hijo of node.children){if(ts.isJsxElement(hijo)&&hijo.openingElement.tagName.getText(sf)==='option'){
   const valor=hijo.openingElement.attributes.properties.find(a=>ts.isJsxAttribute(a)&&a.name.getText(sf)==='value');escribir(`| ${limpio(valor?.initializer?.getText(sf)??'(texto de la opción)')} | ${limpio(hijo.children.map(c=>c.getText(sf)).join(' '))} |`);
  }else if(ts.isJsxExpression(hijo)&&hijo.expression)escribir(`| Dinámico | ${limpio(hijo.expression.getText(sf))} |`);}
  const disabled=atrib('disabled');if(disabled)escribir(`\nControl deshabilitado según: \`${limpio(disabled)}\`.`);
  escribir('');
 }ts.forEachChild(node,visitar);}visitar(sf);
}
escribir(`Total: **${n} controles select**. Para valores activos del servidor, usar scripts/consultar-catalogos.mjs de solo lectura; no confundir estos valores con los datos ficticios de pruebas.\n`);
escribir('## Listas fijas utilizadas por los controles\n\nValores definidos en código; los estados históricos no equivalen a opciones habilitadas para registrar un bien nuevo.\n');
const referencias=archivos.map(a=>fs.readFileSync(a,'utf8')).join('\n'),fuentes=[];
function bibliotecas(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())bibliotecas(p);else if(/\.ts$/.test(p))fuentes.push(p);}}bibliotecas(path.join(raiz,'web/src/lib'));
const base=n=>ts.isAsExpression(n)?base(n.expression):n;
for(const archivo of fuentes.sort()){
 const sf=ts.createSourceFile(archivo,fs.readFileSync(archivo,'utf8'),ts.ScriptTarget.Latest,true);
 function visita(n){if(ts.isVariableDeclaration(n)&&/^[A-Z][A-Z_]+$/.test(n.name.getText(sf))&&referencias.includes(n.name.getText(sf))&&n.initializer){
  const v=base(n.initializer),pares=[];
  if(ts.isObjectLiteralExpression(v))for(const p of v.properties){if(!ts.isPropertyAssignment(p)||!ts.isStringLiteralLike(p.initializer)){pares.length=0;break;}pares.push([p.name.getText(sf),p.initializer.text]);}
  if(ts.isArrayLiteralExpression(v)&&v.elements.every(e=>ts.isStringLiteralLike(e)||ts.isNumericLiteral(e)))for(const e of v.elements)pares.push([e.getText(sf),e.getText(sf)]);
  if(pares.length){escribir(`### ${n.name.getText(sf)}\n\nFuente: ${path.relative(raiz,archivo)}\n\n| Valor | Etiqueta |\n|---|---|`);for(const [k,v] of pares)escribir(`| ${limpio(k)} | ${limpio(v)} |`);escribir('');}
 }ts.forEachChild(n,visita);}visita(sf);
}

process.stdout.write(lineas.join('\n').trimEnd()+'\n');
