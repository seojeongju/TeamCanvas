# 데스크톱 빌드 산출물을 웹 다운로드 경로로 복사하고 latest.json 을 갱신합니다.
# 사용: 루트에서  powershell -File scripts/publish-desktop-download.ps1
# 선택: -Notes "변경 요약" -Version "0.1.2"

param(
  [string]$Notes = "버그 수정 및 개선",
  [string]$Version = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$bundleNsis = Join-Path $root "apps\desktop\src-tauri\target\release\bundle\nsis"
$cargoToml = Join-Path $root "apps\desktop\src-tauri\Cargo.toml"
$outDir = Join-Path $root "apps\web\public\downloads"
$outFile = Join-Path $outDir "TeamCanvas-Setup.exe"
$latestFile = Join-Path $outDir "latest.json"
$downloadUrl = "https://teamcanvas.pages.dev/downloads/TeamCanvas-Setup.exe"

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

if (-not $Version) {
  $cargo = Get-Content $cargoToml -Raw
  if ($cargo -match 'version\s*=\s*"([^"]+)"') {
    $Version = $Matches[1]
  } else {
    Write-Error "Cargo.toml 에서 버전을 읽지 못했습니다."
  }
}

$setup = Get-ChildItem -Path $bundleNsis -Filter "*x64-setup.exe" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $setup) {
  Write-Error "설치 파일을 찾을 수 없습니다. 먼저 npm run desktop:build 를 실행하세요.`n경로: $bundleNsis"
}

Copy-Item $setup.FullName $outFile -Force

$pubDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$manifestJson = @"
{
  "version": "$Version",
  "notes": "$($Notes -replace '"','\"')",
  "pub_date": "$pubDate",
  "url": "$downloadUrl"
}
"@
[System.IO.File]::WriteAllText($latestFile, $manifestJson, [System.Text.UTF8Encoding]::new($false))

# 웹 상수 버전 동기화
$desktopTs = Join-Path $root "apps\web\src\lib\desktopDownload.ts"
if (Test-Path $desktopTs) {
  $ts = Get-Content $desktopTs -Raw
  $ts = [regex]::Replace($ts, 'export const DESKTOP_APP_VERSION = "[^"]+"', "export const DESKTOP_APP_VERSION = `"$Version`"")
  Set-Content -Path $desktopTs -Value $ts -Encoding utf8 -NoNewline
}

Write-Host "복사 완료: $($setup.Name) -> $outFile ($([math]::Round($setup.Length/1MB, 2)) MB)"
Write-Host "매니페스트: $latestFile (version $Version)"
