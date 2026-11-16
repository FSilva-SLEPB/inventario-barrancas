# Desplegables del sistema

Generado desde JSX con `node scripts/listar-desplegables.mjs`. Incluye controles condicionados por permisos: aparecer en esta lista no habilita acceso. Las expresiones entre llaves se resuelven con los catálogos y permisos de la petición. No son datos comprobados de producción.

## 1. "tipo"

Archivo: [web/src/app/gestor-insumos/filtros.tsx:3](../web/src/app/gestor-insumos/filtros.tsx#L3).

| Valor | Opción o fuente |
|---|---|
| "" | Todos |
| "establecimiento" | Establecimientos |
| "jardin_infantil" | Jardines y salas cuna |
| "nivel_central" | Nivel Central |

## 2. "producto"

Archivo: [web/src/app/gestor-insumos/filtros.tsx:4](../web/src/app/gestor-insumos/filtros.tsx#L4).

| Valor | Opción o fuente |
|---|---|
| "" | Todos los productos |
| Dinámico | opciones.productos.map(p=><option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>) |

## 3. "categoria"

Archivo: [web/src/app/gestor-insumos/filtros.tsx:5](../web/src/app/gestor-insumos/filtros.tsx#L5).

| Valor | Opción o fuente |
|---|---|
| "" | Todas las categorías |
| Dinámico | opciones.categorias.map(c=><option key={c}>{c}</option>) |

## 4. "base"

Archivo: [web/src/app/gestor-insumos/filtros.tsx:6](../web/src/app/gestor-insumos/filtros.tsx#L6).

| Valor | Opción o fuente |
|---|---|
| "solicitud" | Fecha de solicitud |
| "entrega" | Fecha de entrega |

## 5. "sede"

Archivo: [web/src/app/gestor-insumos/filtros.tsx:9](../web/src/app/gestor-insumos/filtros.tsx#L9).

| Valor | Opción o fuente |
|---|---|
| "" | Todas las sedes |
| Dinámico | opciones.sedes.filter(s=>!f.tipo\|\|s.tipo===f.tipo).map(s=><option key={s.id} value={s.id}>{s.rbd?s.rbd+' · ':''}{s.nombre}</option>) |

## 6. "producto"

Archivo: [web/src/app/gestor-insumos/informe.tsx:6](../web/src/app/gestor-insumos/informe.tsx#L6).

| Valor | Opción o fuente |
|---|---|
| "" | Todos |
| Dinámico | o.productos.map(p=><option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>) |

## 7. "categoria"

Archivo: [web/src/app/gestor-insumos/informe.tsx:6](../web/src/app/gestor-insumos/informe.tsx#L6).

| Valor | Opción o fuente |
|---|---|
| "" | Todas |
| Dinámico | o.categorias.map(c=><option key={c}>{c}</option>) |

## 8. "sel-sede"

Archivo: [web/src/app/insumos/components/insumos-client.tsx:110](../web/src/app/insumos/components/insumos-client.tsx#L110).

| Valor | Opción o fuente |
|---|---|
| "" | Seleccione establecimiento... |
| Dinámico | sedes.map(s=><option key={s.id} value={s.id}>{s.rbd?\`${s.rbd} · \`:''}{s.nombre}</option>) |

Control deshabilitado según: `{local && !!actor.sedeId}`.

## 9. "sel-sede"

Archivo: [web/src/app/insumos/components/solicitud-form.tsx:108](../web/src/app/insumos/components/solicitud-form.tsx#L108).

| Valor | Opción o fuente |
|---|---|
| "" | Seleccione establecimiento... |
| Dinámico | sedes.map(s=><option key={s.id} value={s.id}>{s.rbd?\`${s.rbd} · \`:''}{s.nombre}</option>) |

Control deshabilitado según: `{local && !!actor.sedeId}`.

## 10. "filtro-categoria"

Archivo: [web/src/app/insumos/components/solicitud-form.tsx:145](../web/src/app/insumos/components/solicitud-form.tsx#L145).

| Valor | Opción o fuente |
|---|---|
| "" | Todas las categorías |
| Dinámico | categorias.map(c=><option key={c} value={c}>{c}</option>) |

## 11. "estado"

Archivo: [web/src/app/insumos/components/solicitudes-lista.tsx:42](../web/src/app/insumos/components/solicitudes-lista.tsx#L42).

| Valor | Opción o fuente |
|---|---|
| "" | Todos |
| "activas" | En curso (seguimiento) |
| "finalizadas" | Finalizadas (historial) |
| Dinámico | Object.entries(ESTADOS_SOLICITUD_INSUMO).map(([k,v])=><option key={k} value={k}>{v}</option>) |

## 12. "sede"

Archivo: [web/src/app/insumos/components/solicitudes-lista.tsx:48](../web/src/app/insumos/components/solicitudes-lista.tsx#L48).

| Valor | Opción o fuente |
|---|---|
| "" | Todas |
| Dinámico | sedes.map(s=><option key={s.id} value={s.id}>{s.nombre}{s.rbd&&' ('+s.rbd+')'}</option>) |

## 13. "ubicacion"

Archivo: [web/src/app/inventario/bodega-ti/page.tsx:37](../web/src/app/inventario/bodega-ti/page.tsx#L37).

| Valor | Opción o fuente |
|---|---|
| "" | Todas |
| "sin_ubicacion" | Sin ubicación confirmada |
| Dinámico | ubicaciones.map(u=><option key={u.id} value={u.id}>{u.nombre}{!u.activo?' (inactiva)':''}</option>) |

## 14. "clase"

Archivo: [web/src/app/inventario/bodega-ti/page.tsx:37](../web/src/app/inventario/bodega-ti/page.tsx#L37).

| Valor | Opción o fuente |
|---|---|
| "" | Todos |
| "equipo" | Equipos |
| "celular" | Celulares |

## 15. "estado"

Archivo: [web/src/app/inventario/celulares/page.tsx:33](../web/src/app/inventario/celulares/page.tsx#L33).

| Valor | Opción o fuente |
|---|---|
| "activo" | Vigentes |
| "inactivo" | Archivados |
| "" | Todos |

## 16. "accion"

Archivo: [web/src/app/inventario/movimientos/page.tsx:23](../web/src/app/inventario/movimientos/page.tsx#L23).

| Valor | Opción o fuente |
|---|---|
| "" | Todos |
| Dinámico | Object.entries(ACCIONES_MOVIMIENTO).map(([k,t])=><option key={k} value={k}>{t}</option>) |

## 17. "estado"

Archivo: [web/src/app/inventario/prestamos/page.tsx:20](../web/src/app/inventario/prestamos/page.tsx#L20).

| Valor | Opción o fuente |
|---|---|
| "" | Todos |
| "abierto" | En préstamo (incluye vencidos) |
| "vencido" | Vencidos |
| "devuelto" | Devueltos |

## 18. "clase"

Archivo: [web/src/app/inventario/prestamos/page.tsx:20](../web/src/app/inventario/prestamos/page.tsx#L20).

| Valor | Opción o fuente |
|---|---|
| "" | Todos |
| "equipo" | Equipos |
| "celular" | Celulares |

## 19. "ambito"

Archivo: [web/src/app/inventario/robos/page.tsx:26](../web/src/app/inventario/robos/page.tsx#L26).

| Valor | Opción o fuente |
|---|---|
| "" | Todos |
| "nc" | Nivel Central |
| "eeji" | Establecimientos / JISC |

Control deshabilitado según: `{local}`.

## 20. "sede"

Archivo: [web/src/app/inventario/robos/page.tsx:27](../web/src/app/inventario/robos/page.tsx#L27).

| Valor | Opción o fuente |
|---|---|
| "" | Todos los autorizados |
| Dinámico | sedes.map(s=><option key={s.id} value={s.id}>{etiquetaSede(s)}</option>) |

## 21. "comuna"

Archivo: [web/src/app/inventario/robos/page.tsx:28](../web/src/app/inventario/robos/page.tsx#L28).

| Valor | Opción o fuente |
|---|---|
| "" | Todas |
| Dinámico | comunas.map(c=><option key={c} value={c}>{c}</option>) |

## 22. "estado"

Archivo: [web/src/app/inventario/robos/page.tsx:29](../web/src/app/inventario/robos/page.tsx#L29).

| Valor | Opción o fuente |
|---|---|
| "" | Todos los estados |
| Dinámico | Object.entries(ESTADOS_ROBO).map(([k,v])=><option key={k} value={k}>{v}</option>) |

## 23. "estado"

Archivo: [web/src/app/mantenedores/funcionarios/page.tsx:35](../web/src/app/mantenedores/funcionarios/page.tsx#L35).

| Valor | Opción o fuente |
|---|---|
| "activo" | Activos |
| "inactivo" | Inactivos |
| "" | Todos |

## 24. "activo"

Archivo: [web/src/app/mantenedores/insumos/insumos-mantenedor.tsx:17](../web/src/app/mantenedores/insumos/insumos-mantenedor.tsx#L17).

| Valor | Opción o fuente |
|---|---|
| "true" | Activo |
| "false" | Inactivo |

## 25. "compra-existente"

Archivo: [web/src/app/mantenedores/insumos/insumos-mantenedor.tsx:23](../web/src/app/mantenedores/insumos/insumos-mantenedor.tsx#L23).

| Valor | Opción o fuente |
|---|---|
| Dinámico | crear&&<option value="">Crear producto nuevo</option> |
| Dinámico | catalogo.filter(c=>c.activo).map(c=><option key={c.id} value={c.id}>{c.codigo} · {c.nombre} · {c.unidad}</option>) |

## 26. {bloqueado?undefined:'condicionTecnica'}

Archivo: [web/src/components/campo-condicion-activo.tsx:5](../web/src/components/campo-condicion-activo.tsx#L5).

| Valor | Opción o fuente |
|---|---|
| Dinámico | bloqueado?<option value=""></option>:<option value="">Selecciona una condición</option> |
| Dinámico | existente&&!bloqueado&&valor!==''&&!Object.hasOwn(ESTADOS_CONDICION_ACTIVO,valor)&&<option value={valor}>{CONDICIONES[valor as keyof typeof CONDICIONES]??'Selecciona una condición'} (pendiente de clasificación)</option> |
| Dinámico | Object.entries(ESTADOS_CONDICION_ACTIVO).map(([k,t])=><option key={k} value={k}>{t}</option>) |

Control deshabilitado según: `{bloqueado}`.

## 27. "custodiaInicial"

Archivo: [web/src/components/campo-custodia-inicial.tsx:2](../web/src/components/campo-custodia-inicial.tsx#L2).

| Valor | Opción o fuente |
|---|---|
| "en_bodega" | En Bodega TI |
| "asignado" | Asignado / recibido en sede (registro existente) |

## 28. "celular-uso-contacto"

Archivo: [web/src/components/clasificacion-contacto-celular.tsx:4](../web/src/components/clasificacion-contacto-celular.tsx#L4).

| Valor | Opción o fuente |
|---|---|
| Dinámico | Object.entries(USOS_CONTACTO).map(([k,v])=><option key={k} value={k}>{v}</option>) |

Control deshabilitado según: `{pendiente}`.

## 29. "correccion-decision"

Archivo: [web/src/components/correccion-personal.tsx:3](../web/src/components/correccion-personal.tsx#L3).

| Valor | Opción o fuente |
|---|---|
| "true" | Aprobar y corregir ficha |
| "false" | Rechazar solicitud |

## 30. "correccion-campo"

Archivo: [web/src/components/correccion-personal.tsx:3](../web/src/components/correccion-personal.tsx#L3).

| Valor | Opción o fuente |
|---|---|
| Dinámico | [['nombre','Nombre'],['rut','RUT'],['correo','Correo institucional'],['unidad','Unidad'],['subdireccion','Subdirección'],['cargo','Cargo']].map(([k,v])=><option key={k} value={k}>{v}</option>) |

## 31. "modelo-modulo"

Archivo: [web/src/components/diagrama-entidades.tsx:31](../web/src/components/diagrama-entidades.tsx#L31).

| Valor | Opción o fuente |
|---|---|
| (texto de la opción) | Todos |
| Dinámico | modulos.map(m=><option key={m}>{m}</option>) |

## 32. "modelo-tabla"

Archivo: [web/src/components/diagrama-entidades.tsx:31](../web/src/components/diagrama-entidades.tsx#L31).

| Valor | Opción o fuente |
|---|---|
| "" | Todas las relaciones |
| Dinámico | modelo.tablas.map(t=><option key={t.nombre} value={t.nombre}>{t.nombre}</option>) |

## 33. "tipo"

Archivo: [web/src/components/filtros-inventario.tsx:10](../web/src/components/filtros-inventario.tsx#L10).

| Valor | Opción o fuente |
|---|---|
| "" | Selecciona un tipo |
| Dinámico | permitirNC&&<option value="nivel_central">Nivel Central</option> |
| "establecimiento" | Establecimientos |
| "jardin_infantil" | Jardines infantiles y salas cunas |

## 34. "sede"

Archivo: [web/src/components/filtros-inventario.tsx:10](../web/src/components/filtros-inventario.tsx#L10).

| Valor | Opción o fuente |
|---|---|
| "" | Todos los autorizados |
| Dinámico | sedes.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>) |

Control deshabilitado según: `{!tipo}`.

## 35. "rbd"

Archivo: [web/src/components/filtros-inventario.tsx:10](../web/src/components/filtros-inventario.tsx#L10).

| Valor | Opción o fuente |
|---|---|
| "" | Todos |
| Dinámico | rbds.map(v=><option key={v}>{v}</option>) |

Control deshabilitado según: `{!conRbd}`.

## 36. "vista"

Archivo: [web/src/components/filtros-inventario.tsx:11](../web/src/components/filtros-inventario.tsx#L11).

| Valor | Opción o fuente |
|---|---|
| "inventario" | Asignados / recibidos |
| "pendientes" | En Bodega TI |

## 37. "activo"

Archivo: [web/src/components/formulario-categoria.tsx:53](../web/src/components/formulario-categoria.tsx#L53).

| Valor | Opción o fuente |
|---|---|
| "true" | Activa |
| "false" | Inactiva |

Control deshabilitado según: `{pendiente}`.

## 38. "sedeId"

Archivo: [web/src/components/formulario-celular.tsx:14](../web/src/components/formulario-celular.tsx#L14).

| Valor | Opción o fuente |
|---|---|
| "" | Selecciona una sede |
| Dinámico | sedes.filter(s=>s.activo\|\|s.id===v.sedeId).map(s=><option key={s.id} value={s.id}>{etiquetaSede(s)}</option>) |

## 39. "activo"

Archivo: [web/src/components/formulario-celular.tsx:17](../web/src/components/formulario-celular.tsx#L17).

| Valor | Opción o fuente |
|---|---|
| "si" | Vigente |
| "no" | Archivado |

## 40. "cuenta-perfil"

Archivo: [web/src/components/formulario-cuenta-rbac.tsx:6](../web/src/components/formulario-cuenta-rbac.tsx#L6).

| Valor | Opción o fuente |
|---|---|
| "" | {usuario?'Conservar perfil anterior: '+usuario.rol:'Selecciona un perfil'} |
| Dinámico | perfiles.filter(p=>p.activo\|\|p.id===perfilId).map(p=><option key={p.id} value={p.id}>{p.nombre}{p.activo?'':' (desactivado)'}</option>) |

## 41. "cuenta-alcance"

Archivo: [web/src/components/formulario-cuenta-rbac.tsx:6](../web/src/components/formulario-cuenta-rbac.tsx#L6).

| Valor | Opción o fuente |
|---|---|
| Dinámico | (perfil?.alcances??[alcance]).map(a=><option key={a} value={a}>{a==='global'?'Global':a==='sede'?'Una sede asignada':'Registros propios'}</option>) |

Control deshabilitado según: `{!perfil}`.

## 42. "cuenta-sede"

Archivo: [web/src/components/formulario-cuenta-rbac.tsx:6](../web/src/components/formulario-cuenta-rbac.tsx#L6).

| Valor | Opción o fuente |
|---|---|
| "" | Selecciona |
| Dinámico | sedes.filter(s=>!['enlaces_ee','director_ee'].includes(perfil?.codigo??'')\|\|s.tipo==='establecimiento').filter(s=>!['encargado_jardin','directora_ji'].includes(perfil?.codigo??'')\|\|s.tipo==='jardin_infantil').map(s=><option key={s.id} value={s.id}>{s.nombre}</option>) |

## 43. "cuenta-funcionario"

Archivo: [web/src/components/formulario-cuenta-rbac.tsx:6](../web/src/components/formulario-cuenta-rbac.tsx#L6).

| Valor | Opción o fuente |
|---|---|
| "" | Selecciona la ficha con el mismo correo |
| Dinámico | funcionarios.filter(f=>f.correo===correo.trim().toLowerCase()).map(f=><option key={f.id} value={f.id}>{f.nombre}</option>) |

## 44. "sedeId"

Archivo: [web/src/components/formulario-dependencia.tsx:32](../web/src/components/formulario-dependencia.tsx#L32).

| Valor | Opción o fuente |
|---|---|
| "" | Selecciona una sede |
| Dinámico | sedes.map((sede) => ( <option key={sede.id} value={sede.id}> {etiquetaSede(sede)} — {TIPOS_SEDE[sede.tipo]} {sede.activo ? "" : " (inactiva)"} </option> )) |

## 45. "activo"

Archivo: [web/src/components/formulario-dependencia.tsx:71](../web/src/components/formulario-dependencia.tsx#L71).

| Valor | Opción o fuente |
|---|---|
| "true" | Activa |
| "false" | Inactiva |

## 46. "situacion"

Archivo: [web/src/components/formulario-director.tsx:12](../web/src/components/formulario-director.tsx#L12).

| Valor | Opción o fuente |
|---|---|
| Dinámico | Object.entries(SITUACIONES_DIRECTOR).map(([k,label])=><option key={k} value={k}>{label}</option>) |

## 47. "directorio-fuente"

Archivo: [web/src/components/formulario-director.tsx:31](../web/src/components/formulario-director.tsx#L31).

| Valor | Opción o fuente |
|---|---|
| "archivo" | Seleccionar archivo CSV, TSV o TXT |
| "texto" | Pegar tabla desde Excel o el listado |

## 48. "situacion"

Archivo: [web/src/components/formulario-directorio-seccion.tsx:10](../web/src/components/formulario-directorio-seccion.tsx#L10).

| Valor | Opción o fuente |
|---|---|
| Dinámico | Object.entries(SITUACIONES_DIRECTOR).map(([k,v])=><option key={k} value={k}>{v}</option>) |

## 49. "sedeId"

Archivo: [web/src/components/formulario-equipo.tsx:33](../web/src/components/formulario-equipo.tsx#L33).

| Valor | Opción o fuente |
|---|---|
| "" | Selecciona una sede |
| Dinámico | sedes.filter(s=>s.activo).map(s=><option key={s.id} value={s.id}>{etiquetaSede(s)}</option>) |

## 50. "categoriaId"

Archivo: [web/src/components/formulario-equipo.tsx:38](../web/src/components/formulario-equipo.tsx#L38).

| Valor | Opción o fuente |
|---|---|
| "" | Selecciona una categoría |
| Dinámico | categorias.filter(c=>c.activo\|\|c.id===v.categoriaId).map(c=><option key={c.id} value={c.id}>{c.nombre}{!c.activo?" (inactiva)":""}</option>) |

## 51. "estadoAdministrativo"

Archivo: [web/src/components/formulario-estados-activo.tsx:87](../web/src/components/formulario-estados-activo.tsx#L87).

| Valor | Opción o fuente |
|---|---|
| Dinámico | Object.entries(ESTADOS_ADMINISTRATIVOS_ACTIVO).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>) |

Control deshabilitado según: `{bloqueado}`.

## 52. "estadoCondicion"

Archivo: [web/src/components/formulario-estados-activo.tsx:93](../web/src/components/formulario-estados-activo.tsx#L93).

| Valor | Opción o fuente |
|---|---|
| "" | {condicionBloqueada(registro.estadoAdministrativo) && !soloLectura ? '' : 'Selecciona una condición'} |
| Dinámico | Object.entries(ESTADOS_CONDICION_ACTIVO).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>) |

Control deshabilitado según: `{bloqueado \|\| condicionBloqueada(registro.estadoAdministrativo)}`.

## 53. "activo"

Archivo: [web/src/components/formulario-funcionario.tsx:11](../web/src/components/formulario-funcionario.tsx#L11).

| Valor | Opción o fuente |
|---|---|
| "si" | Activo |
| "no" | Inactivo |

## 54. "destino"

Archivo: [web/src/components/formulario-movimiento-inventario.tsx:26](../web/src/components/formulario-movimiento-inventario.tsx#L26).

| Valor | Opción o fuente |
|---|---|
| "" | Selecciona un destino |
| Dinámico | (['establecimiento','jardin_infantil','nivel_central'] as const).map(tipo=><optgroup key={tipo} label={tipo==='nivel_central'?'Funcionarios de Nivel Central':tipo==='establecimiento'?'Establecimientos':'Jardines infantiles y salas cuna'}>{sedes.filter(s=>s.activo&&s.tipo===tipo).map(s=><option key={s.id} value={s.id}>{etiquetaSede(s)}</option>)}</optgroup>) |

## 55. "funcionario"

Archivo: [web/src/components/formulario-movimiento-inventario.tsx:30](../web/src/components/formulario-movimiento-inventario.tsx#L30).

| Valor | Opción o fuente |
|---|---|
| "" | Selecciona un funcionario |
| Dinámico | funcionarios.map(f=><option key={f.id} value={f.id}>{f.nombre}{f.unidad?' · '+f.unidad:''}</option>) |
| "manual" | Otra persona (completar datos) |

## 56. "perfil-clase"

Archivo: [web/src/components/formulario-perfil.tsx:5](../web/src/components/formulario-perfil.tsx#L5).

| Valor | Opción o fuente |
|---|---|
| "operativo" | Operativo |
| "personal" | Personal |
| "utic" | Administrativo UTIC |
| "sistema" | Administrador del sistema |

Control deshabilitado según: `{Boolean(perfil)}`.

## 57. "reporte-sede"

Archivo: [web/src/components/formulario-reporte-incidente.tsx:29](../web/src/components/formulario-reporte-incidente.tsx#L29).

| Valor | Opción o fuente |
|---|---|
| "" | Selecciona |
| Dinámico | sedes.map(s=><option key={s.id} value={s.id}>{s.rbd? s.rbd+' · ':''}{s.nombre}</option>) |

## 58. "reporte-tipo"

Archivo: [web/src/components/formulario-reporte-incidente.tsx:30](../web/src/components/formulario-reporte-incidente.tsx#L30).

| Valor | Opción o fuente |
|---|---|
| "robo" | Robo |
| "sustraccion" | Sustracción |
| "dano" | Daño / equipo quebrado |

## 59. "equipo"

Archivo: [web/src/components/formulario-robo.tsx:27](../web/src/components/formulario-robo.tsx#L27).

| Valor | Opción o fuente |
|---|---|
| "" | Selecciona un equipo |
| Dinámico | equipos!.filter(e=>!e.recuperadoFecha).map(e=><option key={e.equipoId} value={e.equipoId}>{e.identificacion.inventario\|\|e.identificacion.serie\|\|e.equipoId} · {e.identificacion.marca} {e.identificacion.modelo}</option>) |

## 60. "operacion"

Archivo: [web/src/components/formulario-robo.tsx:28](../web/src/components/formulario-robo.tsx#L28).

| Valor | Opción o fuente |
|---|---|
| "" | Selecciona una decisión |
| "validado" | Validar robo |
| "rechazado" | Rechazar reporte |

## 61. "tipo"

Archivo: [web/src/components/formulario-sede.tsx:47](../web/src/components/formulario-sede.tsx#L47).

| Valor | Opción o fuente |
|---|---|
| "" | Selecciona un tipo |
| Dinámico | Object.entries(TIPOS_SEDE).map(([valor, texto]) => ( <option key={valor} value={valor}>{texto}</option> )) |

## 62. "activo"

Archivo: [web/src/components/formulario-sede.tsx:92](../web/src/components/formulario-sede.tsx#L92).

| Valor | Opción o fuente |
|---|---|
| "true" | Activa |
| "false" | Inactiva |

## 63. "ubicacion"

Archivo: [web/src/components/formulario-ubicacion-bodega.tsx:9](../web/src/components/formulario-ubicacion-bodega.tsx#L9).

| Valor | Opción o fuente |
|---|---|
| "" | Sin ubicación confirmada |
| Dinámico | ubicaciones.map(u=><option key={u.id} value={u.id} disabled={!u.activo}>{u.nombre}{!u.activo?' (inactiva)':''}</option>) |

## 64. "rol"

Archivo: [web/src/components/formulario-usuario.tsx:61](../web/src/components/formulario-usuario.tsx#L61).

| Valor | Opción o fuente |
|---|---|
| Dinámico | Object.entries(PERFILES).filter(([valor]) => sistema \|\| !perfilReservado(valor)) .map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>) |

Control deshabilitado según: `{pendiente}`.

## 65. "sedeId"

Archivo: [web/src/components/formulario-usuario.tsx:72](../web/src/components/formulario-usuario.tsx#L72).

| Valor | Opción o fuente |
|---|---|
| "" | Selecciona una sede |
| Dinámico | sedes.filter(s => (s.activo \|\| s.id === estado.valores.sedeId) && s.tipo !== "nivel_central") .map(s => <option key={s.id} value={s.id} disabled={!s.activo}> {etiquetaSede(s)}{!s.activo ? " (inactiva)" : ""} </option>) |

Control deshabilitado según: `{pendiente}`.

## 66. "activo"

Archivo: [web/src/components/formulario-usuario.tsx:88](../web/src/components/formulario-usuario.tsx#L88).

| Valor | Opción o fuente |
|---|---|
| "true" | Activo |
| "false" | Inactivo |

Control deshabilitado según: `{pendiente}`.

## 67. "vinculo-bien"

Archivo: [web/src/components/formulario-vinculo-funcionario.tsx:3](../web/src/components/formulario-vinculo-funcionario.tsx#L3).

| Valor | Opción o fuente |
|---|---|
| "" | Selecciona |
| Dinámico | bienes.map(b=><option key={b.clase+b.id} value={b.clase+':'+b.id}>{b.clase} · {b.nombre}</option>) |

## 68. "vinculo-persona"

Archivo: [web/src/components/formulario-vinculo-funcionario.tsx:3](../web/src/components/formulario-vinculo-funcionario.tsx#L3).

| Valor | Opción o fuente |
|---|---|
| "" | Selecciona |
| Dinámico | funcionarios.map(f=><option key={f.id} value={f.id}>{f.nombre}</option>) |

## 69. "numero-categoria"

Archivo: [web/src/components/identificacion-inventario.tsx:30](../web/src/components/identificacion-inventario.tsx#L30).

| Valor | Opción o fuente |
|---|---|
| "" | Seleccionar categoría |
| Dinámico | p.config.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>) |

## 70. "etiqueta-accion"

Archivo: [web/src/components/identificacion-inventario.tsx:30](../web/src/components/identificacion-inventario.tsx#L30).

| Valor | Opción o fuente |
|---|---|
| Dinámico | p.puedeImprimir&&<option value="imprimir">Imprimir</option> |
| Dinámico | p.puedeDescargar&&<option value="descargar">Descargar PDF</option> |

## 71. "excel-tipo"

Archivo: [web/src/components/importar-excel.tsx:26](../web/src/components/importar-excel.tsx#L26).

| Valor | Opción o fuente |
|---|---|
| Dinámico | tipos.map(t=><option key={t} value={t}>{TIPOS_EXCEL[t]}</option>) |

Control deshabilitado según: `{pendiente}`.

## 72. "excel-hoja"

Archivo: [web/src/components/importar-excel.tsx:28](../web/src/components/importar-excel.tsx#L28).

| Valor | Opción o fuente |
|---|---|
| Dinámico | hojas.map(h=><option key={h}>{h}</option>) |

Control deshabilitado según: `{pendiente}`.

## 73. {'categoria-excel-'+i}

Archivo: [web/src/components/importar-excel.tsx:33](../web/src/components/importar-excel.tsx#L33).

| Valor | Opción o fuente |
|---|---|
| "" | Pendiente de elegir |
| Dinámico | previa.categorias.map(x=><option key={x.id} value={x.id}>{x.nombre}</option>) |

## 74. "ambito"

Archivo: [web/src/components/pagina-identificacion.tsx:8](../web/src/components/pagina-identificacion.tsx#L8).

| Valor | Opción o fuente |
|---|---|
| "" | Todos los autorizados |
| "nc" | Nivel Central |
| "p02" | Establecimientos y jardines |

## 75. "sede"

Archivo: [web/src/components/pagina-identificacion.tsx:8](../web/src/components/pagina-identificacion.tsx#L8).

| Valor | Opción o fuente |
|---|---|
| "" | Todas las autorizadas |
| Dinámico | sedes.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>) |

## 76. "pendiente"

Archivo: [web/src/components/pagina-identificacion.tsx:8](../web/src/components/pagina-identificacion.tsx#L8).

| Valor | Opción o fuente |
|---|---|
| "" | Todos |
| "si" | Pendiente |
| "no" | Ya numerado |

## 77. {id}

Archivo: [web/src/components/panel-filtros.tsx:20](../web/src/components/panel-filtros.tsx#L20).

| Valor | Opción o fuente |
|---|---|
| Dinámico | [50,100,150].map(n=><option key={n}>{n}</option>) |

## 78. "limite"

Archivo: [web/src/components/panel-filtros.tsx:21](../web/src/components/panel-filtros.tsx#L21).

| Valor | Opción o fuente |
|---|---|
| Dinámico | [50,100,150].map(n=><option key={n}>{n}</option>) |

## 79. "inventario-destino"

Archivo: [web/src/components/registro-equipos.tsx:17](../web/src/components/registro-equipos.tsx#L17).

| Valor | Opción o fuente |
|---|---|
| "" | Selecciona el inventario |
| "nc" | Inventario Nivel Central |
| "eeji" | Inventario de establecimiento / JISC (P02) |

## 80. "comuna"

Archivo: [web/src/components/vista-directorio.tsx:43](../web/src/components/vista-directorio.tsx#L43).

| Valor | Opción o fuente |
|---|---|
| "" | Todas |
| Dinámico | comunas.map(v=><option key={v} value={v}>{v}</option>) |

## 81. "situacion"

Archivo: [web/src/components/vista-directorio.tsx:43](../web/src/components/vista-directorio.tsx#L43).

| Valor | Opción o fuente |
|---|---|
| "" | Todos |
| Dinámico | Object.entries(SITUACIONES_DIRECTOR).map(([k,v])=><option key={k} value={k}>{v}</option>) |

## 82. "orden"

Archivo: [web/src/components/vista-directorio.tsx:43](../web/src/components/vista-directorio.tsx#L43).

| Valor | Opción o fuente |
|---|---|
| "rbd" | RBD |
| "nombre" | Nombre A–Z |

Total: **82 controles select**. Para valores activos del servidor, usar scripts/consultar-catalogos.mjs de solo lectura; no confundir estos valores con los datos ficticios de pruebas.

## Listas fijas utilizadas por los controles

Valores definidos en código; los estados históricos no equivalen a opciones habilitadas para registrar un bien nuevo.

### ESTADOS_ENVIO

Fuente: web/src/lib/actas.ts

| Valor | Etiqueta |
|---|---|
| en_curso | Envío en curso |
| aceptado | Aceptado por el servidor de correo |
| parcial | Envío aceptado parcialmente |
| fallido | No enviado |
| no_confirmado | Resultado por confirmar |

### COLUMNAS_CARGA_INVENTARIO

Fuente: web/src/lib/columnas-carga-inventario.ts

| Valor | Etiqueta |
|---|---|
| 'Año de Entrega' | 'Año de Entrega' |
| 'RBD' | 'RBD' |
| 'ESTABLECIMIENTO' | 'ESTABLECIMIENTO' |
| 'DIRECCIÓN' | 'DIRECCIÓN' |
| 'COMUNA' | 'COMUNA' |
| 'RUT DIRECTOR/A' | 'RUT DIRECTOR/A' |
| 'DIRECTOR/A' | 'DIRECTOR/A' |
| 'Adquision' | 'Adquision' |
| 'N° OC' | 'N° OC' |
| 'ID Adquision' | 'ID Adquision' |
| 'N° CDP' | 'N° CDP' |
| 'FECHA OC' | 'FECHA OC' |
| 'N° Guia / Factura' | 'N° Guia / Factura' |
| 'CANTIDAD' | 'CANTIDAD' |
| 'Tipo de Estado' | 'Tipo de Estado' |
| 'Tipo de compra' | 'Tipo de compra' |
| 'Categoria' | 'Categoria' |
| 'MARCA' | 'MARCA' |
| 'MODELO' | 'MODELO' |
| 'N° DE SERIE' | 'N° DE SERIE' |
| 'N° INVENTARIO' | 'N° INVENTARIO' |
| 'ESTADO ADMINISTRATIVO' | 'ESTADO ADMINISTRATIVO' |
| 'ESTADO CONDICION' | 'ESTADO CONDICION' |

### ESTADOS_CONDICION_ACTIVO

Fuente: web/src/lib/estados-activo.ts

| Valor | Etiqueta |
|---|---|
| operativo | Operativo |
| bodega_ti | Bodega de TI |
| mantencion | Mantención |
| mal_estado | Mal estado |
| obsoleto | Obsoleto |

### ESTADOS_ADMINISTRATIVOS_ACTIVO

Fuente: web/src/lib/estados-activo.ts

| Valor | Etiqueta |
|---|---|
| activo | Activo |
| robado | Robado |
| no_encontrado | No encontrado |
| dado_de_baja | Dado de baja |

### VISTAS_INFORME

Fuente: web/src/lib/filtros-gestor-insumos.ts

| Valor | Etiqueta |
|---|---|
| dashboard | Resumen |
| sedes | Solicitudes por establecimiento |
| productos | Solicitado y entregado por producto |
| consolidado | Entregado por establecimiento y producto |
| detalle | Detalle de solicitudes y entregas |
| stock | Stock actual de bodega |

### CAMPOS_QR

Fuente: web/src/lib/identificacion/reglas.ts

| Valor | Etiqueta |
|---|---|
| inventario | Número de inventario |
| categoria | Categoría |
| marca | Marca |
| modelo | Modelo |
| serie | Serie |
| rbd | RBD |

### TIPOS_EXCEL

Fuente: web/src/lib/importacion-excel/tipos.ts

| Valor | Etiqueta |
|---|---|
| establecimientos | Inventario de establecimientos y jardines |
| central | Inventario de Nivel Central |
| funcionarios | Fichas de funcionarios |
| vinculos | Vincular equipos existentes a funcionarios |

### PERFILES

Fuente: web/src/lib/politica-acceso.ts

| Valor | Etiqueta |
|---|---|
| administrador | Administrador del sistema |
| administrador_gestion | Administrador de gestión |
| encargado | Encargado de EE/JI |
| gestor_insumos | Gestor de insumos |
| consulta | Consulta general / Auditor |
| consulta_sede | Consulta de establecimiento |

### USOS_CONTACTO

Fuente: web/src/lib/usos-contacto-celular.ts

| Valor | Etiqueta |
|---|---|
| sin_clasificar | Sin clasificar |
| establecimiento | Establecimiento / jardín |
| director | Director/a |

### TIPOS_ACTA

Fuente: web/src/lib/validacion-actas.ts

| Valor | Etiqueta |
|---|---|
| entrega_insumo | Entrega de insumos |
| cambio | Cambio de equipamiento |
| traspaso | Traspaso |
| asignacion | Asignación |
| devolucion | Devolución |
| entrega_historica | Entrega histórica |
| prestamo | Préstamo |
| devolucion_prestamo | Devolución de préstamo |

### ETIQUETAS_CELULAR

Fuente: web/src/lib/validacion-celulares.ts

| Valor | Etiqueta |
|---|---|
| usoContacto | Uso del celular en el directorio |
| directorRun | RUN del director/a vinculado |
| estadoAdministrativo | Estado administrativo |
| fechaBaja | Fecha de archivo |
| custodia | Estado |
| sedeNombre | Sede |
| rbd | RBD |
| telefono | Número de teléfono |
| marca | Marca |
| modelo | Modelo |
| imei | IMEI |
| inventario | Número de inventario |
| condicionTecnica | Funcionamiento |
| responsable | Responsable o uso |
| observaciones | Observaciones |
| activo | Vigencia |

### SITUACIONES_DIRECTOR

Fuente: web/src/lib/validacion-directorio.ts

| Valor | Etiqueta |
|---|---|
| titular | Titular |
| subrogante | Subrogante |
| vacante | Cargo vacante |
| pendiente | Responsable pendiente |

### ORIGENES

Fuente: web/src/lib/validacion-equipos.ts

| Valor | Etiqueta |
|---|---|
| compra_utic | Compra gestionada por UTIC |
| compra_sede | Compra propia de la sede |
| donacion | Donación |
| otro | Otro origen |

### SITUACIONES

Fuente: web/src/lib/validacion-equipos.ts

| Valor | Etiqueta |
|---|---|
| registrado_nc | Registrado en Nivel Central |
| pendiente_entrega | Pendiente de entrega |
| recibido | Recibido |
| recibido_historico | Recibido según registro histórico |

### CAMPOS_COMPRA

Fuente: web/src/lib/validacion-equipos.ts

| Valor | Etiqueta |
|---|---|
| anioEntrega | Año de entrega |
| modalidadCompra | Modalidad de adquisición |
| ordenCompra | Número de OC |
| idAdquisicion | ID de adquisición |
| cdp | CDP |
| fechaOrdenCompra | Fecha de OC |
| guiaFactura | Guía o factura |
| condicionIngreso | Condición al ingreso |
| financiamiento | Financiamiento |

### ETIQUETAS_FUNCIONARIO

Fuente: web/src/lib/validacion-funcionarios.ts

| Valor | Etiqueta |
|---|---|
| nombre | Nombre completo |
| rut | RUN |
| correo | Correo institucional |
| unidad | Unidad |
| subdireccion | Subdirección |
| cargo | Cargo |
| fechaIngreso | Fecha de ingreso prevista o real |
| activo | Estado |

### ESTADOS_SOLICITUD_INSUMO

Fuente: web/src/lib/validacion-insumos.ts

| Valor | Etiqueta |
|---|---|
| solicitada | Solicitada |
| en_validacion | En validación (TI) |
| aprobada | Aprobada · reservada |
| entregada | Entregada (contra entrega) |
| cancelada | Cancelada |

### CUSTODIAS

Fuente: web/src/lib/validacion-movimientos-inventario.ts

| Valor | Etiqueta |
|---|---|
| en_bodega | En Bodega TI |
| asignado | Asignado / recibido |
| en_prestamo | En préstamo |

### ACCIONES_MOVIMIENTO

Fuente: web/src/lib/validacion-movimientos-inventario.ts

| Valor | Etiqueta |
|---|---|
| cambio | Cambio de equipamiento |
| traspaso | Traspaso |
| asignacion | Asignación |
| devolucion | Devolución |
| prestamo | Préstamo |
| devolucion_prestamo | Devolución de préstamo |

### ESTADOS_ROBO

Fuente: web/src/lib/validacion-robos.ts

| Valor | Etiqueta |
|---|---|
| reportado | Reportado · pendiente de validación |
| validado | Robo validado · sin recuperar |
| rechazado | Reporte rechazado |
| recuperado | Equipo recuperado |

### TIPOS_SEDE

Fuente: web/src/lib/validacion-sedes.ts

| Valor | Etiqueta |
|---|---|
| nivel_central | Nivel Central |
| establecimiento | Establecimiento |
| jardin_infantil | Jardín infantil |
