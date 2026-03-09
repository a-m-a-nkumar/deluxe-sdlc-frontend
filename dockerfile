# Deluxe SDLC Frontend - Dockerfile
# Build (required for Azure login - Vite bakes these at build time):
#   docker build -t frontend \
#     --build-arg VITE_AZURE_CLIENT_ID=your-client-id \
#     --build-arg VITE_AZURE_TENANT_ID=your-tenant-id \
#     .
# Run:   docker run -p 8080:8080 -e BACKEND_URL=http://backend:8000 frontend

# Build stage
FROM public.ecr.aws/docker/library/node:18-alpine AS builder

# Azure AD / MSAL - MUST be set at build time (Vite embeds VITE_* in the bundle)
ARG VITE_AZURE_CLIENT_ID
ARG VITE_AZURE_TENANT_ID
ARG VITE_API_BASE_URL=
ARG VITE_S3_TEMPLATE_URL=

ENV VITE_AZURE_CLIENT_ID=$VITE_AZURE_CLIENT_ID
ENV VITE_AZURE_TENANT_ID=$VITE_AZURE_TENANT_ID
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_S3_TEMPLATE_URL=$VITE_S3_TEMPLATE_URL

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application (Vite will embed the ENV values above)
RUN npm run build

# Production stage
FROM public.ecr.aws/docker/library/nginx:alpine

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Install envsubst for environment variable substitution
RUN apk add --no-cache gettext

# Copy nginx configuration template
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Create startup script to substitute environment variables
# envsubst replaces ${VAR} with environment variable values
RUN echo '#!/bin/sh' > /docker-entrypoint.sh && \
    echo 'envsubst '"'"'$$BACKEND_URL $$CONFLUENCE_URL $$CONFLUENCE_HOST'"'"' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf' >> /docker-entrypoint.sh && \
    echo 'exec nginx -g "daemon off;"' >> /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

# Expose port 8080
EXPOSE 8080

# Backend and Confluence — use DOMAIN for Confluence (never IP), or TLS handshake fails with CloudFront.
ENV BACKEND_URL=http://localhost:8000
ENV CONFLUENCE_URL=https://siriusai-team-test.atlassian.net
ENV CONFLUENCE_HOST=siriusai-team-test.atlassian.net

CMD ["/docker-entrypoint.sh"]
