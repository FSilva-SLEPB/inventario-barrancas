export type TipoIcono='ver'|'editar'|'devolver'|'asignar'|'acta'|'imprimir'|'correo'|'descargar'|'prestar';
export default function IconoAccion({tipo}:{tipo:TipoIcono}){
 const trazos:Record<TipoIcono,string>={prestar:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M12 6v6l4 2',ver:'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',editar:'m15 5 4 4 M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15z',devolver:'m8 4-5 5 5 5 M3 9h11a7 7 0 0 1 0 14',asignar:'M4 12h16 m-6-6 6 6-6 6',acta:'M14 2H5v20h14V7z M14 2v6h5 M8 12h8 M8 16h8',imprimir:'M6 8V2h12v6 M6 17H3V8h18v9h-3 M6 14h12v8H6z M17 11h1',correo:'M2 4h20v16H2z m0 0 10 9L22 4',descargar:'M12 2v14 m-5-5 5 5 5-5 M3 17v5h18v-5'};
 return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={trazos[tipo]}/></svg>;
}
