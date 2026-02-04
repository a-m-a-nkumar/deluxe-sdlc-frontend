# Frontend ECS Deployment Guide

## Overview
This guide explains how to deploy the frontend to ECS without using an ALB (Application Load Balancer).

## Key Changes

### 1. Nginx Configuration
The frontend now uses a proper nginx configuration file (`nginx.conf`) that:
- Proxies `/api/*` requests to the backend service
- Proxies `/confluence-api/*` requests to Confluence
- Serves static files with proper caching
- Handles SPA routing (all routes serve `index.html`)

### 2. Environment Variables
The frontend container needs these environment variables:

```json
{
  "environment": [
    {
      "name": "BACKEND_URL",
      "value": "http://backend-service:8000"
    },
    {
      "name": "CONFLUENCE_URL",
      "value": "https://siriusai-team-test.atlassian.net"
    }
  ]
}
```

## ECS Deployment Options

### Option 1: Using ECS Service Discovery (Recommended)

If both frontend and backend are in the same ECS cluster, use service discovery:

```json
{
  "family": "deluxe-frontend",
  "containerDefinitions": [
    {
      "name": "frontend",
      "image": "448049797912.dkr.ecr.us-east-1.amazonaws.com/deluxe-sdlc:frontend",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 80,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "BACKEND_URL",
          "value": "http://deluxe-backend.local:8000"
        },
        {
          "name": "CONFLUENCE_URL",
          "value": "https://siriusai-team-test.atlassian.net"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/deluxe-frontend",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ],
  "requiresCompatibilities": ["FARGATE"],
  "networkMode": "awsvpc"
}
```

**Service Discovery Setup:**
1. Create a service discovery namespace in ECS
2. Register the backend service with DNS name: `deluxe-backend.local`
3. Register the frontend service with DNS name: `deluxe-frontend.local`

### Option 2: Using Task IP Address

If services are in the same task or network:

```json
{
  "environment": [
    {
      "name": "BACKEND_URL",
      "value": "http://<BACKEND_TASK_IP>:8000"
    }
  ]
}
```

**Note:** This requires updating the URL when backend tasks restart.

### Option 3: Using Public/Private IP

If backend has a public IP or is accessible via private network:

```json
{
  "environment": [
    {
      "name": "BACKEND_URL",
      "value": "http://<BACKEND_PUBLIC_IP>:8000"
    }
  ]
}
```

### Option 4: Using Network Load Balancer (NLB)

If you're using an NLB instead of ALB:

```json
{
  "environment": [
    {
      "name": "BACKEND_URL",
      "value": "http://<NLB_DNS_NAME>:8000"
    }
  ]
}
```

## ECS Service Configuration

### Frontend Service

```json
{
  "serviceName": "deluxe-frontend",
  "cluster": "deluxe-cluster",
  "taskDefinition": "deluxe-frontend",
  "desiredCount": 1,
  "launchType": "FARGATE",
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "subnets": ["subnet-xxx", "subnet-yyy"],
      "securityGroups": ["sg-frontend"],
      "assignPublicIp": "ENABLED"
    }
  },
  "serviceRegistries": [
    {
      "registryArn": "arn:aws:servicediscovery:us-east-1:448049797912:service/srv-xxx",
      "containerName": "frontend",
      "containerPort": 80
    }
  ]
}
```

### Backend Service (for reference)

```json
{
  "serviceName": "deluxe-backend",
  "cluster": "deluxe-cluster",
  "taskDefinition": "deluxe-backend",
  "desiredCount": 1,
  "launchType": "FARGATE",
  "networkConfiguration": {
    "awsvpcConfiguration": {
      "subnets": ["subnet-xxx", "subnet-yyy"],
      "securityGroups": ["sg-backend"],
      "assignPublicIp": "ENABLED"
    }
  },
  "serviceRegistries": [
    {
      "registryArn": "arn:aws:servicediscovery:us-east-1:448049797912:service/srv-yyy",
      "containerName": "backend",
      "containerPort": 8000
    }
  ]
}
```

## Security Groups

### Frontend Security Group
- **Inbound**: Port 80 from internet (or ALB if using one)
- **Outbound**: Port 8000 to backend security group

### Backend Security Group
- **Inbound**: Port 8000 from frontend security group
- **Outbound**: All traffic (for AWS services)

## Testing

1. **Check nginx logs:**
   ```bash
   aws logs tail /ecs/deluxe-frontend --follow
   ```

2. **Test API proxy:**
   ```bash
   curl http://<FRONTEND_IP>/api/health
   ```

3. **Test frontend:**
   ```bash
   curl http://<FRONTEND_IP>/
   ```

## Troubleshooting

### Issue: Frontend can't reach backend
- Check security groups allow traffic
- Verify BACKEND_URL environment variable
- Check nginx logs for proxy errors
- Verify backend service is running

### Issue: CORS errors
- Backend should set CORS headers
- Nginx also sets CORS headers as fallback
- Check browser console for specific errors

### Issue: 502 Bad Gateway
- Backend service might be down
- BACKEND_URL might be incorrect
- Check nginx error logs

## Rebuilding Frontend Image

After making changes:

```bash
cd deluxe-sdlc-frontend
docker build -t frontend:latest .
docker tag frontend:latest 448049797912.dkr.ecr.us-east-1.amazonaws.com/deluxe-sdlc:frontend
docker push 448049797912.dkr.ecr.us-east-1.amazonaws.com/deluxe-sdlc:frontend
```

Then update the ECS service to use the new image.
