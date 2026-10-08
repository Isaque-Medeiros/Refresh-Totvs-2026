# ============================================================================
# TOTVS Field Refresh 2026 - Servidor estatico local para validacao
# ----------------------------------------------------------------------------
# Necessario porque o app usa fetch() para carregar data/*.json, e o navegador
# bloqueia fetch em paginas abertas por file://.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File tools\serve.ps1
#   depois abra http://localhost:8765/app/index.html
# ============================================================================

param(
    [int]$Port = 8765
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$rootFull = (Resolve-Path $root).Path

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
    $listener.Start()
} catch {
    Write-Host "[ERRO] Nao foi possivel abrir a porta $Port. Ela ja esta em uso?" -ForegroundColor Red
    throw
}

Write-Host ''
Write-Host "Servindo: $rootFull" -ForegroundColor Cyan
Write-Host "Endereco: http://localhost:$Port/app/index.html" -ForegroundColor Green
Write-Host 'Pressione Ctrl+C para encerrar.' -ForegroundColor DarkGray
Write-Host ''

$mime = @{
    '.html' = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.md'   = 'text/plain; charset=utf-8'
    '.txt'  = 'text/plain; charset=utf-8'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
}

while ($listener.IsListening) {
    $context  = $listener.GetContext()
    $request  = $context.Request
    $response = $context.Response

    try {
        $relative = [System.Uri]::UnescapeDataString($request.Url.LocalPath).TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'app/index.html' }

        $candidate = Join-Path $rootFull ($relative -replace '/', '\')
        $resolved  = [System.IO.Path]::GetFullPath($candidate)

        if (-not $resolved.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
            $response.StatusCode = 403
            $response.Close()
            continue
        }

        if (Test-Path $resolved -PathType Container) {
            $resolved = Join-Path $resolved 'index.html'
        }

        if (-not (Test-Path $resolved -PathType Leaf)) {
            $response.StatusCode = 404
            $body = [System.Text.Encoding]::UTF8.GetBytes('404 - Nao encontrado')
            $response.OutputStream.Write($body, 0, $body.Length)
            $response.Close()
            Write-Host ("404 {0}" -f $relative) -ForegroundColor DarkYellow
            continue
        }

        $extension = [System.IO.Path]::GetExtension($resolved).ToLower()
        $contentType = if ($mime.ContainsKey($extension)) { $mime[$extension] } else { 'application/octet-stream' }

        $bytes = [System.IO.File]::ReadAllBytes($resolved)
        $response.ContentType = $contentType
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
        $response.Close()

        Write-Host ("200 {0}" -f $relative) -ForegroundColor DarkGray
    } catch {
        Write-Host ("[ERRO] {0}" -f $_.Exception.Message) -ForegroundColor Red
        try {
            $response.StatusCode = 500
            $response.Close()
        } catch { }
    }
}
