# Build context = repository root (see docker-compose.yml)
FROM python:3.13-alpine AS build
WORKDIR /src
COPY web-app/build.py web-app/build.py
COPY web-app/static web-app/static
COPY songs songs
RUN python web-app/build.py --songs songs --out /dist

# Unprivileged nginx: runs as uid 101 and listens on 8080
FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY web-app/nginx.conf /etc/nginx/conf.d/default.conf
COPY web-app/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build --chown=root:root --chmod=a=rX /dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=60s --timeout=3s CMD wget -qO /dev/null http://127.0.0.1:8080/ || exit 1
