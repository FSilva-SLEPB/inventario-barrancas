import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID, createHash, createHmac, timingSafeEqual } from "node:crypto";
import { SourceTextModule, SyntheticModule } from "node:vm";
import test from "node:test";
import ts from "typescript";

const raiz = path.resolve(import.meta.dirname, "../src");

// Carga el código real del servidor; sustituye solo I/O y contexto de Next.
async function entorno() {
  const roles = new Map([["felipe.silva@slepb.gob.cl", "administrador"]]);
  const consultas = [];
  let sesion = null;
  let falloBD = false;
  const modulos = new Map();
  const redirigir = (destino) => { throw new Error("REDIRECT:" + destino); };
  const query = async (sql, parametros = []) => {
    consultas.push({ sql, parametros });
    if (falloBD) throw new Error("fallo simulado");
    if (sql.includes("usuarios_acceso")) {
      const rol = roles.get(parametros[0]);
      return { rows: rol ? [typeof rol === "string" ? { rol, sedeId: null, sedeNombre: null } : rol] : [] };
    }
    return { rows: [], rowCount: 1 };
  };
  const dobles = {
    "server-only": {},
    "react": { cache: (fn) => fn },
    "next-auth": { getServerSession: async () => sesion },
    "next-auth/providers/google": { default: (opciones) => opciones },
    "next/navigation": { redirect: redirigir },
    "next/cache": { revalidatePath() {} },
    "node:crypto": { randomUUID, createHash, createHmac, timingSafeEqual },
    "@/lib/db": { obtenerBaseDatos: () => ({ query }) },
  };
  async function cargar(nombre) {
    if (modulos.has(nombre)) return modulos.get(nombre);
    if (dobles[nombre]) {
      const valores = dobles[nombre];
      const modulo = new SyntheticModule(Object.keys(valores), function () {
        for (const [clave, valor] of Object.entries(valores)) this.setExport(clave, valor);
      });
      modulos.set(nombre, modulo);
      return modulo;
    }
    const archivo = nombre.startsWith("@/") ? path.join(raiz, nombre.slice(2) + ".ts") : nombre;
    const fuente = await readFile(archivo, "utf8");
    const { outputText } = ts.transpileModule(fuente, { compilerOptions: {
      module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022,
    } });
    const modulo = new SourceTextModule(outputText, { identifier: archivo });
    modulos.set(nombre, modulo);
    return modulo;
  }
  async function importar(nombre) {
    const modulo = await cargar(nombre);
    if (modulo.status === "unlinked") await modulo.link(cargar);
    if (modulo.status !== "evaluated") await modulo.evaluate();
    return modulo.namespace;
  }
  return { importar, roles, consultas,
    sesion: (valor) => { sesion = valor; },
    fallarBD: () => { falloBD = true; } };
}

const perfil = { sub: "google-id-ficticio", email: "felipe.silva@slepb.gob.cl",
  email_verified: true, hd: "slepb.gob.cl" };

test("dominio, correo verificado e identidad de Google son obligatorios", async () => {
  const e = await entorno();
  const { correoInstitucional } = await e.importar("@/lib/politica-acceso");
  assert.equal(correoInstitucional(perfil), perfil.email);
  for (const cambio of [{ email_verified: false }, { email_verified: "true" },
    { hd: "gmail.com" }, { hd: undefined }, { sub: "" },
    { email: "felipe.silva@slepb.gob.cl.ejemplo.com" }, { email: "externo@gmail.com" },
    { email: "felipe.silva@slepb.gob.cl\n" }]) {
    assert.equal(correoInstitucional({ ...perfil, ...cambio }), null);
  }
  assert.equal(correoInstitucional({ ...perfil, email: perfil.email.toUpperCase() }), perfil.email);
});

test("solo perfiles administrativos pueden modificar catálogos globales", async () => {
  const e = await entorno();
  const { puedeAdministrar, rolValido } = await e.importar("@/lib/politica-acceso");
  assert.equal(puedeAdministrar("administrador"), true);
  assert.equal(puedeAdministrar("administrador_gestion"), true);
  for (const rol of ["consulta", "editor", "ADMIN", undefined, null, {}]) {
    assert.equal(puedeAdministrar(rol), false);
  }
  assert.equal(rolValido("consulta"), true);
  assert.equal(rolValido("editor"), false);
});

test("OAuth exige configuración explícita y origen seguro", async () => {
  const e = await entorno();
  const { autenticacionConfigurada } = await e.importar("@/lib/configuracion-auth");
  const original = { ...process.env };
  try {
    Object.assign(process.env, { NEXTAUTH_URL: "http://localhost:3000", NEXTAUTH_SECRET: "x".repeat(32),
      GOOGLE_CLIENT_ID: "id-ficticio", GOOGLE_CLIENT_SECRET: "secreto-ficticio" });
    assert.equal(autenticacionConfigurada(), true);
    for (const url of ["http://192.168.8.18:3000", "https://usuario:clave@ejemplo.cl", "https://ejemplo.cl/otra", "no-url"]) {
      process.env.NEXTAUTH_URL = url;
      assert.equal(autenticacionConfigurada(), false);
    }
    process.env.NEXTAUTH_URL = "https://inventario.ejemplo.cl";
    assert.equal(autenticacionConfigurada(), true);
    process.env.NEXTAUTH_SECRET = "corto";
    assert.equal(autenticacionConfigurada(), false);
  } finally {
    for (const n of ["NEXTAUTH_URL", "NEXTAUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]) {
      if (original[n] === undefined) delete process.env[n]; else process.env[n] = original[n];
    }
  }
});

test("login, revocación inmediata y actualización de sesión sin escalación", async () => {
  const e = await entorno();
  const original = { ...process.env };
  try {
    Object.assign(process.env, { NEXTAUTH_URL: "http://localhost:3000", NEXTAUTH_SECRET: "x".repeat(32),
      GOOGLE_CLIENT_ID: "id-ficticio", GOOGLE_CLIENT_SECRET: "secreto-ficticio" });
    const { opcionesAuth } = await e.importar("@/lib/opciones-auth");
    const { signIn, jwt, session, redirect } = opcionesAuth.callbacks;
    assert.equal(await signIn({ account: { provider: "google" }, profile: perfil }), true);
    assert.equal(await signIn({ account: { provider: "otro" }, profile: perfil }), false);
    assert.equal(await signIn({ account: { provider: "google" }, profile: { ...perfil, email_verified: false } }), false);
    assert.equal(await signIn({ account: { provider: "google" }, profile: { ...perfil, email: "sinpermiso@slepb.gob.cl" } }), false);
    const token = await jwt({ token: {}, account: { provider: "google", access_token: "no-persistir" }, profile: perfil });
    assert.equal(token.correoInstitucional, perfil.email);
    assert.equal(token.access_token, undefined);
    const intento = await jwt({ token, trigger: "update", session: { correoInstitucional: "otro@slepb.gob.cl", rol: "administrador" } });
    assert.deepEqual(intento, token);
    const activa = await session({ session: {}, token });
    assert.equal(activa.user.rol, "administrador");
    e.roles.set(perfil.email, "consulta");
    assert.equal((await session({ session: {}, token })).user.rol, "consulta");
    e.roles.delete(perfil.email);
    const denegada = await session({ session: {}, token });
    assert.equal(denegada.user, undefined);
    assert.equal(denegada.accesoDenegado, true);
    assert.equal((await session({ session: {}, token: { email: perfil.email, sub: "id" } })).user, undefined);
    assert.equal(await redirect({ baseUrl: "http://localhost:3000", url: "https://sitio-ajeno.cl" }), "http://localhost:3000/");
    e.fallarBD();
    assert.equal(await signIn({ account: { provider: "google" }, profile: perfil }), "/ingresar?error=ServicioNoDisponible");
    const falloServicio = await session({ session: {}, token });
    assert.equal(falloServicio.user, undefined);
    assert.equal(falloServicio.accesoDenegado, false);
  } finally {
    for (const n of ["NEXTAUTH_URL", "NEXTAUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]) {
      if (original[n] === undefined) delete process.env[n]; else process.env[n] = original[n];
    }
  }
});

for (const [nombre, accion] of [["categorias", "guardarCategoria"], ["sedes", "guardarSede"],
  ["dependencias", "guardarDependencia"], ["usuarios", "guardarUsuario"]]) {
  for (const rol of [null, "consulta"]) {
    test(`acción ${nombre} rechaza ${rol ?? "anónimo"} antes de consultar o escribir datos`, async () => {
      const e = await entorno();
      // El guard consulta la sesión simulada; la configuración se sustituye solo en esta prueba.
      const originales = { ...process.env };
      try {
        Object.assign(process.env, { NEXTAUTH_URL: "http://localhost:3000", NEXTAUTH_SECRET: "x".repeat(32),
          GOOGLE_CLIENT_ID: "id-ficticio", GOOGLE_CLIENT_SECRET: "secreto-ficticio" });
        e.sesion(rol ? { user: { email: perfil.email, rol } } : null);
        const modulo = await e.importar(path.join(raiz, `app/mantenedores/${nombre}/acciones.ts`));
        await assert.rejects(modulo[accion]({}, new FormData()), {
          message: rol ? "REDIRECT:/sin-permiso" : "REDIRECT:/ingresar",
        });
        assert.equal(e.consultas.length, 0);
      } finally {
        for (const n of ["NEXTAUTH_URL", "NEXTAUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]) {
          if (originales[n] === undefined) delete process.env[n]; else process.env[n] = originales[n];
        }
      }
    });
  }
}

test("usuarios normaliza correo y nombre y rechaza perfiles y formularios inválidos", async () => {
  const e = await entorno();
  const { validarUsuario } = await e.importar("@/lib/validacion-usuarios");
  const formulario = (cambios = {}) => {
    const datos = new FormData();
    for (const [k, v] of Object.entries({ correo: " PRUEBA@slepb.gob.cl ", nombre: "  Nombre  Prueba  ",
      rol: "consulta", activo: "true", version: "0", sedeId: "", ...cambios })) datos.set(k, v);
    return datos;
  };
  const correcto = validarUsuario(formulario());
  assert.equal(correcto.datos.correo, "prueba@slepb.gob.cl");
  assert.equal(correcto.datos.nombre, "Nombre Prueba");
  assert.equal(correcto.datos.rol, "consulta");
  for (const cambio of [{ correo: "externo@gmail.com" }, { correo: "a@slepb.gob.cl.otro.cl" },
    { rol: "inventado" }, { activo: "sí" }, { version: "-1" }, { version: "2147483647" },
    { nombre: "nombre\nsalto" }, { nombre: "a".repeat(121) }]) {
    assert.equal(validarUsuario(formulario(cambio)).datos, null);
  }
  for (const campo of ["correo", "nombre", "rol", "activo", "version", "sedeId"]) {
    const repetido = formulario(); repetido.append(campo, "repetido");
    assert.equal(validarUsuario(repetido).datos, null);
    const faltante = formulario(); faltante.delete(campo);
    assert.equal(validarUsuario(faltante).datos, null);
    const archivo = formulario(); archivo.set(campo, new File(["prueba"], "prueba.txt"));
    assert.equal(validarUsuario(archivo).datos, null);
  }
});


test("perfiles locales requieren una sola sede y los generales no aceptan sede", async () => {
  const e = await entorno();
  const { validarUsuario } = await e.importar("@/lib/validacion-usuarios");
  for (const rol of ["encargado", "consulta_sede", "consulta", "administrador_gestion", "administrador"]) {
    for (const sedeId of ["", "no-uuid", randomUUID()]) {
      const f = new FormData();
      for (const [k,v] of Object.entries({ correo: "prueba@slepb.gob.cl", nombre: "", rol,
        activo: "true", version: "0", sedeId })) f.set(k,v);
      const local = ["encargado", "consulta_sede"].includes(rol);
      assert.equal(Boolean(validarUsuario(f).datos), local ? sedeId.length === 36 : sedeId === "");
    }
  }
});

test("sesión usa la sede actual de la base e ignora el alcance insertado en el token", async () => {
  const e = await entorno();
  const { opcionesAuth } = await e.importar("@/lib/opciones-auth");
  const sedeId = randomUUID();
  const token = { sub: "ficticio", correoInstitucional: perfil.email, rol: "administrador", sedeId: randomUUID() };
  e.roles.set(perfil.email, { rol: "encargado", sedeId, sedeNombre: "Sede ficticia" });
  const primera = await opcionesAuth.callbacks.session({ session: {}, token });
  assert.equal(primera.user.rol, "encargado");
  assert.equal(primera.user.sedeId, sedeId);
  e.roles.set(perfil.email, { rol: "consulta_sede", sedeId: null });
  assert.equal((await opcionesAuth.callbacks.session({ session: {}, token })).accesoDenegado, true);
});


test("equipos permiten identificadores pendientes con motivo y conservan ceros/guiones", async () => {
  const e=await entorno();const {validarEquipo,valoresEquipo}=await e.importar("@/lib/validacion-equipos");
  const preparar=(cambios={})=>{const f=new FormData();for(const [k,v] of Object.entries({...valoresEquipo(),sedeId:randomUUID(),categoriaId:randomUUID(),marca:"Marca ficticia",modelo:"Modelo ficticio",serie:"001-ABC",inventario:"00012-9",...cambios}))f.set(k,v);return f;};
  assert.equal(validarEquipo(preparar()).datos.serie,"001-ABC");
  assert.equal(validarEquipo(preparar({serie:""})).datos,null);
  assert.ok(validarEquipo(preparar({serie:"",observaciones:"Etiqueta no legible"})).datos);
  assert.ok(validarEquipo(preparar({inventario:""})).datos);
  for(const cambio of [{serie:"S/N"},{inventario:"N/A"},{marca:""},{modelo:""},{origen:"traspaso"},{condicionTecnica:"robado"},
    {sedeId:"invalida"},{categoriaId:"invalida"},{version:"-1"},{marca:"a".repeat(121)},{id:randomUUID(),version:"1",motivoCambio:""}])
    assert.equal(validarEquipo(preparar(cambio)).datos,null);
  const repetido=preparar();repetido.append("sedeId",randomUUID());assert.equal(validarEquipo(repetido).datos,null);
});

test("CSV soporta BOM, separadores, comillas, tildes y rechaza estructuras inválidas",async()=>{
  const e=await entorno();const {leerCsv}=await e.importar("@/lib/csv-equipos");
  assert.deepEqual(leerCsv('\uFEFFa;b\r\n1;"texto; con ""comillas"""\r\n'),[["a","b"],["1",'texto; con "comillas"']]);
  assert.deepEqual(leerCsv('a,b\n1,"línea\nsegunda"'),[["a","b"],["1","línea\nsegunda"]]);
  for(const texto of ['a;b\n1','a;b\n1;"sin cerrar','a;b\n1;"cerrado"otro','a;b']) assert.throws(()=>leerCsv(texto));
});

test("vista previa histórica conserva faltantes y rechaza duplicados, sedes y fechas inválidas",async()=>{
  const e=await entorno();const {prepararCargaEquipos}=await e.importar("@/lib/preparar-carga-equipos");
  const sedes=[{id:randomUUID(),rbd:"00123-4",tipo:"establecimiento",activo:true}];
  const categorias=[{id:randomUUID(),nombre:"Laptop",activo:true}];
  const header='rbd;categoria;marca;modelo;serie;inventario;estado;fechaEntrega;enlaceActa;cantidad;anioEntrega';
  const linea='00123-4;Laptop;Marca;Modelo;S-01;I-01;Activo;;;1;2024';
  const correcto=prepararCargaEquipos(header+'\n'+linea,sedes,categorias);
  assert.equal(correcto.errores.length,0);assert.equal(correcto.avisos.length,2);
  assert.equal(correcto.datos[0].fechaEntrega,"");assert.equal(correcto.datos[0].compra.anioEntrega,"2024");
  assert.equal(correcto.datos[0].condicionTecnica,"sin_verificar");
  assert.ok(prepararCargaEquipos(header+'\n'+linea+'\n'+linea,sedes,categorias).errores.length);
  assert.ok(prepararCargaEquipos(header+'\n'+linea.replace('00123-4','desconocido'),sedes,categorias).errores.length);
  assert.ok(prepararCargaEquipos(header+'\n'+linea.replace('Activo;;','Activo;30/02/2024;'),sedes,categorias).errores.length);
  assert.ok(prepararCargaEquipos(header+'\n'+linea.replace(';;;1;',';;javascript:alert(1);1;'),sedes,categorias).errores.length);
});


for(const rol of ["consulta","consulta_sede","encargado"]) {
 test(`carga rechaza ${rol} antes de leer archivos o consultar catálogos`,async()=>{
  const e=await entorno();const original={...process.env};
  try{
   Object.assign(process.env,{NEXTAUTH_URL:"http://localhost:3000",NEXTAUTH_SECRET:"x".repeat(32),GOOGLE_CLIENT_ID:"id-ficticio",GOOGLE_CLIENT_SECRET:"secreto-ficticio"});
   e.sesion({user:{email:perfil.email,rol,sedeId:randomUUID()}});
   await e.importar("@/lib/acceso");
   await e.importar("@/lib/sedes");
   await e.importar("@/lib/catalogos");
   const modulo=await e.importar(path.join(raiz,"app/inventario/carga/acciones.ts"));
   await assert.rejects(modulo.procesarCarga({},new FormData()),{message:"REDIRECT:/sin-permiso"});
   assert.equal(e.consultas.length,0);
  }finally{
   for(const n of ["NEXTAUTH_URL","NEXTAUTH_SECRET","GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET"]){
    if(original[n]===undefined)delete process.env[n];else process.env[n]=original[n];
   }
  }
 });
}

test('Gestor de insumos es operativo sin facultades administrativas o de inventario',async()=>{
 const e=await entorno();const p=await e.importar('@/lib/politica-acceso');
 assert.equal(p.rolValido('gestor_insumos'),true);assert.equal(p.puedeGestionarInsumos('gestor_insumos'),true);assert.equal(p.puedeSolicitarInsumos('gestor_insumos'),true);assert.equal(p.puedeAdministrar('gestor_insumos'),false);assert.equal(p.puedeGestionarDependencias('gestor_insumos'),false);assert.equal(p.requiereSede('gestor_insumos'),false);assert.equal(p.perfilReservado('gestor_insumos'),false);
 for(const rol of ['consulta','consulta_sede','encargado',null])assert.equal(p.puedeGestionarInsumos(rol),false);
});

test('la guarda de Insumos no abre módulos generales al gestor',async()=>{
 const e=await entorno(),originales={...process.env};
 try{
  Object.assign(process.env,{NEXTAUTH_URL:'http://localhost:3000',NEXTAUTH_SECRET:'x'.repeat(32),GOOGLE_CLIENT_ID:'id-ficticio',GOOGLE_CLIENT_SECRET:'secreto-ficticio'});
  e.sesion({user:{email:perfil.email,rol:'gestor_insumos'}});const a=await e.importar('@/lib/acceso');
  assert.equal((await a.exigirGestionInsumos()).rol,'gestor_insumos');assert.equal((await a.exigirAcceso('insumos')).rol,'gestor_insumos');
  await assert.rejects(a.exigirAcceso(),{message:'REDIRECT:/sin-permiso'});await assert.rejects(a.exigirAdministrador(),{message:'REDIRECT:/sin-permiso'});await assert.rejects(a.exigirGestionDependencias(),{message:'REDIRECT:/sin-permiso'});
  e.sesion({user:{email:perfil.email,rol:'consulta'}});await assert.rejects(a.exigirGestionInsumos(),{message:'REDIRECT:/sin-permiso'});
 }finally{for(const k of ['NEXTAUTH_URL','NEXTAUTH_SECRET','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET']){if(originales[k]===undefined)delete process.env[k];else process.env[k]=originales[k];}}
});

test('el menú de Insumos respeta creación y lectura por perfil',async()=>{
 const e=await entorno(),{modulosSistema}=await e.importar('@/lib/modulos');
 const g=modulosSistema('gestor_insumos');assert.deepEqual(Array.from(g,m=>m.id),['mantenedores','solicitudes','gestor']);assert.equal(g.flatMap(m=>m.accesos).filter(a=>a.href==='/mantenedores/insumos').length,1);assert.deepEqual(Array.from(g.find(m=>m.id==='mantenedores').accesos,a=>a.href),['/mantenedores/insumos']);assert.equal(g.find(m=>m.id==='solicitudes').accesos.some(a=>a.href==='/mantenedores/insumos'),false);
 for(const rol of ['consulta','consulta_sede']){const m=modulosSistema(rol).find(m=>m.id==='solicitudes');assert.ok(m);assert.ok(m.accesos.some(a=>a.href==='/insumos/seguimiento'));assert.ok(m.accesos.some(a=>a.href==='/insumos/historial'));assert.equal(m.accesos.some(a=>a.href==='/insumos/solicitud'),false);}
});

test('fotografías: solo administradores editan, consultas solo leen y gestor no hereda permisos',async()=>{
 const e=await entorno(),p=await e.importar('@/lib/politica-fotos-sedes');
 for(const rol of ['administrador','administrador_gestion']){assert.equal(p.puedeEditarFotoSede(rol,null,'sede-a'),true);assert.equal(p.puedeVerFotoSede(rol,null,'sede-a'),true);}
 assert.equal(p.puedeEditarFotoSede('encargado','sede-a','sede-a'),false);assert.equal(p.puedeEditarFotoSede('encargado','sede-a','sede-b'),false);
 for(const rol of ['consulta_sede','consulta','gestor_insumos'])assert.equal(p.puedeEditarFotoSede(rol,'sede-a','sede-a'),false);
 assert.equal(p.puedeVerFotoSede('consulta_sede','sede-a','sede-a'),true);assert.equal(p.puedeVerFotoSede('consulta_sede','sede-a','sede-b'),false);assert.equal(p.puedeVerFotoSede('consulta',null,'sede-b'),true);assert.equal(p.puedeVerFotoSede('gestor_insumos',null,'sede-b'),false);
});


test('menú RBAC: sede sin Nivel Central y consultas sin Nueva solicitud ni Gestor',async()=>{
 const e=await entorno(),{modulosSistema}=await e.importar('@/lib/modulos');
 const a={rol:'consulta',permisos:['equipos.consultar','celulares.consultar','seguimiento_insumos.consultar','historial_insumos.consultar'],alcance:'sede',clasePerfil:'operativo',perfilId:'ficticio',perfilNombre:'Director EE',revisionAcceso:'1:1'};
 const enlaces=modulosSistema(a).flatMap(m=>m.accesos);assert.ok(!enlaces.some(x=>x.href==='/inventario/nivel-central'||x.href==='/insumos/solicitud'));assert.ok(enlaces.some(x=>x.href==='/insumos/seguimiento'&&x.titulo==='Seguimiento de insumos'));assert.ok(enlaces.some(x=>x.href==='/insumos/historial'));assert.ok(!enlaces.some(x=>x.titulo==='Gestor de insumos'));
});

test('Inventario completo acepta las 23 columnas, cantidades y antecedentes sin exigir Estado antiguo',async()=>{
 const e=await entorno(),{prepararCargaEquipos}=await e.importar('@/lib/preparar-carga-equipos'),{COLUMNAS_CARGA_INVENTARIO:c}=await e.importar('@/lib/columnas-carga-inventario');
 const sedes=[{id:randomUUID(),rbd:'12345-6',tipo:'establecimiento',activo:true}],cats=[{id:randomUUID(),nombre:'Pantalla',activo:true}];
 const fila=['2025','12345','Escuela del archivo','Dirección original','Comuna original','12345678-5','Persona del archivo','Compra','OC-001','LIC-1','CDP-1','15/03/2025','FAC-1','10','Nuevo','Fondos propios','Pantalla','Marca','Modelo','','','Activo','Bodega de TI'];
 for(const sep of [';','\t',',']){const r=prepararCargaEquipos(c.join(sep)+'\n'+fila.join(sep),sedes,cats);assert.deepEqual(r.errores,[]);assert.equal(r.total,10);assert.equal(r.datos.length,1);assert.equal(r.datos[0].cantidad,10);assert.equal(r.datos[0].condicionTecnica,'bodega_ti');assert.equal(r.datos[0].origen,'otro');assert.equal(r.datos[0].compra.fechaOrdenCompra,'2025-03-15');assert.equal(r.datos[0].antecedentesCarga['RUT DIRECTOR/A'],'12345678-5');assert.ok(r.datos[0].observaciones.includes('no informado'));assert.equal(r.vistas[0].antecedentes['N° OC'],'OC-001');}
 const csv=f=>c.join(';')+'\n'+f.join(';');
 const duplicado=[...fila];duplicado[19]='SERIE-ÚNICA';assert.match(prepararCargaEquipos(csv(duplicado),sedes,cats).errores.join(' '),/varias unidades/);
 const baja=[...fila];baja[21]='Dado de baja';baja[22]='Obsoleto';const b=prepararCargaEquipos(csv(baja),sedes,cats);assert.deepEqual(b.errores,[]);assert.equal(b.datos[0].estadoAdministrativo,'dado_de_baja');assert.match(b.avisos.join(' '),/pendiente de validación TI/);
 const robado=[...fila];robado[13]='1';robado[21]='Robado';const r=prepararCargaEquipos(csv(robado),sedes,cats);assert.deepEqual(r.errores,[]);assert.equal(r.datos[0].condicionTecnica,'');assert.equal(r.datos[0].antecedentesCarga['ESTADO CONDICION'],'Bodega de TI');
 for(const valor of ['1.000','2.000','1,000','10,0']){const ambigua=[...fila];ambigua[13]=valor;assert.match(prepararCargaEquipos(csv(ambigua),sedes,cats).errores.join(' '),/sin puntos ni comas/);}
 const exceso=[...fila];exceso[13]='2501';assert.ok(prepararCargaEquipos(csv(exceso),sedes,cats).errores.length);
 const fecha=[...fila];fecha[11]='31/02/2025';assert.match(prepararCargaEquipos(csv(fecha),sedes,cats).errores.join(' '),/FECHA OC/);
});

test('filtros del gestor validan período, identificadores y conservan criterios de descarga',async()=>{
 const e=await entorno(),{leerFiltroGestor,enlaceInformeInsumos}=await e.importar('@/lib/filtros-gestor-insumos');
 const f=leerFiltroGestor({sede:'11111111-1111-4111-8111-111111111111',desde:'2026-01-01',hasta:'2026-01-31',base:'entrega',categoria:'Papel',q:'A & B',limite:'100'});
 const u=new URL(enlaceInformeInsumos(f,'consolidado'),'http://local');assert.equal(u.pathname,'/gestor-insumos/exportar');for(const k of ['sede','desde','hasta','base','categoria','q'])assert.equal(u.searchParams.get(k),f[k]);assert.equal(u.searchParams.get('vista'),'consolidado');
 for(const p of [{desde:'2026-02-30'},{desde:'2026-02-02',hasta:'2026-01-01'},{sede:'otra'},{q:['a','b']},{limite:'999'},{pagina:'0'},{grupo:'inventado'}])assert.throws(()=>leerFiltroGestor(p));
});
