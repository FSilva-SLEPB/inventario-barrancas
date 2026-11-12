import {esAutorizacionRbac,tienePermiso,type AutorizacionRbac} from '@/lib/rbac';
import {permisoRuta} from '@/lib/rbac-rutas';
import {puedeAdministrar,puedeSolicitarInsumos,puedeGestionarInsumos,requiereSede,type RolAcceso} from '@/lib/politica-acceso';
export type AccesoModulo={href:string;titulo:string;descripcion:string;icono:string;externo?:boolean};
export type ModuloSistema={id:'inventario'|'directorio'|'mantenedores'|'solicitudes';titulo:string;href:string;descripcion:string;accesos:AccesoModulo[]};
export function modulosSistema(entrada:RolAcceso|(Partial<AutorizacionRbac>&{rol:RolAcceso})):ModuloSistema[]{
 if(esAutorizacionRbac(entrada)){
  const todos=modulosSistema('administrador');
  todos.find(m=>m.id==='inventario')!.accesos.push({href:'/inventario/actas',titulo:'Actas emitidas',descripcion:'Consultar documentos conservados, imprimir y descargar según permisos.',icono:'ACT'});
  todos.find(m=>m.id==='mantenedores')!.accesos.push({href:'/mantenedores/perfiles',titulo:'Perfiles y permisos',descripcion:'Permisos por recurso y acción, alcances e historial.',icono:'PR'});
  if(['sistema','utic'].includes(entrada.clasePerfil)&&tienePermiso(entrada,'funcionarios','editar'))todos.find(m=>m.id==='mantenedores')!.accesos.push({href:'/mantenedores/asignaciones',titulo:'Vínculos de inventario personal',descripcion:'Vincular registros previos a su funcionario, con revisión e historial.',icono:'VP'});
  return todos.map(m=>({...m,accesos:m.accesos.filter(a=>{if(a.href==='/inventario/nivel-central'&&entrada.alcance!=='global')return false;const p=permisoRuta(a.href);return p?entrada.permisos.includes(p):false;}).map(a=>a.href==='/insumos/seguimiento'&&!tienePermiso(entrada,'seguimiento_insumos','aprobar')&&!tienePermiso(entrada,'seguimiento_insumos','confirmar')?{...a,titulo:'Seguimiento de insumos',descripcion:'Consulta del avance de solicitudes autorizadas.'}:a.href==='/inventario/p02'&&entrada.alcance==='sede'?{...a,titulo:'Inventario de mi sede'}:a)})).filter(m=>m.accesos.length>0);
 }
 const rol=typeof entrada==='string'?entrada:entrada.rol;
 const admin=puedeAdministrar(rol),local=requiereSede(rol);
 const modulos:ModuloSistema[]=[{id:'inventario',titulo:'Inventario',href:'/inventario',descripcion:'Equipos, entregas e incidentes, con identificación e historial de cada bien.',accesos:[
  ...(!local?[{href:'/inventario/nivel-central',titulo:'Inventario Nivel Central',descripcion:'Equipos y bienes de Nivel Central.',icono:'NC'}]:[]),
  {href:'/inventario/p02',titulo:local?'Inventario de mi sede':'Inventario P02',descripcion:'Establecimientos educacionales, jardines infantiles y salas cunas.',icono:'P02'},
  ...(admin?[{href:'/inventario/bodega-ti',titulo:'Bodega TI',descripcion:'Equipos destinados a establecimientos y pendientes de entrega.',icono:'TI'},
   {href:'/inventario/prestamos',titulo:'Préstamos',descripcion:'Préstamos temporales desde Bodega TI, plazos y devoluciones vinculadas.',icono:'↔'},
   {href:'/inventario/movimientos',titulo:'Movimientos y actas',descripcion:'Entregas registradas, personas receptoras y antecedentes.',icono:'↔'}]:[]),
  {href:'/inventario/celulares',titulo:'Inventario de celulares',descripcion:'Equipos celulares y números asociados de establecimientos, jardines y Nivel Central.',icono:'CEL'},
  {href:'/inventario/incidentes',titulo:'Reportes y validación de TI',descripcion:'Reportar robos, sustracciones o daños y consultar su revisión.',icono:'!'},
  {href:'/inventario/robos',titulo:'Consolidado de robos',descripcion:'Equipos reportados, robos validados y recuperaciones.',icono:'!'}
 ]},...(admin?[{id:'directorio' as const,titulo:'Directorio',href:'/directorio',descripcion:'Establecimientos, jardines y salas cuna, con los datos de sus directores y directoras.',accesos:[
  {href:'/directorio/establecimientos',titulo:'Directorio de establecimientos',descripcion:'RBD, nombre, dirección, comuna y correo del establecimiento.',icono:'EE'},
  {href:'/directorio/directores',titulo:'Directores/as EE.EE.',descripcion:'Identidad, contacto y estado contractual del director o directora.',icono:'DIR'},
  {href:'/directorio/jardines',titulo:'Directorio JI y SC',descripcion:'Datos de jardines infantiles y salas cuna.',icono:'JI'},
  {href:'/directorio/directoras',titulo:'Directoras JI y SC',descripcion:'Identidad y estado contractual de las directoras.',icono:'DIR'}
 ]}]:[]),{id:'mantenedores',titulo:'Mantenedores',href:'/mantenedores',descripcion:'Catálogos, ubicaciones y accesos al sistema.',accesos:[
  ...(admin?[{href:'/mantenedores/funcionarios',titulo:'Funcionarios de Nivel Central',descripcion:'Fichas de personas, unidad, contacto e historial de cambios.',icono:'NC'},
   {href:'/mantenedores/usuarios',titulo:'Usuarios y perfiles',descripcion:'Cuentas autorizadas, perfiles y alcance de acceso.',icono:'US'}]:[]),
  ...(puedeGestionarInsumos(rol)?[{href:'/mantenedores/insumos',titulo:'Catálogo de insumos',descripcion:'Productos, stock e ingresos por orden de compra.',icono:'IN'}]:[]),
  ...(rol!=='gestor_insumos'?[
  {href:'/mantenedores/categorias',titulo:'Categorías de bienes',descripcion:'Tipos de equipos y bienes del inventario.',icono:'CA'},
  {href:'/mantenedores/sedes',titulo:'Sedes',descripcion:'Establecimientos, jardines, salas cunas y Nivel Central.',icono:'SE'},
  {href:'/mantenedores/dependencias',titulo:'Dependencias',descripcion:'Ubicaciones internas de cada sede.',icono:'DE'}]:[]),
 ]},{id:'solicitudes',titulo:'Solicitudes de insumos',href:'/insumos',descripcion:'Solicitudes de insumos para establecimientos educacionales, jardines infantiles y Nivel Central.',accesos:[
  ...(puedeSolicitarInsumos(rol)?[
   {href:'/insumos/solicitud',titulo:'Solicitud de insumos',descripcion:'Crear y enviar una nueva solicitud de insumos.',icono:'+'}]:[]),
   {href:'/insumos/seguimiento',titulo:puedeGestionarInsumos(rol)?'Gestor de insumos':'Seguimiento de insumos',descripcion:puedeGestionarInsumos(rol)?'Validar solicitudes, aprobar cantidades y confirmar entregas.':'Revisar el estado y avance de las solicitudes.',icono:'SG'},
   {href:'/insumos/historial',titulo:'Historial de insumos',descripcion:'Consultar el historial de solicitudes realizadas.',icono:'HI'},
 ]}];
 return rol==='gestor_insumos'?modulos.filter(m=>m.id==='solicitudes'||m.id==='mantenedores'):modulos;
}
