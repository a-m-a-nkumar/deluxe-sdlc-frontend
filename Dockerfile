# Pipeline Dockerfile — packages pre-built Vite output into nginx
# The CI "Build React" step runs: npm install → npm run build → produces dist/
# Then this Dockerfile packages dist/ into an nginx image.

# Staging: hold the pre-built files
FROM docker.artifacts.deluxe.com/nodejs/node:20 AS build

# Set the working directory
WORKDIR /app

# Copy the pre-built Vite output (dist/, not build/)
COPY ./dist/ .

# Final stage to create the runtime image
FROM nginx:alpine AS final

# Set the working directory inside the container
WORKDIR /usr/share/nginx/html

# Remove default static assets
RUN rm -rf ./*

# Copy the build artifacts from the build stage
COPY --from=build /app .

# Expose port 80
EXPOSE 80

# Start Nginx server
CMD ["nginx", "-g", "daemon off;"]
