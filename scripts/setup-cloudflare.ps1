# TeamCanvas — Cloudflare 초기 설정 스크립트
# 사용: PowerShell에서 .\scripts\setup-cloudflare.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "`n=== TeamCanvas Cloudflare Setup ===" -ForegroundColor Cyan
Write-Host "개발: (주)와우쓰리디`n"

Write-Host "[1/5] Wrangler 로그인 확인..." -ForegroundColor Yellow
try {
    npx wrangler whoami
} catch {
    Write-Host "로그인이 필요합니다: npx wrangler login" -ForegroundColor Red
    exit 1
}

Write-Host "`n[2/5] D1 데이터베이스 생성..." -ForegroundColor Yellow
Write-Host "이미 있으면 오류가 날 수 있습니다 — wrangler.jsonc의 database_id를 확인하세요."
npx wrangler d1 create teamcanvas-db

Write-Host "`n[3/5] R2 버킷 생성..." -ForegroundColor Yellow
npx wrangler r2 bucket create teamcanvas-files

Write-Host "`n[4/5] Pages 프로젝트 생성..." -ForegroundColor Yellow
npx wrangler pages project create teamcanvas --production-branch=main

Write-Host "`n[5/5] D1 마이그레이션 (remote)..." -ForegroundColor Yellow
Write-Host "wrangler.jsonc에 database_id를 설정한 후 실행하세요:"
Write-Host "  npm run db:migrate:remote" -ForegroundColor Green

Write-Host "`n=== 다음 단계 ===" -ForegroundColor Cyan
Write-Host "1. wrangler.jsonc 의 database_id 를 d1 create 출력값으로 교체"
Write-Host "2. Pages Secrets 설정 (docs/DEPLOY.md 참고)"
Write-Host "3. GitHub repo + Actions Secrets 설정"
Write-Host "4. git push origin main`n"
