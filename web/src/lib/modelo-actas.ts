import type {DatosActa} from '@/lib/validacion-actas';
// Contenido institucional homologado a partir de los modelos Word proporcionados por Felipe.
export function tituloDocumentoActa(d:DatosActa){
 if(d.tipo==='entrega_insumo')return 'Acta de entrega de insumos';
 if(d.tipo==='cambio')return d.clase==='celular'?'Acta de cambio de celulares':'Acta de cambio de equipamiento';
 if(d.tipo==='traspaso')return d.clase==='celular'?'Acta de traspaso de celulares':'Acta de traspaso de equipamiento';
 if(d.tipo==='entrega_historica')return 'Acta de entrega registrada';
 if(d.tipo==='prestamo')return 'Acta de préstamo temporal'+(d.sedeTipo==='nivel_central'?' · Nivel Central':'');
 if(d.tipo==='devolucion_prestamo')return 'Acta de devolución de préstamo';
 if(d.tipo==='devolucion')return d.clase==='celular'?'Acta de devolución de celulares':'Acta de devolución de equipos';
 const base=d.clase==='celular'?'Acta de asignación de celulares':'Acta de asignación';
 return base+(d.sedeTipo==='nivel_central'?' · Nivel Central':d.sedeTipo==='establecimiento'?' · Establecimiento educacional':d.sedeTipo==='jardin_infantil'?' · Jardines infantiles y salas cuna':'');
}
export function condicionesActa(d:DatosActa){
 if(d.tipo==='entrega_insumo')return ['Se deja constancia de los insumos y cantidades efectivamente recibidos, según el detalle y las observaciones de esta acta.'];
 if(d.tipo==='devolucion'||d.tipo==='devolucion_prestamo')return ['La Unidad TIC recibe los bienes en el estado indicado y deja constancia de los accesorios faltantes y observaciones.'];
 return [
  'Los bienes se reciben en el estado de funcionamiento indicado en el detalle y en las observaciones.',
  'El uso del bien debe ser exclusivo para los fines que establezca el Servicio y deberá hacer buen uso de este.',
  'Se tomará como una falta grave su comercialización.',
  'En caso de hurto o robo, deberá proceder de forma inmediata con la denuncia en el órgano correspondiente y notificar por escrito a su jefatura directa con copia a soporteti@slepb.gob.cl y robos@slepb.gob.cl como plazo máximo al día hábil siguiente de ocurrido el evento (aviso el mismo día o al día siguiente).',
  'El daño o extravío del bien será de absoluta responsabilidad del usuario y el hecho será investigado de conformidad a las disposiciones vigentes.',
  ...(d.tipo==='prestamo'?['Deberá devolver los bienes y sus accesorios en la fecha acordada, en las mismas condiciones de entrega, salvo el desgaste propio del uso normal.']:d.sedeTipo==='nivel_central'?['En caso de término de relación laboral, el usuario deberá devolver los bienes recibidos en un plazo máximo de 3 días hábiles.']:[]),
 ];
}
