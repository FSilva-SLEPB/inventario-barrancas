/** Traduce únicamente errores conocidos; nunca expone mensajes SQL arbitrarios. */
export function mensajePermisoPerfil(mensaje?:string){
 if(mensaje==='El perfil conserva sus límites funcionales aunque cambie de nombre')return 'Algún permiso seleccionado no está habilitado para este perfil predefinido. Revisa sus permisos; no se guardaron cambios.';
 if(mensaje==='Clasificación protegida')return 'No puedes cambiar el tipo de un perfil existente. El tipo define sus límites de seguridad; no es su estado activo o desactivado.';
 if(mensaje==='Facultad reservada a UTIC')return 'Este permiso corresponde a los perfiles administrativos de UTIC; no se puede asignar a un perfil operativo.';
 if(mensaje==='El perfil personal solo accede a datos propios y directorio autorizado')return 'El perfil personal permite únicamente datos propios, sus correcciones y el directorio autorizado.';
 if(mensaje==='El perfil del sistema conserva sus facultades')return 'El Administrador del sistema debe conservar todos sus permisos.';
 return 'La combinación de permisos y alcances no está permitida para este tipo de perfil. No se guardaron cambios.';
}
