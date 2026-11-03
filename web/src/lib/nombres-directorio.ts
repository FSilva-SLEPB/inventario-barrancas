// Sugerencia de presentación: nunca escribe ni reemplaza el nombre conservado.
export function sugerirNombre(nombre: string | null | undefined) {
 const partes=(nombre??'').normalize('NFC').trim().split(/\s+/u).filter(Boolean);
 if(partes.length<3)return {nombres:partes.join(' '),apellidos:''};
 const particulas=new Set(['de','del','la','las','los','san','santa','da','das','do','dos','van','von','den']);
 let inicio=partes.length;
 for(let apellido=0;apellido<2&&inicio>1;apellido++){
  inicio--;
  while(inicio>1&&particulas.has(partes[inicio-1].toLocaleLowerCase('es')))inicio--;
  if(apellido===0&&inicio>1&&partes[inicio-1].toLowerCase()==='y')inicio--;
 }
 return {nombres:partes.slice(0,inicio).join(' '),apellidos:partes.slice(inicio).join(' ')};
}
