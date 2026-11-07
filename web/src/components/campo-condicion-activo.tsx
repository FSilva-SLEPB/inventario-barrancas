import {ESTADOS_CONDICION_ACTIVO} from '@/lib/estados-activo';
import {CONDICIONES} from '@/lib/validacion-equipos';
export default function CampoCondicionActivo({id,valor,administrativo='activo',existente=true}:{id:string;valor:string;administrativo?:string;existente?:boolean}){
 const bloqueado=administrativo!=='activo';
 return <div className="campo-catalogos"><label htmlFor={id}>Estado de condición</label><select id={id} name={bloqueado?undefined:'condicionTecnica'} disabled={bloqueado} required={!bloqueado} defaultValue={bloqueado||!existente&&!Object.hasOwn(ESTADOS_CONDICION_ACTIVO,valor)?'':valor}>
 {bloqueado?<option value=""></option>:<option value="">Selecciona una condición</option>}
 {existente&&!bloqueado&&valor!==''&&!Object.hasOwn(ESTADOS_CONDICION_ACTIVO,valor)&&<option value={valor}>{CONDICIONES[valor as keyof typeof CONDICIONES]??'Selecciona una condición'} (pendiente de clasificación)</option>}
 {Object.entries(ESTADOS_CONDICION_ACTIVO).map(([k,t])=><option key={k} value={k}>{t}</option>)}</select>{bloqueado&&<input type="hidden" name="condicionTecnica" value=""/>}</div>;
}
