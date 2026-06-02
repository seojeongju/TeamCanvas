# GitHub & Cloudflare 빠른 시작

## 지금 바로 (로컬)

```powershell
cd d:\Program_DEV\TeamCanvas

# 1. Cloudflare 로그인 (브라우저 열림)
npx wrangler login

# 2. D1 / R2 / Pages 생성
npm run cf:setup

# 3. d1 create 출력의 database_id → wrangler.jsonc 반영

# 4. 원격 DB 마이그레이션
npm run db:migrate:remote

# 5. Pages Secrets (최소)
npx wrangler pages secret put JWT_SECRET --project-name=teamcanvas
npx wrangler pages secret put FRONTEND_URL --project-name=teamcanvas
npx wrangler pages secret put ALLOW_DEV_AUTH --project-name=teamcanvas
```

## GitHub

1. https://github.com/new → `TeamCanvas` 저장소 생성
2. Settings → Secrets → Actions:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
3. 푸시:

```powershell
git add .
git commit -m "Initial commit: TeamCanvas PWA"
git remote add origin https://github.com/<USER>/TeamCanvas.git
git push -u origin main
```

→ Actions가 자동 배포 → `https://teamcanvas.pages.dev`

상세: [DEPLOY.md](./DEPLOY.md)
