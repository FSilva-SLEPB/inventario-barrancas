'use client';

import {useState} from 'react';
import FormularioEstadosActivo from '@/components/formulario-estados-activo';
import type {RegistroEstadoActivo} from '@/lib/estados-activo';

export default function EjemploEstadosActivo() {
  const [eventos, setEventos] = useState<string[]>([]);
  const agregar = (texto: string) => setEventos(anteriores => [...anteriores, texto]);
  const ejecutarProtocoloSeguridad = (activoId: string) => {
    agregar('Simulación: ejecutarProtocoloSeguridad(' + activoId + ')');
  };
  const onCambio = (actual: RegistroEstadoActivo, anterior: RegistroEstadoActivo) => {
    if (actual.estadoAdministrativo !== anterior.estadoAdministrativo) {
      agregar('Estado administrativo: ' + anterior.estadoAdministrativo + ' → ' + actual.estadoAdministrativo);
      if (actual.estadoAdministrativo === 'dado_de_baja') agregar('Histórico de la simulación conservado; formulario de solo lectura.');
    }
  };
  return <section>
    <h1>Simulación de estados de un activo</h1>
    <p>Ejemplo con datos ficticios. Los cambios se mantienen en esta vista; no modifican el inventario instalado.</p>
    <FormularioEstadosActivo activoId="ACTIVO-DEMO-001" inicial={{descripcion: 'Pantalla de ejemplo', estadoAdministrativo: 'activo', estadoCondicion: 'operativo'}} ejecutarProtocoloSeguridad={ejecutarProtocoloSeguridad} onCambio={onCambio} onGuardar={() => agregar('Guardar recibido por la simulación.')}/>
    <section aria-label="Eventos de la simulación"><h2>Eventos</h2><ol>{eventos.map((evento, i) => <li key={i}>{evento}</li>)}</ol></section>
  </section>;
}
