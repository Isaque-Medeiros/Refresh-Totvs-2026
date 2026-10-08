# ============================================================================
# TOTVS Field Refresh 2026 - Verificacao de IDs
# ----------------------------------------------------------------------------
# Compara todos os IDs usados no JavaScript (getElementById e o helper el())
# com os IDs realmente existentes em app/index.html.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File tools\check-ids.ps1
# ============================================================================

$ErrorActionPreference = 'Stop'

$root     = Split-Path -Parent $PSScriptRoot
$htmlPath = Join-Path $root 'app\index.html'
$jsDir    = Join-Path $root 'app\js'

if (-not (Test-Path $htmlPath)) { throw "Arquivo nao encontrado: $htmlPath" }
if (-not (Test-Path $jsDir))    { throw "Pasta nao encontrada: $jsDir" }

$html    = Get-Content $htmlPath -Raw
$htmlIds = [regex]::Matches($html, 'id="([^"]+)"') |
    ForEach-Object { $_.Groups[1].Value } |
    Sort-Object -Unique

$idsSet = @{}
foreach ($id in $htmlIds) { $idsSet[$id] = $true }

$refs = New-Object System.Collections.Generic.List[object]

foreach ($file in (Get-ChildItem $jsDir -Filter *.js)) {
    $content = Get-Content $file.FullName -Raw

    foreach ($pattern in @(
        "getElementById\(\s*['""]([^'""]+)['""]\s*\)",
        "\bel\(\s*['""]([^'""]+)['""]\s*\)"
    )) {
        foreach ($match in [regex]::Matches($content, $pattern)) {
            $refs.Add([pscustomobject]@{
                File = $file.Name
                Line = ($content.Substring(0, $match.Index) -split "`n").Count
                Id   = $match.Groups[1].Value
            })
        }
    }
}

$missing = $refs | Where-Object { -not $idsSet.ContainsKey($_.Id) }
$usedIds = ($refs | Select-Object -ExpandProperty Id -Unique)
$orphans = $htmlIds | Where-Object { $usedIds -notcontains $_ }

Write-Host ''
Write-Host '=== TOTVS Field Refresh 2026 :: Verificacao de IDs ===' -ForegroundColor Cyan
Write-Host ("IDs no HTML .......: {0}" -f $htmlIds.Count)
Write-Host ("Referencias no JS .: {0}" -f $refs.Count)
Write-Host ''

if ($missing.Count -gt 0) {
    Write-Host ("FALHA: {0} referencia(s) apontam para IDs inexistentes:" -f $missing.Count) -ForegroundColor Red
    $missing | Sort-Object Id -Unique | ForEach-Object {
        Write-Host ("  - [{0}:{1}] {2}" -f $_.File, $_.Line, $_.Id) -ForegroundColor Red
    }
} else {
    Write-Host 'OK: toda referencia de JS aponta para um ID existente no HTML.' -ForegroundColor Green
}

Write-Host ''
if ($orphans.Count -gt 0) {
    Write-Host ("Aviso: {0} ID(s) no HTML sem uso direto no JS (pode ser data-tab, label for, etc):" -f $orphans.Count) -ForegroundColor Yellow
    $orphans | ForEach-Object { Write-Host ("  - {0}" -f $_) -ForegroundColor DarkYellow }
} else {
    Write-Host 'OK: nenhum ID orfao no HTML.' -ForegroundColor Green
}

Write-Host ''
if ($missing.Count -gt 0) { exit 1 }
exit 0
