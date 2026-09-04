$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot\..
$p = Start-Process -FilePath "npx.cmd" -ArgumentList "vite preview --port 4179 --strictPort" -PassThru -WindowStyle Hidden -RedirectStandardOutput qa\preview.out.txt -RedirectStandardError qa\preview.err.txt
Start-Sleep 5
try { "preview HTTP " + (Invoke-WebRequest -UseBasicParsing http://localhost:4179/ -TimeoutSec 5).StatusCode } catch { "preview not up: $_" }
node scripts/hostile.mjs 2>&1 | Tee-Object -FilePath qa\hostile-run.log
Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'vite preview' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
"preview stopped"
