# Build stage
FROM node:18-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm install instead of npm ci to avoid lock file issues)
RUN npm install --only=production

# Copy source code
COPY . .

# Fix api.js to use relative URLs in production
RUN echo 'import axios from "axios";\n\
\n\
// Use relative URLs when deployed (no localhost)\n\
const API_BASE_URL = process.env.REACT_APP_API_URL || "";\n\
\n\
const api = axios.create({\n\
  baseURL: API_BASE_URL,\n\
  headers: {\n\
    "Content-Type": "application/json",\n\
  },\n\
});\n\
\n\
// Request interceptor\n\
api.interceptors.request.use(\n\
  (config) => {\n\
    // Add auth token if available\n\
    const token = localStorage.getItem("auth_token");\n\
    if (token) {\n\
      config.headers.Authorization = `Bearer ${token}`;\n\
    }\n\
    return config;\n\
  },\n\
  (error) => {\n\
    return Promise.reject(error);\n\
  }\n\
);\n\
\n\
// Response interceptor\n\
api.interceptors.response.use(\n\
  (response) => {\n\
    return response;\n\
  },\n\
  (error) => {\n\
    if (error.response?.status === 401) {\n\
      // Handle unauthorized access\n\
      localStorage.removeItem("auth_token");\n\
      window.location.href = "/login";\n\
    }\n\
    return Promise.reject(error);\n\
  }\n\
);\n\
\n\
export default api;' > src/services/api.js

# Build the application with empty API URL for relative paths
ENV REACT_APP_API_URL=""
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built application from build stage
COPY --from=build /app/build /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]