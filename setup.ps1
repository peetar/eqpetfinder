# Quick Start Script for Windows PowerShell
# This script helps you get started quickly

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "EQ Charm Pet Finder - Quick Setup" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-Not (Test-Path ".env")) {
    Write-Host "Creating .env file from template..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "✓ Created .env file" -ForegroundColor Green
    Write-Host ""
    Write-Host "IMPORTANT: Edit .env and update your MySQL credentials!" -ForegroundColor Red
    Write-Host ""
} else {
    Write-Host "✓ .env file already exists" -ForegroundColor Green
}

# Check if node_modules exists
if (-Not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host "✓ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✓ Dependencies already installed" -ForegroundColor Green
}

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Set up your MySQL database (see database-setup.md)" -ForegroundColor White
Write-Host "2. Update .env with your database credentials" -ForegroundColor White
Write-Host "3. Run 'npm start' to start the server" -ForegroundColor White
Write-Host "4. Open http://localhost:3000 in your browser" -ForegroundColor White
Write-Host ""
Write-Host "For development with auto-restart: npm run dev" -ForegroundColor Gray
