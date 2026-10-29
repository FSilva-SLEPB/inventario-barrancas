#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
umask 077
python3 - <<'PY'
from pathlib import Path
import os
import secrets
import stat
import tempfile

ruta = Path('.env')
estado = ruta.lstat()
if not stat.S_ISREG(estado.st_mode) or estado.st_uid != os.getuid() or stat.S_IMODE(estado.st_mode) != 0o600:
    raise SystemExit('.env debe ser un archivo privado 600 del usuario actual, sin enlaces.')
texto = ruta.read_text()
lineas = texto.splitlines()
valores = {'NEXTAUTH_URL': 'http://localhost:3000',
           'NEXTAUTH_SECRET': None, 'GOOGLE_CLIENT_ID': '', 'GOOGLE_CLIENT_SECRET': ''}
for nombre, valor in valores.items():
    indices = [i for i, l in enumerate(lineas) if l.strip().startswith(nombre + '=')]
    if len(indices) > 1:
        raise SystemExit('Hay entradas repetidas de ' + nombre + '; revisarlas de forma privada.')
    if indices and lineas[indices[0]].split('=', 1)[1].strip() not in ('', '""', "''"):
        continue
    if nombre == 'NEXTAUTH_SECRET':
        valor = secrets.token_urlsafe(48)
    nueva = nombre + '=' + valor
    if indices:
        lineas[indices[0]] = nueva
    else:
        lineas.append(nueva)
nuevo = '\n'.join(lineas) + '\n'
if nuevo != texto:
    fd, temporal = tempfile.mkstemp(prefix='.env-acceso-', dir='.')
    try:
        with os.fdopen(fd, 'w') as archivo:
            archivo.write(nuevo)
        os.replace(temporal, ruta)
    finally:
        if os.path.exists(temporal):
            os.unlink(temporal)
print('Configuración local preparada. Se conservaron los valores existentes; no se mostraron secretos.')
PY
