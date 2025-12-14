# Build stage
FROM node:18-alpine as build

# Accept build arguments
ARG REACT_APP_API_URL
ARG REACT_APP_FHIR_ENDPOINT
ARG REACT_APP_WS_URL

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install instead of npm ci to avoid lock file issues)
# Using --legacy-peer-deps to handle dependency conflicts
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Set environment variables for build
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
ENV REACT_APP_FHIR_ENDPOINT=${REACT_APP_FHIR_ENDPOINT}
ENV REACT_APP_WS_URL=${REACT_APP_WS_URL}
ENV NODE_ENV=production

# Build the application with production URLs baked in
# CI=false prevents treating warnings as errors during build
RUN CI=false npm run build

# Production stage
FROM nginx:alpine

# Copy custom nginx config (non-SSL for internal frontend)
COPY nginx-default.conf /etc/nginx/conf.d/default.conf

# Copy built application from build stage
COPY --from=build /app/build /usr/share/nginx/html

# Ensure proper permissions on all files
RUN chmod -R 644 /usr/share/nginx/html/* && \
    find /usr/share/nginx/html -type d -exec chmod 755 {} \;

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]