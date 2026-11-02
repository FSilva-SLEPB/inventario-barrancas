import { leerCsv, cabeceraCsv } from "@/lib/csv-equipos";
export type FilaDirectorio = {sedeId:string;nombre:string;version:number};
export function nombreResponsable(valor: unknown): string {
  if (typeof valor !== "string") throw new Error("Escribe el nombre del director o directora.");
  const nombre=valor.normalize("NFC").trim().replace(/ +/g," ");
  if(!nombre || nombre.length>200 || /\p{Cc}/u.test(nombre)) throw new Error("Escribe un nombre de hasta 200 caracteres, sin saltos de línea.");
  return nombre;
}
export function prepararDirectorio(texto: string, sedes: {sedeId:string;rbd:string|null;sedeNombre:string;nombre:string|null;version:number}[]) {
  const filas=leerCsv(texto),cab=filas.shift()!.map(cabeceraCsv);
  if(filas.length>1000) throw new Error("El directorio admite hasta 1.000 filas por carga.");
  const rbd=cab.indexOf('rbd');const alias=['nombre','directora','director','nombredirector','nombredirectora','nombredeldirector','nombredeladirectora','directoradirector','directoras'];
  const nombres=cab.map((v,i)=>alias.includes(v)?i:-1).filter(i=>i>=0);
  if(rbd<0||cab.filter(v=>v==='rbd').length!==1||nombres.length!==1) throw new Error("El CSV debe tener una columna RBD y una columna Nombre (nombre del director o directora).");
  const datos: FilaDirectorio[]=[],vista:{rbd:string;sede:string;anterior:string;nuevo:string}[]=[],vistos=new Set<string>();
  for(const[fila,f]of filas.entries()){
    const codigo=f[rbd].trim();
    const s=sedes.find(s=>s.rbd===codigo);
    if(!s||!codigo)throw new Error(`Fila ${fila+2}: el RBD no corresponde a un establecimiento/JISC activo.`);
    if(vistos.has(s.sedeId))throw new Error(`Fila ${fila+2}: RBD repetido.`);vistos.add(s.sedeId);
    const nombre=nombreResponsable(f[nombres[0]]);
    datos.push({sedeId:s.sedeId,nombre,version:s.version});vista.push({rbd:codigo,sede:s.sedeNombre,anterior:s.nombre??'Sin registrar',nuevo:nombre});
  }
  return {datos,vista};
}
