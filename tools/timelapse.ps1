# ============================================================================
# TOTVS Field Refresh 2026 - Gravacao de tela / Timelapse
# ----------------------------------------------------------------------------
# Captura a tela em intervalos regulares e salva as imagens como uma sequencia
# de frames (timelapse) do processo de atualizacao do sistema.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File tools\timelapse.ps1
#   powershell -ExecutionPolicy Bypass -File tools\timelapse.ps1 -IntervalSeconds 15 -Frames 60
#   powershell -ExecutionPolicy Bypass -File tools\timelapse.ps1 -Scale 50
#
# Ao final gera docs\timelapse\index.html com todos os frames em sequencia.
# ============================================================================

param(
    [int]$IntervalSeconds = 30,
    [int]$Frames = 40,
    [int]$Scale = 100,
    [string]$OutputDir = 'docs\timelapse'
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$target = Join-Path $root $OutputDir

if (-not (Test-Path $target)) {
    New-Item -ItemType Directory -Path $target -Force | Out-Null
}

# Limpa frames antigos para nao misturar gravacoes.
Get-ChildItem $target -Filter 'frame-*.png' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$factor = [Math]::Max(10, [Math]::Min(100, $Scale)) / 100
$width  = [int]($bounds.Width * $factor)
$height = [int]($bounds.Height * $factor)

Write-Host ''
Write-Host '================================================================' -ForegroundColor Cyan
Write-Host ' TOTVS FIELD REFRESH 2026 - GRAVACAO DE TELA (TIMELAPSE)' -ForegroundColor Cyan
Write-Host '================================================================' -ForegroundColor Cyan
Write-Host (" Tela .........: {0} x {1}" -f $bounds.Width, $bounds.Height)
Write-Host (" Escala .......: {0}%  ->  {1} x {2}" -f $Scale, $width, $height)
Write-Host (" Intervalo ....: {0} s" -f $IntervalSeconds)
Write-Host (" Frames .......: {0}" -f $Frames)
Write-Host (" Duracao aprox.: {0} minuto(s)" -f ([Math]::Round(($IntervalSeconds * $Frames) / 60, 1)))
Write-Host (" Destino ......: {0}" -f $target)
Write-Host ''
Write-Host ' Pressione Ctrl+C para encerrar antes do fim.' -ForegroundColor DarkGray
Write-Host ''

for ($index = 1; $index -le $Frames; $index += 1) {
    try {
        $bitmap = New-Object System.Drawing.Bitmap $width, $height
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, (New-Object System.Drawing.Size $width, $height))

        $stamp = Get-Date -Format 'dd/MM/yyyy HH:mm:ss'
        $font = New-Object System.Drawing.Font('Consolas', 14, [System.Drawing.FontStyle]::Bold)
        $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 255, 255, 255))
        $graphics.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150, 7, 19, 33))), 0, 0, $width, 34)
        $graphics.DrawString("TOTVS Refresh 2026  |  frame {0:D3}/{1:D3}  |  {2}" -f $index, $Frames, $stamp, $font, $brush, 10, 6)

        $file = Join-Path $target ("frame-{0:D4}.png" -f $index)
        $bitmap.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)

        $graphics.Dispose()
        $bitmap.Dispose()
        $font.Dispose()
        $brush.Dispose()

        Write-Host (" [{0}] frame {1:D4} salvo  {2}" -f (Get-Date -Format 'HH:mm:ss'), $index, $file)
    } catch {
        Write-Host (" [ERRO] falha ao capturar o frame {0}: {1}" -f $index, $_.Exception.Message) -ForegroundColor Red
    }

    if ($index -lt $Frames) {
        Start-Sleep -Seconds $IntervalSeconds
    }
}

Write-Host ''
Write-Host ' Gerando visualizador HTML dos frames...' -ForegroundColor Cyan

$frames = Get-ChildItem $target -Filter 'frame-*.png' | Sort-Object Name

if (-not $frames -or $frames.Count -eq 0) {
    Write-Host ' [AVISO] Nenhum frame foi capturado.' -ForegroundColor Yellow
    exit 1
}

$frameList = ($frames | ForEach-Object { "            '" + $_.Name + "'" }) -join ",`r`n"

$template = @'
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Timelapse | TOTVS Field Refresh 2026</title>
    <style>
        body { margin: 0; background: #071321; color: #e8f1ff; font-family: 'Segoe UI', Arial, sans-serif; }
        header { padding: 18px 24px; border-bottom: 1px solid #24405f; display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
        h1 { font-size: 1.1rem; margin: 0; }
        button { background: #1f7cff; color: #fff; border: 0; border-radius: 8px; padding: 9px 16px; font-weight: 600; cursor: pointer; }
        button.alt { background: #12304d; }
        .meta { color: #8fa8c4; font-size: 0.85rem; }
        main { padding: 18px 24px 40px; }
        img { width: 100%; border-radius: 12px; border: 1px solid #24405f; display: block; }
        input[type=range] { width: 240px; }
    </style>
</head>
<body>
    <header>
        <h1>TOTVS Field Refresh 2026 &mdash; Timelapse da atualizacao</h1>
        <button id="play">Reproduzir</button>
        <button id="prev" class="alt">Anterior</button>
        <button id="next" class="alt">Proximo</button>
        <label class="meta">Velocidade <input type="range" id="speed" min="120" max="2000" step="40" value="600"></label>
        <span class="meta" id="counter">-</span>
    </header>
    <main><img id="frame" alt="frame do timelapse"></main>
    <script>
        const frames = [
/*FRAMES*/
        ];
        const img = document.getElementById('frame');
        const counter = document.getElementById('counter');
        let index = 0;
        let timer = null;

        function show(next) {
            index = (next + frames.length) % frames.length;
            img.src = frames[index];
            counter.textContent = `${index + 1} / ${frames.length}`;
        }

        function stop() {
            if (timer) { clearInterval(timer); timer = null; }
            document.getElementById('play').textContent = 'Reproduzir';
        }

        document.getElementById('next').addEventListener('click', () => { stop(); show(index + 1); });
        document.getElementById('prev').addEventListener('click', () => { stop(); show(index - 1); });
        document.getElementById('play').addEventListener('click', () => {
            if (timer) { stop(); return; }
            const speed = Number(document.getElementById('speed').value);
            document.getElementById('play').textContent = 'Pausar';
            timer = setInterval(() => show(index + 1), speed);
        });

        show(0);
    </script>
</body>
</html>
'@

$html = $template.Replace('/*FRAMES*/', $frameList)
$indexPath = Join-Path $target 'index.html'
$html | Out-File -FilePath $indexPath -Encoding utf8

Write-Host ''
Write-Host '================================================================' -ForegroundColor Green
Write-Host (" TIMELAPSE CONCLUIDO: {0} frames" -f $frames.Count) -ForegroundColor Green
Write-Host (" Visualizador: {0}" -f $indexPath) -ForegroundColor Green
Write-Host '================================================================' -ForegroundColor Green
