# TeamCanvas Desktop (Windows)

웹 PWA를 감싼 **Tauri 2** 셸입니다. 창의 **X(닫기)** 는 앱을 종료하지 않고 **시스템 트레이**로 숨깁니다.

## 동작

| 동작 | 결과 |
|------|------|
| 창 X 클릭 | 창 숨김, 트레이에 상주 |
| 트레이 아이콘 클릭 | 창 다시 열기 |
| 트레이 메뉴 → 열기 | 창 다시 열기 |
| 트레이 메뉴 → 종료 | 프로세스 완전 종료 |

기본으로 `https://teamcanvas.pages.dev` 를 로드합니다.

## 사전 요구사항 (Windows)

1. [Rust](https://rustup.rs/) (`rustc`, `cargo`)
2. [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) — **Desktop development with C++**
3. WebView2 (Windows 10/11 기본 포함인 경우가 많음)
4. Node.js 20+

## 실행

```bash
cd apps/desktop
npm install
npm run icons          # 최초 1회: 트레이/앱 아이콘 생성
npm run desktop:dev    # 개발 실행
```

설치 파일 빌드:

```bash
npm run desktop:build
npm run desktop:publish-download   # 웹 홈 다운로드용으로 public/downloads 에 복사
```

산출물: `src-tauri/target/release/bundle/` (`nsis` / `msi`)  
## 업데이트 알림

설치형 앱은 시작 시(하루 1회) 및 트레이 메뉴 **업데이트 확인**으로
`https://teamcanvas.pages.dev/downloads/latest.json` 을 조회합니다.

새 버전이 있으면 Windows 알림 + 확인 대화상자가 뜨고, 동의하면 설치 파일을
받아 실행합니다.

```bash
npm run desktop:build
npm run desktop:publish-download -- -Notes "변경 요약"
# 이후 웹 배포(npm run deploy 또는 pages deploy)로 latest.json / Setup.exe 공개
```

## 루트에서

```bash
npm run desktop:dev
npm run desktop:build
```
