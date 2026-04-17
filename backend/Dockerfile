FROM python:3.12-slim

# Build-time configuration for Synthea JAR integrity verification
ARG SYNTHEA_VERSION=3.3.0
ARG SYNTHEA_SHA256=8ba04f7d73abadd5a377e41edf24c5c83935a1cb07c6d982cd5db731ef1cf445

WORKDIR /app

# System dependencies. default-jre-headless (not default-jdk) is sufficient for
# running the Synthea JAR and is significantly smaller.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    git \
    curl \
    ca-certificates \
    default-jre-headless \
    libjpeg-dev \
    libopenjp2-7-dev \
    libpng-dev \
    libtiff-dev \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies. Installed as root so they land in the global site-packages,
# then the process runs as a non-root user.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir asyncpg psycopg2-binary

# Non-root runtime user. Fixed UID/GID so bind-mounted volumes from the host
# have predictable ownership.
RUN groupadd --gid 1000 emruser && \
    useradd --uid 1000 --gid emruser --shell /bin/bash --create-home emruser

# Application code and runtime directories, owned by the non-root user.
COPY --chown=emruser:emruser . .
RUN mkdir -p /app/data /app/logs /app/synthea/build/libs /app/synthea/output /app/uploads/dicom && \
    chown -R emruser:emruser /app && \
    chmod +x /app/docker-entrypoint.sh

# Synthea JAR with SHA256 integrity check. Fails the build if the upstream
# artifact has been tampered with.
RUN set -eu && \
    curl -fL --retry 3 --retry-delay 5 \
        "https://github.com/synthetichealth/synthea/releases/download/v${SYNTHEA_VERSION}/synthea-with-dependencies.jar" \
        -o /app/synthea/build/libs/synthea-with-dependencies.jar && \
    echo "${SYNTHEA_SHA256}  /app/synthea/build/libs/synthea-with-dependencies.jar" | sha256sum -c - && \
    chown emruser:emruser /app/synthea/build/libs/synthea-with-dependencies.jar

USER emruser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
