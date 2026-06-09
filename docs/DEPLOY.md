# TeamCanvas — GitHub & Cloudflare 배포 가이드

> 개발: **(주)와우쓰리디**

---

## 1. 사전 준비

| 항목 | 설명 |
|------|------|
| Cloudflare 계정 | [dash.cloudflare.com](https://dash.cloudflare.com) |
| GitHub 계정 | 저장소 호스팅 |
| Node.js 20+ | 로컬 빌드/CLI |

---

## 2. Cloudflare CLI 로그인

```powershell
cd d:\Program_DEV\TeamCanvas
npx wrangler login
npx wrangler whoami
```

`Account ID`를 메모해 두세요 (GitHub Secret에 사용).

---

## 3. Cloudflare 리소스 생성

### 3.1 D1 데이터베이스

```powershell
npx wrangler d1 create teamcanvas-db
```

출력된 `database_id`를 `wrangler.jsonc`에 반영:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "teamcanvas-db",
    "database_id": "<여기에_실제_UUID>",
    "migrations_dir": "migrations"
  }
]
```

로컬/원격 마이그레이션:

```powershell
npm run db:migrate:local
npm run db:migrate:remote
```

### 3.2 R2 버킷

```powershell
npx wrangler r2 bucket create teamcanvas-files
```

`wrangler.jsonc`의 `bucket_name`과 일치하는지 확인.

### 3.3 Pages 프로젝트

```powershell
npx wrangler pages project create teamcanvas --production-branch=main
```

---

## 4. Pages Secrets (런타임 환경변수)

```powershell
# 필수
npx wrangler pages secret put JWT_SECRET --project-name=teamcanvas
npx wrangler pages secret put FRONTEND_URL --project-name=teamcanvas

# 이메일 (Resend)
npx wrangler pages secret put RESEND_API_KEY --project-name=teamcanvas
npx wrangler pages secret put EMAIL_FROM --project-name=teamcanvas

# OAuth (선택)
npx wrangler pages secret put GOOGLE_CLIENT_ID --project-name=teamcanvas
npx wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name=teamcanvas
npx wrangler pages secret put KAKAO_CLIENT_ID --project-name=teamcanvas
npx wrangler pages secret put KAKAO_CLIENT_SECRET --project-name=teamcanvas

# Web Push (VAPID)
npm run vapid:generate
npm run vapid:setup
# 또는 수동:
# npx wrangler pages secret put VAPID_PUBLIC_KEY --project-name=teamcanvas
# npx wrangler pages secret put VAPID_PRIVATE_KEY --project-name=teamcanvas

# 프로덕션에서는 dev auth 비활성화
npx wrangler pages secret put ALLOW_DEV_AUTH --project-name=teamcanvas
# 값: false
```

| Secret | 예시 값 |
|--------|---------|
| `JWT_SECRET` | 32자 이상 랜덤 문자열 |
| `FRONTEND_URL` | `https://teamcanvas.pages.dev` (커스텀 도메인 연결 후 변경) |
| `EMAIL_FROM` | `TeamCanvas <noreply@yourdomain.com>` |
| `VAPID_PUBLIC_KEY` | `npm run vapid:generate` 출력값 |
| `VAPID_PRIVATE_KEY` | `npm run vapid:generate` 출력값 |
| `ALLOW_DEV_AUTH` | `false` |

### Google Calendar 연동 (선택)

Google Cloud Console → OAuth 클라이언트에 **승인된 리디렉션 URI** 추가:

```
https://teamcanvas.pages.dev/api/integrations/google-calendar/callback
```

로컬 개발 시:

```
http://127.0.0.1:8788/api/integrations/google-calendar/callback
```

`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`이 설정되어 있어야 합니다. Calendar API를 사용하려면 Google Cloud에서 **Google Calendar API**를 활성화하세요.

---

## 5. GitHub 저장소

### 5.1 저장소 생성

GitHub에서 **New repository** → 이름: `TeamCanvas` → Create (README 없이).

### 5.2 로컬 연결 & 푸시

```powershell
cd d:\Program_DEV\TeamCanvas
git init
git add .
git commit -m "Initial commit: TeamCanvas PWA"
git branch -M main
git remote add origin https://github.com/<YOUR_USER>/TeamCanvas.git
git push -u origin main
```

### 5.3 GitHub Actions Secrets

Repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret | 값 |
|--------|-----|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API 토큰 (아래 5.4 참고) |
| `CLOUDFLARE_ACCOUNT_ID` | `wrangler whoami`의 Account ID |

### 5.4 Cloudflare API 토큰 발급

1. [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens) → **Create Token**
2. **Edit Cloudflare Workers** 템플릿 사용 또는 커스텀:
   - Account → Cloudflare Pages → Edit
   - Account → D1 → Edit
   - Account → Workers R2 Storage → Edit
3. 토큰 복사 → GitHub Secret `CLOUDFLARE_API_TOKEN`에 저장

---

## 6. 배포 흐름

```
git push main
    ↓
GitHub Actions (deploy.yml)
    ├── npm ci & build
    ├── D1 migrations (remote)
    └── wrangler pages deploy
    ↓
https://teamcanvas.pages.dev
```

- **PR:** `ci.yml` — 빌드 + wrangler check만 실행
- **main push:** `deploy.yml` — 빌드 + 마이그레이션 + 배포

---

## 7. 커스텀 도메인 (선택)

1. Cloudflare Dashboard → **Workers & Pages** → **teamcanvas** → **Custom domains**
2. 도메인 추가 (예: `app.wow3d.co.kr`)
3. `FRONTEND_URL` Secret 업데이트
4. OAuth Redirect URI에 새 도메인 등록

---

## 8. 수동 배포 (로컬)

```powershell
npm run build
npm run db:migrate:remote
npx wrangler pages deploy apps/web/dist --project-name=teamcanvas --branch=main
```

---

## 9. 체크리스트

- [ ] `wrangler login` 완료
- [ ] D1 생성 + `database_id` in `wrangler.jsonc`
- [ ] R2 버킷 생성
- [ ] Pages 프로젝트 `teamcanvas` 생성
- [ ] Pages Secrets 설정 (JWT, FRONTEND_URL, …)
- [ ] GitHub repo 생성 & push
- [ ] GitHub Secrets (API_TOKEN, ACCOUNT_ID)
- [ ] main push 후 Actions 배포 성공 확인
- [ ] `/api/health` → `db: ok` 확인

---

## 10. 문제 해결

| 증상 | 해결 |
|------|------|
| `db: error` on health | D1 binding / database_id 확인, migrate remote 실행 |
| 401 on auth | JWT_SECRET Pages Secret 설정 |
| 이메일 미발송 | RESEND_API_KEY, EMAIL_FROM 확인 |
| OAuth redirect 오류 | FRONTEND_URL + Provider Redirect URI 일치 |
| Actions deploy 실패 | Secrets, project-name=teamcanvas 확인 |
