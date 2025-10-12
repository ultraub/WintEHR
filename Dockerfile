# Multi-stage Dockerfile for EMR System
# This handles both frontend and backend in a single container

# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy frontend files
COPY frontend/package*.json ./
RUN npm ci || npm install

COPY frontend/ ./

# Build with correct API URL (empty means use relative paths)
ENV REACT_APP_API_URL=""
RUN npm run build

# Stage 2: Setup backend with built frontend
FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    nginx \
    supervisor \
    curl \
    default-jre-headless \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy backend files
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/

# Copy frontend build from previous stage
COPY --from=frontend-builder /app/frontend/build /usr/share/nginx/html

# Create nginx configuration
RUN echo 'server { \n\
    listen 80; \n\
    server_name _; \n\
    \n\
    location /api/ { \n\
        proxy_pass http://localhost:8000; \n\
        proxy_http_version 1.1; \n\
        proxy_set_header Host $host; \n\
        proxy_set_header X-Real-IP $remote_addr; \n\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \n\
        proxy_set_header X-Forwarded-Proto $scheme; \n\
    } \n\
    \n\
    location /fhir/ { \n\
        proxy_pass http://localhost:8000; \n\
        proxy_http_version 1.1; \n\
        proxy_set_header Host $host; \n\
    } \n\
    \n\
    location /docs { \n\
        proxy_pass http://localhost:8000/docs; \n\
        proxy_http_version 1.1; \n\
        proxy_set_header Host $host; \n\
    } \n\
    \n\
    location /openapi.json { \n\
        proxy_pass http://localhost:8000/openapi.json; \n\
        proxy_http_version 1.1; \n\
        proxy_set_header Host $host; \n\
    } \n\
    \n\
    location / { \n\
        root /usr/share/nginx/html; \n\
        try_files $uri /index.html; \n\
    } \n\
}' > /etc/nginx/sites-available/default

# Create supervisor configuration
RUN echo '[supervisord] \n\
nodaemon=true \n\
\n\
[program:nginx] \n\
command=/usr/sbin/nginx -g "daemon off;" \n\
autostart=true \n\
autorestart=true \n\
stdout_logfile=/dev/stdout \n\
stdout_logfile_maxbytes=0 \n\
stderr_logfile=/dev/stderr \n\
stderr_logfile_maxbytes=0 \n\
\n\
[program:backend] \n\
command=python /app/backend/main.py \n\
directory=/app/backend \n\
autostart=true \n\
autorestart=true \n\
stdout_logfile=/dev/stdout \n\
stdout_logfile_maxbytes=0 \n\
stderr_logfile=/dev/stderr \n\
stderr_logfile_maxbytes=0 \n\
environment=PYTHONUNBUFFERED=1' > /etc/supervisor/conf.d/supervisord.conf

# Create startup script
RUN echo '#!/bin/bash \n\
set -e \n\
\n\
echo "Starting EMR System..." \n\
\n\
# Create necessary directories \n\
mkdir -p /app/backend/data /app/backend/logs \n\
\n\
# Initialize database if needed \n\
cd /app/backend \n\
python -c "from database.database import engine, Base; Base.metadata.create_all(bind=engine)" \n\
\n\
# Create sample providers if database is empty \n\
python -c " \n\
from database.database import SessionLocal \n\
from models.synthea_models import Provider \n\
db = SessionLocal() \n\
if db.query(Provider).count() == 0: \n\
    print(\"No providers found, creating sample providers...\") \n\
    import subprocess \n\
    subprocess.run([\"python\", \"scripts/create_sample_providers.py\"]) \n\
db.close() \n\
" \n\
\n\
# Start supervisor \n\
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf' > /app/start.sh

RUN chmod +x /app/start.sh

# Expose port
EXPOSE 80

# Start services
CMD ["/app/start.sh"]