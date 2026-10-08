# ============================================================================
# TOTVS Field Refresh 2026 - Validacao automatica
# ----------------------------------------------------------------------------
# Executa, em sequencia:
#   1. Verificacao de IDs (JS x HTML)
#   2. Smoke test de logica no navegador (tests/smoke.html)
#   3. Teste de carregamento da aplicacao real (app/index.html)
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File tools\validate.ps1
#   Relatorio gerado em: tools\last-validation.txt
# ============================================================================

$ErrorActionPreference = 'Continue'

$root      = Split-Path -Parent $PSScriptRoot
$reportPath = Join-Path $PSScriptRoot 'last-validation.txt'
$port      = 8765
$serverJob = $null

$log = New-Object System.Collections.Generic.List[string]
function Say($message) {
    Write-Host $message
    $log.Add($message)
    # Grava a cada linha: se a execucao for interrompida, o relatorio continua util.
    try { $log | Out-File -FilePath $reportPath -Encoding utf8 } catch { }
}

Say '============================================================'
Say ' TOTVS FIELD REFRESH 2026 - VALIDACAO'
Say (" Data: {0}" -f (Get-Date -Format 'dd/MM/yyyy HH:mm:ss'))
Say '============================================================'
Say ''

# ---------------------------------------------------------------- 1. IDs
Say '[1/3] Verificacao de IDs (JavaScript x HTML)'
Say '------------------------------------------------------------'
$idOutput = & powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'check-ids.ps1') 2>&1
$idText = ($idOutput | Out-String)
Say $idText.TrimEnd()
$idsOk = ($idText -notmatch 'FALHA') -and ($idText -notmatch 'Exce')
Say ("Resultado: {0}" -f ($(if ($idsOk) { 'OK' } else { 'FALHA' })))
Say ''

# ------------------------------------------------------------- 2. Navegador
$browsers = @(
    'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    'C:\Program Files\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
) | Where-Object { Test-Path $_ }

if (-not $browsers) {
    Say '[ERRO] Nenhum navegador compativel encontrado (Edge ou Chrome).'
    Say 'Validacao de navegador ignorada.'
    $log | Out-File -FilePath $reportPath -Encoding utf8
    exit 1
}

$browser = $browsers[0]
Say ("Navegador: {0}" -f $browser)
Say ''

# ----------------------------------------------------------------- 2.1 Servidor
Say '[2/3] Smoke test de logica (tests/smoke.html)'
Say '------------------------------------------------------------'

$serverScript = Join-Path $PSScriptRoot 'serve.ps1'
$serverJob = Start-Job -ScriptBlock {
    param($script, $port)
    & powershell -ExecutionPolicy Bypass -File $script -Port $port
} -ArgumentList $serverScript, $port

$serverUp = $false
for ($attempt = 1; $attempt -le 20; $attempt += 1) {
    Start-Sleep -Milliseconds 500
    try {
        $probe = Invoke-WebRequest -Uri "http://localhost:$port/tests/smoke.html" -UseBasicParsing -TimeoutSec 3
        if ($probe.StatusCode -eq 200) { $serverUp = $true; break }
    } catch { }
}

if (-not $serverUp) {
    Say "[ERRO] O servidor local nao respondeu na porta $port."
    Stop-Job $serverJob -ErrorAction SilentlyContinue
    Remove-Job $serverJob -Force -ErrorAction SilentlyContinue
    $log | Out-File -FilePath $reportPath -Encoding utf8
    exit 1
}

Say "[OK] Servidor local ativo em http://localhost:$port/"
Say ''

function Test-Page {
    param(
        [string]$Url,
        [int]$Budget = 20000
    )
    $profileDir = Join-Path $env:TEMP ("totvs-headless-" + [System.Guid]::NewGuid().ToString('N').Substring(0, 8))
    $arguments = @(
        '--headless',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-extensions',
        "--user-data-dir=$profileDir",
        "--virtual-time-budget=$Budget",
        '--dump-dom',
        $Url
    )
    $output = & $browser @arguments 2>$null | Out-String
    Remove-Item $profileDir -Recurse -Force -ErrorAction SilentlyContinue
    return $output
}

$smokeDom = Test-Page -Url "http://localhost:$port/tests/smoke.html"

# Importante: lemos o RESULTADO RENDERIZADO (div #summary), e nao o texto solto
# do DOM, porque o codigo-fonte do proprio script contem as strings de status.
$summaryText = ''
$summaryMatch = [regex]::Match($smokeDom, '<div id="summary"[^>]*>([^<]*)</div>')
if ($summaryMatch.Success) {
    $summaryText = $summaryMatch.Groups[1].Value.Trim()
    Say ("Resumo do smoke test: {0}" -f $summaryText)
} else {
    Say 'Resumo do smoke test: NAO FOI POSSIVEL LER O RESULTADO (a pagina nao executou o script).'
}

$smokePass = $summaryText -like 'TODOS OS TESTES PASSARAM*'
$smokeFail = $summaryText -like 'FALHOU*'

$failedItems = [regex]::Matches($smokeDom, '<li class="no">(.*?)</li>', 'Singleline')
if ($failedItems.Count -gt 0) {
    Say ''
    Say 'Testes com falha:'
    foreach ($item in $failedItems) {
        $text = ($item.Groups[1].Value -replace '<[^>]+>', ' ' -replace '\s+', ' ').Trim()
        Say ("  - {0}" -f $text)
    }
}

Say '[3/3] Carregamento da aplicacao real (app/index.html)'
Say '------------------------------------------------------------'

$appDom = Test-Page -Url "http://localhost:$port/app/index.html" -Budget 25000

$checks = @(
    @{ Name = 'Pagina renderizou o titulo TOTVS';         Pattern = 'TOTVS Field Refresh 2026' },
    @{ Name = 'login.js executou (select de usuarios cheio)'; Pattern = '<option value="gerente">' },
    @{ Name = 'Analistas carregados na lista de login';   Pattern = '<option value="isaque">' },
    @{ Name = 'View de login visivel por padrao';         Pattern = 'id="loginView"' },
    @{ Name = 'View do app comeca oculta';                Pattern = 'id="appView" class="app-shell hidden"' },
    @{ Name = 'UI de sincronizacao GitHub presente';      Pattern = 'id="ghOwner"' },
    @{ Name = 'Campo de token presente';                  Pattern = 'id="ghToken"' },
    @{ Name = 'Botao de leitura publica presente';        Pattern = 'id="btnGhPublished"' },
    @{ Name = 'Download por analista presente';           Pattern = 'id="selectExportAnalyst"' },
    @{ Name = 'Botao de restaurar snapshot marcado gerente-only'; Pattern = 'file-trigger manager-only' },
    @{ Name = 'Script github-sync.js carregado';          Pattern = 'js/github-sync.js' },
    @{ Name = 'Area de impressao presente';               Pattern = 'id="printArea"' },
    @{ Name = 'Lancamento manual presente';               Pattern = 'id="checkManualEntry"' },
    @{ Name = 'Campos de tempo manual presentes';         Pattern = 'id="manualTimesContainer"' },
    @{ Name = 'Total manual calculado ao vivo';           Pattern = 'id="manualTotalLabel"' },
    @{ Name = 'Graficos gerais renderizados';             Pattern = 'id="generalChartsContainer"' },
    @{ Name = 'Graficos por analista renderizados';       Pattern = 'id="analystChartsContainer"' },
    @{ Name = 'Botao de imprimir grafico geral';          Pattern = 'id="btnPrintGeneralCharts"' },
    @{ Name = 'Botao de imprimir grafico do analista';    Pattern = 'id="btnPrintAnalystCharts"' },
    @{ Name = 'Aba Visao geral restrita ao gerente';      Pattern = 'tab-content active manager-only' },
    @{ Name = 'Snapshot restrito ao gerente';             Pattern = 'btn-outline manager-only" id="btnDownloadSnapshot"' },
    @{ Name = 'Barra de troca em lote presente';          Pattern = 'id="bulkSwapBar"' },
    @{ Name = 'Botao marcar como trocadas';               Pattern = 'id="btnMarkSwapped"' },
    @{ Name = 'Botao do painel de gestao (gerente)';      Pattern = 'manager-only" id="btnOpenManagement"' },
    @{ Name = 'Modulo de rollout carregado';              Pattern = 'js/rollout.js' },
    @{ Name = 'Filtro de trocada presente';               Pattern = 'value="TROCADA"' }
)

$appFailures = 0
foreach ($check in $checks) {
    $found = $appDom -match [regex]::Escape($check.Pattern)
    if (-not $found) { $appFailures += 1 }
    Say ("  [{0}] {1}" -f ($(if ($found) { 'OK  ' } else { 'FALHA' })), $check.Name)
}

Say ''
Say ("Resultado carregamento: {0}" -f ($(if ($appFailures -eq 0) { 'OK' } else { "FALHA ($appFailures verificacao(oes))" })))
Say ''

# --------------------------------------------------- 3.2 Painel de gestao
Say '[3.2] Painel de gestao do gerente (app/gestao.html)'
Say '------------------------------------------------------------'

$mgmtDom = Test-Page -Url "http://localhost:$port/app/gestao.html" -Budget 25000

$mgmtChecks = @(
    @{ Name = 'Tela de gestao renderizou';          Pattern = 'id="managementView" class="app-shell hidden"' },
    @{ Name = 'Bloqueio de acesso existe';          Pattern = 'id="deniedView"' },
    @{ Name = 'Indicador ao vivo';                  Pattern = 'id="liveLabel"' },
    @{ Name = 'Botao de pausar o ao vivo';          Pattern = 'id="btnToggleLive"' },
    @{ Name = 'Relogio local';                      Pattern = 'id="managementClock"' },
    @{ Name = 'KPIs do gestor presentes';           Pattern = 'id="managementKpis"' },
    @{ Name = 'Burndown plano x realizado';         Pattern = 'id="burndownChart"' },
    @{ Name = 'Grafico por analista';               Pattern = 'id="analystChart"' },
    @{ Name = 'Grafico dos ultimos 10 dias';        Pattern = 'id="dailyChart"' },
    @{ Name = 'Lancamento do dia (ajuste)';         Pattern = 'id="adjustRows"' },
    @{ Name = 'Observacao da daily';                Pattern = 'id="fObs"' },
    @{ Name = 'Copiar resumo para a daily';         Pattern = 'id="bCopyDaily"' },
    @{ Name = 'Frentes superado';                   Pattern = 'id="okList"' },
    @{ Name = 'Frentes pendente';                   Pattern = 'id="pdList"' },
    @{ Name = 'Historico diario';                   Pattern = 'id="historyTableBody"' },
    @{ Name = 'Operacao: em andamento';             Pattern = 'id="inProgressBody"' },
    @{ Name = 'Operacao: aguardando troca';         Pattern = 'id="waitingSwapBody"' },
    @{ Name = 'Operacao: incidentes';               Pattern = 'id="incidentsBody"' },
    @{ Name = 'Operacao: tempo por etapa';          Pattern = 'id="stepTimesBody"' },
    @{ Name = 'Operacao: atingimento por analista'; Pattern = 'id="analystOpsBody"' },
    @{ Name = 'Botao de imprimir painel';           Pattern = 'id="btnPrintDashboard"' },
    @{ Name = 'Botao de exportar backup';           Pattern = 'id="btnExportBackup"' },
    @{ Name = 'Importar apontamentos';              Pattern = 'id="fileImport"' },
    @{ Name = 'Chart.js vendorizado carregado';     Pattern = 'js/vendor/chart.umd.js' },
    @{ Name = 'Modulo de rollout carregado';        Pattern = 'js/rollout.js' },
    @{ Name = 'Script de gestao carregado';         Pattern = 'js/gestao.js' }
)

$mgmtFailures = 0
foreach ($check in $mgmtChecks) {
    $found = $mgmtDom -match [regex]::Escape($check.Pattern)
    if (-not $found) { $mgmtFailures += 1 }
    Say ("  [{0}] {1}" -f ($(if ($found) { 'OK  ' } else { 'FALHA' })), $check.Name)
}

Say ''
Say ("Resultado painel de gestao: {0}" -f ($(if ($mgmtFailures -eq 0) { 'OK' } else { "FALHA ($mgmtFailures verificacao(oes))" })))
Say ''

# ----------------------------------------------------------------- Encerramento
if ($serverJob) {
    Stop-Job $serverJob -ErrorAction SilentlyContinue
    Remove-Job $serverJob -Force -ErrorAction SilentlyContinue
}

$resultOk = $idsOk -and $smokePass -and (-not $smokeFail) -and ($appFailures -eq 0) -and ($mgmtFailures -eq 0)

Say '============================================================'
Say (" RESULTADO FINAL: {0}" -f ($(if ($resultOk) { 'TUDO OK' } else { 'EXISTEM FALHAS' })))
Say '============================================================'

$log | Out-File -FilePath $reportPath -Encoding utf8
Write-Host ''
Write-Host ("Relatorio salvo em: {0}" -f $reportPath)

if ($resultOk) { exit 0 }
exit 1

