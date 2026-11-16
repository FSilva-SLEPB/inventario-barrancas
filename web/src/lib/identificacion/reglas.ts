export const CAMPOS_QR={inventario:'Número de inventario',categoria:'Categoría',marca:'Marca',modelo:'Modelo',serie:'Serie',rbd:'RBD'} as const;
export type CampoQR=keyof typeof CAMPOS_QR;
export type OpcionesEtiqueta={posicion:number;copias:number;ajusteX:number;ajusteY:number;campos:CampoQR[]};
export type BienIdentificacion={id:string;version:number;inventario:string|null;serie:string|null;marca:string;modelo:string;categoria:string;categoriaId:string;sede:string;rbd:string|null;tipo:string;estado:string;fechaOC:string;prefijo:string|null;prefijoVersion:number;prefijoActivo:boolean};
export function validarOpcionesEtiqueta(d:unknown):OpcionesEtiqueta{
 if(!d||typeof d!=='object'||Array.isArray(d)||Object.keys(d).sort().join(',')!=='ajusteX,ajusteY,campos,copias,posicion')throw new Error('Opciones de etiqueta inválidas.');
 const o=d as OpcionesEtiqueta;
 if(!Number.isInteger(o.posicion)||o.posicion<1||o.posicion>30||!Number.isInteger(o.copias)||o.copias<1||o.copias>10||![o.ajusteX,o.ajusteY].every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=3))throw new Error('Usa posición 1–30, copias 1–10 y ajustes entre −3 y 3 mm.');
 if(!Array.isArray(o.campos)||o.campos.length>6||new Set(o.campos).size!==o.campos.length||!o.campos.includes('inventario')||o.campos.some(c=>!Object.hasOwn(CAMPOS_QR,c)))throw new Error('Selecciona campos QR válidos, incluido el número de inventario.');
 return o;
}
export function contenidoQr(b:BienIdentificacion,campos:CampoQR[]){
 if(!b.inventario)throw new Error('El equipo no tiene número de inventario.');
 const alias:Record<CampoQR,string>={inventario:'INV',categoria:'CAT',marca:'MAR',modelo:'MOD',serie:'SER',rbd:'RBD'};
 const lineas=['SLEP BARRANCAS · UNIDAD TIC','ORG:'+(b.tipo==='nivel_central'?'NC':'P02')];
 for(const c of campos){const v=b[c];if(v)lineas.push(alias[c]+':'+v);}
 return lineas.join('\n');
}
export function anioOC(fecha:string):number|null{
 if(/^(19|20)\d{2}$/.test(fecha))return Number(fecha);
 if(!/^(19|20)\d{2}-\d{2}-\d{2}$/.test(fecha))return null;
 const d=new Date(fecha+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===fecha?Number(fecha.slice(0,4)):null;
}
