/** Windows 데스크톱 설치 파일 다운로드 설정 */

export const DESKTOP_APP_VERSION = "0.1.0";

/** 안정적인 공개 경로 (Vite public → Pages 루트) */
export const DESKTOP_SETUP_PATH = "/downloads/TeamCanvas-Setup.exe";

export function getDesktopDownloadUrl(): string {
  const fromEnv = import.meta.env.VITE_DESKTOP_WIN_URL as string | undefined;
  if (fromEnv?.trim()) return fromEnv.trim();
  return DESKTOP_SETUP_PATH;
}

/** Tauri 셸 안에서 실행 중인지 */
export function isDesktopShell(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

/** Windows 계열 UA (다운로드 안내 강조용) */
export function isLikelyWindows(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Windows|Win64|Win32/i.test(navigator.userAgent);
}
