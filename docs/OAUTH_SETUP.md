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

## 5. 문제 해결

| 증상 | 확인 |
|------|------|
| `token_exchange_failed` | Redirect URI가 콘솔과 100% 일치하는지 |
| Google 503 | `GOOGLE_CLIENT_ID` / `SECRET` Secret 등록 |
| 카카오 이메일 없음 | 동의 항목에서 이메일 필수, scope 설정 |
| 로컬에서 빈 페이지 | `npm run dev`(루트)로 API 8788 + Vite 5173 동시 실행 |

개발: **(주)와우쓰리디**
