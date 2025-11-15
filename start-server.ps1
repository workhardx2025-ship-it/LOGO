# Скрипт для запуска сервера
Write-Host "Запускаю backend сервер..." -ForegroundColor Green
cd server
Start-Process powershell -ArgumentList "-NoExit", "-Command", "node index.js"
cd ..
Write-Host "Сервер запущен на http://localhost:3001" -ForegroundColor Green
Write-Host "Нажмите любую клавишу для продолжения..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

