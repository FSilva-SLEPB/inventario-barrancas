import type {VistaInformeInsumos} from './filtros-gestor-insumos';
export const columnasInsumos:Record<VistaInformeInsumos,[string,string][]>= {
 dashboard:[['seccion','Sección'],['concepto','Concepto'],['unidad','Unidad'],['cantidad','Cantidad']],
 sedes:[['rbd','RBD'],['sede','Establecimiento / sede'],['tipo','Tipo'],['solicitudes','Solicitudes no canceladas'],['pendientes','Pendientes'],['entregadas','Entregadas']],
 productos:[['codigo','Código'],['producto','Producto'],['categoria','Categoría'],['unidad','Unidad'],['solicitado','Solicitado'],['aprobado','Aprobado'],['entregado','Entregado'],['solicitudes','Solicitudes no canceladas']],
 consolidado:[['rbd','RBD'],['sede','Establecimiento / sede'],['codigo','Código'],['producto','Producto'],['unidad','Unidad'],['entregado','Entregado'],['entregas','Entregas'],['primera_entrega','Primera entrega'],['ultima_entrega','Última entrega']],
 detalle:[['solicitud_id','ID solicitud'],['rbd','RBD'],['sede','Establecimiento / sede'],['codigo','Código'],['producto','Producto'],['unidad','Unidad'],['solicitado','Solicitado'],['aprobado','Aprobado'],['entregado','Entregado'],['estado','Estado'],['fecha_solicitud','Fecha solicitud'],['fecha_validacion','Fecha validación TI'],['fecha_entrega','Fecha entrega']],
 stock:[['codigo','Código'],['producto','Producto'],['categoria','Categoría'],['unidad','Unidad'],['existencia','Existencia'],['reservado','Reservado'],['disponible','Disponible'],['activo','Producto activo']]
};
export function valorInforme(v:unknown){return typeof v==='boolean'?(v?'Sí':'No'):String(v??'');}
