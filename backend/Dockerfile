FROM python:3.9-slim

WORKDIR /app

# Install system dependencies including DICOM image libraries and Java for Synthea
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    git \
    curl \
    # Java for Synthea
    default-jdk \
    # Libraries for DICOM image processing
    libjpeg-dev \
    libopenjp2-7-dev \
    libpng-dev \
    libtiff-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install additional async PostgreSQL support
RUN pip install --no-cache-dir asyncpg psycopg2-binary

# Copy application code
COPY . .

# Create necessary directories including DICOM storage
RUN mkdir -p /app/data /app/logs /app/synthea/output /app/uploads/dicom

# Download Synthea JAR for patient data generation
# Using version 3.3.0 (latest stable as of configuration)
RUN set -e && \
    mkdir -p /app/synthea/build/libs && \
    echo "Downloading Synthea JAR v3.3.0..." && \
    curl -f -L --progress-bar --retry 3 --retry-delay 5 \
        https://github.com/synthetichealth/synthea/releases/download/v3.3.0/synthea-with-dependencies.jar \
        -o /app/synthea/build/libs/synthea-with-dependencies.jar && \
    echo "Verifying Synthea JAR download..." && \
    test -f /app/synthea/build/libs/synthea-with-dependencies.jar && \
    test -s /app/synthea/build/libs/synthea-with-dependencies.jar && \
    chmod +r /app/synthea/build/libs/synthea-with-dependencies.jar && \
    ls -lh /app/synthea/build/libs/synthea-with-dependencies.jar && \
    echo "Synthea JAR successfully downloaded and verified!"

# Install postgresql client for pg_isready
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

# Make entrypoint executable
RUN chmod +x /app/docker-entrypoint.sh

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Set entrypoint
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# Run with multiple workers for production
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]