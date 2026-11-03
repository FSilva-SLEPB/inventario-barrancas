export function destinoRobosAnterior(p:Record<string,string|string[]|undefined>){
 const filtros=new URLSearchParams();for(const k of ['ambito','sede','comuna','estado','desde','hasta','q']){const v=p[k];if(typeof v==='string'&&v.length<=150&&!/\p{Cc}/u.test(v))filtros.set(k,v);}
 return '/inventario/robos'+(filtros.size?'?'+filtros:'');
}
