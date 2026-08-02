$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$aiDir = Join-Path $root "services\ai"
$venvPython = Join-Path $aiDir ".venv\Scripts\python.exe"
$uvicorn = Join-Path $aiDir ".venv\Scripts\uvicorn.exe"
$port = if ($args.Count -gt 0) { $args[0] } else { "8001" }
$envFile = Join-Path $root ".env"
if (-not (Test-Path -LiteralPath $envFile)) {
  Write-Error "未找到 $envFile，请先创建 .env"
  exit 1
}
Write-Host "启动 BOKS AI 服务 (端口 $port)"
Write-Host "配置文件: $envFile"
& $uvicorn "boks_ai.main:app" --app-dir (Join-Path $aiDir "src") --host 127.0.0.1 --port $port --env-file $envFile
