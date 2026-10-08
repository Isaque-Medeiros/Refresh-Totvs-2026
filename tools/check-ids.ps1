# ============================================================================
# TOTVS Field Refresh 2026 - Verificacao de IDs
# ----------------------------------------------------------------------------
# Verificacao POR PAGINA: para cada HTML em app/, descobre quais scripts ele
# carrega e confere se todo ID usado naqueles scripts existe naquela pagina.
#
# Isso pega tanto clique orfao (ID que nao existe) quanto script carregado na
# pagina errada (script que usa IDs de outra tela).
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File tools\check-ids.ps1
# ============================================================================

$ErrorActionPreference = 'Stop'

$root   = Split-Path -Parent $PSScriptRoot
$appDir = Join-Path $root 'app'

if (-not (Test-Path $appDir)) { throw "Pasta nao encontrada: $appDir" }

$idPatterns = @(
    "getElementById\(\s*['""]([^'""]+)['""]\s*\)",
    "\bel\(\s*['""]([^'""]+)['""]\s*\)",
    "\bensureCanvas\(\s*['""]([^'""]+)['""]\s*\)"
)

$pages = Get-ChildItem $appDir -Filter *.html | Sort-Object Name
$missing = New-Object System.Collections.Generic.List[object]
$totalRefs = 0
$allPageIds = @{}

foreach ($page in $pages) {
    $html = Get-Content $page.FullName -Raw

    $pageIds = [regex]::Matches($html, 'id="([^"]+)"') |
        ForEach-Object { $_.Groups[1].Value } |
        Sort-Object -Unique

    $idSet = @{}
    foreach ($id in $pageIds) {
        $idSet[$id] = $true
        $allPageIds[$id] = $true
    }

    $scriptSources = [regex]::Matches($html, '<script[^>]*src="([^"]+)"') |
        ForEach-Object { $_.Groups[1].Value }

    Write-Host ''
    Write-Host ("Pagina: {0}  ({1} IDs, {2} script(s))" -f $page.Name, $pageIds.Count, $scriptSources.Count) -ForegroundColor Cyan

    foreach ($source in $scriptSources) {
        $scriptFile = Join-Path $appDir ($source -replace '/', '\')

        if (-not (Test-Path $scriptFile -PathType Leaf)) {
            $missing.Add([pscustomobject]@{ Page = $page.Name; File = $source; Line = 0; Id = '(arquivo de script nao encontrado)' })
            continue
        }

        $content = Get-Content $scriptFile -Raw

        foreach ($pattern in $idPatterns) {
            foreach ($match in [regex]::Matches($content, $pattern)) {
                $totalRefs += 1
                $id = $match.Groups[1].Value

                if (-not $idSet.ContainsKey($id)) {
                    $line = ($content.Substring(0, $match.IndexOf) -split "`n").Count
                    $missing.Add([pscustomobject]@{ Page = $page.Name; File = $source; Line = $line; Id = $id })
                }
            }
        }

        Write-Host ("   - {0}" -f $source) -ForegroundColor DarkGray
    }
}

Write-Host ''
Write-Host '=== TOTVS Field Refresh 2026 :: Verificacao de IDs ===' -ForegroundColor Cyan
Write-Host ("Paginas ..........: {0}" -f $pages.Count)
Write-Host ("IDs distintos ....: {0}" -f $allPageIds.Keys.Count)
Write-Host ("Referencias no JS : {0}" -f $totalRefs)
Write-Host ''

if ($missing.Count -gt 0) {
    Write-Host ("FALHA: {0} referencia(s) apontam para IDs inexistentes na propria pagina:" -f $missing.Count) -ForegroundColor Red
    $missing | Sort-Object Page, Id -Unique | ForEach-Object {
        Write-Host ("  - [{0} -> {1}:{2}] {3}" -f $_.Page, $_.File, $_.Line, $_.Id) -ForegroundColor Red
    }
} else {
    Write-Host 'OK: toda referencia de JS aponta para um ID existente na pagina que carrega o script.' -ForegroundColor Green
}

$orphans = $allPageIds.Keys | Where-Object { $_ -notmatch '^$' } | Sort-Object
$unused = New-Object System.Collections.Generic.List[string]

foreach ($page in $pages) {
    $html = Get-Content $page.FullName -Raw
    $pageIds = [regex]::Matches($html, 'id="([^"]+)"') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
    $referenced = New-Object System.Collections.Generic.HashSet[string]

    foreach ($source in ([regex]::Matches($html, '<script[^>]*src="([^"]+)"') | ForEach-Object { $_.Groups[1].Value })) {
        $scriptFile = Join-Path $appDir ($source -replace '/', '\')
        if (-not (Test-Path $scriptFile -PathType Leaf)) { continue }
        $content = Get-Content $scriptFile -Raw
        foreach ($pattern in $idPatterns) {
            foreach ($match in [regex]::Matches($content, $pattern)) {
                [void]$referenced.Add($match.Groups[1].Value)
            }
        }
    }

    $pageUnused = $pageIds | Where-Object { -not $referenced.Contains($_) }
    if ($pageUnused) {
        $unused.AddRange([string[]]$pageUnused)
    }
}

Write-Host ''
if ($unused.Count -gt 0) {
    Write-Host ("Aviso: {0} ID(s) sem uso direto no JS (data-tab, label for, etc):" -f $unused.Count) -ForegroundColor Yellow
    $unused | Sort-Object -Unique | ForEach-Object { Write-Host ("  - {0}" -f $_) -ForegroundColor DarkYellow }
} else {
    Write-Host 'OK: nenhum ID orfao no HTML.' -ForegroundColor Green
}

Write-Host ''
if ($missing.Count -gt 0) { exit 1 }
exit 0
