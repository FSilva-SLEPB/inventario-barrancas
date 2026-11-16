import PaginaIdentificacion from '@/components/pagina-identificacion';
export const metadata={title:'Etiquetas QR | SLEP Barrancas'};
export default function Pagina(p:{searchParams:Promise<Record<string,string|string[]|undefined>>}){return <PaginaIdentificacion modo="etiquetas" {...p}/>;}
