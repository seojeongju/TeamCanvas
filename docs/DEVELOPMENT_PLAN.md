# TeamCanvas — Cloudflare 기반 개발 계획서

> **버전:** 1.0  
> **작성일:** 2026-06-02  
> **스택:** Cloudflare Pages · Pages Functions · D1 · R2 · KV (선택)

---

## 1. 기술 아키텍처

### 1.1 전체 구조

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (PWA)                              │
│  React / Vue / Svelte + Vite · Workbox SW · IndexedDB           │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼─────────────────────────────────────┐
│                   Cloudflare Pages (Global CDN)                  │
│  ┌─────────────┐  ┌──────────────────────────────────────────┐  │
│  │ Static SPA  │  │ Pages Functions (/functions)            │  │
│  │  dist/      │  │  /api/*  /auth/*  /webhooks/*           │  │
│  └─────────────┘  └───────────┬──────────────────────────────┘  │
└───────────────────────────────┼─────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
   ┌─────────┐            ┌─────────┐            ┌─────────┐
   │   D1    │            │   R2    │            │   KV    │
   │ SQLite  │            │  Files  │            │ Session │
   │  Meta   │            │  Assets │            │  Cache  │
   └─────────┘            └─────────┘            └─────────┘
```

### 1.2 기술 스택 선정

| 계층 | 선택 | 근거 |
|------|------|------|
| Frontend | **React + TypeScript + Vite** | PWA 생태계, 컴포넌트 풍부, TanStack Query |
| UI | **Tailwind CSS + shadcn/ui** | 모바일 반응형, 빠른 프로토타이핑 |
| Routing | **React Router v7** | SPA + deep link (PWA) |
| State | **TanStack Query + Zustand** | 서버 상태 / UI 상태 분리 |
| Backend | **Pages Functions (Hono)** | 경량, 타입 안전, Workers 호환 |
| DB | **D1** | 관계형, SQL, Pages 바인딩 |
| Storage | **R2** | S3 호환, 첨부파일·조직 로고 |
| Cache | **KV** (선택) | OAuth state, rate limit, hot cache |
| Auth | **自前 JWT + OAuth2** | Google/Kakao, HttpOnly cookie |
| PWA | **vite-plugin-pwa (Workbox)** | manifest, SW, precache |
| Push | **web-push** (Pages Function) | VAPID, D1 subscription |
| i18n | **i18next** | ko 기본, en 확장 |
| Test | **Vitest + Playwright** | unit + E2E |
| CI/CD | **GitHub Actions → Pages** | PR preview, main deploy |

### 1.3 Pages vs Workers 역할 분담

| Pages | Workers (필요 시 분리) |
|-------|------------------------|
| SPA 호스팅, Functions API | Cron (일정 리마인더 배치) |
| OAuth callback | Durable Objects (실시간 협업 v2) |
| R2 presigned upload | Email 발송 (Resend 등) |

**MVP:** Pages Functions만으로 충분. Cron은 Pages Function + scheduled trigger 또는 별도 Worker.

---

## 2. 프로젝트 구조

```
TeamCanvas/
├── apps/
│   └── web/                    # React PWA
│       ├── public/
│       │   ├── manifest.webmanifest
│       │   └── icons/
│       ├── src/
│       │   ├── components/
│       │   ├── features/       # calendar, tasks, org, auth
│       │   ├── hooks/
│       │   ├── lib/
│       │   ├── pages/
│       │   └── sw/             # Workbox custom logic
│       └── vite.config.ts
├── functions/                  # Pages Functions
│   ├── api/
│   │   ├── auth/
│   │   ├── organizations/
│   │   ├── events/
│   │   ├── tasks/
│   │   └── files/
│   ├── _middleware.ts          # auth, CORS, org context
│   └── utils/
├── packages/
│   └── shared/                 # types, validators (zod)
├── migrations/                 # D1 SQL migrations
│   └── 0001_initial.sql
├── wrangler.jsonc
├── package.json                # monorepo (pnpm workspaces)
└── docs/
    ├── PRD.md
    └── DEVELOPMENT_PLAN.md
```

---

## 3. Cloudflare 리소스 설정

### 3.1 wrangler.jsonc (예시)

```jsonc
{
  "name": "teamcanvas",
  "compatibility_date": "2026-01-01",
  "pages_build_output_dir": "apps/web/dist",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "teamcanvas-db",
      "database_id": "<UUID>"
    }
  ],
  "r2_buckets": [
    {
      "binding": "FILES",
      "bucket_name": "teamcanvas-files"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "CACHE",
      "id": "<KV_ID>"
    }
  ]
}
```

### 3.2 Secrets (Pages Dashboard / CLI)

| Secret | 용도 |
|--------|------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `KAKAO_CLIENT_ID` / `KAKAO_CLIENT_SECRET` | Kakao OAuth |
| `JWT_SECRET` | Access/Refresh token 서명 |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push |
| `ENCRYPTION_KEY` | Refresh token 암호화 (선택) |

### 3.3 R2 버킷 정책

```
버킷: teamcanvas-files
경로 규칙:
  org/{orgId}/logo/{fileId}
  org/{orgId}/attachments/{entityType}/{entityId}/{fileId}
```

- 업로드: Pages Function → presigned URL 또는 direct upload via Function
- 다운로드: signed URL (만료 15분) 또는 public logo만 CDN
- 최대 파일: 25MB (MVP), MIME 화이트리스트

### 3.4 D1 마이그레이션 전략

```bash
# 로컬
wrangler d1 migrations apply teamcanvas-db --local

# 프로덕션
wrangler d1 migrations apply teamcanvas-db --remote
```

- 모든 DDL은 `migrations/` 버전 관리
- 파괴적 변경: expand-contract 패턴
- 인덱스: `organization_id` 복합 인덱스 필수

---

## 4. D1 데이터베이스 스키마

### 4.1 ERD (핵심)

```
users ──┬── oauth_accounts
        ├── sessions
        └── memberships ── organizations
                              ├── departments
                              ├── teams ── team_members
                              ├── events ── event_attendees
                              ├── tasks ── task_comments
                              ├── files
                              └── audit_logs
```

### 4.2 DDL (초기 마이그레이션)

```sql
-- 0001_initial.sql

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  locale TEXT DEFAULT 'ko',
  timezone TEXT DEFAULT 'Asia/Seoul',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'google' | 'kakao'
  provider_user_id TEXT NOT NULL,
  access_token_enc TEXT,
  refresh_token_enc TEXT,
  expires_at INTEGER,
  UNIQUE(provider, provider_user_id)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  user_agent TEXT,
  ip_address TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_r2_key TEXT,
  timezone TEXT DEFAULT 'Asia/Seoul',
  settings_json TEXT DEFAULT '{}',
  owner_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE memberships (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- owner|admin|member|guest
  status TEXT NOT NULL DEFAULT 'active', -- active|invited|suspended
  invited_by TEXT REFERENCES users(id),
  joined_at INTEGER,
  UNIQUE(organization_id, user_id)
);

CREATE TABLE departments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES departments(id),
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id TEXT REFERENCES departments(id),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  created_at INTEGER NOT NULL
);

CREATE TABLE team_members (
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- lead|member
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES teams(id),
  creator_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_at INTEGER NOT NULL,
  end_at INTEGER NOT NULL,
  all_day INTEGER DEFAULT 0,
  visibility TEXT DEFAULT 'team', -- private|team|organization
  recurrence_rule TEXT,
  color TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_events_org_time ON events(organization_id, start_at, end_at);

CREATE TABLE event_attendees (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rsvp TEXT DEFAULT 'pending', -- pending|accepted|declined|tentative
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES teams(id),
  creator_id TEXT NOT NULL REFERENCES users(id),
  assignee_id TEXT REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo', -- todo|doing|done
  priority TEXT DEFAULT 'medium',
  due_at INTEGER,
  sort_order INTEGER DEFAULT 0,
  event_id TEXT REFERENCES events(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_tasks_org_status ON tasks(organization_id, status);

CREATE TABLE task_comments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE files (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  uploader_id TEXT NOT NULL REFERENCES users(id),
  r2_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  entity_type TEXT, -- event|task|comment|org_logo
  entity_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES organizations(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata_json TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_audit_org_time ON audit_logs(organization_id, created_at DESC);
```

---

## 5. API 설계

### 5.1 REST 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/auth/google` | Google OAuth redirect |
| GET | `/auth/kakao` | Kakao OAuth redirect |
| GET | `/auth/callback/:provider` | OAuth callback |
| POST | `/auth/logout` | 세션 종료 |
| GET | `/auth/me` | 현재 사용자 |
| GET/POST | `/api/organizations` | 조직 목록/생성 |
| GET/PATCH | `/api/organizations/:id` | 조직 상세/수정 |
| GET/POST | `/api/organizations/:id/members` | 멤버 |
| POST | `/api/organizations/:id/invites` | 초대 |
| GET/POST | `/api/organizations/:id/teams` | 팀 |
| GET/POST | `/api/organizations/:id/events` | 일정 (range query) |
| GET/PATCH/DELETE | `/api/events/:id` | 일정 CRUD |
| GET/POST | `/api/organizations/:id/tasks` | 업무 |
| PATCH | `/api/tasks/:id` | 업무 수정 (status 포함) |
| POST | `/api/files/upload` | R2 업로드 URL |
| GET | `/api/notifications` | 알림 |
| POST | `/api/push/subscribe` | Push 구독 |

### 5.2 Middleware 체인

```typescript
// functions/_middleware.ts
// 1. CORS / Security headers
// 2. Rate limit (KV)
// 3. JWT 검증 → context.user
// 4. org_id 헤더/X-Org-Id → membership 검증
```

### 5.3 멀티 테넌시 쿼리 패턴

```typescript
// 모든 쿼리에 organization_id 필수
const events = await env.DB.prepare(`
  SELECT * FROM events
  WHERE organization_id = ? AND start_at >= ? AND end_at <= ?
`).bind(orgId, rangeStart, rangeEnd).all();
```

---

## 6. OAuth 구현 상세

### 6.1 Google

```
Redirect URI: https://app.teamcanvas.com/auth/callback/google
Scopes: openid email profile
Token: authorization_code → token endpoint → id_token 검증
```

### 6.2 Kakao

```
Redirect URI: https://app.teamcanvas.com/auth/callback/kakao
Scopes: profile_nickname account_email (동의항목 설정 필요)
User info: GET https://kapi.kakao.com/v2/user/me
```

### 6.3 JWT Payload

```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "orgs": [{ "id": "org_id", "role": "admin" }],
  "iat": 1717300000,
  "exp": 1717300900
}
```

---

## 7. PWA 구현 계획

### 7.1 vite-plugin-pwa 설정

```typescript
// vite.config.ts
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'TeamCanvas',
    short_name: 'TeamCanvas',
    theme_color: '#2563EB',
    background_color: '#FFFFFF',
    display: 'standalone',
    start_url: '/',
    icons: [/* 192, 512 */]
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /^\/api\/organizations\/.*\/events/,
        handler: 'NetworkFirst',
        options: { cacheName: 'events-cache', expiration: { maxAgeSeconds: 86400 } }
      }
    ]
  }
})
```

### 7.2 오프라인 전략

| 데이터 | 저장소 | 동기화 |
|--------|--------|--------|
| 최근 일정 (7일) | IndexedDB | Background Sync |
| 업무 보드 | IndexedDB | Optimistic + retry |
| 사용자·조직 | Cache API | Stale-while-revalidate |
| 첨부 미리보기 | Cache API | 온라인 only |

### 7.3 모바일 UI 컴포넌트

- `BottomNav`, `SwipeCalendar`, `FloatingActionButton`
- Safe area inset (`env(safe-area-inset-*)`)
- Pull-to-refresh (캘린더·알림)

---

## 8. 개발 단계별 계획

### Phase 0 — 기반 구축 (2주)

| 주차 | 작업 |
|------|------|
| W1 | Monorepo 셋업, wrangler.jsonc, D1/R2/KV 프로비저닝 |
| W1 | CI/CD (GitHub → Pages), preview deploy |
| W2 | 디자인 토큰, 컴포넌트 라이브러리, PWA shell |
| W2 | Auth skeleton (Google OAuth), JWT middleware |

**산출물:** 빈 PWA 설치 가능, Google 로그인, health check API

### Phase 1 — MVP (8주)

| Sprint | 기간 | 목표 |
|--------|------|------|
| S1 | 2주 | Kakao OAuth, users/sessions, 온보딩 |
| S2 | 2주 | Organization, Team, Membership, RBAC |
| S3 | 2주 | Calendar (CRUD, views, attendees) |
| S4 | 2주 | Task board, notifications (in-app), PWA polish |

**MVP 완료 기준:**
- Google/Kakao 가입 → 조직 생성 → 팀 일정·업무 CRUD
- 모바일 PWA 설치 및 기본 오프라인
- RBAC 동작

### Phase 2 — 협업 강화 (4주)

| Sprint | 목표 |
|--------|------|
| S5 | R2 파일 업로드, 댓글, @멘션 |
| S6 | Web Push, 검색, iCal export, 감사 로그 |

### Phase 3 — 확장 (4주)

| Sprint | 목표 |
|--------|------|
| S7 | Google Calendar sync (read) |
| S8 | 대시보드, 부서 트리, 성능·보안 hardening |

---

## 9. CI/CD 파이프라인

```yaml
# .github/workflows/deploy.yml
on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install && pnpm test && pnpm build

  deploy-preview:
    if: github.event_name == 'pull_request'
    needs: test
    steps:
      - run: npx wrangler pages deploy apps/web/dist --branch=${{ github.head_ref }}

  deploy-production:
    if: github.ref == 'refs/heads/main'
    needs: test
    steps:
      - run: npx wrangler d1 migrations apply teamcanvas-db --remote
      - run: npx wrangler pages deploy apps/web/dist --branch=main
```

---

## 10. 로컬 개발 환경

```bash
# 초기 설정
pnpm install
wrangler d1 create teamcanvas-db
wrangler r2 bucket create teamcanvas-files

# 로컬 개발
wrangler pages dev apps/web/dist --d1 DB=teamcanvas-db --r2 FILES=teamcanvas-files

# 또는 Vite + Functions proxy
pnpm --filter web dev
```

`.dev.vars` (gitignore):
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
KAKAO_CLIENT_ID=...
KAKAO_CLIENT_SECRET=...
JWT_SECRET=dev-secret-change-in-prod
```

---

## 11. 테스트 전략

| 유형 | 도구 | 범위 |
|------|------|------|
| Unit | Vitest | utils, validators, date helpers |
| Integration | Vitest + miniflare | Pages Functions + D1 |
| E2E | Playwright | Auth flow, calendar CRUD, PWA install |
| Load | k6 (선택) | API 100 RPS smoke |

**필수 E2E 시나리오:**
1. Google OAuth → 조직 생성 → 일정 추가
2. 초대 링크 → Kakao 가입 → 팀 캘린더 조회
3. 모바일 viewport → PWA manifest valid

---

## 12. 모니터링·운영

| 항목 | 도구 |
|------|------|
| 에러 추적 | Sentry (client + Functions) |
| 로그 | `wrangler pages deployment tail` |
| Analytics | Cloudflare Web Analytics (privacy-friendly) |
| Uptime | Cloudflare Health Checks |
| D1 | Dashboard query analytics, Time Travel backup |

---

## 13. 비용 추정 (초기)

| 서비스 | Free Tier | 예상 (1K MAU) |
|--------|-----------|---------------|
| Pages | Unlimited requests | $0 |
| D1 | 5M reads/day, 100K writes/day | $0~5/mo |
| R2 | 10GB storage, 1M Class A | $0~3/mo |
| KV | 100K reads/day | $0 |
| **합계** | | **~$0~10/mo** |

---

## 14. 보안 체크리스트 (출시 전)

- [ ] OAuth state + PKCE
- [ ] JWT secret rotation 절차
- [ ] CSP, HSTS, X-Frame-Options
- [ ] API rate limiting (KV)
- [ ] organization_id 누락 쿼리 audit
- [ ] R2 presigned URL 만료·MIME 검증
- [ ] OWASP Top 10 리뷰

---

## 15. 다음 액션 (Immediate)

1. `npm create cloudflare@latest teamcanvas -- --framework=react` 로 스캐폴딩
2. Cloudflare Dashboard에서 D1, R2, Pages 프로젝트 생성
3. Google Cloud Console / Kakao Developers 앱 등록 (Redirect URI)
4. Figma 와이어프레임: 모바일 캘린더·하단 탭 (Phase 0 W2)
5. `migrations/0001_initial.sql` 적용 및 Auth Sprint 착수

---

## 부록 A — Kakao Developers 설정

1. [developers.kakao.com](https://developers.kakao.com) → 앱 생성
2. 플랫폼 → Web → 사이트 도메인 등록
3. 카카오 로그인 → Redirect URI: `https://<domain>/auth/callback/kakao`
4. 동의항목: 닉네임(필수), 카카오계정(이메일)(선택→필수 권장)
5. REST API 키 → `KAKAO_CLIENT_ID`, Client Secret → `KAKAO_CLIENT_SECRET`

## 부록 B — Google Cloud OAuth 설정

1. APIs & Services → Credentials → OAuth 2.0 Client ID (Web)
2. Authorized redirect URIs: `https://<domain>/auth/callback/google`
3. OAuth consent screen: External, scopes: email, profile, openid

## 부록 C — 커스텀 도메인

```
app.teamcanvas.com → Cloudflare Pages custom domain
→ Automatic HTTPS, CDN cache for static assets
→ R2 public bucket (logo only): logos.teamcanvas.com via R2 custom domain
```
