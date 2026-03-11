# Start Frontend Server
# Deluxe SDLC Frontend (from Azure DevOps)

# Set execution policy for this session only
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Starting Frontend Server..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to the frontend directory
$FrontendPath = "C:\Users\ArushSingh\Desktop\FRONTEND1"
Set-Location -Path $FrontendPath

Write-Host "Current Directory: $FrontendPath" -ForegroundColor Yellow
Write-Host ""

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "[WARNING] node_modules not found!" -ForegroundColor Yellow
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    Write-Host ""
    npm install
    Write-Host ""
}

Write-Host "Starting Vite development server..." -ForegroundColor Cyan
Write-Host "Frontend will be available at: http://localhost:5173" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Start the development server
npm run dev
