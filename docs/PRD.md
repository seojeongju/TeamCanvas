# TeamCanvas — 제품 요구사항 정의서 (PRD)

> **버전:** 1.0  
> **작성일:** 2026-06-02  
> **플랫폼:** Cloudflare Pages · D1 · R2  
> **형태:** PWA (Progressive Web App, 모바일 우선)

---

## 1. 제품 개요

### 1.1 한 줄 정의

**TeamCanvas**는 회사·조직 단위로 팀 일정, 업무, 협업을 하나의 캔버스에서 관리하는 B2B/B2B2C 협업 SaaS이다.

### 1.2 해결하려는 문제

| 문제 | 현재 상황 | TeamCanvas 해결 |
|------|-----------|-----------------|
| 일정 분산 | 개인 캘린더, 메신저, 스프레드시트가 분리 | 조직 단위 통합 캘린더·보드 |
| 권한 혼란 | 누가 무엇을 볼/수정할 수 있는지 불명확 | RBAC 기반 조직·팀·프로젝트 권한 |
| 모바일 접근성 | PC 중심 도구, 현장·외근 대응 약함 | PWA + 오프라인 캐시 + 푸시 알림 |
| 온보딩 마찰 | 회사 이메일·복잡한 가입 | Google / Kakao 간편 가입 |

### 1.3 제품 비전

> "조직의 모든 일정과 협업이 연결되는 단 하나의 캔버스"

### 1.4 성공 지표 (KPI)

| 지표 | MVP 목표 (3개월) | 6개월 목표 |
|------|------------------|------------|
| MAU | 500 | 3,000 |
| 조직 생성 수 | 50 | 300 |
| D7 Retention | 25% | 35% |
| PWA 설치율 | 15% | 25% |
| 일정 생성/주/활성 사용자 | 3건 | 8건 |

---

## 2. 타겟 사용자 & 페르소나

### 2.1 1차 타겟

- **10~200명 규모** 스타트업·중소기업·프로젝트 팀
- Google Workspace 또는 Kakao 기반으로 이미 협업 중인 팀
- 별도 ERP/그룹웨어 없이 가볍게 일정·업무를 통합하고 싶은 조직

### 2.2 페르소나

| 페르소나 | 역할 | 니즈 |
|----------|------|------|
| **민지 (32)** | 팀 리더 / PM | 팀 전체 일정 가시화, 마감·회의 관리 |
| **준호 (28)** | 실무자 | 모바일에서 빠른 일정 확인·등록 |
| **수진 (40)** | HR/관리자 | 조직 구조·권한·멤버 온보딩 |
| **CEO 김 (45)** | 경영진 | 부서별 일정 요약, 리소스 파악 |

---

## 3. 핵심 기능 범위

### 3.1 기능 우선순위 (MoSCoW)

#### Must Have (MVP)

- [ ] Google / Kakao OAuth 간편 가입·로그인
- [ ] 회사(Organization) 생성·가입·초대
- [ ] 조직 멤버 관리 (초대, 역할, 탈퇴)
- [ ] 팀(Team) / 부서(Department) 구조
- [ ] 개인·팀·조직 캘린더 (월/주/일 뷰)
- [ ] 일정 CRUD, 반복 일정, 참석자, 알림
- [ ] 업무(Task) 보드 (Kanban: To Do / Doing / Done)
- [ ] PWA 설치, 홈 화면 추가, 모바일 반응형 UI
- [ ] 기본 RBAC (Owner / Admin / Member / Guest)

#### Should Have (v1.1)

- [ ] R2 기반 파일 첨부 (일정·업무·댓글)
- [ ] 실시간 알림 (Web Push)
- [ ] 일정 공유 링크 (읽기 전용)
- [ ] 검색 (일정·업무·멤버)
- [ ] 활동 피드 (Activity Log)
- [ ] iCal 구독 / 내보내기

#### Could Have (v1.2+)

- [ ] Google Calendar / Outlook 양방향 동기화
- [ ] 슬랙·카카오워크 웹훅 연동
- [ ] 대시보드·리포트 (부서별 업무량)
- [ ] 다국어 (ko / en)
- [ ] AI 일정 제안 (Workers AI)

#### Won't Have (초기 제외)

- 화상 회의 자체 제공 (외부 링크만 첨부)
- 급여·HR 전체 모듈
- 온프레미스 배포

---

## 4. 조직·관리 기능 (상세)

### 4.1 조직(Organization) 계층

```
Organization (회사/조직)
├── Department (부서) — 선택
├── Team (팀/프로젝트 그룹)
│   ├── Members
│   ├── Calendar (팀 일정)
│   └── Task Board
└── Members (조직 전체 멤버)
```

### 4.2 역할 및 권한 (RBAC)

| 역할 | 조직 설정 | 멤버 관리 | 팀 생성 | 전체 일정 | 타팀 일정 |
|------|-----------|-----------|---------|-----------|-----------|
| **Owner** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Member** | ❌ | ❌ | 요청 | 소속팀 | 공개팀만 |
| **Guest** | ❌ | ❌ | ❌ | 초대받은 것만 | ❌ |

### 4.3 조직 관리 기능

| 기능 | 설명 |
|------|------|
| 조직 생성 | 가입 후 첫 조직 생성 또는 초대 코드/링크로 가입 |
| 멤버 초대 | 이메일 초대, 초대 링크, 도메인 자동 가입 (선택) |
| 부서·팀 관리 | 트리 구조, 멤버 배치, 팀 리더 지정 |
| 조직 설정 | 이름, 로고(R2), 타임존, 근무일, 휴일 캘린더 |
| 감사 로그 | 멤버 변경, 권한 변경, 일정 삭제 등 (Admin+) |
| 조직 비활성화 | Owner만, 데이터 보존 30일 후 삭제 |

### 4.4 멀티 테넌시 정책

- 한 사용자가 **여러 조직**에 소속 가능 (컨텍스트 스위처)
- 조직별 데이터 **완전 격리** (D1 `organization_id` 필수 + RLS 패턴)
- Free: 조직 1개 / Pro: 조직 5개 (향후 과금 모델)

---

## 5. 일정·협업 기능 (상세)

### 5.1 캘린더

| 항목 | 요구사항 |
|------|----------|
| 뷰 | 월 / 주 / 일 / 아젠다 (모바일: 주·일 기본) |
| 일정 유형 | 회의, 마감, 휴가, 개인, 조직 이벤트 |
| 반복 | 일/주/월/년, RRULE subset |
| 참석자 | 멤버 지정, RSVP (참석/불참/미정) |
| 리마인더 | 5분/15분/1시간/1일 전 (Web Push) |
| 가시성 | Private / Team / Organization |
| 색상·태그 | 팀·프로젝트별 색상 |

### 5.2 업무(Task) 보드

- Kanban 보드 (팀·프로젝트 단위)
- 담당자, 마감일, 우선순위, 라벨
- 체크리스트, 댓글, @멘션
- 일정과 연동 (마감일 → 캘린더 표시)

### 5.3 협업 공통

- 댓글·멘션 (일정·업무)
- 활동 피드 (팀/조직)
- 알림 센터 (인앱 + Push)

---

## 6. 인증 — Google / Kakao 간편 가입

### 6.1 지원 방식

| 제공자 | 용도 | 필수 스코프 |
|--------|------|-------------|
| **Google** | 가입·로그인, (v1.1) Calendar 연동 | `openid`, `email`, `profile` |
| **Kakao** | 가입·로그인 (국내 사용자) | `profile_nickname`, `account_email` |

### 6.2 인증 플로우

```
[사용자] → [OAuth Provider] → [Pages Function /auth/callback]
    → D1 users + oauth_accounts upsert
    → JWT (HttpOnly Cookie) 발급
    → 온보딩 (조직 생성 or 초대 수락)
    → /dashboard
```

### 6.3 보안 요구사항

- Access Token: HttpOnly, Secure, SameSite=Lax 쿠키
- Refresh Token: D1 `sessions` 테이블, rotation 적용
- CSRF: OAuth state 파라미터 + double-submit cookie
- Kakao/Google Client Secret: Wrangler Secrets (`wrangler pages secret put`)
- 세션 만료: Access 15분, Refresh 30일 (슬라이딩)

### 6.4 계정 연결

- 동일 이메일 Google + Kakao → 계정 연결 UI 제공
- 이메일 미제공 시 (Kakao) → 온보딩에서 이메일 입력 요청

---

## 7. PWA — 모바일 최적화 (기본)

> 사용자 요청의 "PWG"는 **PWA(Progressive Web App)** 로 해석하여 정의한다.

### 7.1 PWA 필수 요건

| 항목 | 구현 |
|------|------|
| **Web App Manifest** | `name`, `short_name`, `icons` (192/512), `display: standalone`, `theme_color` |
| **Service Worker** | Workbox 기반, 정적 자산 precache, API stale-while-revalidate |
| **HTTPS** | Cloudflare Pages 기본 제공 |
| **설치 프롬프트** | `beforeinstallprompt` 커스텀 UI (Android/Desktop) |
| **iOS 대응** | `apple-touch-icon`, `apple-mobile-web-app-capable` meta |

### 7.2 모바일 UX 원칙

- **Mobile First** 디자인 (breakpoint: 320px ~)
- 하단 **탭 네비게이션**: 홈 · 캘린더 · 업무 · 알림 · 더보기
- 터치 타겟 최소 **44×44px**
- 스와이프: 캘린더 주간 이동, 업무 카드 액션
- **오프라인**: 최근 7일 일정·업무 로컬 캐시 (IndexedDB)
- **낙관적 UI**: 일정 생성·수정 즉시 반영, 백그라운드 동기화

### 7.3 Web Push 알림

- VAPID 키 (Workers/Pages Function에서 발급)
- 구독: 사용자 opt-in 후 `push_subscriptions` D1 저장
- 트리거: 일정 리마인더, @멘션, 초대, RSVP 변경

### 7.4 성능 목표 (모바일)

| 지표 | 목표 |
|------|------|
| LCP | < 2.5s (4G) |
| FID / INP | < 200ms |
| CLS | < 0.1 |
| TTI | < 3.5s |
| Lighthouse PWA | 90+ |

---

## 8. 비기능 요구사항

### 8.1 가용성·확장성

- Cloudflare 글로벌 엣지, Pages Functions auto-scale
- D1: 조직별 샤딩 검토 (10GB/DB 한도), MVP는 단일 DB + `organization_id`
- R2: 무제한 객체, CDN 캐시 via custom domain

### 8.2 보안·컴플라이언스

- 전 구간 HTTPS, CSP 헤더
- 조직 데이터 격리 (API 레벨 + 쿼리 필터)
- GDPR/개인정보보호법: 데이터 내보내기·삭제 API (v1.1)
- 감사 로그 90일 보관

### 8.3 접근성

- WCAG 2.1 AA 목표
- 키보드 네비게이션, 스크린 리더 라벨

### 8.4 지원 브라우저

- Chrome / Safari / Firefox / Edge (최신 2버전)
- iOS Safari 16+, Android Chrome 100+

---

## 9. 사용자 여정 (핵심)

### 9.1 신규 사용자 — 조직 생성

1. 랜딩 → "Google로 시작" / "카카오로 시작"
2. OAuth 완료 → 프로필 확인
3. "새 조직 만들기" → 조직명·타임존 입력
4. 팀 생성 (선택) → 멤버 초대
5. PWA 설치 안내 배너
6. 첫 일정 생성 가이드

### 9.2 초대받은 사용자

1. 초대 링크 클릭 → OAuth 로그인
2. 조직·팀 자동 배정
3. 팀 캘린더·보드 진입

---

## 10. 화면 목록 (IA)

| 영역 | 화면 |
|------|------|
| Public | 랜딩, 로그인, OAuth 콜백, 초대 수락 |
| App | 대시보드, 캘린더, 업무 보드, 알림, 검색 |
| Org | 조직 설정, 멤버, 부서·팀, 권한, 감사 로그 |
| User | 프로필, 연결된 계정, 알림 설정, PWA 설치 |
| Mobile | 동일 IA, 하단 탭 + FAB (일정/업무 추가) |

---

## 11. 데이터 모델 (개요)

> 상세 스키마는 `DEVELOPMENT_PLAN.md` 참조

- `users`, `oauth_accounts`, `sessions`
- `organizations`, `departments`, `teams`, `memberships`
- `events`, `event_attendees`, `event_recurrence`
- `tasks`, `task_comments`, `labels`
- `notifications`, `push_subscriptions`
- `files` (R2 key 메타)
- `audit_logs`

---

## 12. 릴리스 로드맵

| 단계 | 기간 | 산출물 |
|------|------|--------|
| **Phase 0** | 2주 | 아키텍처, DB 스키마, 디자인 시스템, CI/CD |
| **Phase 1 MVP** | 8주 | Auth, Org, Calendar, Task, PWA 기본 |
| **Phase 2** | 4주 | R2 파일, Push, 검색, iCal |
| **Phase 3** | 4주 | 외부 캘린더 연동, 대시보드, Pro 기능 |

---

## 13. 리스크 & 완화

| 리스크 | 영향 | 완화 |
|--------|------|------|
| D1 단일 DB 한도 | 성장 시 병목 | org_id 샤딩, Hyperdrive 검토 |
| Kakao 이메일 미제공 | 온보딩 이탈 | 닉네임+수동 이메일, 카카오 비즈 검토 |
| iOS PWA Push 제한 | 알림 UX 저하 | 인앱 알림 강화, APNs 네이티브 앱은 v2 |
| OAuth 보안 사고 | 치명적 | Secret rotation, state 검증, rate limit |

---

## 14. 용어 정의

| 용어 | 정의 |
|------|------|
| Organization | 최상위 테넌트 (회사·단체) |
| Team | Organization 내 협업 단위 |
| Event | 캘린더 일정 |
| Task | Kanban 업무 카드 |
| PWA | 브라우저 설치형 웹앱 |

---

## 15. 승인

| 역할 | 이름 | 일자 | 서명 |
|------|------|------|------|
| Product Owner | | | |
| Tech Lead | | | |
| Design | | | |
