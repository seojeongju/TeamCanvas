# Google / Kakao OAuth 설정 가이드

> 프로덕션: `https://teamcanvas.pages.dev`  
> 로컬: API `http://localhost:8788`, 프론트 `http://localhost:5173`

---

## 1. Cloudflare Pages Secrets

```powershell
cd d:\Program_DEV\TeamCanvas

# API 콜백 URL 고정 (권장)
"https://teamcanvas.pages.dev" | npx wrangler pages secret put APP_URL --project-name=teamcanvas

# Google
"YOUR_GOOGLE_CLIENT_ID" | npx wrangler pages secret put GOOGLE_CLIENT_ID --project-name=teamcanvas
"YOUR_GOOGLE_CLIENT_SECRET" | npx wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name=teamcanvas

# Kakao
"YOUR_KAKAO_REST_API_KEY" | npx wrangler pages secret put KAKAO_CLIENT_ID --project-name=teamcanvas
"YOUR_KAKAO_CLIENT_SECRET" | npx wrangler pages secret put KAKAO_CLIENT_SECRET --project-name=teamcanvas
```

로컬 개발은 `.dev.vars`에 동일 키를 넣습니다.

---

## 2. Google Cloud Console

1. [Google Cloud Console](https://console.cloud.google.com/) → 프로젝트 생성
2. **APIs & Services** → **OAuth consent screen** → External → 앱 정보 입력
3. **Credentials** → **Create Credentials** → **OAuth client ID** → **Web application**
4. **Authorized redirect URIs** (정확히 일치해야 함):

| 환경 | Redirect URI |
|------|----------------|
| 프로덕션 | `https://teamcanvas.pages.dev/auth/callback/google` |
| 로컬 | `http://localhost:8788/auth/callback/google` |

5. Client ID / Client Secret을 Pages Secret에 저장

---

## 3. Kakao Developers

1. [Kakao Developers](https://developers.kakao.com/) → 애플리케이션 추가
2. **앱 설정** → **앱 키** → **REST API 키** → `KAKAO_CLIENT_ID`
3. **제품 설정** → **카카오 로그인** → 활성화 ON
4. **Redirect URI** 등록:

| 환경 | Redirect URI |
|------|----------------|
| 프로덕션 | `https://teamcanvas.pages.dev/auth/callback/kakao` |
| 로컬 | `http://localhost:8788/auth/callback/kakao` |

5. **동의 항목**: 닉네임, 프로필 사진, **카카오계정(이메일)** 필수 동의 설정
6. (선택) **보안** → Client Secret 사용 시 `KAKAO_CLIENT_SECRET` 설정

---

## 4. 동작 확인

1. `GET https://teamcanvas.pages.dev/auth/providers`  
   → `{ "google": true, "kakao": true }`
2. 로그인 페이지 → **Google로 계속하기** / **카카오로 계속하기**
3. 최초 로그인 시 → **온보딩**(조직 생성)으로 이동

---

## 5. Google 캘린더 일정 가져오기 (연동)

로그인용 OAuth와 **동일한** Google OAuth 클라이언트를 사용합니다. 아래를 **추가**로 설정하세요.

### 5.1 Google Cloud Console

1. **APIs & Services** → **Library** → **Google Calendar API** → **Enable**
2. **OAuth consent screen** → **Scopes** → Add scope:
   - `https://www.googleapis.com/auth/calendar.readonly`
3. **Credentials** → 기존 Web OAuth 클라이언트 → **Authorized redirect URIs**에 **캘린더 콜백** 추가:

| 환경 | Redirect URI |
|------|----------------|
| 프로덕션 | `https://teamcanvas.pages.dev/api/integrations/google-calendar/callback` |
| 로컬 | `http://127.0.0.1:8788/api/integrations/google-calendar/callback` |

> 로그인용 URI(`/auth/callback/google`)와 캘린더용 URI를 **둘 다** 등록해야 합니다.

### 5.2 Cloudflare Pages Secrets

로그인 OAuth와 동일한 값을 사용합니다.

| Secret | 설명 |
|--------|------|
| `GOOGLE_CLIENT_ID` | OAuth 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | OAuth 클라이언트 Secret |
| `APP_URL` | `https://teamcanvas.pages.dev` (API 콜백 기준 URL) |
| `FRONTEND_URL` | `https://teamcanvas.pages.dev` (연동 후 돌아갈 프론트 URL) |
| `JWT_SECRET` | OAuth state 서명용 (필수) |

### 5.3 동작 확인

1. 일정 페이지 → **Google 연결** 클릭
2. Google 계정 권한 허용 (캘린더 읽기)
3. 캘린더에 Google 일정이 빨간색 `📅` 칩으로 표시 (본인만, 읽기 전용)
4. **동기화** 버튼으로 최신 일정 다시 가져오기

### 5.4 테스트 사용자 (앱 미검수 시)

OAuth consent screen이 **Testing** 상태면, **Test users**에 연동할 Google 계정을 추가해야 합니다.

---

## 6. 문제 해결

| 증상 | 확인 |
|------|------|
| `token_exchange_failed` | Redirect URI가 콘솔과 100% 일치하는지 |
| Google 503 | `GOOGLE_CLIENT_ID` / `SECRET` Secret 등록 |
| 캘린더 연결 실패 | Calendar API 활성화, `calendar.readonly` scope, 캘린더 callback URI 등록 |
| 연결됐는데 일정 없음 | **동기화** 클릭, primary 캘린더에 해당 기간 일정 있는지 확인 |
| 카카오 이메일 없음 | 동의 항목에서 이메일 필수, scope 설정 |
| 로컬에서 빈 페이지 | `npm run dev`(루트)로 API 8788 + Vite 5173 동시 실행 |

개발: **(주)와우쓰리디**
