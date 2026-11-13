// Una ruta concede únicamente el recurso indicado; las acciones se vuelven a comprobar en SQL.
export const RUTAS_RBAC:Record<string,string>={
 '/gestor-insumos':'gestion_insumos.consultar',
 '/inventario/nivel-central':'equipos.consultar','/inventario/p02':'equipos.consultar','/inventario/registro':'equipos.registrar','/inventario/carga':'equipos.registrar',
 '/inventario/celulares':'celulares.consultar','/inventario/bodega-ti':'bodega.consultar','/inventario/movimientos':'movimientos.consultar','/inventario/prestamos':'prestamos.consultar','/inventario/actas':'actas.consultar','/inventario/incidentes':'incidentes.consultar','/inventario/robos':'incidentes.consultar',
 '/mantenedores/asignaciones':'funcionarios.editar',
 '/mantenedores/usuarios':'usuarios_operativos.consultar','/mantenedores/perfiles':'perfiles.consultar','/mantenedores/funcionarios':'funcionarios.consultar','/mantenedores/categorias':'categorias.consultar','/mantenedores/sedes':'sedes.consultar','/mantenedores/dependencias':'dependencias.consultar','/mantenedores/insumos':'catalogo_insumos.consultar',
 '/directorio/establecimientos':'directorio_institucional.consultar','/directorio/jardines':'directorio_institucional.consultar','/directorio/directores':'directorio_personas.consultar','/directorio/directoras':'directorio_personas.consultar','/directorio/cargar':'directorio_institucional.registrar',
 '/insumos/solicitud':'solicitudes_insumos.registrar','/insumos/seguimiento':'seguimiento_insumos.consultar','/insumos/historial':'historial_insumos.consultar',
 '/mi-cuenta':'mis_datos.consultar','/mi-inventario':'mis_asignaciones.consultar','/correcciones':'correcciones.consultar','/directorio-autorizado':'directorio_autorizado.consultar',
 '/documentacion':'perfiles.consultar',
};
export function permisoRuta(ruta:string):string|null{
 const r=Object.keys(RUTAS_RBAC).filter(k=>ruta===k||ruta.startsWith(k+'/')).sort((a,b)=>b.length-a.length)[0];
 if(r)return RUTAS_RBAC[r];
 if(/^\/inventario\/[0-9a-f-]{36}(\/|$)/i.test(ruta))return 'equipos.consultar';
 if(ruta.startsWith('/mantenedores/directorio-'))return 'directorio_institucional.consultar';
 return null;
}
