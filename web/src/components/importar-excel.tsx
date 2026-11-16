'use client';
import {useState} from 'react';
import PanelResultados from '@/components/panel-resultados';
import {TIPOS_EXCEL,type TipoExcel} from '@/lib/importacion-excel/tipos';
import type {VistaExcel} from '@/lib/importacion-excel/preparar';
type Previa={id:string;vista:VistaExcel[];excluidas:{fila:number;motivo:string}[];totalFilas:number;unidades:number;avisos:string[];categoriasPendientes:string[];categorias:{id:string;nombre:string}[]};
function TablaRevision({filas,excluidas=false}:{filas:{fila:number;descripcion:string;accion?:string;aviso?:string}[];excluidas?:boolean}){
 const [pagina,setPagina]=useState(1),[limite,setLimite]=useState(50);const paginas=Math.max(1,Math.ceil(filas.length/limite)),p=Math.min(pagina,paginas);
 return <PanelResultados total={filas.length} descripcion={excluidas?'filas excluidas, sin guardar':'filas aptas para confirmar'} ruta="" limite={limite} filtros={{}} pagina={p} paginas={paginas} local={{id:excluidas?'excel-excluidas':'excel-previa',cambiarPagina:setPagina,cambiarLimite:n=>{setLimite(n);setPagina(1);}}}><div className="tabla-usuarios-contenedor" role="region" tabIndex={0} aria-label={excluidas?'Filas excluidas':'Vista previa de Excel'}><table className="tabla-datos tabla-catalogos"><thead><tr><th>Fila Excel</th><th>{excluidas?'Revisión necesaria':'Registro'}</th>{!excluidas&&<><th>Acción</th><th>Avisos</th></>}</tr></thead><tbody>{filas.slice((p-1)*limite,p*limite).map(f=><tr key={f.fila}><td>{f.fila}</td><td>{f.descripcion}</td>{!excluidas&&<><td>{f.accion}</td><td>{f.aviso||'Sin avisos'}</td></>}</tr>)}</tbody></table></div></PanelResultados>;
}
export default function ImportarExcel({tipos,inicial,p02=false}:{tipos:TipoExcel[];inicial:TipoExcel;p02?:boolean}){
 const [tipo,setTipo]=useState<TipoExcel>(inicial),[archivo,setArchivo]=useState<File|null>(null),[hojas,setHojas]=useState<string[]>([]),[hoja,setHoja]=useState(''),[previa,setPrevia]=useState<Previa|null>(null),[mapeo,setMapeo]=useState<Record<string,string>>({}),[pendiente,setPendiente]=useState(false),[mensaje,setMensaje]=useState(''),[aceptar,setAceptar]=useState(false),[anio,setAnio]=useState(''),[confirmarAnio,setConfirmarAnio]=useState(false);
 function limpiar(){setPrevia(null);setAceptar(false);setMensaje('');}
 async function enviar(operacion:'hojas'|'previa'|'confirmar'){
  setPendiente(true);setMensaje('');try{
   const f=new FormData();f.set('operacion',operacion);f.set('tipo',tipo);
   if(operacion==='confirmar'){f.set('id',previa?.id??'');f.set('aceptar',aceptar?'si':'no');}
   else{if(!archivo)throw new Error('Selecciona un Excel.');f.set('archivo',archivo);f.set('hoja',hoja);f.set('mapeo',JSON.stringify(mapeo));if(p02){f.set('anioNumeracion',anio);f.set('confirmarAnio',confirmarAnio?'si':'no');}}
   const r=await fetch(p02?'/api/p02/importaciones':'/api/importaciones/excel',{method:'POST',body:f}),d=await r.json();if(!r.ok)throw new Error(d.error||'No se pudo revisar la carga.');
   if(operacion==='hojas'){setHojas(d.hojas);setHoja(d.hojas[0]??'');setPrevia(null);}
   else if(operacion==='previa'){setPrevia(d);setAceptar(false);setMensaje('Vista previa preparada. Revisa las filas aptas y excluidas. Vence en 30 minutos.');}
   else{setPrevia(null);setAceptar(false);setMensaje(d.guardado.repetida?'Esta hoja ya estaba confirmada. No se duplicaron registros.':`Carga confirmada: ${d.guardado.cantidad} ${tipo==='vinculos'?'vínculos':tipo==='funcionarios'?'fichas':'bienes'}.`);}
  }catch(e){setMensaje(e instanceof Error?e.message:'No se pudo procesar la carga.');if(operacion==='confirmar')setAceptar(false);}finally{setPendiente(false);}
 }
 return <section aria-busy={pendiente} className="carga-equipos"><form className="formulario-catalogos" onSubmit={e=>{e.preventDefault();void enviar(hojas.length?'previa':'hojas');}}>
  {!p02&&<div className="campo-catalogos"><label htmlFor="excel-tipo">Qué vas a importar *</label><select id="excel-tipo" value={tipo} disabled={pendiente} onChange={e=>{setTipo(e.target.value as TipoExcel);limpiar();setMapeo({});}}>{tipos.map(t=><option key={t} value={t}>{TIPOS_EXCEL[t]}</option>)}</select></div>}
  <div className="campo-catalogos"><label htmlFor="excel-archivo">Archivo Excel (.xlsx, máximo 5 MB) *</label><input id="excel-archivo" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={pendiente} onChange={e=>{setArchivo(e.target.files?.[0]??null);setHojas([]);setHoja('');setMapeo({});limpiar();}} required/></div>
  {hojas.length>0&&<div className="campo-catalogos"><label htmlFor="excel-hoja">Hoja de datos *</label><select id="excel-hoja" value={hoja} disabled={pendiente} onChange={e=>{setHoja(e.target.value);setMapeo({});limpiar();}}>{hojas.map(h=><option key={h}>{h}</option>)}</select></div>}
  {p02&&<fieldset className="panel-catalogos" disabled={pendiente}><legend>Solo para bienes sin año de OC y sin número anterior</legend><div className="campo-catalogos"><label htmlFor="p02-anio">Año de numeración del lote (opcional si todas las OC tienen año)</label><input id="p02-anio" type="number" min="1900" max="2099" value={anio} onChange={e=>{setAnio(e.target.value);setConfirmarAnio(false);limpiar();}}/></div>{anio&&<label><input type="checkbox" checked={confirmarAnio} onChange={e=>{setConfirmarAnio(e.target.checked);limpiar();}}/> Confirmo este año de numeración. La OC y fecha de compra desconocidas permanecerán vacías.</label>}</fieldset>}
  <div className="acciones-catalogos"><button type="submit" className="btn btn-primary" disabled={pendiente||!archivo}>{hojas.length?'Preparar vista previa':'Leer hojas del Excel'}</button></div><p>* Estos datos son obligatorios.</p>
 </form>
 <p role="status" aria-live="polite">{pendiente?'Procesando…':mensaje}</p>
 {previa&&<><p>{previa.totalFilas} filas revisadas · {previa.unidades} {tipo==='vinculos'?'vínculos':tipo==='funcionarios'?'fichas':'bienes'} aptos · {previa.excluidas.length} filas excluidas.</p>{previa.avisos.map(a=><p key={a}>{a}</p>)}
 {previa.categoriasPendientes.length>0&&<fieldset disabled={pendiente} className="panel-catalogos"><legend>Correspondencias de categorías</legend><p>Selecciona la categoría existente y vuelve a preparar la vista previa.</p>{previa.categoriasPendientes.map((c,i)=><div className="campo-catalogos" key={c}><label htmlFor={'categoria-excel-'+i}>{c}</label><select id={'categoria-excel-'+i} value={mapeo[c]??''} onChange={e=>{setMapeo(m=>{const nuevo={...m};if(e.target.value)nuevo[c]=e.target.value;else delete nuevo[c];return nuevo;});setPrevia(p=>p?{...p,id:''}:null);setAceptar(false);}}><option value="">Pendiente de elegir</option>{previa.categorias.map(x=><option key={x.id} value={x.id}>{x.nombre}</option>)}</select></div>)}</fieldset>}
 <TablaRevision key={previa.id+':aptas'} filas={previa.vista}/>{previa.excluidas.length>0&&<TablaRevision key={previa.id+':excluidas'} excluidas filas={previa.excluidas.map(f=>({fila:f.fila,descripcion:f.motivo}))}/>}
 {previa.id&&<div className="panel-catalogos"><label><input type="checkbox" checked={aceptar} disabled={pendiente} onChange={e=>setAceptar(e.target.checked)}/> Revisé las correspondencias. Confirmo solo las filas aptas; las excluidas no se guardarán.</label><p>La confirmación vuelve a comprobar permisos y conflictos. Si cambió un registro, se cancela toda la carga. {p02?'Los números faltantes se generan dentro de esta misma confirmación; no se crean actas ni movimientos.':'Los vínculos a funcionarios se realizan después de importar personas e inventario, en una revisión separada.'}</p><button type="button" className="btn btn-primary" disabled={pendiente||!aceptar} onClick={()=>void enviar('confirmar')}>Confirmar filas aptas</button></div>}
 </>}
 </section>;
}
