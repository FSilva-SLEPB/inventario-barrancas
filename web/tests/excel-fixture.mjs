import {zipSync,strToU8} from 'fflate';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
// Únicamente datos ficticios, sin archivos ni información del usuario.
export function excel(headers,rows,{extra={},hojas=['Datos'],oculta=false,cache=null,fechaCol=-1,fechaTipoN=false}={}){
 const col=n=>n<26?String.fromCharCode(65+n):String.fromCharCode(64+Math.floor(n/26))+String.fromCharCode(65+n%26);
 const sheet='<worksheet><sheetData>'+[headers,...rows].map((r,i)=>`<row r="${i+1}">`+r.map((v,j)=>`<c r="${col(j)}${i+1}" ${i&&j===fechaCol?(fechaTipoN?'s="1" t="n"':'s="1"'):i&&cache&&j===cache.col?'t="str"':'t="inlineStr"'}>`+(i&&j===fechaCol?`<v>${esc(v)}</v>`:i&&cache&&j===cache.col?`<f>NOT_EXECUTED()</f>${cache.valor===null?'':`<v>${esc(cache.valor)}</v>`}`:`<is><t>${esc(v)}</t></is>`)+`</c>`).join('')+'</row>').join('')+'</sheetData></worksheet>';
 return zipSync(Object.fromEntries(Object.entries({'[Content_Types].xml':'<Types/>','xl/workbook.xml':`<workbook xmlns:r="urn:r"><sheets>${hojas.map((h,i)=>`<sheet name="${esc(h)}" sheetId="${i+1}" r:id="rId${i+1}" ${oculta&&i?'state="hidden"':''}/>`).join('')}</sheets></workbook>`,'xl/_rels/workbook.xml.rels':`<Relationships>${hojas.map((h,i)=>`<Relationship Id="rId${i+1}" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`,'xl/styles.xml':'<styleSheet><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>',...Object.fromEntries(hojas.map((_,i)=>[`xl/worksheets/sheet${i+1}.xml`,sheet])),...extra}).map(([k,v])=>[k,strToU8(v)])));
}
