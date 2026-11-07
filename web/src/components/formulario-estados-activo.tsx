'use client';

import {useId, useRef, useState} from 'react';
import {
  ESTADOS_ADMINISTRATIVOS_ACTIVO, ESTADOS_CONDICION_ACTIVO,
  cambiarCondicionActivo, cambiarEstadoAdministrativo, cambiarTextoActivo,
  condicionBloqueada, crearRegistroEstadoActivo,
  ejecutarProtocoloSeguridad as protocoloSimulado, registroSoloLectura,
  type DatosInicialesEstadoActivo, type EstadoAdministrativoActivo,
  type EstadoCondicionActivo, type RegistroEstadoActivo,
} from '@/lib/estados-activo';

export type PropsFormularioEstadosActivo = {
  activoId: string;
  inicial?: DatosInicialesEstadoActivo;
  ejecutarProtocoloSeguridad?: (activoId: string) => void | Promise<void>;
  onCambio?: (actual: RegistroEstadoActivo, anterior: RegistroEstadoActivo) => void;
  onGuardar?: (registro: RegistroEstadoActivo) => void | Promise<void>;
};
export default function FormularioEstadosActivo(props: PropsFormularioEstadosActivo) {
  return <EditorEstadosActivo key={props.activoId} {...props}/>;
}
function EditorEstadosActivo({activoId, inicial, ejecutarProtocoloSeguridad = protocoloSimulado, onCambio, onGuardar}: PropsFormularioEstadosActivo) {
  const [registro, setRegistro] = useState(() => crearRegistroEstadoActivo(activoId, inicial));
  const vigente = useRef(registro);
  const [guardando, setGuardando] = useState(false);
  const guardadoEnCurso = useRef(false);
  const numeroTransicion = useRef(0);
  const [error, setError] = useState('');
  const id = useId();
  const soloLectura = registroSoloLectura(registro);
  const bloqueado = soloLectura || guardando;
  const aplicar = (siguiente: RegistroEstadoActivo) => {
    const anterior = vigente.current;
    if (siguiente === anterior) return;
    vigente.current = siguiente;
    setRegistro(siguiente);
    setError('');
    try {onCambio?.(siguiente, anterior);} catch {setError('No se pudo notificar el cambio del registro.');}
  };
  const cambiarAdministrativo = (valor: EstadoAdministrativoActivo) => {
    if (guardadoEnCurso.current) return;
    const cambio = cambiarEstadoAdministrativo(vigente.current, valor);
    if (cambio.registro === vigente.current) return;
    const transicion = ++numeroTransicion.current;
    aplicar(cambio.registro);
    if (cambio.protocoloSeguridad) {
      // El efecto pertenece al evento, nunca a un render, efecto o updater de React.
      try {
        Promise.resolve(ejecutarProtocoloSeguridad(activoId)).catch(() => {
          if (numeroTransicion.current === transicion) setError('No se pudo ejecutar el callback de seguridad. El estado mantiene sus restricciones.');
        });
      } catch {
        setError('No se pudo ejecutar el callback de seguridad. El estado mantiene sus restricciones.');
      }
    }
  };
  return <form className="formulario-catalogos formulario-estados-activo" aria-label="Estados del activo" aria-busy={guardando} onReset={e => e.preventDefault()} onSubmit={async e => {
    e.preventDefault();
    if (guardadoEnCurso.current || registroSoloLectura(vigente.current) || !onGuardar) return;
    guardadoEnCurso.current = true;
    setGuardando(true);
    setError('');
    try {await onGuardar(vigente.current);} catch {setError('No se pudo guardar. Los valores del formulario se conservan.');}
    finally {guardadoEnCurso.current = false;setGuardando(false);}
  }}>
    <p><strong>Activo:</strong> {activoId}</p>
    <p id={id + '-situacion'} role="status">{soloLectura ? 'Registro archivado como histórico. Solo lectura.' : condicionBloqueada(registro.estadoAdministrativo) ? 'La condición queda vacía y bloqueada por el estado administrativo.' : 'Activo: ambos selectores están habilitados.'}</p>
    <fieldset disabled={bloqueado} className="border-0 p-0 m-0" aria-describedby={id + '-situacion'}>
      <legend>Datos y estados del activo</legend>
      <div className="campo-catalogos">
        <label htmlFor={id + '-descripcion'}>Descripción del activo</label>
        <input id={id + '-descripcion'} name="descripcion" value={registro.descripcion} readOnly={soloLectura} maxLength={200} onChange={e => {if (!guardadoEnCurso.current) aplicar(cambiarTextoActivo(vigente.current, 'descripcion', e.target.value));}}/>
      </div>
      <div className="campos-directorio">
        <div className="campo-catalogos">
          <label htmlFor={id + '-administrativo'}>Estado administrativo</label>
          <select id={id + '-administrativo'} name="estadoAdministrativo" disabled={bloqueado} value={registro.estadoAdministrativo} onChange={e => cambiarAdministrativo(e.target.value as EstadoAdministrativoActivo)}>
            {Object.entries(ESTADOS_ADMINISTRATIVOS_ACTIVO).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
          </select>
        </div>
        <div className="campo-catalogos">
          <label htmlFor={id + '-condicion'}>Estado de condición</label>
          <select id={id + '-condicion'} name="estadoCondicion" disabled={bloqueado || condicionBloqueada(registro.estadoAdministrativo)} value={registro.estadoCondicion} onChange={e => {if (!guardadoEnCurso.current) aplicar(cambiarCondicionActivo(vigente.current, e.target.value as EstadoCondicionActivo | ''));}}>
            <option value="">{condicionBloqueada(registro.estadoAdministrativo) && !soloLectura ? '' : 'Selecciona una condición'}</option>
            {Object.entries(ESTADOS_CONDICION_ACTIVO).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
          </select>
        </div>
      </div>
      <div className="campo-catalogos">
        <label htmlFor={id + '-observaciones'}>Observaciones</label>
        <textarea id={id + '-observaciones'} name="observaciones" value={registro.observaciones} readOnly={soloLectura} maxLength={2000} onChange={e => {if (!guardadoEnCurso.current) aplicar(cambiarTextoActivo(vigente.current, 'observaciones', e.target.value));}}/>
      </div>
      {onGuardar && <button type="submit" className="btn btn-primary" disabled={bloqueado}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>}
    </fieldset>
    {soloLectura && <p>Condición final: <strong>Obsoleto</strong>. {registro.fechaBaja ? <>Archivado el {new Intl.DateTimeFormat('es-CL', {dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Santiago'}).format(new Date(registro.fechaBaja))}.</> : 'Fecha de archivo no informada.'}</p>}
    <p role="alert" className="error-catalogos">{error}</p>
  </form>;
}
