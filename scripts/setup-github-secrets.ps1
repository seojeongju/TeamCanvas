# TeamCanvas — GitHub Actions Secrets 설정
# 사용: PowerShell에서 .\scripts\setup-github-secrets.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$AccountId = "85c8e953bdefb825af5374f0d66ca5dc"
$Repo = "seojeongju/TeamCanvas"

Write-Host "`n=== TeamCanvas GitHub Actions Secrets ===" -ForegroundColor Cyan
Write-Host "개발: (주)와우쓰리디`n"

# gh CLI 확인 (winget 설치 직후 PATH 미반영 터미널 대비)
$ghCmd = Get-Command gh -ErrorAction SilentlyContinue
if (-not $ghCmd) {
    $ghDefault = "${env:ProgramFiles}\GitHub CLI\gh.exe"
    if (Test-Path $ghDefault) {
        $env:Path = "$(Split-Path $ghDefault -Parent);$env:Path"
        $ghCmd = Get-Command gh -ErrorAction SilentlyContinue
    }
}
if (-not $ghCmd) {
    Write-Host "GitHub CLI(gh)가 필요합니다. 설치: winget install GitHub.cli" -ForegroundColor Red
    Write-Host "설치 후에도 인식되지 않으면 터미널을 닫았다가 다시 열거나 아래를 실행하세요:" -ForegroundColor Yellow
    Write-Host '  $env:Path += ";C:\Program Files\GitHub CLI"' -ForegroundColor Gray
    exit 1
}

# GitHub 로그인 확인
$authOk = $false
try {
    gh auth status 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $authOk = $true }
} catch {}

if (-not $authOk) {
    Write-Host "GitHub 로그인이 필요합니다. 브라우저가 열립니다..." -ForegroundColor Yellow
    gh auth login --hostname github.com --git-protocol https --web
}

Write-Host "`n[1/2] CLOUDFLARE_ACCOUNT_ID 설정..." -ForegroundColor Yellow
gh secret set CLOUDFLARE_ACCOUNT_ID --repo $Repo --body $AccountId
Write-Host "  OK: $AccountId" -ForegroundColor Green

Write-Host "`n[2/2] CLOUDFLARE_API_TOKEN 설정..." -ForegroundColor Yellow
Write-Host @"

Cloudflare API 토큰을 발급받으세요:
  1. 브라우저에서 API 토큰 페이지 열기
  2. 'Create Custom Token' 선택
  3. 권한 추가:
     - Account > Cloudflare Pages > Edit
     - Account > D1 > Edit
     - Account > Workers R2 Storage > Edit
     - Account > Workers AI > Edit
  4. Account Resources: Jayseo36@gmail.com's Account
  5. Create Token → 토큰 복사 (한 번만 표시됨)

"@ -ForegroundColor Gray

Start-Process "https://dash.cloudflare.com/profile/api-tokens"

$token = Read-Host "발급받은 CLOUDFLARE_API_TOKEN 을 붙여넣으세요"
if ([string]::IsNullOrWhiteSpace($token)) {
    Write-Host "토큰이 비어 있습니다. 나중에 다시 실행하세요." -ForegroundColor Red
    exit 1
}

gh secret set CLOUDFLARE_API_TOKEN --repo $Repo --body $token.Trim()
Write-Host "  OK: CLOUDFLARE_API_TOKEN 저장됨" -ForegroundColor Green

Write-Host "`n=== 완료 ===" -ForegroundColor Cyan
Write-Host "Actions 탭에서 Deploy 워크플로를 재실행하거나 main에 push 하세요:"
Write-Host "  https://github.com/$Repo/actions`n" -ForegroundColor Green
