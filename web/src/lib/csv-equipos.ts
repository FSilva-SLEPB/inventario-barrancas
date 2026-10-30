// CSV acotado y sin evaluación de fórmulas. No lee macros ni ejecuta enlaces.
export class ErrorCargaCsv extends Error {}
export function leerCsv(texto: string): string[][] {
  texto=texto.replace(/^\uFEFF/,"");
  const primera=texto.split(/\r?\n/,1)[0];
  const separador=primera.includes(";") ? ";" : ",";
  const filas: string[][]=[]; let fila: string[]=[]; let celda=""; let citado=false; let cerrado=false;
  const agregar=()=> { if(celda.length>16000) throw new ErrorCargaCsv("Una celda supera el límite permitido."); fila.push(celda); celda=""; cerrado=false; };
  for(let i=0;i<texto.length;i++) {
    const c=texto[i];
    if(citado) {
      if(c==='"') { if(texto[i+1]==='"'){celda+='"';i++;} else {citado=false;cerrado=true;} }
      else celda+=c;
    } else if(c==='"') {
      if(celda || cerrado) throw new ErrorCargaCsv("Comillas CSV inválidas."); citado=true;
    } else if(c===separador) agregar();
    else if(c==='\n' || c==='\r') {
      if(c==='\r' && texto[i+1]==='\n')i++;
      agregar();if(fila.some(v=>v.trim()))filas.push(fila);fila=[];
      if(filas.length>2501)throw new ErrorCargaCsv("La carga admite hasta 2.500 equipos.");
    } else {if(cerrado)throw new ErrorCargaCsv("Hay datos después del cierre de comillas.");celda+=c;}
  }
  if(citado)throw new ErrorCargaCsv("Una celda tiene comillas sin cerrar.");
  agregar();if(fila.some(v=>v.trim()))filas.push(fila);
  if(filas.length<2 || filas.length>2501)throw new ErrorCargaCsv("Incluye entre 1 y 2.500 filas de equipos.");
  if(filas.some(f=>f.length!==filas[0].length))throw new ErrorCargaCsv("Todas las filas deben tener la misma cantidad de columnas.");
  return filas;
}
export function cabeceraCsv(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
}
