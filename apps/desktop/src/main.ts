/**
 * 데스크톱 셸용 최소 프론트엔드.
 * 실제 UI는 tauri.conf.json 의 windows[].url (프로덕션)을 로드합니다.
 * 개발 시 로컬 미리보기용으로만 사용됩니다.
 */
const APP_URL = "https://teamcanvas.pages.dev";

window.location.replace(APP_URL);
