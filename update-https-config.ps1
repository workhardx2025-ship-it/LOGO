# Обновление конфигурации HTTPS в .env файле

$envFile = "D:\CursorProjects\server\.env"
$certPath = ".\certs\localhost+3.pem"
$keyPath = ".\certs\localhost+3-key.pem"

if (Test-Path $envFile) {
    $content = Get-Content $envFile -Raw
    
    # Обновляем или добавляем HTTPS_CERT_PATH
    if ($content -match "HTTPS_CERT_PATH=") {
        $content = $content -replace "HTTPS_CERT_PATH=.*", "HTTPS_CERT_PATH=$certPath"
    } else {
        $content += "`nHTTPS_CERT_PATH=$certPath`n"
    }
    
    # Обновляем или добавляем HTTPS_KEY_PATH
    if ($content -match "HTTPS_KEY_PATH=") {
        $content = $content -replace "HTTPS_KEY_PATH=.*", "HTTPS_KEY_PATH=$keyPath"
    } else {
        $content += "HTTPS_KEY_PATH=$keyPath`n"
    }
    
    # Убеждаемся, что HTTPS_ENABLED=true
    if ($content -match "HTTPS_ENABLED=") {
        $content = $content -replace "HTTPS_ENABLED=.*", "HTTPS_ENABLED=true"
    } else {
        $content += "HTTPS_ENABLED=true`n"
    }
    
    Set-Content -Path $envFile -Value $content -Encoding UTF8
    Write-Host "Конфигурация HTTPS обновлена в server\.env" -ForegroundColor Green
    Write-Host "HTTPS_CERT_PATH=$certPath" -ForegroundColor Gray
    Write-Host "HTTPS_KEY_PATH=$keyPath" -ForegroundColor Gray
} else {
    Write-Host "Файл server\.env не найден. Создайте его из server\.env.example" -ForegroundColor Yellow
}

