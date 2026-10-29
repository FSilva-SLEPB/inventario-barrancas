"""Prueba la preparación con archivos ficticios; no lee el .env del proyecto."""
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts/preparar-acceso.sh'


class Preparacion(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.raiz = Path(self.tmp.name)
        (self.raiz / 'scripts').mkdir()
        self.script = self.raiz / 'scripts/preparar-acceso.sh'
        shutil.copyfile(SCRIPT, self.script)
        self.config = self.raiz / '.env'
        self.config.write_text('POSTGRES_PASSWORD=valor_ficticio\nAPP_DB_PASSWORD=otro_ficticio\n')
        self.config.chmod(0o600)

    def ejecutar(self):
        return subprocess.run(['bash', str(self.script)], text=True, capture_output=True)

    def test_secreto_privado_y_preparacion_repetible(self):
        primera = self.ejecutar()
        self.assertEqual(primera.returncode, 0, primera.stderr)
        contenido = self.config.read_text()
        secreto = next(l.split('=', 1)[1] for l in contenido.splitlines() if l.startswith('NEXTAUTH_SECRET='))
        self.assertGreaterEqual(len(secreto), 32)
        self.assertNotIn(secreto, primera.stdout + primera.stderr)
        self.assertIn('POSTGRES_PASSWORD=valor_ficticio\n', contenido)
        self.assertEqual(self.config.stat().st_mode & 0o777, 0o600)
        self.assertEqual(self.ejecutar().returncode, 0)
        self.assertEqual(self.config.read_text(), contenido)

    def test_conserva_cliente_existente(self):
        with self.config.open('a') as f:
            f.write('GOOGLE_CLIENT_ID=cliente_ficticio\nGOOGLE_CLIENT_SECRET=secreto_ficticio\n')
        self.assertEqual(self.ejecutar().returncode, 0)
        self.assertIn('GOOGLE_CLIENT_SECRET=secreto_ficticio\n', self.config.read_text())

    def test_rechaza_duplicados_sin_modificar(self):
        with self.config.open('a') as f:
            f.write('NEXTAUTH_SECRET=uno\nNEXTAUTH_SECRET=dos\n')
        anterior = self.config.read_bytes()
        self.assertNotEqual(self.ejecutar().returncode, 0)
        self.assertEqual(self.config.read_bytes(), anterior)

    def test_rechaza_enlaces(self):
        destino = self.raiz / 'privado'
        self.config.rename(destino)
        self.config.symlink_to(destino)
        anterior = destino.read_bytes()
        self.assertNotEqual(self.ejecutar().returncode, 0)
        self.assertEqual(destino.read_bytes(), anterior)


if __name__ == '__main__':
    unittest.main()
