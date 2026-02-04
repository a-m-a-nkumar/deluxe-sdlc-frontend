# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Install envsubst for environment variable substitution
RUN apk add --no-cache gettext

# Copy nginx configuration template
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Create startup script to substitute environment variables
# envsubst replaces ${VAR} with environment variable values
RUN echo '#!/bin/sh' > /docker-entrypoint.sh && \
    echo 'envsubst '"'"'$$BACKEND_URL $$CONFLUENCE_URL'"'"' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf' >> /docker-entrypoint.sh && \
    echo 'exec nginx -g "daemon off;"' >> /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

# Expose port 8080
EXPOSE 8080

# Set default backend URL (can be overridden via environment variable in ECS)
# In ECS, set BACKEND_URL to your backend service URL
# Examples:
# - http://localhost:8000 (same container/task)
# - http://backend-service:8000 (service discovery)
# - http://<backend-ip>:8000 (direct IP)
ENV BACKEND_URL=http://localhost:8000
ENV CONFLUENCE_URL=https://siriusai-team-test.atlassian.net

# Start nginx with environment variable substitution
CMD ["/docker-entrypoint.sh"]
