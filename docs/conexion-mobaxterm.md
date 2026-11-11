# Acceso local con MobaXterm

La comprobación enviada por Felipe el 11/11/2026 muestra web y PostgreSQL saludables,
`127.0.0.1:3000->3000/tcp` y `/api/salud` con HTTP 200. El acceso del navegador se
mantiene en `http://localhost:3000`, mediante túnel SSH. No se necesita publicar el
puerto 3000 en todas las interfaces para usarlo desde otro equipo.

En MobaXterm:

1. En Settings → Configuration → SSH, activar **SSH keepalive**. Si la versión
   permite elegir el intervalo, usar 30 segundos. Reconectar la sesión para aplicar.
2. En Tunneling, mantener un túnel **Local port forwarding**: puerto local `3000`,
   servidor remoto `127.0.0.1`, puerto remoto `3000`. Como servidor SSH, usar la
   dirección del CentOS y el usuario `slepb`, puerto `22`.
3. Iniciar el túnel y abrir `http://localhost:3000`. Comprobar que otro programa no
   esté ocupando el puerto local 3000. Tras una desconexión, volver a iniciar el túnel.

Que fallen simultáneamente SSH y la página es compatible con una interrupción de
la conexión o del túnel; el HTTP 200 posterior no determina la causa de esa caída.
Keepalive puede evitar cierres por inactividad, pero no repara una pérdida de red.
Si vuelve a ocurrir, anotar hora y mensaje de MobaXterm; al reconectar comprobar:

```bash
cd /home/slepb/inventario-barrancas
docker compose -p inventario-barrancas -f compose.produccion.yaml ps -a
curl -fsS --max-time 15 -w '\nHTTP %{http_code}\n' http://127.0.0.1:3000/api/salud
uptime
```

Esto permite distinguir reinicios o fallas de la aplicación de la pérdida del
acceso SSH. Esta revisión no cambia SSH, NetworkManager ni el firewall del servidor.
