# WintEHR control-plane sidecar: the one container with the Docker socket.
# Runs as root inside the container because the socket demands it; the
# allow-list in app.py is the security boundary. Never publish its port.
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends git curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .

EXPOSE 9000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD curl -fsS http://localhost:9000/health || exit 1
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "9000", "--no-server-header", "--log-level", "warning"]
