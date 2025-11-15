# Скрипт для автоматической настройки HTTPS
# Запустите: .\setup-https.ps1

Write-Host "Настройка HTTPS для локальной разработки" -ForegroundColor Cyan
Write-Host ""

# Проверяем наличие mkcert
$mkcertPath = Get-Command mkcert -ErrorAction SilentlyContinue

if (-not $mkcertPath) {
    Write-Host "mkcert не найден в PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Пожалуйста, установите mkcert одним из способов:" -ForegroundColor Yellow
    Write-Host "1. Скачайте с https://github.com/FiloSottile/mkcert/releases/latest" -ForegroundColor Yellow
    Write-Host "   Переименуйте в mkcert.exe и поместите в папку в PATH" -ForegroundColor Yellow
    Write-Host "2. Или используйте Scoop: scoop install mkcert" -ForegroundColor Yellow
    Write-Host "3. Или используйте Chocolatey: choco install mkcert" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "После установки запустите этот скрипт снова." -ForegroundColor Yellow
    exit 1
}

Write-Host "mkcert найден: $($mkcertPath.Source)" -ForegroundColor Green
Write-Host ""

# Создаем папку для сертификатов
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$certsDir = Join-Path $scriptRoot "server\certs"
if (-not (Test-Path $certsDir)) {
    New-Item -ItemType Directory -Path $certsDir -Force | Out-Null
    Write-Host "Создана папка для сертификатов: $certsDir" -ForegroundColor Green
}

# Устанавливаем локальный CA (если еще не установлен)
Write-Host "Установка локального Certificate Authority..." -ForegroundColor Cyan
& mkcert -install
if ($LASTEXITCODE -eq 0) {
    Write-Host "Локальный CA установлен" -ForegroundColor Green
} else {
    Write-Host "Возможно, CA уже установлен или произошла ошибка" -ForegroundColor Yellow
}

Write-Host ""

# Получаем локальный IP адрес
Write-Host "Определение локального IP адреса..." -ForegroundColor Cyan
$localIPs = @("127.0.0.1", "localhost")
try {
    $networkAdapters = Get-NetIPAddress -AddressFamily IPv4
    foreach ($adapter in $networkAdapters) {
        $ip = $adapter.IPAddress
        if ($ip -and $ip -notlike "127.*" -and $ip -notlike "169.254.*") {
            $localIPs += $ip
        }
    }
} catch {
    Write-Host "Не удалось определить все IP адреса, используем только localhost" -ForegroundColor Yellow
}

Write-Host "Найденные адреса: $($localIPs -join ', ')" -ForegroundColor Gray
Write-Host ""

# Создаем сертификаты
Write-Host "Создание сертификатов..." -ForegroundColor Cyan
$originalLocation = Get-Location
Set-Location $certsDir

$certArgs = $localIPs + @("::1")
& mkcert $certArgs

if ($LASTEXITCODE -eq 0) {
    Write-Host "Сертификаты созданы успешно!" -ForegroundColor Green
    Write-Host ""
    
    # Находим созданные файлы
    $certFiles = Get-ChildItem -Filter "*.pem" | Sort-Object LastWriteTime -Descending | Select-Object -First 2
    
    if ($certFiles.Count -ge 2) {
        $certFile = $certFiles[0].Name
        $keyFile = $certFiles[1].Name
        
        Write-Host "Сертификат: $certFile" -ForegroundColor Green
        Write-Host "Ключ: $keyFile" -ForegroundColor Green
        Write-Host ""
        
        # Обновляем .env файл
        $envFile = Join-Path $scriptRoot "server\.env"
        $envExample = Join-Path $scriptRoot "server\.env.example"
        
        if (Test-Path $envExample) {
            if (-not (Test-Path $envFile)) {
                Copy-Item $envExample $envFile
                Write-Host "Создан файл server\.env из примера" -ForegroundColor Green
            }
            
            # Обновляем настройки HTTPS в .env
            $envContent = Get-Content $envFile -Raw
            $certPath = ".\certs\$certFile"
            $keyPath = ".\certs\$keyFile"
            
            if ($envContent -match "HTTPS_ENABLED=") {
                $envContent = $envContent -replace "HTTPS_ENABLED=.*", "HTTPS_ENABLED=true"
            } else {
                $envContent += "`nHTTPS_ENABLED=true`n"
            }
            
            if ($envContent -match "HTTPS_CERT_PATH=") {
                $envContent = $envContent -replace "HTTPS_CERT_PATH=.*", "HTTPS_CERT_PATH=$certPath"
            } else {
                $envContent += "HTTPS_CERT_PATH=$certPath`n"
            }
            
            if ($envContent -match "HTTPS_KEY_PATH=") {
                $envContent = $envContent -replace "HTTPS_KEY_PATH=.*", "HTTPS_KEY_PATH=$keyPath"
            } else {
                $envContent += "HTTPS_KEY_PATH=$keyPath`n"
            }
            
            Set-Content -Path $envFile -Value $envContent -Encoding UTF8
            Write-Host "Настройки HTTPS обновлены в server\.env" -ForegroundColor Green
        } else {
            Write-Host "Файл server\.env.example не найден, создайте .env вручную" -ForegroundColor Yellow
        }
        
        Write-Host ""
        Write-Host "Настройка HTTPS завершена!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Следующие шаги:" -ForegroundColor Cyan
        Write-Host "1. Убедитесь, что в server\.env установлено HTTPS_ENABLED=true" -ForegroundColor Yellow
        Write-Host "2. Для Vite создайте client\.env с VITE_HTTPS_ENABLED=true" -ForegroundColor Yellow
        Write-Host "3. Запустите приложение: npm run dev" -ForegroundColor Yellow
        Write-Host "4. Откройте https://localhost:5173 в браузере" -ForegroundColor Yellow
    } else {
        Write-Host "Не найдены файлы сертификатов" -ForegroundColor Yellow
    }
} else {
    Write-Host "Ошибка при создании сертификатов" -ForegroundColor Red
    Set-Location $originalLocation
    exit 1
}

Set-Location $originalLocation
