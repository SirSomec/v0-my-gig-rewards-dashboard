# Скачивание корневого и промежуточного CA Yandex Cloud для подключения к ETL (MVP).
# Запуск: из папки nestjs-service выполнить: .\scripts\download-yandex-certs.ps1

$ErrorActionPreference = "Stop"
$certDir = Join-Path $PSScriptRoot ".." "certs"
$rootCaUrl = "https://storage.yandexcloud.net/cloud-certs/RootCA.pem"
$intermediateCaUrl = "https://storage.yandexcloud.net/cloud-certs/IntermediateCA.pem"

if (-not (Test-Path $certDir)) {
    New-Item -ItemType Directory -Path $certDir | Out-Null
    Write-Host "Создана папка: $certDir"
}

$rootPath = Join-Path $certDir "RootCA.pem"
$intermediatePath = Join-Path $certDir "IntermediateCA.pem"
$combinedPath = Join-Path $certDir "YandexCloudCA.pem"

Write-Host "Скачивание RootCA.pem..."
Invoke-WebRequest -Uri $rootCaUrl -OutFile $rootPath -UseBasicParsing

Write-Host "Скачивание IntermediateCA.pem..."
Invoke-WebRequest -Uri $intermediateCaUrl -OutFile $intermediatePath -UseBasicParsing

Write-Host "Формирование объединённого файла YandexCloudCA.pem..."
Get-Content $rootPath, $intermediatePath | Set-Content $combinedPath -Encoding UTF8

Write-Host "Готово. Файлы:"
Write-Host "  - $rootPath"
Write-Host "  - $intermediatePath"
Write-Host "  - $combinedPath"
Write-Host ""
Write-Host "В .env укажите, например:"
Write-Host "  PG_CONNECTION=postgresql://user:pass@host:5432/db?sslrootcert=$(Resolve-Path $combinedPath)"
Write-Host "  (или sslrootcert=./certs/YandexCloudCA.pem если запускаете из папки nestjs-service)"
