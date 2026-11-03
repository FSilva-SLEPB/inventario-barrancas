import {puedeAdministrar,puedeGestionarDependencias,requiereSede,type RolAcceso} from '@/lib/politica-acceso';
export type AccesoModulo={href:string;titulo:string;descripcion:string;icono:string};
export type ModuloSistema={id:'inventario'|'directorio'|'mantenedores'|'solicitudes';titulo:string;href:string;descripcion:string;accesos:AccesoModulo[]};
export function modulosSistema(rol:RolAcceso):ModuloSistema[]{
 const admin=puedeAdministrar(rol),gestion=puedeGestionarDependencias(rol),local=requiereSede(rol);
 return [{id:'inventario',titulo:'Inventario',href:'/inventario',descripcion:'Equipos, entregas e incidentes, con identificación e historial de cada bien.',accesos:[
  ...(!local?[{href:'/inventario/nivel-central',titulo:'Inventario Nivel Central',descripcion:'Equipos y bienes de Nivel Central.',icono:'NC'}]:[]),
  {href:'/inventario/p02',titulo:local?'Inventario de mi sede':'Inventario P02',descripcion:'Establecimientos educacionales, jardines infantiles y salas cunas.',icono:'P02'},
  ...(gestion?[{href:'/inventario/registro',titulo:'Registro de equipos',descripcion:admin?'Ingreso individual y carga masiva de equipos.':'Registrar equipos propios de la sede.',icono:'+'}]:[]),
  ...(admin?[{href:'/inventario/bodega-ti',titulo:'Bodega TI',descripcion:'Equipos destinados a establecimientos y pendientes de entrega.',icono:'TI'},
   {href:'/inventario/movimientos',titulo:'Movimientos y actas',descripcion:'Entregas registradas, personas receptoras y antecedentes.',icono:'↔'}]:[]),
  {href:'/inventario/celulares',titulo:'Inventario de celulares',descripcion:'Espacio reservado; gestión de celulares pendiente de definir.',icono:'CEL'},
  {href:'/inventario/robos/dashboard',titulo:'Dashboard de robos',descripcion:'Indicadores y gráficos por sede, comuna, categoría y período.',icono:'▥'},
  {href:'/inventario/robos',titulo:'Consolidado de robos',descripcion:'Equipos reportados, robos validados y recuperaciones.',icono:'!'}
 ]},...(admin?[{id:'directorio' as const,titulo:'Directorio',href:'/directorio',descripcion:'Establecimientos, jardines y salas cuna, con los datos de sus directores y directoras.',accesos:[
  {href:'/directorio/establecimientos',titulo:'Directorio de establecimientos',descripcion:'RBD, nombre, dirección, comuna y correo del establecimiento.',icono:'EE'},
  {href:'/directorio/directores',titulo:'Directores/as EE.EE.',descripcion:'Identidad, contacto y estado contractual del director o directora.',icono:'DIR'},
  {href:'/directorio/jardines',titulo:'Directorio JI y SC',descripcion:'Datos de jardines infantiles y salas cuna.',icono:'JI'},
  {href:'/directorio/directoras',titulo:'Directoras JI y SC',descripcion:'Identidad y estado contractual de las directoras.',icono:'DIR'}
 ]}]:[]),{id:'mantenedores',titulo:'Mantenedores',href:'/mantenedores',descripcion:'Catálogos, ubicaciones y accesos al sistema.',accesos:[
  ...(admin?[{href:'/mantenedores/funcionarios',titulo:'Funcionarios de Nivel Central',descripcion:'Fichas de personas, unidad, contacto e historial de cambios.',icono:'NC'},
   {href:'/mantenedores/usuarios',titulo:'Usuarios y perfiles',descripcion:'Cuentas autorizadas, perfiles y alcance de acceso.',icono:'US'}]:[]),
  {href:'/mantenedores/categorias',titulo:'Categorías de bienes',descripcion:'Tipos de equipos y bienes del inventario.',icono:'CA'},
  {href:'/mantenedores/sedes',titulo:'Sedes',descripcion:'Establecimientos, jardines, salas cunas y Nivel Central.',icono:'SE'},
  {href:'/mantenedores/dependencias',titulo:'Dependencias',descripcion:'Ubicaciones internas de cada sede.',icono:'DE'}
 ]},{id:'solicitudes',titulo:'Solicitudes',href:'/solicitudes',descripcion:'Solicitudes de insumos para establecimientos educacionales, JISC y Nivel Central.',accesos:[]}];
}
