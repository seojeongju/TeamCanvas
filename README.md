# TeamCanvas

팀 일정·협업을 하나의 캔버스에서 — **Cloudflare Pages + D1 + R2** 기반 PWA

## 디자인

Clean Tech Blue · Glassmorphism · Soft UI (모바일 우선)

- 컬러: `#4A9FE8` Primary, `#1E3A5F` Navy, `#F0F7FF` Background
- 상세: [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md)

## 빠른 시작

### 1. 환경 설정

```bash
cp .dev.vars.example .dev.vars
npm run db:migrate:local
```

### 2. 개발 서버 (프론트 + API 동시 실행)

```bash
npm run dev
```

- **Web:** http://localhost:5173
- **API:** http://localhost:8788 (Vite 프록시로 `/api`, `/auth` 연결)

### 3. 로그인

- **회원가입** → 이메일 인증 (개발: `[개발] 인증 링크` 표시) → 조직 생성
- **비밀번호 찾기:** `/forgot-password`

### 4. 이메일 발송 (Resend)

```bash
# .dev.vars 또는 Cloudflare Secrets
RESEND_API_KEY=re_xxxxxxxx
EMAIL_FROM=TeamCanvas <noreply@yourdomain.com>
FRONTEND_URL=https://app.yourdomain.com
```

`RESEND_API_KEY` 미설정 + `ALLOW_DEV_AUTH=true` → API 응답에 `devLink` 포함

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/health` | 헬스체크 |
| POST | `/auth/register` | 이메일 회원가입 (+ 인증 메일) |
| POST | `/auth/login` | 이메일 로그인 |
| POST | `/auth/verify-email` | 이메일 인증 (토큰) |
| POST | `/auth/resend-verification` | 인증 메일 재발송 |
| POST | `/auth/forgot-password` | 비밀번호 재설정 요청 |
| POST | `/auth/reset-password` | 비밀번호 재설정 |
| POST | `/auth/dev` | 개발용 로그인 |
| GET | `/auth/google` | Google OAuth |
| GET | `/auth/kakao` | Kakao OAuth |
| GET | `/auth/me` | 현재 사용자 |
| POST | `/auth/logout` | 로그아웃 |
| POST | `/api/organizations` | 조직 생성 |
| GET/POST | `/api/organizations/:id/events` | 일정 |
| GET/POST | `/api/organizations/:id/tasks` | 업무 |
| PATCH | `/api/tasks/:id` | 업무 상태 변경 |

## 프로젝트 구조

```
TeamCanvas/
├── apps/web/          # React PWA (Vite + Tailwind + TanStack Query)
├── functions/         # Cloudflare Pages Functions (Hono)
├── migrations/        # D1 SQL 마이그레이션
├── docs/              # PRD, 개발계획, 디자인 시스템
└── wrangler.jsonc
```

## Cloudflare 배포

상세 가이드: **[docs/DEPLOY.md](docs/DEPLOY.md)**

```bash
# 1. Cloudflare 로그인
npx wrangler login

# 2. 리소스 생성 (D1, R2, Pages)
npm run cf:setup

# 3. wrangler.jsonc database_id 업데이트 후
npm run db:migrate:remote

# 4. GitHub Actions Secrets 설정 후 push
git push origin main
```

### GitHub Actions Secrets

| Secret | 설명 |
|--------|------|
| `CLOUDFLARE_API_TOKEN` | API 토큰 |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID |

### 수동 배포

```bash
npm run deploy
```

## 문서

- [PRD](docs/PRD.md)
- [개발 계획서](docs/DEVELOPMENT_PLAN.md)
- [디자인 시스템](docs/DESIGN_SYSTEM.md)
