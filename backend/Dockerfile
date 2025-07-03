FROM python:3.9-slim

WORKDIR /app

# Install system dependencies including DICOM image libraries and Java for Synthea
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    git \
    curl \
    # Java for Synthea
    openjdk-17-jdk \
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

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Run with multiple workers for production
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]