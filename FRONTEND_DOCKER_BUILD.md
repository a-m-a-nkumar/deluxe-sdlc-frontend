# Frontend Docker build (fix for login.microsoftonline.com/undefined)

## Why you see `/undefined/` in the login URL

The app uses **Vite** and **MSAL**. Vite embeds `VITE_*` env vars **at build time**.  
If you only set `VITE_AZURE_CLIENT_ID` and `VITE_AZURE_TENANT_ID` in ECS (runtime), they are **not** in the built JS, so the authority becomes `https://login.microsoftonline.com/undefined/...`.

## Fix: pass Azure vars at **build** time

Build the image with **build args** so Vite can bake them into the bundle.

**Important:** Do **not** set `VITE_API_BASE_URL=/api`. The app already prefixes paths with `/api/...`; using `/api` as base causes `/api/api/...` and 404s. For production (ALB routing /api/* to backend), leave it **empty** or omit the arg.

**PowerShell (Windows) — use one line or backtick `` ` `` for continuation:**

```powershell
docker build -t frontend --build-arg VITE_AZURE_CLIENT_ID=10eda5db-4715-4e7b-bcd9-32dba3533084 --build-arg VITE_AZURE_TENANT_ID=0575746d-c254-4eea-bfc6-10d0979d1e90 --build-arg VITE_S3_TEMPLATE_URL=https://test-development-bucket-siriusai.s3.us-east-1.amazonaws.com/templates/Deluxe_BRD_Template_v2+2.docx .
```

**Bash / Linux / Git Bash (backslash for continuation):**

```bash
docker build -t frontend \
  --build-arg VITE_AZURE_CLIENT_ID=10eda5db-4715-4e7b-bcd9-32dba3533084 \
  --build-arg VITE_AZURE_TENANT_ID=0575746d-c254-4eea-bfc6-10d0979d1e90 \
  --build-arg VITE_S3_TEMPLATE_URL=https://test-development-bucket-siriusai.s3.us-east-1.amazonaws.com/templates/Deluxe_BRD_Template_v2+2.docx \
  .
```

Then run (runtime env vars are still used for nginx, etc.):

```bash
docker run -p 8080:8080 \
  -e BACKEND_URL=https://your-backend-url \
  -e NEXTAUTH_URL=https://deluxe.siriusai.com \
  -e NEXTAUTH_SECRET=your-secret \
  frontend
```

## ECS / CI

When building the image for ECS (e.g. in CodeBuild or a pipeline), pass the same build args from your pipeline’s environment (or secrets). The **runtime** env vars you set in the ECS task definition (NEXTAUTH_*, BACKEND_URL, etc.) do not change the already-built Azure config; they are for the server/nginx. Azure client/tenant **must** be provided at **build** time as above.

## Auth code (already correct)

- **Frontend:** `src/services/authService.ts` uses `import.meta.env.VITE_AZURE_CLIENT_ID` and `import.meta.env.VITE_AZURE_TENANT_ID`. No change needed.
- **Backend:** Uses `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET` (and optionally `AZURE_AD_*`). Your backend env is fine.

The only fix required was building the frontend image with the Azure build args so the login URL is `.../0575746d-c254-4eea-bfc6-10d0979d1e90/oauth2/...` instead of `.../undefined/...`.
