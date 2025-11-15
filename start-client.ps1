# Скрипт для запуска клиента
Write-Host "Запускаю frontend приложение..." -ForegroundColor Green
cd client
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev"
cd ..
Write-Host "Клиент запущен на http://localhost:5173" -ForegroundColor Green
Write-Host "Нажмите любую клавишу для продолжения..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

