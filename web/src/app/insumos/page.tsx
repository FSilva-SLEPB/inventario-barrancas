import {exigirAcceso} from '@/lib/acceso';
import {modulosSistema} from '@/lib/modulos';
import {puedeGestionarInsumos} from '@/lib/politica-acceso';
import PortadaModulo from '@/components/portada-modulo';
export const metadata={title:'Solicitudes de insumos | SLEP Barrancas'};
export default async function InsumosLanding(){const actor=await exigirAcceso('insumos');return <PortadaModulo modulo={modulosSistema(actor.rol).find(m=>m.id==='solicitudes')!}>{puedeGestionarInsumos(actor.rol)&&<p className="ayuda-catalogos">En Gestor de insumos puedes validar la solicitud, aprobar cantidades y reservar stock. Al confirmar la entrega se descuentan las cantidades entregadas y se genera el acta para imprimir, descargar o enviar por correo.</p>}</PortadaModulo>;}
