# Скрипт для запуска всего приложения
Write-Host "Запускаю приложение..." -ForegroundColor Green

# Запускаем сервер
Write-Host "`n1. Запускаю backend сервер..." -ForegroundColor Yellow
cd server
Start-Process powershell -ArgumentList "-NoExit", "-Command", "node index.js"
Start-Sleep -Seconds 2
cd ..

# Запускаем клиент
Write-Host "2. Запускаю frontend приложение..." -ForegroundColor Yellow
cd client
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev"
cd ..

Write-Host "`n✓ Приложение запущено!" -ForegroundColor Green
Write-Host "Backend: http://localhost:3001" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "`nОткройте браузер и перейдите на http://localhost:5173" -ForegroundColor Yellow
Write-Host "`nДля остановки закройте окна PowerShell" -ForegroundColor Gray

