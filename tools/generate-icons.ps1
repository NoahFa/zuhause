Add-Type -AssemblyName System.Drawing

function New-ZuhauseIcon([int]$size, [string]$path, [bool]$maskable) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $scale = $size / 512.0

  function Brush([string]$hex) { [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($hex)) }
  function Points([double[][]]$values) {
    [System.Drawing.PointF[]]($values | ForEach-Object { [System.Drawing.PointF]::new([float]($_[0] * $scale), [float]($_[1] * $scale)) })
  }

  $background = Brush $(if ($maskable) { '#839681' } else { '#eef0e7' })
  $graphics.FillRectangle($background, 0, 0, $size, $size)
  if (-not $maskable) {
    $sage = Brush '#839681'
    $graphics.FillEllipse($sage, 66 * $scale, 67 * $scale, 380 * $scale, 380 * $scale)
    $sage.Dispose()
  }

  $cream = Brush '#fff7e9'
  $roof = Brush '#536b57'
  $door = Brush '#f2dfcb'
  $blue = Brush '#6f8da2'
  $coral = Brush '#bd7868'
  $white = Brush '#ffffff'
  $goldPen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#b78b47'), [float](13 * $scale))
  $goldPen.StartCap = $goldPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  $graphics.FillPolygon($cream, (Points @(@(105,247),@(256,111),@(407,247),@(407,406),@(105,406))))
  $graphics.FillPolygon($roof, (Points @(@(77,258),@(238,113),@(256,105),@(274,113),@(435,258),@(392,306),@(256,184),@(120,306))))
  $graphics.FillRectangle($roof, 340 * $scale, 157 * $scale, 45 * $scale, 94 * $scale)
  $graphics.FillRectangle($door, 162 * $scale, 282 * $scale, 188 * $scale, 126 * $scale)
  $graphics.FillEllipse($blue, 153 * $scale, 253 * $scale, 108 * $scale, 108 * $scale)
  $graphics.FillEllipse($coral, 251 * $scale, 253 * $scale, 108 * $scale, 108 * $scale)

  $font = [System.Drawing.Font]::new('Arial', [float](72 * $scale), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $graphics.DrawString('1', $font, $white, [System.Drawing.RectangleF]::new(153 * $scale, 250 * $scale, 108 * $scale, 112 * $scale), $format)
  $graphics.DrawString('2', $font, $white, [System.Drawing.RectangleF]::new(251 * $scale, 250 * $scale, 108 * $scale, 112 * $scale), $format)
  $graphics.DrawArc($goldPen, 220 * $scale, 363 * $scale, 72 * $scale, 42 * $scale, 20, 140)

  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $font.Dispose(); $format.Dispose(); $goldPen.Dispose(); $background.Dispose(); $cream.Dispose(); $roof.Dispose(); $door.Dispose(); $blue.Dispose(); $coral.Dispose(); $white.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}

$dist = Join-Path $PSScriptRoot '..\dist'
New-ZuhauseIcon 180 (Join-Path $dist 'apple-touch-icon.png') $false
New-ZuhauseIcon 192 (Join-Path $dist 'icon-192.png') $false
New-ZuhauseIcon 512 (Join-Path $dist 'icon-512.png') $false
New-ZuhauseIcon 512 (Join-Path $dist 'icon-maskable-512.png') $true
