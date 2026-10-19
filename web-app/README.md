# Webový zpěvník

Webová aplikace (PWA) ze `songs/*.tex`, běží na **https://zpevnik.tomasbartek.cz**.

## Spuštění

```bash
cd web-app
docker compose up -d --build        # http://127.0.0.1:8080
```

Lokálně bez Dockeru:

```bash
python web-app/build.py             # -> web-app/dist
python -m http.server -d web-app/dist 8000
```
