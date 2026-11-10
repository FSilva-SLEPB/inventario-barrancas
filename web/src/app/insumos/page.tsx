import Link from "next/link";
import {exigirAcceso} from "@/lib/acceso";
export const metadata={title:'Insumos | SLEP Barrancas'};
export default async function InsumosLanding(){
 await exigirAcceso();
 const cards=[
  {href:'/insumos/solicitud',titulo:'Solicitud de insumos',descripcion:'Crea y envía una nueva solicitud de insumos para tu establecimiento.'},
  {href:'/insumos/seguimiento',titulo:'Seguimiento de insumos',descripcion:'Revisa el estado y avance de las solicitudes en curso.'},
  {href:'/insumos/historial',titulo:'Historial de insumos',descripcion:'Consulta el historial de solicitudes realizadas y sus resultados.'},
 ];
 return <main>
  <header>
   <h1>Insumos</h1>
   <p className="descripcion-pagina">Selecciona una opción para gestionar solicitudes de insumos.</p>
  </header>
  <section style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:'1rem',marginTop:'1rem'}}>
   {cards.map(c=>(
    <Link key={c.href} href={c.href} className="panel-catalogos" style={{display:'grid',gap:'.5rem',padding:'1.25rem',textDecoration:'none',color:'inherit'}}>
     <h2 style={{margin:0,fontSize:'1.1rem'}}>{c.titulo}</h2>
     <p style={{margin:0}} className="descripcion-pagina">{c.descripcion}</p>
     <span className="btn btn-primary btn-sm" style={{justifySelf:'start',marginTop:'.25rem'}}>Ingresar</span>
    </Link>
   ))}
  </section>
 </main>;
}
