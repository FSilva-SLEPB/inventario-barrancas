"""Pruebas sin Docker, Drive ni correo real."""
import datetime as dt
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts/controlar-respaldos.py'
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('control', SCRIPT)
control = importlib.util.module_from_spec(spec)
spec.loader.exec_module(control)
UTC = dt.timezone.utc
AHORA = dt.datetime(2026, 10, 29, 15, tzinfo=UTC)
CLAVE = '11111111-1111-4111-8111-111111111111'


def copia(fecha, numero=0):
    return {'id': 'inventario_' + fecha.strftime('%Y%m%dT%H%M%SZ') + f'_{numero:032x}',
            'creado': fecha, 'bytes': 123}


def marcador(c):
    return {'formato': 1, 'sistema': 'inventario-barrancas', 'postgres_major': 18,
            'id_respaldo': c['id'], 'id_clave': CLAVE,
            'verificacion': 'restauracion_postgresql18',
            'verificado_en': c['creado'].isoformat(),
            'archivos': [{'nombre': n, 'bytes': 10, 'sha256': 'a' * 64}
                         for n in sorted(control.ARCHIVOS)]}


class Politica(unittest.TestCase):
    def test_union_de_semanas_y_meses_sin_duplicados(self):
        copias = [copia(AHORA - dt.timedelta(weeks=i), i) for i in range(80)]
        plan = control.planificar(copias)
        self.assertTrue({c['id'] for c in copias[:8]} <= set(plan['conservar']))
        meses = {}
        for c in copias:
            meses.setdefault(c['creado'].astimezone(control.ZoneInfo('America/Santiago')).strftime('%Y-%m'), c['id'])
        self.assertTrue(set(list(meses.values())[:12]) <= set(plan['conservar']))
        self.assertLessEqual(len(plan['conservar']), 20)
        self.assertEqual(len(plan['conservar']) + len(plan['candidatas_vencidas']), 80)
        self.assertFalse(plan['borrado_automatico'])

    def test_copias_manuales_no_consumen_ocho_semanas(self):
        copias = [copia(AHORA - dt.timedelta(minutes=i), i) for i in range(20)]
        copias += [copia(AHORA - dt.timedelta(weeks=i), 100+i) for i in range(1, 8)]
        self.assertEqual(len(control.planificar(copias)['conservar']), 8)

    def test_cambio_de_mes_usa_hora_de_chile(self):
        fechas = [dt.datetime(2026, 11, 1, 1, tzinfo=UTC),
                  dt.datetime(2026, 11, 1, 4, tzinfo=UTC)]
        self.assertEqual(len(control.planificar([copia(f, i) for i, f in enumerate(fechas)])['conservar']), 2)

    def test_sin_copias_no_propone_borrar(self):
        self.assertEqual(control.planificar([])['candidatas_vencidas'], [])

    def test_umbrales_decimales(self):
        for usados, esperado in [(799*control.GB, 'normal'), (800*control.GB, 'advertencia'),
                                 (900*control.GB, 'critico'), (control.TB, 'critico')]:
            self.assertEqual(control.nivel(usados, control.TB), esperado)

    def test_marcador_valido(self):
        c = copia(AHORA)
        self.assertEqual(control.validar_marcador(marcador(c), c['id'], CLAVE, AHORA)['bytes'], 40)

    def test_rechaza_marcadores_inseguros(self):
        c = copia(AHORA)
        for campo, valor in [('id_clave', 'otra'), ('id_respaldo', '../otra'),
                             ('verificacion', 'solo_subida'), ('postgres_major', 17),
                             ('verificado_en', '2099-01-01T00:00:00Z'), ('archivos', [])]:
            with self.subTest(campo=campo), self.assertRaises(ValueError):
                control.validar_marcador({**marcador(c), campo: valor}, c['id'], CLAVE, AHORA)

    def test_rechaza_archivos_repetidos(self):
        c = copia(AHORA)
        datos = marcador(c)
        datos['archivos'][0] = datos['archivos'][1]
        with self.assertRaises(ValueError):
            control.validar_marcador(datos, c['id'], CLAVE, AHORA)


class Operaciones(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.raiz = Path(self.tmp.name)
        self.config = self.raiz / 'config'
        self.config.mkdir(mode=0o700)
        for nombre in ['rclone.conf', 'recuperacion-cifrado.json']:
            (self.config / nombre).write_text('{}')
            (self.config / nombre).chmod(0o600)
        (self.config / 'recuperacion-cifrado.json').write_text(json.dumps({
            'formato': 1, 'sistema': 'inventario-barrancas', 'id_clave': CLAVE,
            'unidad_id': '0AFt45KLDJwTFUk9PVA', 'carpeta_remota': 'PostgreSQL-Cifrado'}))

    def test_mide_bytes_cifrados_y_preserva_incompletas(self):
        c = copia(AHORA)
        incompleta = copia(AHORA - dt.timedelta(days=1), 2)
        llamadas = []
        def rclone(*args):
            llamadas.append(args)
            if args[0] == 'size':
                self.assertEqual(args[1], 'barrancas_drive:PostgreSQL-Cifrado')
                return {'bytes': 900*control.GB}
            if args[0] == 'cat':
                return marcador(c)
            if args[1] == 'barrancas_cifrado:':
                return [{'Path': n, 'IsDir': True} for n in [c['id'], incompleta['id'], 'desconocida']]
            return [{'Path': 'COMPLETO.json', 'IsDir': False}] if c['id'] in args[1] else []
        with patch.object(control, 'RAIZ', self.raiz), patch.object(control.Control, 'rclone', side_effect=rclone):
            informe = control.Control(self.config).informe(AHORA)
        self.assertEqual(informe['copias_completadas'], 1)
        self.assertEqual(set(informe['sin_clasificar']), {incompleta['id'], 'desconocida'})
        self.assertTrue(any('critico' in aviso for aviso in informe['avisos']))
        self.assertTrue(all(c[0] in ('size', 'lsjson', 'cat') for c in llamadas))

    def test_enlaces_locales_se_rechazan(self):
        carpeta = self.raiz / 'datos'
        carpeta.mkdir()
        (carpeta / 'externo').symlink_to(self.config, target_is_directory=True)
        with self.assertRaises(ValueError):
            control.medir_local(carpeta)

    def test_sin_mta_conserva_aviso_privado(self):
        with patch.object(control.shutil, 'which', return_value=None), patch.object(Path, 'is_file', return_value=False):
            aviso = control.notificar(self.config, ['Falló el respaldo.'])
        self.assertFalse(aviso['aceptado_por_mta'])
        pendiente = self.config / aviso['pendiente']
        self.assertEqual(pendiente.stat().st_mode & 0o777, 0o600)
        self.assertIn(control.DESTINATARIO, pendiente.read_text())

    def test_aceptado_por_mta_no_equivale_a_entregado(self):
        with patch.object(control.shutil, 'which', return_value='/falso/sendmail'), patch.object(
                control.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0)) as envio:
            aviso = control.notificar(self.config, ['Prueba'])
        self.assertTrue(aviso['aceptado_por_mta'])
        self.assertFalse(aviso['entrega_confirmada'])
        self.assertFalse(list(self.config.glob('aviso-*.eml')))
        self.assertEqual(envio.call_args.args[0], ['/falso/sendmail', '-oi', '-t'])

    def test_mta_fallido_conserva_aviso(self):
        with patch.object(control.shutil, 'which', return_value='/falso/sendmail'), patch.object(
                control.subprocess, 'run', return_value=subprocess.CompletedProcess([], 1)):
            self.assertIsNotNone(control.notificar(self.config, ['Prueba'])['pendiente'])

    def test_fallo_de_medicion_no_se_presenta_como_exito(self):
        anterior = Path.cwd()
        self.addCleanup(os.chdir, anterior)
        with patch.object(control, 'RAIZ', self.raiz), patch.dict(os.environ, {
                'INVENTARIO_RESPALDOS_CONFIG_DIR': str(self.config)}), patch.object(
                control.sys, 'argv', ['control', '--solo-control']), patch.object(
                control.Control, 'informe', side_effect=RuntimeError('secreto que no debe publicarse')), patch.object(
                control, 'notificar', return_value={'aceptado_por_mta': False}) as aviso:
            self.assertEqual(control.main(), 1)
        informe = json.loads((self.config / 'control/ultimo-control.json').read_text())
        self.assertFalse(informe['medicion_completa'])
        self.assertNotIn('secreto', json.dumps(informe))
        self.assertTrue(aviso.called)
        self.assertFalse((self.config / '.enviando-respaldo').exists())

    def test_fallo_del_respaldo_avisa_aunque_medicion_pase(self):
        anterior = Path.cwd()
        self.addCleanup(os.chdir, anterior)
        with patch.object(control, 'RAIZ', self.raiz), patch.dict(os.environ, {
                'INVENTARIO_RESPALDOS_CONFIG_DIR': str(self.config)}), patch.object(
                control.sys, 'argv', ['control']), patch.object(control.subprocess, 'run',
                return_value=subprocess.CompletedProcess([], 1)), patch.object(
                control.Control, 'informe', return_value={'avisos': []}), patch.object(
                control, 'notificar', return_value={'aceptado_por_mta': True}) as aviso:
            self.assertEqual(control.main(), 1)
        self.assertIn('restauración', aviso.call_args.args[1][0])

    def test_timeout_del_mta_conserva_el_aviso(self):
        with patch.object(control.shutil, 'which', return_value='/falso/sendmail'), patch.object(
                control.subprocess, 'run', side_effect=subprocess.TimeoutExpired('sendmail', 30)):
            self.assertIsNotNone(control.notificar(self.config, ['Prueba'])['pendiente'])


if __name__ == '__main__':
    os.umask(0o077)
    unittest.main()
