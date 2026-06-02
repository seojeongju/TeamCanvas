# TeamCanvas Design System

> 참조: Clean Tech Blue · Glassmorphism · Soft UI (모바일 PWA)

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `sky-50` | `#F0F7FF` | 페이지 배경 그라데이션 시작 |
| `sky-100` | `#E3F0FC` | 보조 배경 |
| `sky-200` | `#B8D9F5` | 카드 hover, 구분선 |
| `primary-400` | `#4A9FE8` | CTA 버튼, 활성 아이콘 |
| `primary-500` | `#3B8AD9` | Primary 버튼 hover |
| `primary-600` | `#2563EB` | 링크, 강조 |
| `navy-700` | `#2D4A6F` | 본문 텍스트 |
| `navy-800` | `#1E3A5F` | 제목 |
| `navy-900` | `#0F2440` | Hero 텍스트 |
| `glass-white` | `rgba(255,255,255,0.72)` | Glass 카드 배경 |
| `glass-border` | `rgba(255,255,255,0.85)` | Glass 테두리 |

## Typography

- **Font:** Pretendard, -apple-system, system-ui, sans-serif
- **Display:** 28px / 700 — 페이지 타이틀
- **Heading:** 20px / 600 — 섹션 제목
- **Body:** 15px / 400 — 본문
- **Caption:** 13px / 400 — 보조 정보

## Radius & Shadow

- **Card:** `rounded-3xl` (24px)
- **Button:** `rounded-2xl` (16px)
- **Input:** `rounded-2xl`
- **Shadow soft:** `0 8px 32px rgba(30, 58, 95, 0.08)`
- **Shadow glow:** `0 4px 24px rgba(74, 159, 232, 0.25)`

## Glassmorphism

```css
background: rgba(255, 255, 255, 0.72);
backdrop-filter: blur(16px);
border: 1px solid rgba(255, 255, 255, 0.85);
```

## Components

- **GlassCard** — 정보 카드, 통계, 리스트 아이템
- **BottomNav** — 5탭 (홈·캘린더·업무·알림·더보기)
- **PrimaryButton** — solid blue, rounded-2xl
- **SocialButton** — Google/Kakao OAuth

## Mobile

- Touch target: min 44×44px
- Safe area: `env(safe-area-inset-*)`
- Bottom nav height: 72px + safe area
