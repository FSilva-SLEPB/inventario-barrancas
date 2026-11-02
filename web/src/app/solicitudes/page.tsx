import {exigirAcceso} from '@/lib/acceso';
import {modulosSistema} from '@/lib/modulos';
import PortadaModulo from '@/components/portada-modulo';
export const metadata={title:'Solicitudes | SLEP Barrancas'};
export default async function Solicitudes(){const actor=await exigirAcceso();return <PortadaModulo modulo={modulosSistema(actor.rol).find(m=>m.id==='solicitudes')!}><section className="estado-modulo"><span className="estado-etiqueta">Próxima etapa</span><h2>Solicitudes de insumos</h2><p>Este módulo se encuentra en desarrollo. Cuando esté disponible, sus opciones aparecerán aquí y en el menú lateral.</p></section></PortadaModulo>;}
