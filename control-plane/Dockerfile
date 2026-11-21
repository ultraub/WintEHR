# WintEHR control-plane sidecar: the one container with the Docker socket.
# Runs as root inside the container because the socket demands it; the
# allow-list in app.py is the security boundary. Never publish its port.
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends git curl openssl \
    && rm -rf /var/lib/apt/lists/*

# Docker CLI + compose plugin, used only by the update helper (update.sh), a
# short-lived container the sidecar starts from this same image with the host
# repo and socket mounted. No buildx: builds use the daemon's builder exactly
# as deploy.sh on the host does.
ARG DOCKER_VERSION=27.5.1
ARG COMPOSE_VERSION=v2.32.4
RUN arch="$(uname -m)" \
    && curl -fsSL "https://download.docker.com/linux/static/stable/${arch}/docker-${DOCKER_VERSION}.tgz" \
       | tar -xz --strip-components=1 -C /usr/local/bin docker/docker \
    && mkdir -p /usr/local/lib/docker/cli-plugins \
    && curl -fsSL -o /usr/local/lib/docker/cli-plugins/docker-compose \
       "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-${arch}" \
    && chmod +x /usr/local/lib/docker/cli-plugins/docker-compose \
    && docker --version && docker compose version

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py update.sh ./
RUN chmod +x update.sh

EXPOSE 9000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD curl -fsS http://localhost:9000/health || exit 1
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "9000", "--no-server-header", "--log-level", "warning"]
