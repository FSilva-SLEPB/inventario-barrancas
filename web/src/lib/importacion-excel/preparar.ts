import {cabeceraCsv} from '@/lib/csv-equipos';
import {prepararCargaEquipos} from '@/lib/preparar-carga-equipos';
import {validarFuncionario} from '@/lib/validacion-funcionarios';
import {normalizarRut} from '@/lib/validacion-directorio';
import {COLUMNAS_CARGA_INVENTARIO} from '@/lib/columnas-carga-inventario';
import {ErrorExcel} from '@/lib/importacion-excel/lector';
import type {TipoExcel} from '@/lib/importacion-excel/tipos';
export {TIPOS_EXCEL,type TipoExcel} from '@/lib/importacion-excel/tipos';
export type ContextoExcel={sedes:{id:string;rbd:string|null;tipo:string;activo:boolean}[];categorias:{id:string;nombre:string;activo:boolean}[];equipos:{id:string;serie:string|null;inventario:string|null;sedeId:string;version:number;custodia:string;estado:string;pendiente:boolean}[];funcionarios:{id:string;rut:string|null;correo:string|null;nombre:string;version:number;activo:boolean}[];asignaciones:{equipoId:string;funcionarioId:string}[]};
export type OperacionExcel={fila:number;datos:Record<string,unknown>};
export type VistaExcel={fila:number;descripcion:string;accion:string;aviso:string};
export function prepararExcel(filas:{fila:number;celdas:string[]}[],tipo:TipoExcel,c:ContextoExcel,mapeo:Record<string,string>={}){
 const cabecera=filas.findIndex(f=>f.celdas.some(h=>['categoria','run','rut'].includes(cabeceraCsv(h??''))));
 if(cabecera<0||cabecera>29)throw new ErrorExcel('No se reconoce la cabecera en las primeras 30 filas. Selecciona la hoja de datos.');
 const heads=filas[cabecera].celdas.map(h=>cabeceraCsv(h??''));
 const indice=(...alias:string[])=>{const i=heads.flatMap((h,i)=>alias.includes(h)?[i]:[]);if(i.length>1)throw new ErrorExcel('Hay columnas ambiguas: '+alias[0]+'.');return i[0]??-1;};
 const columnas:Record<string,string[]>={run:['run','rut'],nombre:['nombrecompleto'],correo:['correoinstitucional','correosslepbcl','correosslepbgobcl'],unidad:['unidaddepartamento','unidadareadepartamento'],subdireccion:['subdireccion'],cargo:['cargo'],cese:['tipodecese'],categoria:['categoria','tipodeequipamiento'],marca:['marca'],modelo:['modelo'],serie:['nseriecompleto'],serieCorta:['ndeserie','nserie','serie'],inventario:['ninventario','inventario'],rbd:['rbd'],admin:['estadoadministrativo'],condicion:['estadocondicion','estadodecondicion','condiciontecnica'],situacion:['situacionubicacionactual'],observaciones:['detalleuobservaciones','observaciones'],acta:['linkentrega','enlaceacta'],cantidad:['cantidad']};
 const indices=Object.fromEntries(Object.entries(columnas).map(([k,a])=>[k,indice(...a)]));
 const requerido=tipo==='funcionarios'?['run','nombre','correo']:tipo==='vinculos'?['run','situacion']:['categoria','marca','modelo','admin'];
 for(const k of requerido)if(indices[k]<0)throw new ErrorExcel('Falta la columna '+k+'.');
 if(tipo==='establecimientos'&&indices.rbd<0)throw new ErrorExcel('Falta la columna RBD.');
 if(tipo!=='funcionarios'&&indices.serie<0&&indices.serieCorta<0)throw new ErrorExcel('Falta la columna de número de serie.');
 const get=(f:{fila:number;celdas:string[]},k:string)=>indices[k]>=0?(f.celdas[indices[k]]??'').trim():'';
 const datos=filas.slice(cabecera+1).filter(f=>(tipo==='funcionarios'?['run','nombre','correo']:['categoria','marca','modelo','serie','serieCorta','inventario']).some(k=>get(f,k)&&!['0','-','S/N','N/A'].includes(get(f,k))));
 const identificador=(s:string)=>/^(?:S\/?N|N\/?A|SIN (?:SERIE|INVENTARIO)|NO APLICA|-+|0)$/iu.test(s)?'':s;
 const serie=(f:typeof datos[number])=>identificador(get(f,indices.serie>=0?'serie':'serieCorta'));
 const veces=new Map<string,number>();
 for(const f of datos){for(const s of tipo==='funcionarios'?['r:'+get(f,'run').replace(/[.\s]/g,'').toUpperCase(),'c:'+get(f,'correo').toLowerCase()]:['s:'+serie(f).toUpperCase(),'i:'+identificador(get(f,'inventario')).toUpperCase()])if(s.slice(2))veces.set(s,(veces.get(s)??0)+1);}
 const operaciones:OperacionExcel[]=[],vista:VistaExcel[]=[],excluidas:{fila:number;motivo:string}[]=[],avisosGenerales=['La fecha de entrega se excluye. No se generan movimientos, actas ni cuentas de acceso.','Solo se guardan campos reconocidos. Se excluyen claves, PIN, metadatos y hojas ocultas.'];
 const categoriasPendientes=new Set<string>();let unidades=0;
 for(const f of datos){try{
  const aviso:string[]=[];const raw=(k:string)=>{const v=get(f,k);if(v.startsWith('#REVISAR_')||v==='#FECHA_INVALIDA')throw new ErrorExcel('Celda con error o fórmula sin valor guardado; recalcula y guarda el libro en Excel.');return v;};
  if(tipo==='funcionarios'){
   const rut=raw('run').replace(/[.\s]/g,'').toUpperCase(),correo=raw('correo').toLowerCase();
   if((veces.get('r:'+rut)??0)>1||(correo&&(veces.get('c:'+correo)??0)>1))throw new ErrorExcel('RUN o correo repetido en la hoja; revisar todas sus filas.');
   const cese=cabeceraCsv(raw('cese'));if(cese&&cese!=='vigencianormal')throw new ErrorExcel('Situación laboral histórica: revisar vigencia antes de crear la ficha.');
   if(!rut)throw new ErrorExcel('Falta RUN; no se identifica una persona por su nombre.');
   const d=validarFuncionario({nombre:raw('nombre'),rut,correo,unidad:raw('unidad'),subdireccion:raw('subdireccion'),cargo:raw('cargo'),fechaIngreso:'',activo:true});
   if(c.funcionarios.some(a=>a.rut===d.rut||correo&&a.correo===correo))throw new ErrorExcel('Ya existe una ficha por RUN o correo. Se conserva sin sobrescribir; revisar diferencias desde Funcionarios.');
   operaciones.push({fila:f.fila,datos:d});unidades++;vista.push({fila:f.fila,descripcion:d.nombre,accion:'Crear ficha, sin cuenta de acceso',aviso:'Fecha de ingreso y situación laboral no se deducen de fecha de cese.'});continue;
  }
  const s=serie(f),i=identificador(raw('inventario'));
  if(s.startsWith('#')||i.startsWith('#'))throw new ErrorExcel('Identificador con error de fórmula o sin valor guardado. Recalcula y guarda el libro en Excel.');
  if((s&&(veces.get('s:'+s.toUpperCase())??0)>1)||(i&&(veces.get('i:'+i.toUpperCase())??0)>1))throw new ErrorExcel('Serie o inventario repetido en la hoja: reconciliar antecedentes, sin elegir una fila automáticamente.');
  const coincidencias=c.equipos.filter(e=>s&&e.serie?.toUpperCase()===s.toUpperCase()||i&&e.inventario?.toUpperCase()===i.toUpperCase());
  if(tipo==='vinculos'){
   const rut=normalizarRut(raw('run').replace(/[.\s]/g,'').toUpperCase());if(!rut||!s)throw new ErrorExcel('Faltan RUN válido y serie completa para el vínculo.');
   if(cabeceraCsv(raw('situacion'))!=='asignadoafuncionario'||cabeceraCsv(raw('admin'))!=='activo')throw new ErrorExcel('Solo se vinculan asignaciones actuales Activo / Asignado a funcionario.');
   const persona=c.funcionarios.filter(p=>p.rut===rut&&p.activo);const equipo=coincidencias[0];
   if(persona.length!==1||coincidencias.length!==1||!equipo||equipo.serie?.toUpperCase()!==s.toUpperCase()||equipo.custodia!=='asignado'||equipo.estado!=='activo'||equipo.pendiente||!c.sedes.some(a=>a.id===equipo.sedeId&&a.tipo==='nivel_central'))throw new ErrorExcel('Se requiere una ficha activa y un equipo único de Nivel Central, asignado y sin revisión pendiente.');
   if(c.asignaciones.some(a=>a.equipoId===equipo.id))throw new ErrorExcel('El equipo ya tiene un vínculo vigente; se conserva sin reasignar.');
   operaciones.push({fila:f.fila,datos:{equipoId:equipo.id,version:equipo.version,funcionarioId:persona[0].id,funcionarioVersion:persona[0].version,rut}});unidades++;vista.push({fila:f.fila,descripcion:`${s} → ${persona[0].nombre} · RUN ${rut}`,accion:'Vincular por RUN y serie completa',aviso:'Revisa la correspondencia antes de confirmar. No genera un acta nueva.'});continue;
  }
  if(coincidencias.length)throw new ErrorExcel('Identificador ya registrado. Se conserva el equipo existente sin sobrescribirlo.');
  const admin=cabeceraCsv(raw('admin'));
  if(['inactivo','pendientedeinventario'].includes(admin))throw new ErrorExcel('Estado administrativo antiguo; requiere clasificación por TI antes de importar.');
  if(['robado','equiporobado','noencontrado'].includes(admin))throw new ErrorExcel('Antecedente de robo o pérdida: TI debe reconciliar y validar el caso, sin confirmar un incidente desde Excel.');
  if(!['activo','dadodebaja'].includes(admin))throw new ErrorExcel('Estado administrativo no reconocido.');
  let condicion=raw('condicion');
  if(!condicion||/^\d{4}-\d{2}-\d{2}$/.test(condicion)||/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(condicion)){
   condicion='Sin verificar';aviso.push('Condición pendiente de revisión; las fechas colocadas en esa columna se descartan.');
  }
  const situacion=cabeceraCsv(raw('situacion'));
  if(tipo==='central'&&situacion&&!['asignadoafuncionario','enbodegadeti'].includes(situacion))throw new ErrorExcel('Ubicación histórica sin asignación actual clara: revisar antes de importar.');
  if(tipo==='central'&&situacion==='enbodegadeti'){condicion='Bodega de TI';aviso.push('Ubicación física de bodega pendiente; no se deduce del archivo.');}
  const categoria=raw('categoria'),categoriaId=mapeo[categoria];let categoriaFinal=categoria;
  if(categoriaId){const elegida=c.categorias.find(x=>x.id===categoriaId&&x.activo);if(!elegida)throw new ErrorExcel('Correspondencia de categoría inválida.');categoriaFinal=elegida.nombre;}
  if(!c.categorias.some(x=>x.activo&&x.nombre.toLocaleLowerCase('es')===categoriaFinal.toLocaleLowerCase('es'))){categoriasPendientes.add(categoria);throw new ErrorExcel('Categoría sin correspondencia activa: selecciona su categoría y vuelve a preparar.');}
  // Lista cerrada: no trasladar columnas desconocidas ni valores secretos a antecedentesCarga.
  const cab=[...COLUMNAS_CARGA_INVENTARIO,'LINK ENTREGA','DETALLE U OBSERVACIONES'];
  const vals=cab.map(h=>{const at=heads.indexOf(cabeceraCsv(h));return at<0?'':f.celdas[at]??'';});
  const set=(h:string,v:string)=>{vals[cab.indexOf(h)]=v;};
  set('RBD',tipo==='central'?'NC':raw('rbd'));set('Categoria',categoriaFinal);set('N° DE SERIE',s);set('N° INVENTARIO',i);set('ESTADO CONDICION',condicion);set('CANTIDAD',raw('cantidad')||'1');set('ESTADO ADMINISTRATIVO',raw('admin'));set('LINK ENTREGA',raw('acta'));
  const csv=[cab,vals].map(row=>row.map(v=>'"'+v.replaceAll('"','""')+'"').join(';')).join('\n');
  const preparado=prepararCargaEquipos(csv,c.sedes,c.categorias);
  if(preparado.errores.length)throw new ErrorExcel(preparado.errores.join(' ').replace(/Fila 2: /g,''));
  const d=preparado.datos[0];if(tipo==='establecimientos'&&c.sedes.some(a=>a.id===d.sedeId&&a.tipo==='nivel_central'))throw new ErrorExcel('Esta modalidad no admite Nivel Central.');
  // No se conserva ni valida una fecha de entrega, tampoco en los antecedentes.
  d.fechaEntrega='';d.filaOrigen=f.fila;
  const n=d.cantidad;unidades+=n;if(unidades>5000)throw new ErrorExcel('La suma de unidades supera 5.000.');
  operaciones.push({fila:f.fila,datos:d});vista.push({fila:f.fila,descripcion:`${categoriaFinal} · ${d.marca} ${d.modelo} · ${s||'Serie pendiente'}`,accion:`Crear ${n} bien(es)`,aviso:[...aviso,...preparado.avisos.filter(a=>!a.includes('fecha de entrega')).map(a=>a.replace(/^Fila 2: /,''))].join(' ')});
 }catch(e){const motivo=e instanceof Error?e.message:'Fila no válida.';excluidas.push({fila:f.fila,motivo});}}
 if(unidades>5000)throw new ErrorExcel('La suma de unidades supera 5.000.');
 return {operaciones,vista,excluidas,totalFilas:datos.length,unidades,avisosGenerales,categoriasPendientes:[...categoriasPendientes]};
}
