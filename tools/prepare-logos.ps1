# ============================================================================
# TOTVS Field Refresh 2026 - Preparacao das logos
# ----------------------------------------------------------------------------
# A partir da logo completa (fundo branco, arquivo totvsfundobrancoletrapreta.logo.jpg)
# gera duas versoes otimizadas em app/assets/:
#
#   totvs-logo-print.png -> recorte justo do logo (sem as sobras brancas),
#                           usada nos relatorios impressos (fundo branco).
#   totvs-logo-light.png -> logo branca com fundo transparente, para uso em
#                           interfaces de tema escuro (login / cabecalhos).
#
# O icone do app (app/assets/totvs-app-icon.png) ja vem pronto do arquivo
# totvslogoazulpreto.png e nao precisa de tratamento.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File tools\prepare-logos.ps1
# ============================================================================

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root   = Split-Path -Parent $PSScriptRoot
$assets = Join-Path $root 'app\assets'
if (-not (Test-Path $assets)) { New-Item -ItemType Directory -Force -Path $assets | Out-Null }

$sourcePath = Join-Path $root 'totvsfundobrancoletrapreta.logo.jpg'
if (-not (Test-Path $sourcePath)) { $sourcePath = Join-Path $assets 'totvs-logo.jpg' }
if (-not (Test-Path $sourcePath)) { throw "Logo de origem nao encontrada: $sourcePath" }

$source = [System.Drawing.Bitmap]::FromFile($sourcePath)

# --- 1) Descobre o recorte justo do logo (em miniatura, para ser rapido) -----
$scale = 8
$sw = [math]::Max(1, [int]($source.Width / $scale))
$sh = [math]::Max(1, [int]($source.Height / $scale))

$small = New-Object System.Drawing.Bitmap $sw, $sh
$g = [System.Drawing.Graphics]::FromImage($small)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($source, 0, 0, $sw, $sh)
$g.Dispose()

$minX = $sw; $minY = $sh; $maxX = -1; $maxY = -1
for ($y = 0; $y -lt $sh; $y += 1) {
    for ($x = 0; $x -lt $sw; $x += 1) {
        $c = $small.GetPixel($x, $y)
        if (($c.R + $c.G + $c.B) -lt 720) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}
$small.Dispose()

if ($maxX -lt 0) { $minX = 0; $minY = 0; $maxX = $sw - 1; $maxY = $sh - 1 }

$pad = 2
$minX = [math]::Max(0, ($minX - $pad)) * $scale
$minY = [math]::Max(0, ($minY - $pad)) * $scale
$maxX = [math]::Min($source.Width - 1, ($maxX + 1 + $pad) * $scale)
$maxY = [math]::Min($source.Height - 1, ($maxY + 1 + $pad) * $scale)
$cw = [int]($maxX - $minX)
$ch = [int]($maxY - $minY)
if ($cw -le 0 -or $ch -le 0) { throw 'Nao foi possivel determinar o recorte do logo.' }

$rectSource = New-Object System.Drawing.Rectangle $minX, $minY, $cw, $ch

$cropped = New-Object System.Drawing.Bitmap $cw, $ch
$gc = [System.Drawing.Graphics]::FromImage($cropped)
$gc.DrawImage($source, (New-Object System.Drawing.Rectangle 0, 0, $cw, $ch), $rectSource, [System.Drawing.GraphicsUnit]::Pixel)
$gc.Dispose()

# --- 2) Versao para impressao (fundo branco, recorte justo) -----------------
$printPath = Join-Path $assets 'totvs-logo-print.png'
$cropped.Save($printPath, [System.Drawing.Imaging.ImageFormat]::Png)

# --- 3) Versao clara (branca) com fundo transparente, para tema escuro ------
$lw = [math]::Min($cw, 1200)
$lh = [int]([math]::Round($ch * ($lw / $cw)))

$base = New-Object System.Drawing.Bitmap $lw, $lh
$gb = [System.Drawing.Graphics]::FromImage($base)
$gb.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gb.DrawImage($cropped, 0, 0, $lw, $lh)
$gb.Dispose()

$light = New-Object System.Drawing.Bitmap $lw, $lh, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt $lh; $y += 1) {
    for ($x = 0; $x -lt $lw; $x += 1) {
        $c = $base.GetPixel($x, $y)
        $lum = [int]((0.299 * $c.R) + (0.587 * $c.G) + (0.114 * $c.B))
        $alpha = 255 - $lum
        if ($alpha -lt 0) { $alpha = 0 }
        if ($alpha -gt 255) { $alpha = 255 }
        $light.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, 255, 255, 255))
    }
}
$lightPath = Join-Path $assets 'totvs-logo-light.png'
$light.Save($lightPath, [System.Drawing.Imaging.ImageFormat]::Png)

$base.Dispose()
$light.Dispose()
$cropped.Dispose()
$source.Dispose()

Write-Host ("Recorte do logo .......: {0} x {1}" -f $cw, $ch)
Write-Host ("Gerado ................: {0}" -f $printPath)
Write-Host ("Gerado ................: {0} ({1} x {2})" -f $lightPath, $lw, $lh)
Write-Host 'Concluido.'
