# TeamCanvas — 고도화 로드맵 & 이어하기 가이드

> **버전:** 2.0  
> **최종 갱신:** 2026-06-10  
> **최신 커밋:** Sprint A 구현 후 갱신 예정  
> **프로덕션:** https://teamcanvas.pages.dev  
> **관련 문서:** [PRD](./PRD.md) · [개발 계획서](./DEVELOPMENT_PLAN.md) · [배포](./DEPLOY.md)

---

## 1. 이 문서의 목적

다음 세션에서 **어디서부터 이어갈지** 바로 판단할 수 있도록:

- 현재 구현 상태 스냅샷
- 단계별 고도화 계획 (우선순위·산출물·관련 파일)
- **다음 스프린트 작업 목록** (체크리스트 + 완료 기준)
- AI/개발자용 **이어하기 프롬프트** 템플릿

---

## 2. 현재 제품 성숙도 (2026-06-10)

### 2.1 완료된 핵심 기능 ✅

| 영역 | 상태 | 주요 파일 |
|------|------|-----------|
| 인증 (이메일·Google·Kakao·세션) | ✅ | `functions/auth/`, `LoginPage.tsx` |
| 조직·팀·부서·멤버·RBAC | ✅ | `MembersPage.tsx`, `permissions.ts` |
| 캘린더 (월/주/일/아젠다) | ✅ | `CalendarPage.tsx`, `MonthView.tsx` |
| 일정 CRUD·참석자·RSVP·댓글 | ✅ | `CreateEventModal.tsx`, `EventDetailSheet.tsx` |
| 일정 복사 | ✅ | `eventCopy.ts`, `CalendarPage.tsx` |
| 제외 날짜 (다일 종일) | ✅ | `EventExcludedDatesPicker.tsx`, migration `0013` |
| 제외 날짜 UI (월별 1뷰) | ✅ | `EventExcludedDatesPicker.tsx` (`058fc8f`) |
| 업무 Kanban·리스트·라벨·체크리스트 | ✅ | `TasksPage.tsx`, `TaskBoardView.tsx` |
| 시간 피커 (드럼·키보드 입력) | ✅ | `WheelPicker.tsx`, `EventDateTimePicker.tsx` |
| 검색·알림·iCal·Google 읽기 | ✅ | `SearchPage.tsx`, `GoogleCalendarPanel.tsx` |
| 구독·Stripe·관리자 콘솔 | ✅ | `subscriptions.ts`, `admin/*` |
| PWA manifest·설치 UI | ✅ | `vite.config.ts`, `PwaInstallBanner.tsx` |

### 2.2 부분 구현 / 갭 ⚠️

| 항목 | 현황 | 영향 |
|------|------|------|
| ~~**반복 일정 캘린더 표시**~~ | ✅ `recurrence.ts` 클라이언트 확장 | — |
| ~~**서버 리마인더 Cron**~~ | ✅ `_scheduled.ts` + `processDueReminders` | — |
| ~~**조직 활동 피드**~~ | ✅ `GET .../activity` + 대시보드 | — |
| **일정 공유 링크** | 미구현 (PRD Should) | 외부 공유 불가 |
| **Google Calendar 양방향** | 읽기만 | 쓰기 동기화 없음 |
| **멀티 조직** | UI만 (`OrgSwitcher`), API 1인 1조직 | 겸직·컨설턴트 미지원 |
| **오프라인** | `localStorage` 캐시만 | PRD IndexedDB 목표 미달 |
| **테스트** | Vitest/Playwright 계획만, 0 파일 | 회귀 위험 |
| **공개 랜딩** | `/` → 로그인 리다이렉트 | 성장 채널 없음 |
| **i18n** | 한국어 하드코딩 | 해외 확장 불가 |
| **KV 바인딩** | wrangler 미설정 | rate limit·OAuth state 미비 |

---

## 3. 고도화 로드맵 (4 Phase)

### Phase 1 — 신뢰도 & 일상 사용 (4~6주) 🔴 최우선

> 매일 쓰는 도구로 신뢰 — D7 리텐션 직결

| # | 기능 | 우선순위 | 예상 | 상태 |
|---|------|----------|------|------|
| 1.1 | 반복 일정 캘린더 확장 | P0 | 1.5주 | ✅ 완료 |
| 1.2 | 서버 Cron 리마인더 + Web Push | P0 | 1주 | ✅ 완료 |
| 1.3 | 일정 ↔ 업무 양방향 연결 | P1 | 0.5주 | ⬜ 미착수 |
| 1.4 | 조직 활동 피드 | P1 | 1주 | ✅ 완료 |

### Phase 2 — 협업 확장 (6~8주)

| # | 기능 | 우선순위 | 예상 | 상태 |
|---|------|----------|------|------|
| 2.1 | 일정 공유 링크 (읽기 전용) | P1 | 1주 | ⬜ |
| 2.2 | Google Calendar 양방향 (쓰기) | P2 | 2주 | ⬜ |
| 2.3 | 슬랙 / 카카오워크 웹훅 | P2 | 1.5주 | ⬜ |
| 2.4 | 멀티 조직 지원 (정책 결정 후) | P2 | 2주 | ⬜ |

### Phase 3 — 인사이트 & 관리 (8~10주)

| # | 기능 | 우선순위 | 예상 | 상태 |
|---|------|----------|------|------|
| 3.1 | 대시보드 위젯 (업무량·마감·휴가) | P2 | 1.5주 | ⬜ |
| 3.2 | 주간/월간 리포트 (CSV/PDF) | P3 | 2주 | ⬜ |
| 3.3 | AI 일정 제안 고도화 | P2 | 1.5주 | ⬜ |
| 3.4 | 감사 로그 검색·보존 (Enterprise) | P3 | 1주 | ⬜ |

### Phase 4 — 성장 & 품질 (병행 권장)

| # | 기능 | 우선순위 | 예상 | 상태 |
|---|------|----------|------|------|
| 4.1 | 공개 마케팅 랜딩 | P1 | 1주 | ⬜ |
| 4.2 | Vitest 단위 테스트 (날짜·RRULE) | P1 | 1주 | ⬜ |
| 4.3 | Playwright E2E (핵심 플로우) | P2 | 1.5주 | ⬜ |
| 4.4 | IndexedDB 오프라인 + Background Sync | P2 | 2주 | ⬜ |
| 4.5 | 보안 하드닝 (rate limit, CSP, PKCE) | P2 | 1주 | ⬜ |
| 4.6 | 다국어 (ko/en) | P3 | 2주 | ⬜ |

---

## 4. 다음 스프린트 — Sprint A (2주)

**목표:** Phase 1의 P0 두 가지 완료 — 반복 일정 + 서버 리마인더

### 4.1 Task A — 반복 일정 캘린더 확장 (P0)

#### 배경
- 저장 형식: `FREQ=DAILY|WEEKLY|MONTHLY` (간이 RRULE, `CreateEventModal.tsx`)
- `excluded_dates_json`과 함께 동작해야 함 (다일 종일 휴가 시나리오)
- Google 이벤트는 `recurrenceRule: null` — 확장 대상 아님

#### 구현 단계

- [x] **A-1.** `apps/web/src/lib/recurrence.ts` 신규
  - `expandRecurrence(event, rangeStart, rangeEnd): ExpandedOccurrence[]`
  - 입력: `startAt`, `endAt`, `allDay`, `recurrenceRule`, `excludedDates`
  - 출력: 가상 occurrence (`occurrenceKey`, `startAt`, `endAt`, `parentEventId`)
  - `FREQ=DAILY/WEEKLY/MONTHLY`만 지원 (현 UI와 동일)
  - `excludedDates`에 포함된 날짜 스킵

- [x] **A-2.** 캘린더 뷰 통합
  - `CalendarPage.tsx` — 이벤트 fetch 후 `expandRecurrence` 적용
  - `MonthView.tsx`, `TimeGridView.tsx`, `AgendaView.tsx` — 확장된 목록 소비
  - 반복 원본 1건 + occurrence N건 표시 (원본 ID 유지, `occurrenceDate` 메타)

- [x] **A-3.** 상세·수정 UX
  - occurrence 클릭 → `EventDetailSheet` (원본 이벤트 로드)
  - 반복 배지 유지 (`formatRecurrenceRule` in `dates.ts`)

- [x] **A-4.** API — 반복 일정 조회 쿼리 확장
  - 현재: 클라이언트 확장으로 시작 (범위 쿼리는 기존 `GET .../events?from=&to=` 유지)
  - 대량 반복 시: `functions/utils/recurrence.ts` 서버 확장 검토

- [ ] **A-5.** 테스트 (Vitest — Sprint B로 이연)
  - `apps/web/src/lib/recurrence.test.ts` — 주간 반복, 제외일, 월 경계

#### 완료 기준 (Acceptance Criteria)
1. 주간 반복 일정이 캘린더 월/주/일 뷰에 모든 occurrence로 표시됨
2. `excluded_dates_json` 날짜는 occurrence에서 제외됨
3. occurrence 클릭 시 원본 일정 상세가 열림
4. 비반복 일정 동작 회귀 없음
5. `npm run build` 통과

#### 관련 파일
```
apps/web/src/lib/recurrence.ts          ← 신규
apps/web/src/lib/dates.ts
apps/web/src/lib/eventExcludedDates.ts
apps/web/src/lib/eventTypes.ts          ← recurrenceFromRule
apps/web/src/pages/CalendarPage.tsx
apps/web/src/components/calendar/MonthView.tsx
apps/web/src/components/calendar/TimeGridView.tsx
apps/web/src/components/calendar/AgendaView.tsx
apps/web/src/components/modals/CreateEventModal.tsx
functions/api/[[path]].ts               ← events 조회 (변경 최소화)
```

---

### 4.2 Task B — 서버 Cron 리마인더 + Web Push (P0)

#### 배경
- `event_reminders` 테이블 존재 (migration 확인)
- `functions/utils/push.ts`, `push_subscriptions` — 인프라 있음
- `UpcomingRemindersPanel.tsx` — 클라이언트 폴링만

#### 구현 단계

- [x] **B-1.** Cron Worker 또는 Pages scheduled
  - `functions/cron/reminders.ts` 또는 별도 `workers/cron-reminders`
  - 5분마다: `remind_at <= now AND sent_at IS NULL` 조회
  - 인앱 `notifications` INSERT + Web Push 발송

- [x] **B-2.** `wrangler.jsonc` scheduled trigger 설정
  ```jsonc
  "triggers": { "crons": ["*/5 * * * *"] }
  ```

- [x] **B-3.** 리마인더 생성 로직 — 반복 일정 90일 occurrence 확장
  - 일정 생성/수정 시 `event_reminders` row 생성 확인 (`api/[[path]].ts`)
  - 반복 일정 연동: Task A 완료 후 occurrence별 remind_at 생성 검토

- [x] **B-4.** 알림 설정 연동 (`notification_preferences` 기존 활용)
  - `notification_preferences` — push 비활성 사용자 스킵
  - `NotificationSettingsPage.tsx` 채널 존중

- [ ] **B-5.** (선택) 이메일 리마인더
  - `functions/utils/email.ts` (Resend) 활용

#### 완료 기준
1. 일정 15분 전 리마인더가 앱 미실행 상태에서도 Web Push로 도착
2. 인앱 알림 센터에 동일 알림 기록
3. 이미 발송된 리마인더 중복 발송 없음 (`sent_at` 마킹)
4. 로컬 `wrangler dev` 또는 스테이징에서 Cron 수동 트리거 검증

#### 관련 파일
```
functions/utils/push.ts
functions/utils/notifications.ts
functions/api/[[path]].ts
apps/web/src/components/calendar/UpcomingRemindersPanel.tsx
apps/web/src/lib/pushClient.ts
wrangler.jsonc
migrations/*event_reminders*
```

---

### 4.3 Task C — 조직 활동 피드 (P1, Sprint A 여유 시)

- [x] **C-1.** API: `GET /api/organizations/:id/activity`
  - `audit_logs` + `task_activities` + 최근 `events`/`tasks` 생성 UNION
  - 페이지네이션 (cursor, 20건)

- [x] **C-2.** UI: `ActivityFeed.tsx` + `DashboardPage.tsx`
  - 아이콘·액터·시간·링크 (`?event=`, `?task=`)

- [x] **C-3.** 완료 기준: 대시보드에 최근 20건 활동 표시, 클릭 시 상세 이동

#### 관련 파일
```
functions/api/[[path]].ts
functions/utils/taskActivities.ts
apps/web/src/pages/DashboardPage.tsx
apps/web/src/components/dashboard/  ← 신규
```

---

## 5. Sprint B 이후 (참고 순서)

1. 일정 공유 링크 — `event_share_tokens` 테이블 + 공개 API
2. Google Calendar 쓰기 — `googleCalendar.ts` 확장
3. 공개 랜딩 — `LandingPage.tsx`, `/` 라우팅 분기
4. Vitest — `dates.ts`, `recurrence.ts`, `eventExcludedDates.ts`

---

## 6. 기술 결정 메모

| 주제 | 결정 | 근거 |
|------|------|------|
| 반복 확장 위치 | **클라이언트 우선** | MVP 범위·빠른 배포; 성능 이슈 시 서버 이전 |
| RRULE 범위 | DAILY/WEEKLY/MONTHLY만 | 현 UI·저장 형식과 일치 |
| Cron 호스팅 | Pages scheduled 또는 Worker | `DEVELOPMENT_PLAN.md` §1.3 참고 |
| 멀티 조직 | **보류** — PRD vs API 정합 필요 | 제품 결정 후 Sprint C |
| 테스트 | 반복·제외일 우선 | 최근 변경 영역 회귀 위험 최대 |

---

## 7. 로컬 개발 & 배포 (빠른 참조)

```bash
# 개발
npm run dev                    # Web :5173 + API :8788

# 빌드 검증
cd apps/web && npm run build

# DB 마이그레이션 (로컬)
npm run db:migrate:local

# Git (safe.directory 필요 시)
git -c safe.directory=D:/Program_DEV/TeamCanvas status
git -c safe.directory=D:/Program_DEV/TeamCanvas add .
git -c safe.directory=D:/Program_DEV/TeamCanvas commit -m "feat: ..." -m "..."
git -c safe.directory=D:/Program_DEV/TeamCanvas push origin main
# → main 푸시 시 GitHub Actions → teamcanvas.pages.dev 자동 배포
```

---

## 8. 다음 세션 이어하기 프롬프트

아래를 복사해 새 채팅에 붙여넣으면 바로 Sprint A를 이어갈 수 있습니다.

```
TeamCanvas 고도화 Sprint A를 이어서 진행해줘.

참고 문서: docs/ROADMAP.md (섹션 4 — Sprint A)
최신 커밋: 058fc8f

우선순위:
1. Task A — 반복 일정 캘린더 확장 (apps/web/src/lib/recurrence.ts 신규)
2. Task B — 서버 Cron 리마인더 + Web Push
3. (여유 시) Task C — 조직 활동 피드

각 Task 완료 기준은 ROADMAP.md Acceptance Criteria를 따르고,
완료 후 npm run build 검증하고 커밋·푸시·배포까지 해줘.
```

**한 기능만 먼저:**

```
docs/ROADMAP.md Task A(반복 일정 캘린더 확장)만 구현해줘.
체크리스트 A-1 ~ A-5 순서로 진행하고 완료 기준 충족 후 빌드·커밋해줘.
```

---

## 9. 변경 이력

| 날짜 | 버전 | 내용 |
|------|------|------|
| 2026-06-02 | 1.0 | `DEVELOPMENT_PLAN.md` 초안 (인프라·스키마 중심) |
| 2026-06-10 | 2.0 | `ROADMAP.md` 신규 — 구현 현황·Sprint A 상세·이어하기 가이드 |

---

## 10. 상태 갱신 방법

스프린트 완료 시 이 문서를 업데이트:

1. §2.2 갭 테이블 — 완료 항목을 §2.1로 이동
2. §3 로드맵 — `상태` 열 ✅ 갱신
3. §4 체크리스트 — `[x]` 표시
4. §9 변경 이력 — 날짜·커밋 해시 추가
5. §8 프롬프트 — `최신 커밋` 해시 갱신
