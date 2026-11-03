#!/usr/bin/env python3
"""Material de reunión del corte documentado; no consulta datos de la instalación."""
from pathlib import Path
import re
import html
import json
import subprocess
import tempfile
from collections import Counter
import reportlab
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle, Image
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import MSO_ANCHOR

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/jefatura'
CORTE = '2 de noviembre de 2026'
REFERENCIA = '86e11add01ce6f76a361e0eb34b6d1d31b7363e4'
REPO = 'https://github.com/FSilva-SLEPB/inventario-barrancas'
CI = REPO + '/actions/runs/41560559496'
AZUL, TINTA, GRIS, CLARO, BORDE = '#1266A7', '#193858', '#536D88', '#F3F7FC', '#D3DFED'
COLORES = {'Catálogos':'#EAF2FE','Acceso':'#F0ECFA','Equipos':'#E8F3FE','Directorio':'#E6F5F0','Entregas':'#FFF3DE','Robos':'#FCEBEC'}

# El modelo fuente fue generado desde PostgreSQL y se compara con el esquema en CI.
texto = (ROOT / 'docs/modelo-entidad-relacion.md').read_text()
mermaid = re.search(r'```mermaid\n(.*?)\n```', texto, re.S).group(1)
entidades = {}
for nombre, campos in re.findall(r'^  (\w+) \{\n(.*?)^  \}', mermaid, re.M | re.S):
    entidades[nombre] = []
    for linea in campos.splitlines():
        tipo, campo, *claves = linea.strip().split(maxsplit=2)
        entidades[nombre].append({'nombre': campo, 'tipo': tipo, 'claves': claves[0] if claves else ''})
relaciones = []
for padre, cardinal_padre, cardinal_hijo, hijo, columna in re.findall(r'^  (\w+) ([|o{}]+)--([|o{}]+) (\w+) : "([^"]+)"', mermaid, re.M):
    relaciones.append({'padre':padre,'hijo':hijo,'columna':columna,'padre_n':'0..1' if 'o' in cardinal_padre else '1','hijo_n':'0..1' if '|' in cardinal_hijo else '0..N'})
catalogo = []
for linea in texto.split('## Tablas y uso',1)[1].split('## Relaciones',1)[0].splitlines():
    if not linea.startswith('| '): continue
    partes = [v.strip() for v in linea.strip('|').split('|')]
    if partes[0] in entidades or partes[0] == 'pgmigrations': catalogo.append(dict(nombre=partes[0], area=partes[1], uso=partes[2]))
por_nombre = {t['nombre']:t for t in catalogo}
assert len(entidades) == 17 and len(relaciones) == 19 and len(catalogo) == 18
assert sum(1 for _ in (ROOT/'web/migrations').glob('*.mjs')) == 9
assert Counter(t['area'] for t in catalogo if t['nombre'] in entidades) == {'Catálogos':3,'Acceso':2,'Equipos':3,'Directorio':3,'Entregas':3,'Robos':3}


def citar(valor):
    return json.dumps(valor,ensure_ascii=False)


def dot_modelo(nombres, detallado=False):
    nombres = set(nombres)
    rs = [r for r in relaciones if r['padre'] in nombres and r['hijo'] in nombres]
    parcial = len(nombres) != len(entidades)
    titulo = f"{'Vista parcial del núcleo' if parcial else 'Modelo de relaciones actuales'} · {len(nombres)} tablas · {len(rs)} FK"
    lineas = ['digraph G {', 'graph [rankdir=LR, bgcolor="white", pad="0.35", nodesep="0.32", ranksep="1.0", splines=polyline, fontname="DejaVu Sans", fontsize=15, labelloc=t, label='+citar(titulo)+'];', 'node [shape=plain,fontname="DejaVu Sans"];', 'edge [fontname="DejaVu Sans",fontsize=10,color="#6D87A3",fontcolor="#193858",dir=none,labeldistance=1.5];']
    for area in COLORES:
        lista = [n for n in entidades if n in nombres and por_nombre[n]['area'] == area]
        if not lista: continue
        if not parcial: lineas.append('subgraph cluster_'+area.replace('á','a')+' { label='+citar(area)+'; color="#D3DFED"; style="rounded";')
        for nombre in lista:
            campos = entidades[nombre]
            if not detallado:
                campos = [c for c in campos if 'PK' in c['claves'] or any(r['hijo']==nombre and c['nombre'] in r['columna'].split(', ') for r in rs)]
            celdas = []
            for c in campos:
                claves = c['claves'].replace(', ', '/') or '·'
                contenido = f"{claves}  {c['nombre']}" + (f"  : {c['tipo'].replace('timestamp_with_time_zone','timestamptz')}" if detallado else '')
                celdas.append('<TR><TD ALIGN="LEFT"><FONT POINT-SIZE="'+('10' if detallado else '12')+'">'+html.escape(contenido)+'</FONT></TD></TR>')
            tabla = '<TABLE BORDER="0" CELLBORDER="0" CELLSPACING="0" CELLPADDING="7" BGCOLOR="'+COLORES[area]+'"><TR><TD ALIGN="LEFT"><B>'+html.escape(nombre)+'</B></TD></TR>'+''.join(celdas)+'</TABLE>'
            lineas.append(citar(nombre)+' [label=<'+tabla+'>];')
        if not parcial: lineas.append('}')
    for r in rs:
        lineas.append(citar(r['padre'])+' -> '+citar(r['hijo'])+' [label='+citar(r['columna'])+',taillabel='+citar(r['padre_n'])+',headlabel='+citar(r['hijo_n'])+'];')
    lineas.append('leyenda [shape=box,style="rounded",color="#D3DFED",fontsize=11,label="PK: clave primaria · FK: clave foránea\\n1: un registro · 0..1: opcional único · 0..N: cero o varios\\n'+('Vista parcial; consulte el modelo completo.' if parcial else 'pgmigrations: control técnico, explicado fuera del gráfico funcional.')+'\\nCorte: '+CORTE+' · estructura, sin registros personales"];')
    lineas.append('}')
    return '\n'.join(lineas)

ESTADOS = [
 ('Acceso y catálogos','Google Workspace, cinco perfiles y permisos por sede. Sedes, dependencias y categorías.','Implementado'),
 ('Equipos NC / P02','Registro, carga con revisión previa, ficha, edición e historial. Bodega de pendientes.','Implementado'),
 ('Entregas históricas','Regularización de entregas a jardines con receptor y acta existente.','Implementado; alcance histórico'),
 ('Directorio','Ficha completa y editable, contactos, historial y carga privada por RBD.','Código listo; importar listado real'),
 ('Robos','Reporte, revisión, recuperación por equipo y consolidado.','Implementado'),
 ('Navegación y modelo','Portadas, submenús, tablas comunes, móvil, gráficos y SVG.','PR #37 y #38 integrados'),
 ('Servidor y producción','Última migración/directorio respondió HTTP 200; última versión aún por verificar.','Despliegue por comprobar'),
 ('Próximos módulos','Asignaciones/devoluciones completas, nuevas actas, solicitudes y dashboard.','Pendiente'),
]
PENDIENTES = [
 ('Instalación y directorio','Actualizar y comprobar CentOS; cargar el listado real con revisión por RBD.'),
 ('Nivel Central','Definir funcionarios y completar asignación, devolución, reasignación y reparación, conservando el mismo equipo.'),
 ('Entregas y documentos','Completar traspasos y generación de actas nuevas conforme al flujo que se apruebe.'),
 ('Solicitudes e indicadores','Implementar suministros/solicitudes y después el dashboard sobre movimientos e incidentes validados.'),
 ('Operación definitiva','Preparar producción, dominio/HTTPS, supervisión, avisos, recuperación y relevo técnico.'),
]


def crear_pdf(grafico):
    candidatos = [(Path('/usr/share/fonts/truetype/dejavu'),'DejaVuSans.ttf','DejaVuSans-Bold.ttf'),(Path('/usr/share/fonts/dejavu-sans-fonts'),'DejaVuSans.ttf','DejaVuSans-Bold.ttf'),(Path(reportlab.__file__).parent/'fonts','Vera.ttf','VeraBd.ttf')]
    fuentes,normal,negrita = next((d,n,b) for d,n,b in candidatos if (d/n).exists() and (d/b).exists())
    pdfmetrics.registerFont(TTFont('Informe', str(fuentes/normal)))
    pdfmetrics.registerFont(TTFont('InformeBold', str(fuentes/negrita)))
    pdfmetrics.registerFontFamily('Informe',normal='Informe',bold='InformeBold')
    w,h=A4
    c=canvas.Canvas(str(OUT/'avance-inventario.pdf'), pagesize=A4)
    c.setTitle('Inventario 2.0 EE y TI — Avance y continuidad')
    c.setAuthor('UTIC · SLEP Barrancas')
    pagina=0
    def p(texto,y,tam=10.5,color=TINTA,ancho=w-88,x=44,espacio=10):
        estilo=ParagraphStyle('p',fontName='Informe',fontSize=tam,leading=tam*1.45,textColor=HexColor(color))
        par=Paragraph(texto,estilo);_,alto=par.wrap(ancho,h)
        assert y-alto>49, f'Texto fuera de página {pagina}: {texto[:65]}'
        par.drawOn(c,x,y-alto)
        return y-alto-espacio
    def nueva(titulo,subtitulo):
        nonlocal pagina
        if pagina: c.showPage()
        pagina+=1
        c.setFillColor(HexColor(AZUL));c.rect(0,h-10,w,10,fill=1,stroke=0)
        c.setFillColor(HexColor(GRIS));c.setFont('InformeBold',9);c.drawString(44,h-42,'SLEP BARRANCAS  /  UTIC  /  INFORME DE AVANCE')
        y=p(titulo,h-63,23,espacio=8)
        y=p(subtitulo,y,9,GRIS,espacio=24)
        c.setStrokeColor(HexColor(BORDE));c.line(44,44,w-44,44)
        c.setFillColor(HexColor(GRIS));c.setFont('Informe',7.5)
        c.drawString(44,29,f'Corte: {CORTE} · base {REFERENCIA[:8]} · documento de trabajo')
        c.drawRightString(w-44,29,f'{pagina} / 6')
        return y
    def tabla(filas,anchos,y,tam=9):
        estilo=ParagraphStyle('celda',fontName='Informe',fontSize=tam,leading=tam*1.35,textColor=HexColor(TINTA))
        datos=[[Paragraph(html.escape(str(v)),estilo) for v in fila] for fila in filas]
        t=Table(datos,colWidths=anchos,repeatRows=1)
        t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),HexColor('#E4EEF9')),('ROWBACKGROUNDS',(0,1),(-1,-1),[white,HexColor(CLARO)]),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8),('LINEBELOW',(0,0),(-1,-1),0.4,HexColor(BORDE))]))
        _,alto=t.wrap(w-88,h);assert y-alto>52,f'Tabla fuera de página {pagina}: {alto}'
        t.drawOn(c,44,y-alto);return y-alto-15
    y=nueva('Inventario 2.0 EE y TI','Avance funcional, modelo de datos y continuidad · '+CORTE)
    y=p('Un registro trazable de los equipos y sus movimientos',y,18,espacio=15)
    y=p('El proyecto reúne identificación de equipos de Nivel Central y EE/JISC, historial, directorio, entregas históricas e incidentes, con acceso institucional y permisos por sede.',y,12,espacio=23)
    y=tabla([['17 tablas funcionales','19 relaciones FK','242 pruebas HTTP'],['+ 1 tabla técnica','9 migraciones','87 pruebas unitarias']],[(w-88)/3]*3,y,11)
    y=p('<b>Disponible en el código:</b> inventario NC/P02, cargas revisables, fichas e historial, directorio editable, regularización de entregas a jardines y consolidado de robos.',y,11)
    y=p('<b>Validado:</b> pruebas automáticas con PostgreSQL temporal y revisión en navegador de escritorio y móvil. Los PR #37 y #38 están integrados.',y,11)
    y=p('<b>Por comprobar en CentOS:</b> actualización más reciente e importación del listado real de directores/as. Integrar código en GitHub no despliega el servidor.',y,11)
    y=p('El entorno actual utiliza el modo de desarrollo. La puesta en producción y los módulos pendientes tienen una etapa propia.',y,11)
    y=p('Este informe no informa porcentajes de avance ni cifras actuales de equipos: requieren alcance aprobado y consulta de la instalación.',y,9,GRIS)
    y=nueva('Alcance disponible','Implementación y despliegue son estados distintos.')
    y=tabla([['Área','Resultado y límite','Estado']]+ESTADOS,[103,235,w-88-338],y,8.5)
    y=p('La evidencia de CentOS recibida confirma la migración 1793923200000_directorio-establecimientos y HTTP 200 de la web/directorio. No acredita la carga de responsables ni las mejoras posteriores.',y,9,GRIS)
    y=nueva('Cómo se relacionan los registros','Vista parcial del núcleo; el SVG completo contiene las 17 tablas y 19 FK.')
    im=Image(str(grafico));escala=min((w-88)/im.imageWidth,310/im.imageHeight);alto=im.imageHeight*escala
    im.drawWidth=im.imageWidth*escala;im.drawHeight=alto;im.drawOn(c,44+(w-88-im.drawWidth)/2,y-alto);y-=alto+20
    y=p('<b>Identidad estable:</b> el mismo equipo conserva sus cambios y se vincula a entregas e incidentes. Las entregas mantienen los datos de quien recibió en ese momento.',y,10)
    y=p('<b>Auditoría:</b> se conservan usuario, fecha, motivo y antecedentes. Cambiar al director/a actual no reescribe las entregas anteriores. Reportar robo no elimina el bien ni equivale a una baja.',y,10)
    y=p('El diagrama completo y el de atributos se entregan como SVG para ampliar. Actores guardados como texto y datos históricos en JSON no se presentan como FK inexistentes.',y,9,GRIS)
    y=nueva('Tablas y propósito','17 funcionales y pgmigrations como tabla técnica adicional.')
    usos={
      'cargas_equipos':'Origen de cargas y control de reintentos.', 'categorias_bienes':'Clasificación de equipos.', 'dependencias':'Ubicaciones de una sede; sin FK desde equipos.',
      'directorio_cargas':'Control de listados para evitar repetir cambios.', 'directorio_historial':'Cambios de responsable y datos de sede.', 'directorio_sedes':'Responsable vigente y contactos por sede.',
      'entregas_detalle':'Equipos de cada entrega y datos históricos.', 'entregas_equipos':'Entrega por sede y persona receptora.', 'entregas_lotes':'Agrupación de la operación de entrega.',
      'equipos':'Identidad, sede, categoría y situación del bien.', 'equipos_historial':'Ediciones, entregas e incidentes del equipo.', 'incidentes_robos':'Reporte, antecedentes y estado del incidente.',
      'incidentes_robos_equipos':'Bienes afectados y recuperación individual.', 'incidentes_robos_historial':'Seguimiento y decisiones sobre el robo.', 'pgmigrations':'Control de migraciones aplicadas.',
      'sedes':'EE/JISC y Nivel Central.', 'usuarios_acceso':'Cuentas, perfiles y alcance autorizado.', 'usuarios_acceso_historial':'Cambios de cuentas y permisos.'}
    y=tabla([['Tabla','Área','Propósito']]+[[t['nombre'],t['area'],usos[t['nombre']]] for t in catalogo],[172,67,w-88-239],y,8.2)
    y=p('Una tabla vacía puede estar en uso. Los recuentos vigentes se consultan como administrador en Mantenedores → Modelo de datos.',y,9,GRIS)
    y=nueva('Cómo mantener el sistema','Cambios de datos, cambios de código y operación del servidor.')
    y=tabla([['Necesidad','Dónde se realiza'],['Datos y responsables','Mantenedores e Inventario, según el perfil autorizado.'],['Cambios funcionales o visuales','Copia de desarrollo → rama → pruebas → PR → versión aprobada.'],['Actualización del servicio','Respaldo verificado → instalación/migración → pruebas en CentOS.'],['Continuidad','Responsables, recuperación, custodia institucional y relevo.']],[135,w-88-135],y,10)
    y=p('<b>Diariamente:</b> revisar disponibilidad, errores, espacio y último respaldo/control.',y,11)
    y=p('<b>Semanalmente:</b> confirmar copia externa y recuperación de prueba. La programación existente debe comprobarse al recuperar acceso.',y,11)
    y=p('<b>Mensualmente:</b> revisar permisos, dependencias y parches; actualizar mediante versiones probadas.',y,11)
    y=p('<b>Producción:</b> preparar servicio compilado, dominio/HTTPS, supervisión y avisos. Compose todavía ejecuta next dev. Retención automática y transporte real de correo siguen pendientes.',y,10)
    y=p('La guía de mantenimiento del repositorio describe rutas del código, procedimientos y relevo. Git conserva código; PostgreSQL requiere sus propias copias.',y,9,GRIS)
    y=nueva('Próximas etapas y decisiones','Propuesta de secuencia; fechas y prioridad requieren acuerdo.')
    for titulo,contenido in PENDIENTES:
        y=p('<b>'+titulo+'</b> · '+contenido,y,10.3,espacio=12)
    y=p('<b>Para acordar con jefatura:</b> responsable funcional y técnico, reemplazo autorizado, infraestructura, prioridad de módulos y objetivos de pérdida de datos y tiempo de recuperación.',y,10.3,espacio=18)
    y=p('<b>Evidencia verificable:</b> base '+REFERENCIA[:8]+', PR #37/#38 integrados y <link href="'+CI+'" color="'+AZUL+'">verificación de código aprobada en GitHub</link>. Las pruebas no equivalen a certificación de producción.',y,9,espacio=12)
    y=p('Material complementario: presentación PowerPoint editable, dos modelos SVG, diccionario de tablas y guía de operación. No contiene registros personales ni métricas actuales del servidor.',y,9,GRIS)
    assert pagina==6
    c.save()


def crear_presentacion(grafico):
    prs=Presentation();prs.slide_width=Inches(13.333);prs.slide_height=Inches(7.5)
    def color(v):return RGBColor.from_string(v.lstrip('#'))
    def texto(sl,x,y,w,h,contenido,tam=20,negrita=False,tinta=TINTA):
        caja=sl.shapes.add_textbox(Inches(x),Inches(y),Inches(w),Inches(h))
        f=caja.text_frame;f.word_wrap=True;f.margin_left=Inches(.02);f.margin_right=Inches(.02);f.margin_top=0;f.margin_bottom=0
        for i,linea in enumerate(contenido.split('\n')):
            p=f.paragraphs[0] if i==0 else f.add_paragraph();p.text=linea;p.font.name='Aptos';p.font.size=Pt(tam);p.font.bold=negrita;p.font.color.rgb=color(tinta);p.space_after=Pt(10 if i<len(contenido.split('\n'))-1 else 0)
        return caja
    def base(titulo,nota=''):
        s=prs.slides.add_slide(prs.slide_layouts[6]);s.background.fill.solid();s.background.fill.fore_color.rgb=color('#FFFFFF')
        banda=s.shapes.add_shape(1,0,0,prs.slide_width,Inches(.1));banda.fill.solid();banda.fill.fore_color.rgb=color(AZUL);banda.line.fill.background()
        texto(s,.6,.25,12,.3,'SLEP BARRANCAS  /  UTIC  /  AVANCE DEL INVENTARIO',12,True,GRIS)
        texto(s,.6,.85,12,1.0,titulo,31,True)
        texto(s,.6,7.06,11.7,.24,f'{CORTE} · base {REFERENCIA[:8]} · documento de trabajo',10,False,GRIS)
        texto(s,12.05,7.06,.6,.24,str(len(prs.slides)),10,False,GRIS)
        s.notes_slide.notes_text_frame.text=nota+'\nFuente: '+REPO+'/tree/'+REFERENCIA+'\nEstado funcional: docs/informe-avance-jefatura.md. Los datos del servidor no fueron consultados para este material.'
        return s
    def tarjeta(s,x,y,w,h,titulo,contenido):
        shape=s.shapes.add_shape(5,Inches(x),Inches(y),Inches(w),Inches(h));shape.fill.solid();shape.fill.fore_color.rgb=color(CLARO);shape.line.color.rgb=color(BORDE)
        texto(s,x+.22,y+.15,w-.44,.55,titulo,22,True,AZUL)
        texto(s,x+.22,y+.9,w-.44,h-1.0,contenido,18)
    s=base('Inventario 2.0 EE y TI','Presentación del estado del código, distinta de la instalación real. No informar porcentajes sin alcance aprobado.')
    texto(s,.65,2.0,11.7,1.2,'Identificación de equipos, historial y gestión por sede\nUna base para la trazabilidad y la continuidad de UTIC.',26)
    for x,n,t in [(0.65,'17','Tablas funcionales'),(3.8,'19','Relaciones FK'),(6.95,'242','Pruebas HTTP'),(10.1,'9','Migraciones')]:
        texto(s,x,4.0,2.5,.75,n,42,True,AZUL);texto(s,x,4.95,2.55,.6,t,17)
    texto(s,.65,6.05,11.7,.5,'Código integrado hasta PR #38 · actualización de CentOS y carga real del directorio por comprobar.',16,False,GRIS)
    s=base('Qué está disponible','Inventario y mantenedores implementados; la entrega existente es regularización histórica de jardines, no un generador de actas nuevas.')
    tarjeta(s,.65,2,3.9,3.95,'Inventario','NC y P02 separados\nCarga con vista previa\nFicha, edición e historial\nBodega y entregas históricas')
    tarjeta(s,4.72,2,3.9,3.95,'Administración','Acceso y cinco perfiles\nSedes y catálogos\nDirectorio editable\nModelo de datos y SVG')
    tarjeta(s,8.79,2,3.9,3.95,'Incidentes','Reporte simple de robo\nRevisión administrativa\nRecuperación por equipo\nConsolidado por sede')
    s=base('Tres estados que se deben distinguir','La última evidencia de CentOS es migración 1793923200000 y HTTP 200 del directorio. No acredita los despliegues posteriores.')
    tarjeta(s,.65,2,3.9,3.95,'Implementado','Funciones presentes en el código.\nPR #37 y #38 integrados en GitHub.')
    tarjeta(s,4.72,2,3.9,3.95,'Probado','87 pruebas unitarias\n242 comprobaciones HTTP\nPostgreSQL temporal\nNavegador y móvil')
    tarjeta(s,8.79,2,3.9,3.95,'En el servidor','Verificar versión instalada.\nImportar directorio real.\nComprobar funcionamiento y permisos.')
    s=base('Modelo del núcleo: vista parcial','Ocho tablas del núcleo y nueve FK, extraídas del modelo completo. El anexo SVG contiene 17 tablas y 19 FK. PK: primaria; FK: foránea.')
    from PIL import Image as PILImage
    with PILImage.open(grafico) as im: iw,ih=im.size
    ancho,alto=11.9,4.65;factor=min(ancho/iw,alto/ih)
    s.shapes.add_picture(str(grafico),Inches(.65+(ancho-iw*factor)/2),Inches(1.85),width=Inches(iw*factor),height=Inches(ih*factor))
    texto(s,.65,6.55,12,.28,'Descargar y ampliar los modelos completos de relaciones y atributos: docs/jefatura/.',13,False,GRIS)
    s=base('Qué guarda cada área','Los historiales conservan actor, fecha, motivo y datos. Actores en texto y JSON no se dibujan como FK inexistentes. pgmigrations es control técnico.')
    filas=[('Catálogos · 3','Sedes, ubicaciones internas y categorías.'),('Acceso · 2','Cuentas, perfiles y cambios de permisos.'),('Equipos · 3','Identidad del bien, cargas e historial.'),('Directorio · 3','Responsable vigente, cambios y cargas.'),('Entregas · 3','Lotes, cabeceras y equipos entregados.'),('Robos · 3','Incidente, bienes afectados y seguimiento.')]
    for i,(t,d) in enumerate(filas):
        y=1.95+i*.69;texto(s,.75,y,3.15,.5,t,20,True,AZUL);texto(s,4.05,y,8.5,.5,d,20)
    texto(s,.75,6.45,11.9,.35,'17 tablas funcionales + pgmigrations. Dependencias aún no tiene FK desde equipos.',15,False,GRIS)
    s=base('Cómo se conservará la trazabilidad','Cambiar la persona del directorio no modifica las instantáneas de entregas ya registradas. Robo no elimina un bien ni ejecuta una baja.')
    tarjeta(s,.65,2,5.9,3.95,'El mismo equipo','Conserva su identificación interna.\nSus ediciones quedan en historial.\nSe vincula a entregas e incidentes.\nEditar su ficha no crea otro equipo.')
    tarjeta(s,6.75,2,5.9,3.95,'La evidencia de cada momento','Usuario y fecha del cambio.\nMotivo y datos anteriores/posteriores.\nPersona receptora en su entrega.\nValidación y recuperación separadas.')
    s=base('Cómo se mantendrá la aplicación','La guía de operación incluye rutas del código, despliegue, respaldo y relevo. Git conserva código; PostgreSQL necesita sus propias copias.')
    tarjeta(s,.65,2,3.9,3.95,'Datos','Se administran desde las pantallas autorizadas.\nDirectorio y permisos son tareas distintas.')
    tarjeta(s,4.72,2,3.9,3.95,'Código','Editor y rama de desarrollo.\nPruebas y revisión por PR.\nVersión identificada antes de instalar.')
    tarjeta(s,8.79,2,3.9,3.95,'Servidor','Respaldo comprobado.\nInstalación y migraciones.\nVerificación del servicio.\nSupervisión y recuperación.')
    s=base('Próximas etapas propuestas','La secuencia requiere acuerdo. No constituye un compromiso de fechas ni de porcentaje de avance.')
    resumenes=[PENDIENTES[0],('Nivel Central','Funcionarios, asignación, devolución, reasignación y reparación con historial.'),('Entregas y documentos','Completar traspasos y generación de actas nuevas según el flujo aprobado.'),('Solicitudes e indicadores','Suministros y solicitudes; después, dashboard sobre información validada.'),('Operación definitiva','Producción, dominio/HTTPS, supervisión, recuperación y relevo técnico.')]
    for i,(titulo,contenido) in enumerate(resumenes):
        y=1.9+i*.86;texto(s,.7,y,3.2,.6,titulo,18,True,AZUL);texto(s,4.1,y,8.4,.73,contenido,18)
    s=base('Qué acordar para la operación definitiva','La configuración actual ejecuta next dev en localhost. Faltan producción, dominio/HTTPS y supervisión. Retención automática y transporte de avisos por correo pendientes.')
    texto(s,.75,2.0,11.8,3.6,'Responsable funcional y responsable técnico, con reemplazo.\nCustodia institucional del código, configuración y claves de recuperación.\nInfraestructura, dominio/HTTPS y supervisión del servicio.\nPrioridad de módulos y criterios de aceptación.\nPérdida de datos máxima aceptable y tiempo objetivo de recuperación.',23)
    texto(s,.75,6.15,11.8,.75,'Evidencia: PR #37/#38 integrados; verificación de código aprobada.\nInforme, guía y diagramas completos disponibles en el repositorio.',16,False,GRIS)
    assert len(prs.slides)==9
    prs.save(OUT/'avance-inventario.pptx')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    nucleo={'sedes','categorias_bienes','cargas_equipos','equipos','equipos_historial','entregas_lotes','entregas_equipos','entregas_detalle'}
    with tempfile.TemporaryDirectory(prefix='inventario-docs-') as directorio:
        temporal=Path(directorio)
        for nombre,lista,detallado in [('modelo-relaciones',entidades,False),('modelo-atributos',entidades,True),('modelo-principal',nucleo,False)]:
            dot=dot_modelo(lista,detallado)
            fuente=temporal/(nombre+'.dot');fuente.write_text(dot)
            subprocess.run(['dot','-Tsvg',str(fuente),'-o',str(OUT/(nombre+'.svg'))],check=True)
            if nombre=='modelo-principal':
                subprocess.run(['dot','-Tpng','-Gdpi=180',str(fuente),'-o',str(temporal/'modelo-principal.png')],check=True)
        crear_pdf(temporal/'modelo-principal.png')
        crear_presentacion(temporal/'modelo-principal.png')
    print('Generados: PDF de 6 páginas, PowerPoint de 9 diapositivas y 3 SVG.')
    print('Modelo completo: 17 tablas funcionales, 19 FK; catálogo: 18 tablas. Sin datos de registros.')

if __name__=='__main__':main()
