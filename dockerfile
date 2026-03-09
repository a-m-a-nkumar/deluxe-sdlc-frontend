FROM public.ecr.aws/docker/library/node:18-alpine AS builder

# Azure service principal / app registration inputs (embedded by Vite at build time)
ARG VITE_AZURE_CLIENT_ID
ARG VITE_AZURE_TENANT_ID
ARG VITE_API_BASE_URL=
ARG VITE_S3_TEMPLATE_URL=

ENV VITE_AZURE_CLIENT_ID=$VITE_AZURE_CLIENT_ID
ENV VITE_AZURE_TENANT_ID=$VITE_AZURE_TENANT_ID
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_S3_TEMPLATE_URL=$VITE_S3_TEMPLATE_URL

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM public.ecr.aws/nginx/nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 8080

ENV BACKEND_URL=http://localhost:8000
ENV CONFLUENCE_URL=https://siriusai-team-test.atlassian.net
ENV CONFLUENCE_HOST=siriusai-team-test.atlassian.net