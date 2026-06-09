# VAPID 키 생성 후 Cloudflare Pages Secret 등록
# 사용: .\scripts\setup-vapid-secrets.ps1
# 사전: npx wrangler login

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "`n=== TeamCanvas VAPID Setup ===" -ForegroundColor Cyan

Write-Host "[1/3] VAPID 키 생성..." -ForegroundColor Yellow
$json = node scripts/generate-vapid-keys.mjs | ConvertFrom-Json
$pub = $json.publicKey
$priv = $json.privateKey

Write-Host "Public Key:  $pub" -ForegroundColor Green
Write-Host "Private Key: (hidden)" -ForegroundColor Green

Write-Host "`n[2/3] Wrangler 로그인 확인..." -ForegroundColor Yellow
npx wrangler whoami

Write-Host "`n[3/3] Pages Secrets 등록..." -ForegroundColor Yellow
$pub | npx wrangler pages secret put VAPID_PUBLIC_KEY --project-name=teamcanvas
$priv | npx wrangler pages secret put VAPID_PRIVATE_KEY --project-name=teamcanvas

Write-Host "`n완료! GitHub Actions에도 동일 키를 Secrets로 등록하려면:" -ForegroundColor Cyan
Write-Host "  VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (선택 — Pages Secret만으로 충분)" -ForegroundColor Gray
Write-Host "`n로컬 dev: .dev.vars 파일에 추가하세요." -ForegroundColor Cyan
Write-Host "VAPID_PUBLIC_KEY=$pub"
Write-Host "VAPID_PRIVATE_KEY=$priv`n"
