# ============================================================================
# TOTVS Field Refresh 2026 - Publicacao no GitHub (sem git instalado)
# ----------------------------------------------------------------------------
# Publica o projeto direto no repositorio usando a API do GitHub, gerando UM
# UNICO COMMIT com todas as mudancas. Serve de alternativa ao upload manual.
#
# Como funciona:
#   1. Le owner/repo/branch/token do proprio app (app/js/github-sync.js).
#   2. Compara o SHA do blob local de cada arquivo com o do repositorio e
#      seleciona SOMENTE o que realmente mudou (ou ainda nao existe la).
#   3. Cria blobs -> nova arvore -> commit -> atualiza a branch.
#
# Os dados operacionais em data/ (dados-gerais.json, usuarios.json, gestao.json
# e data/analistas/*) NAO sao publicados por este script, para nunca sobrescrever
# a base viva com uma copia local antiga.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File tools\publish-to-github.ps1
#   powershell -ExecutionPolicy Bypass -File tools\publish-to-github.ps1 -DryRun
# ============================================================================

[CmdletBinding()]
param(
    [string]$Message = 'feat: auto-vinculo, checklist final, consulta de SPON, logos e remaster de UI (Sessao 8)',
    [string]$Token = '',
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root = Split-Path -Parent $PSScriptRoot

# ---------------------------------------------------------------- Arquivos ---
# Somente arquivos do sistema. data/ fica de fora de proposito.
$candidates = @(
    '.gitignore',
    'README.md',
    'TIMELAPSE_ATUALIZACAO.md',
    'GuiaDev.md',
    'start.bat',
    'ImplementarAuto.html',
    'status-report-rollout-totvs-local.html',
    'vercel.json',
    'app/index.html',
    'app/gestao.html',
    'app/css/styles.css',
    'app/js/storage.js',
    'app/js/filters.js',
    'app/js/reports.js',
    'app/js/rollout.js',
    'app/js/importer-exporter.js',
    'app/js/github-sync.js',
    'app/js/print-layout.js',
    'app/js/app.js',
    'app/js/gestao.js',
    'app/js/vendor/chart.umd.js',
    'tests/smoke.html',
    'tools/check-ids.ps1',
    'tools/serve.ps1',
    'tools/timelapse.ps1',
    'tools/validate.ps1',
    'tools/last-validation.txt',
    'tools/macro-operacao.bookmarklet.js',
    'tools/macro-operacao.build.mjs',
    'tools/macro-operacao.README.md',
    'tools/macro-operacao.test.mjs',
    'tools/macro-operacao.url.txt',
    'tools/seed-metricas.bookmarklet.js',
    'tools/seed-metricas.build.mjs',
    'tools/seed-metricas.README.md',
    'tools/seed-metricas.test.mjs',
    'tools/seed-metricas.url.txt',
    'data/README.md'
)

# Arquivos novos (podem nao existir no repositorio ainda).
$newFiles = @(
    'tools/prepare-logos.ps1',
    'tools/publish-to-github.ps1',
    'totvslogoazulpreto.png',
    'totvsfundobrancoletrapreta.logo.jpg',
    'app/assets/totvs-app-icon.png',
    'app/assets/totvs-logo-light.png',
    'app/assets/totvs-logo-print.png',
    'app/assets/totvs-logo.jpg',
    'app/assets/github-token.local.example.js'
)

# ------------------------------------------------------------- Credenciais ---
# owner/repo/branch vem do proprio app; o token NUNCA fica no repositorio, entao
# e resolvido por: -Token, variavel de ambiente ou o arquivo local (nao versionado).
$configPath = Join-Path $root 'app\js\github-sync.js'
$configText = Get-Content $configPath -Raw
$owner  = [regex]::Match($configText, "owner:\s*'([^']+)'").Groups[1].Value
$repo   = [regex]::Match($configText, "repo:\s*'([^']+)'").Groups[1].Value
$branch = [regex]::Match($configText, "branch:\s*'([^']+)'").Groups[1].Value

$resolvedToken = $Token
if (-not $resolvedToken) { $resolvedToken = $env:TOTVS_GITHUB_TOKEN }
if (-not $resolvedToken) {
    $localTokenFile = Join-Path $root 'app\assets\github-token.local.js'
    if (Test-Path -LiteralPath $localTokenFile) {
        $localTokenText = Get-Content $localTokenFile -Raw
        $resolvedToken = [regex]::Match($localTokenText, "TOTVS_GITHUB_TOKEN\s*=\s*'([^']+)'").Groups[1].Value
    }
}

if (-not $owner -or -not $repo -or -not $branch) {
    throw 'Nao foi possivel ler owner/repo/branch de app/js/github-sync.js.'
}
if (-not $resolvedToken) {
    throw 'Token ausente. Use -Token, a variavel TOTVS_GITHUB_TOKEN ou app/assets/github-token.local.js.'
}
$token = $resolvedToken

$headers = @{
    Authorization          = "Bearer $token"
    Accept                 = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2022-11-28'
    'User-Agent'           = 'totvs-refresh-publish'
}
$api = "https://api.github.com/repos/$owner/$repo"

function Send-Json {
    param([string]$Method, [string]$Uri, $Body)
    $json = $Body | ConvertTo-Json -Depth 8 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $bytes -TimeoutSec 120
}

function Get-GitBlobSha {
    param([byte[]]$Bytes)
    $header = [System.Text.Encoding]::ASCII.GetBytes("blob $($Bytes.Length)`0")
    $buffer = New-Object byte[] ($header.Length + $Bytes.Length)
    [Array]::Copy($header, 0, $buffer, 0, $header.Length)
    [Array]::Copy($Bytes, 0, $buffer, $header.Length, $Bytes.Length)
    $sha1 = [System.Security.Cryptography.SHA1]::Create()
    try {
        $hash = $sha1.ComputeHash($buffer)
    } finally {
        $sha1.Dispose()
    }
    return (($hash | ForEach-Object { $_.ToString('x2') }) -join '')
}

Write-Host ("Repositorio: {0}/{1} @ {2}" -f $owner, $repo, $branch)

# --------------------------------------------------------- Estado remoto ----
$ref = Invoke-RestMethod -Method Get -Uri "$api/git/ref/heads/$branch" -Headers $headers -TimeoutSec 60
$parentSha = $ref.object.sha
$parentCommit = Invoke-RestMethod -Method Get -Uri "$api/git/commits/$parentSha" -Headers $headers -TimeoutSec 60
$baseTreeSha = $parentCommit.tree.sha

$remoteTree = Invoke-RestMethod -Method Get -Uri "$api/git/trees/$baseTreeSha`?recursive=1" -Headers $headers -TimeoutSec 120
$remoteSha = @{}
foreach ($entry in $remoteTree.tree) {
    if ($entry.type -eq 'blob') { $remoteSha[$entry.path] = $entry.sha }
}
Write-Host ("Commit atual: {0}  ({1} arquivos no repositorio)" -f $parentSha.Substring(0, 8), $remoteSha.Count)

# ---------------------------------------------------- Diferencas locais -----
$changed = New-Object System.Collections.Generic.List[object]
$unchanged = 0
$missing = New-Object System.Collections.Generic.List[string]

foreach ($rel in ($candidates + $newFiles | Select-Object -Unique)) {
    $full = Join-Path $root ($rel -replace '/', '\')
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
        $missing.Add($rel)
        continue
    }

    $bytes = [System.IO.File]::ReadAllBytes($full)
    $localSha = Get-GitBlobSha -Bytes $bytes

    if ($remoteSha.ContainsKey($rel) -and $remoteSha[$rel] -eq $localSha) {
        $unchanged += 1
        continue
    }

    $action = if ($remoteSha.ContainsKey($rel)) { 'alterar' } else { 'criar  ' }
    $changed.Add([pscustomobject]@{ Path = $rel; Bytes = $bytes; Sha = $localSha; Action = $action })
}

Write-Host ''
Write-Host ("Alterados/novos: {0}   |   sem mudanca: {1}" -f $changed.Count, $unchanged)
foreach ($item in $changed) {
    Write-Host ("  [{0}] {1}" -f $item.Action, $item.Path)
}
if ($missing.Count) {
    Write-Host ''
    Write-Host ("Nao encontrados no disco (ignorados): {0}" -f ($missing -join ', ')) -ForegroundColor Yellow
}

if ($changed.Count -eq 0) {
    Write-Host ''
    Write-Host 'Nada para publicar: o repositorio ja esta igual ao projeto local.'
    return
}

if ($DryRun) {
    Write-Host ''
    Write-Host '[DryRun] Nenhum envio foi feito. Rode sem -DryRun para publicar.' -ForegroundColor Cyan
    return
}

# ------------------------------------------------------------- Publicacao ---
Write-Host ''
Write-Host 'Enviando blobs...'
foreach ($item in $changed) {
    $body = @{ content = [Convert]::ToBase64String($item.Bytes); encoding = 'base64' }
    $blob = Send-Json -Method 'Post' -Uri "$api/git/blobs" -Body $body
    $item | Add-Member -NotePropertyName BlobSha -NotePropertyValue $blob.sha -Force
    Write-Host ("  ok {0}" -f $item.Path)
}

$treeEntries = @()
foreach ($item in $changed) {
    $treeEntries += @{ path = $item.Path; mode = '100644'; type = 'blob'; sha = $item.BlobSha }
}

Write-Host 'Montando a nova arvore...'
$newTree = Send-Json -Method 'Post' -Uri "$api/git/trees" -Body @{ base_tree = $baseTreeSha; tree = $treeEntries }

Write-Host 'Criando o commit...'
$newCommit = Send-Json -Method 'Post' -Uri "$api/git/commits" -Body @{
    message = $Message
    tree    = $newTree.sha
    parents = @($parentSha)
}

Write-Host ("Atualizando {0}..." -f $branch)
$null = Send-Json -Method 'Patch' -Uri "$api/git/refs/heads/$branch" -Body @{ sha = $newCommit.sha; force = $false }

Write-Host ''
Write-Host '============================================================' -ForegroundColor Green
Write-Host (" PUBLICADO COM SUCESSO: {0}" -f $newCommit.sha.Substring(0, 8)) -ForegroundColor Green
Write-Host (" Arquivos no commit: {0}" -f $changed.Count) -ForegroundColor Green
Write-Host (" https://github.com/{0}/{1}/commit/{2}" -f $owner, $repo, $newCommit.sha) -ForegroundColor Green
Write-Host '============================================================' -ForegroundColor Green
