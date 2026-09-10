# 데스크톱 빌드 산출물을 웹 다운로드 경로로 복사합니다.
# 사용: 루트에서  powershell -File scripts/publish-desktop-download.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$bundleNsis = Join-Path $root "apps\desktop\src-tauri\target\release\bundle\nsis"
$outDir = Join-Path $root "apps\web\public\downloads"
$outFile = Join-Path $outDir "TeamCanvas-Setup.exe"

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$setup = Get-ChildItem -Path $bundleNsis -Filter "*x64-setup.exe" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $setup) {
  Write-Error "설치 파일을 찾을 수 없습니다. 먼저 npm run desktop:build 를 실행하세요.`n경로: $bundleNsis"
}

Copy-Item $setup.FullName $outFile -Force
Write-Host "복사 완료: $($setup.Name) -> $outFile ($([math]::Round($setup.Length/1MB, 2)) MB)"
